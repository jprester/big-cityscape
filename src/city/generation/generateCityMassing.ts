import { createSeededRandom, deriveSeed, type SeededRandom } from '../../core/random';
import type {
  BuildingArchetype,
  BuildingDefinition,
  BuildingRole,
  CityMassingDefinition,
  MassingMaterialCategory,
} from '../model/cityMassing';
import {
  BUILDING_ARCHETYPES,
  MASSING_MATERIAL_CATEGORIES,
} from '../model/cityMassing';
import type { CityBlock, DistrictProfile, ProcessedCityBlocks } from '../model/cityBlocks';
import type { Point2 } from '../model/processedCity';
import {
  fitStreetAlignedRectangle,
  splitOrientedRectangle,
} from './blockPlacement';
import { createBuildingArchetype } from './archetypes/createBuildingArchetype';
import {
  CITY_MASSING_CONFIG,
  type CityMassingConfig,
  type DistrictMassingProfile,
} from './massingConfig';

const BUILDING_GAP_METRES = 7;

export function generateCityMassing(
  cityBlocks: ProcessedCityBlocks,
  config: CityMassingConfig = CITY_MASSING_CONFIG,
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

  for (const block of [...cityBlocks.blocks].sort((first, second) =>
    first.id.localeCompare(second.id),
  )) {
    const districtProfile = districtProfiles.get(block.districtId);

    if (districtProfile === undefined) {
      throw new Error(`Block "${block.id}" references an unknown district.`);
    }

    const profile = config.profiles[districtProfile];
    let placementZone: ReturnType<typeof fitStreetAlignedRectangle>;

    try {
      placementZone = fitStreetAlignedRectangle(block.buildablePolygon);
    } catch (error) {
      throw new Error(`Block "${block.id}" has no usable massing placement zone.`, {
        cause: error,
      });
    }
    const buildingCount = Math.max(
      1,
      Math.min(
        profile.maximumBuildingsPerBlock,
        Math.round(block.buildableAreaSquareMetres / profile.targetLotAreaSquareMetres),
      ),
    );
    const lots = splitOrientedRectangle(
      placementZone,
      buildingCount,
      BUILDING_GAP_METRES,
    );

    for (let lotIndex = 0; lotIndex < lots.length; lotIndex += 1) {
      const lot = lots[lotIndex];

      if (lot === undefined) {
        continue;
      }

      const buildingSeed = deriveSeed(config.seed, block.id, `building-${lotIndex + 1}`);
      const random = createSeededRandom(buildingSeed);
      const role = selectBuildingRole(
        block,
        lotIndex,
        buildingCount,
        block.id === landmarkBlock.id,
      );
      const archetype =
        role === 'landmark'
          ? 'stepped-tower'
          : selectWeightedArchetype(random, profile);
      const heightMetres = selectBuildingHeight(
        block.centroid,
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
      );

      buildings.push({
        id: `${block.id}/building-${lotIndex + 1}`,
        blockId: block.id,
        districtId: block.districtId,
        seed: buildingSeed,
        role,
        archetype,
        material,
        footprint: generatedArchetype.footprint,
        heightMetres,
        parts: generatedArchetype.parts,
      });
    }
  }

  const landmark = buildings.find((building) => building.role === 'landmark');

  if (landmark === undefined) {
    throw new Error('City massing did not produce its configured landmark.');
  }

  return {
    seed: config.seed >>> 0,
    buildings,
    metadata: {
      sourceBlocks: cityBlocks.blocks.length,
      buildings: buildings.length,
      primitiveParts: buildings.reduce(
        (total, building) => total + building.parts.length,
        0,
      ),
      landmarkBuildingId: landmark.id,
      minimumHeightMetres: Math.min(
        ...buildings.map((building) => building.heightMetres),
      ),
      maximumHeightMetres: Math.max(
        ...buildings.map((building) => building.heightMetres),
      ),
      countsByArchetype: countBy(
        BUILDING_ARCHETYPES,
        buildings.map((building) => building.archetype),
      ),
      countsByMaterial: countBy(
        MASSING_MATERIAL_CATEGORIES,
        buildings.map((building) => building.material),
      ),
    },
  };
}

function selectBuildingRole(
  block: CityBlock,
  lotIndex: number,
  buildingCount: number,
  landmarkBlock: boolean,
): BuildingRole {
  if (landmarkBlock && lotIndex === 0) {
    return 'landmark';
  }

  if (lotIndex === 0 && (buildingCount > 1 || block.buildableAreaSquareMetres >= 2_500)) {
    return 'anchor';
  }

  return 'background';
}

function selectWeightedArchetype(
  random: SeededRandom,
  profile: DistrictMassingProfile,
): BuildingArchetype {
  const totalWeight = profile.archetypes.reduce(
    (total, option) => total + option.weight,
    0,
  );

  if (
    totalWeight <= 0 ||
    profile.archetypes.some(
      (option) => !Number.isFinite(option.weight) || option.weight <= 0,
    )
  ) {
    throw new Error('A district massing profile requires a positive archetype weight.');
  }

  let selection = random.float(0, totalWeight);

  for (const option of profile.archetypes) {
    selection -= option.weight;

    if (selection <= 0) {
      return option.archetype;
    }
  }

  const fallback = profile.archetypes.at(-1)?.archetype;

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
  const [minimumHeight, maximumHeight] = profile.heightRangeMetres;
  const coherentHeight =
    minimumHeight +
    (maximumHeight - minimumHeight) * (0.2 + clusterInfluence * 0.8);
  const roleScale = role === 'anchor' ? 1.08 : 0.92;
  const variedHeight = coherentHeight * roleScale * random.float(0.88, 1.12);
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
