import { createSeededRandom, deriveSeed, type SeededRandom } from '../../core/random';
import type {
  BuildingArchetype,
  BuildingDefinition,
  BuildingRole,
  CityMassingDefinition,
  MassingMaterialCategory,
} from '../model/cityMassing';
import {
  BUILDING_SOURCES,
  BUILDING_ARCHETYPES,
  MASSING_MATERIAL_CATEGORIES,
} from '../model/cityMassing';
import type {
  BuildableRegion,
  CityBlock,
  DistrictProfile,
  ProcessedCityBlocks,
} from '../model/cityBlocks';
import type { Point2, RoadClass, RoadPath } from '../model/processedCity';
import type { ResidualFabricDefinition } from '../model/residualFabric';
import {
  fitStreetAlignedRectangle,
  MINIMUM_PLACEMENT_DIMENSION_METRES,
  type OrientedRectangle,
  splitOrientedRectangle,
} from './blockPlacement';
import { createBuildingArchetype } from './archetypes/createBuildingArchetype';
import { createRoadClearancePredicate } from './generateResidualFabric';
import {
  CITY_MASSING_CONFIG,
  type CityMassingConfig,
  type DistrictMassingProfile,
  type WeightedArchetype,
} from './massingConfig';

const BUILDING_GAP_METRES = 7;
const BUILDING_ROAD_CLEARANCE_METRES: Readonly<Record<RoadClass, number>> = {
  motorway: 8,
  trunk: 7.5,
  primary: 7.5,
  secondary: 6,
  tertiary: 5.5,
  local: 4.5,
  pedestrian: 3.5,
};

export function generateCityMassing(
  cityBlocks: ProcessedCityBlocks,
  config: CityMassingConfig = CITY_MASSING_CONFIG,
  residualFabric?: ResidualFabricDefinition,
  roadExclusions: readonly RoadPath[] = [],
): CityMassingDefinition {
  if (!Number.isSafeInteger(config.seed)) {
    throw new RangeError('The city massing seed must be a safe integer.');
  }

  const districtProfiles = new Map<string, DistrictProfile>();

  for (const district of cityBlocks.districts) {
    districtProfiles.set(district.id, district.profile);
  }

  const landmarkBlock = [...cityBlocks.blocks]
    .filter((block) => block.districtId === config.landmark.districtId)
    .sort(
      (first, second) =>
        second.buildableAreaSquareMetres - first.buildableAreaSquareMetres ||
        first.id.localeCompare(second.id),
    )[0];

  if (landmarkBlock === undefined) {
    throw new Error(
      `The landmark district "${config.landmark.districtId}" has no buildable block.`,
    );
  }

  const buildings: BuildingDefinition[] = [];
  const populatedRegionIds = new Set<string>();
  let skippedRegions = 0;

  for (const block of [...cityBlocks.blocks].sort((first, second) =>
    first.id.localeCompare(second.id),
  )) {
    const districtProfile = districtProfiles.get(block.districtId);

    if (districtProfile === undefined) {
      throw new Error(`Block "${block.id}" references an unknown district.`);
    }

    const profile = config.profiles[districtProfile];
    const anchorRegion = selectAnchorRegion(block);

    for (const region of [...block.buildableRegions].sort((first, second) =>
      first.id.localeCompare(second.id),
    )) {
      let placementZone: OrientedRectangle;

      try {
        placementZone = fitStreetAlignedRectangle(region.polygon);
      } catch {
        skippedRegions += 1;
        continue;
      }

      const landmarkRegion =
        block.id === landmarkBlock.id && region.id === anchorRegion.id;
      const requestedBuildingCount = landmarkRegion
        ? 1
        : Math.max(
            1,
            Math.min(
              profile.maximumBuildingsPerRegion,
              Math.round(
                region.areaSquareMetres / profile.targetLotAreaSquareMetres,
              ),
            ),
          );
      const lots = createUsableLots(placementZone, requestedBuildingCount);
      populatedRegionIds.add(region.id);

      for (let lotIndex = 0; lotIndex < lots.length; lotIndex += 1) {
        const lot = lots[lotIndex];

        if (lot === undefined) {
          continue;
        }

        const buildingSeed = deriveSeed(
          config.seed,
          block.id,
          region.id,
          `building-${lotIndex + 1}`,
        );
        const random = createSeededRandom(buildingSeed);
        const role = selectBuildingRole(
          region.id === anchorRegion.id,
          lotIndex,
          block.id === landmarkBlock.id,
        );
        const archetype =
          role === 'landmark'
            ? 'stepped-tower'
            : selectWeightedArchetype(
                random,
                role === 'anchor'
                  ? profile.anchorArchetypes
                  : profile.backgroundArchetypes,
              );
        const heightMetres = selectBuildingHeight(
          region.centroid,
          Math.min(lot.widthMetres, lot.depthMetres),
          role,
          profile,
          config.landmark.heightMetres,
          random,
        );
        const material = selectMaterial(districtProfile, role, random);
        const generatedArchetype = createBuildingArchetype(
          lot,
          archetype,
          heightMetres,
          random,
          { preserveHeight: role === 'landmark' },
        );

        buildings.push({
          id: `${region.id}/building-${lotIndex + 1}`,
          source: 'road-block',
          blockId: block.id,
          regionId: region.id,
          districtId: block.districtId,
          seed: buildingSeed,
          role,
          archetype,
          material,
          footprint: generatedArchetype.footprint,
          heightMetres: generatedArchetype.heightMetres,
          parts: generatedArchetype.parts,
        });
      }
    }
  }

  for (const lot of residualFabric?.lots ?? []) {
    const districtProfile = districtProfiles.get(lot.districtId);

    if (districtProfile === undefined) {
      throw new Error(
        `Residual fabric lot "${lot.id}" references an unknown district.`,
      );
    }

    const profile = config.profiles[districtProfile];
    const buildingSeed = deriveSeed(config.seed, lot.id, 'building-1');
    const random = createSeededRandom(buildingSeed);
    const archetype = selectWeightedArchetype(
      random,
      profile.fabricArchetypes,
    );
    const heightMetres = selectFabricHeight(
      lot.center,
      profile,
      random,
    );
    const generatedArchetype = createBuildingArchetype(
      lot,
      archetype,
      heightMetres,
      random,
    );

    buildings.push({
      id: `${lot.id}/building-1`,
      source: 'residual-fabric',
      blockId: `fabric:${lot.districtId}`,
      regionId: lot.id,
      districtId: lot.districtId,
      seed: buildingSeed,
      role: 'background',
      archetype,
      material: selectMaterial(districtProfile, 'background', random),
      footprint: generatedArchetype.footprint,
      heightMetres: generatedArchetype.heightMetres,
      parts: generatedArchetype.parts,
    });
  }

  const footprintClearsRoads = createRoadClearancePredicate(
    roadExclusions,
    BUILDING_ROAD_CLEARANCE_METRES,
  );
  const clearedBuildings = buildings.filter((building) =>
    footprintClearsRoads(building.footprint),
  );
  clearedBuildings.sort((first, second) => first.id.localeCompare(second.id));

  const landmark = clearedBuildings.find(
    (building) => building.role === 'landmark',
  );

  if (landmark === undefined) {
    throw new Error('City massing did not produce its configured landmark.');
  }

  return {
    seed: config.seed >>> 0,
    buildings: clearedBuildings,
    metadata: {
      sourceBlocks: cityBlocks.blocks.length,
      sourceRegions: cityBlocks.blocks.reduce(
        (total, block) => total + block.buildableRegions.length,
        0,
      ),
      sourceFabricLots: residualFabric?.lots.length ?? 0,
      populatedRegions: populatedRegionIds.size,
      skippedRegions,
      buildings: clearedBuildings.length,
      primitiveParts: clearedBuildings.reduce(
        (total, building) => total + building.parts.length,
        0,
      ),
      landmarkBuildingId: landmark.id,
      minimumHeightMetres: Math.min(
        ...clearedBuildings.map((building) => building.heightMetres),
      ),
      maximumHeightMetres: Math.max(
        ...clearedBuildings.map((building) => building.heightMetres),
      ),
      countsByArchetype: countBy(
        BUILDING_ARCHETYPES,
        clearedBuildings.map((building) => building.archetype),
      ),
      countsByMaterial: countBy(
        MASSING_MATERIAL_CATEGORIES,
        clearedBuildings.map((building) => building.material),
      ),
      countsBySource: countBy(
        BUILDING_SOURCES,
        clearedBuildings.map((building) => building.source),
      ),
    },
  };
}

function selectAnchorRegion(block: CityBlock): BuildableRegion {
  const region = [...block.buildableRegions].sort(
    (first, second) =>
      second.areaSquareMetres - first.areaSquareMetres ||
      first.id.localeCompare(second.id),
  )[0];

  if (region === undefined) {
    throw new Error(`Block "${block.id}" has no buildable regions.`);
  }

  return region;
}

function createUsableLots(
  placementZone: OrientedRectangle,
  requestedCount: number,
): readonly OrientedRectangle[] {
  for (let count = requestedCount; count >= 1; count -= 1) {
    const lots = splitOrientedRectangle(
      placementZone,
      count,
      BUILDING_GAP_METRES,
    );

    if (
      lots.every(
        (lot) =>
          lot.widthMetres >= MINIMUM_PLACEMENT_DIMENSION_METRES &&
          lot.depthMetres >= MINIMUM_PLACEMENT_DIMENSION_METRES,
      )
    ) {
      return lots;
    }
  }

  return [placementZone];
}

function selectBuildingRole(
  anchorRegion: boolean,
  lotIndex: number,
  landmarkBlock: boolean,
): BuildingRole {
  if (landmarkBlock && anchorRegion && lotIndex === 0) {
    return 'landmark';
  }

  if (anchorRegion && lotIndex === 0) {
    return 'anchor';
  }

  return 'background';
}

function selectWeightedArchetype(
  random: SeededRandom,
  archetypes: readonly WeightedArchetype[],
): BuildingArchetype {
  const totalWeight = archetypes.reduce(
    (total, option) => total + option.weight,
    0,
  );

  if (
    totalWeight <= 0 ||
    archetypes.some(
      (option) => !Number.isFinite(option.weight) || option.weight <= 0,
    )
  ) {
    throw new Error('A district massing profile requires a positive archetype weight.');
  }

  let selection = random.float(0, totalWeight);

  for (const option of archetypes) {
    selection -= option.weight;

    if (selection <= 0) {
      return option.archetype;
    }
  }

  const fallback = archetypes.at(-1)?.archetype;

  if (fallback === undefined) {
    throw new Error('A district massing profile requires at least one archetype.');
  }

  return fallback;
}

function selectBuildingHeight(
  centroid: Point2,
  lotMinorDimensionMetres: number,
  role: BuildingRole,
  profile: DistrictMassingProfile,
  landmarkHeightMetres: number,
  random: SeededRandom,
): number {
  if (role === 'landmark') {
    return landmarkHeightMetres;
  }

  const distanceToCluster = Math.hypot(
    centroid[0] - profile.clusterCenter[0],
    centroid[1] - profile.clusterCenter[1],
  );
  const clusterInfluence = clamp(
    1 - distanceToCluster / profile.clusterRadiusMetres,
    0,
    1,
  );
  const [minimumHeight, maximumHeight] =
    role === 'anchor'
      ? profile.anchorHeightRangeMetres
      : profile.backgroundHeightRangeMetres;
  const coherentHeight =
    minimumHeight +
    (maximumHeight - minimumHeight) * (0.2 + clusterInfluence * 0.8);
  const variedHeight = coherentHeight * random.float(0.88, 1.12);
  const constrainedParcelMinimum = minimumHeight * 0.65;
  const parcelCapacityHeight = Math.max(
    constrainedParcelMinimum,
    lotMinorDimensionMetres * 8,
  );

  return roundToTenth(
    clamp(
      Math.min(variedHeight, parcelCapacityHeight),
      constrainedParcelMinimum,
      maximumHeight,
    ),
  );
}

function selectFabricHeight(
  center: Point2,
  profile: DistrictMassingProfile,
  random: SeededRandom,
): number {
  const [minimumHeight, maximumHeight] = profile.fabricHeightRangeMetres;
  const distanceToCluster = Math.hypot(
    center[0] - profile.clusterCenter[0],
    center[1] - profile.clusterCenter[1],
  );
  const clusterInfluence = clamp(
    1 - distanceToCluster / profile.clusterRadiusMetres,
    0,
    1,
  );
  const coherentHeight =
    minimumHeight +
    (maximumHeight - minimumHeight) * (0.15 + clusterInfluence * 0.55);

  return roundToTenth(
    clamp(
      coherentHeight * random.float(0.82, 1.18),
      minimumHeight,
      maximumHeight,
    ),
  );
}

function selectMaterial(
  districtProfile: DistrictProfile,
  role: BuildingRole,
  random: SeededRandom,
): MassingMaterialCategory {
  if (role === 'landmark') {
    return 'landmark';
  }

  if (districtProfile === 'dense-mixed' || districtProfile === 'infrastructure-edge') {
    return 'mixed-use';
  }

  return random.next() < 0.82 ? 'commercial' : 'mixed-use';
}

function countBy<const Key extends string>(
  keys: readonly Key[],
  values: readonly Key[],
): Record<Key, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;

  for (const value of values) {
    counts[value] += 1;
  }

  return counts;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
