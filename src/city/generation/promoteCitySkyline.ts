import { createSeededRandom, deriveSeed } from '../../core/random';
import type {
  BuildingDefinition,
  BuildingMassPart,
} from '../model/cityMassing';
import type { DistrictProfile } from '../model/cityBlocks';
import type { Point2 } from '../model/processedCity';
import { sampleCityHeightField } from './cityHeightField';
import type { CityMassingConfig } from './massingConfig';

/**
 * Promotes the strongest planned tower sites after exclusions have been
 * applied. This creates an intentional skyline without adding scene-only
 * buildings or weakening road, rail, and water clearance rules.
 */
export function promoteCitySkyline(
  buildings: readonly BuildingDefinition[],
  districtProfiles: ReadonlyMap<string, DistrictProfile>,
  config: CityMassingConfig,
): BuildingDefinition[] {
  const rankedCandidates = rankCandidates(
    buildings,
    districtProfiles,
    config,
  );
  const skylineCandidates = rankedCandidates
    .filter(
      ({ building }) =>
        building.source === 'road-block' &&
        minimumFootprintDimension(building) >=
        config.skyline.minimumParcelDimensionMetres,
    )
    .slice(0, config.skyline.promotedTowerCount);
  const skylineBuildingIds = new Set(
    skylineCandidates.map(({ building }) => building.id),
  );
  const highRisePool = rankedCandidates
    .filter(
      ({ building }) =>
        building.source === 'road-block' &&
        !skylineBuildingIds.has(building.id) &&
        minimumFootprintDimension(building) >=
          config.highRise.minimumParcelDimensionMetres,
    );
  const centralHighRiseCandidates = highRisePool.slice(
    0,
    config.highRise.promotedBuildingCount,
  );
  const centralHighRiseBuildingIds = new Set(
    centralHighRiseCandidates.map(({ building }) => building.id),
  );
  const distributedHighRiseCandidates = selectDistributedCandidates(
    rankedCandidates.filter(
      ({ building }) =>
        !skylineBuildingIds.has(building.id) &&
        !centralHighRiseBuildingIds.has(building.id) &&
        minimumFootprintDimension(building) >=
          config.highRise.distributedMinimumParcelDimensionMetres,
    ),
    centralHighRiseCandidates,
    config.highRise.distributedBuildingCount,
    config.highRise.distributionCellSizeMetres,
  );
  const highRiseCandidates = [
    ...centralHighRiseCandidates,
    ...distributedHighRiseCandidates,
  ];
  const promotedHeights = new Map<string, number>();

  assignTierHeights(
    skylineCandidates,
    config.skyline.heightRangeMetres,
    config.seed,
    'skyscraper-height',
    promotedHeights,
  );
  assignTierHeights(
    highRiseCandidates,
    config.highRise.heightRangeMetres,
    config.seed,
    'high-rise-height',
    promotedHeights,
    config.highRise.maximumHeightToParcelRatio,
  );

  return buildings.map((building) => {
    const promotedHeight = promotedHeights.get(building.id);

    if (promotedHeight === undefined) {
      if (
        building.role !== 'landmark' &&
        building.heightMetres > config.highRise.heightRangeMetres[1]
      ) {
        return scaleBuildingHeight(
          building,
          config.highRise.heightRangeMetres[1],
        );
      }

      return building;
    }

    return scaleBuildingHeight(building, promotedHeight);
  });
}

function selectDistributedCandidates(
  candidates: readonly RankedCandidate[],
  centralCandidates: readonly RankedCandidate[],
  count: number,
  cellSizeMetres: number,
): RankedCandidate[] {
  const occupiedCells = new Set(
    centralCandidates.map(({ building }) =>
      distributionCellId(building, cellSizeMetres),
    ),
  );
  const bestByCell = new Map<string, RankedCandidate>();

  for (const candidate of candidates) {
    const cellId = distributionCellId(candidate.building, cellSizeMetres);

    if (occupiedCells.has(cellId) || bestByCell.has(cellId)) {
      continue;
    }

    bestByCell.set(cellId, candidate);
  }

  return Array.from(bestByCell.values())
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.building.id.localeCompare(second.building.id),
    )
    .slice(0, count);
}

function distributionCellId(
  building: BuildingDefinition,
  cellSizeMetres: number,
): string {
  const center = footprintCenter(building);
  return `${Math.floor(center[0] / cellSizeMetres)},${Math.floor(center[1] / cellSizeMetres)}`;
}

type RankedCandidate = Readonly<{
  building: BuildingDefinition;
  score: number;
}>;

function rankCandidates(
  buildings: readonly BuildingDefinition[],
  districtProfiles: ReadonlyMap<string, DistrictProfile>,
  config: CityMassingConfig,
): RankedCandidate[] {
  return buildings
    .filter((building) => building.role !== 'landmark')
    .map((building) => ({
      building,
      score: skylineScore(building, districtProfiles, config),
    }))
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.building.id.localeCompare(second.building.id),
    );
}

function assignTierHeights(
  candidates: readonly RankedCandidate[],
  heightRangeMetres: readonly [minimum: number, maximum: number],
  seed: number,
  seedLabel: string,
  promotedHeights: Map<string, number>,
  maximumHeightToParcelRatio?: number,
): void {
  const [minimumHeight, maximumHeight] = heightRangeMetres;
  const rankDivisor = Math.max(1, candidates.length - 1);

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];

    if (candidate === undefined) {
      continue;
    }

    const rankInfluence = 1 - index / rankDivisor;
    const plannedHeight =
      minimumHeight +
      (maximumHeight - minimumHeight) * Math.pow(rankInfluence, 0.7);
    const parcelMaximumHeight = maximumHeightToParcelRatio === undefined
      ? maximumHeight
      : Math.min(
          maximumHeight,
          minimumFootprintDimension(candidate.building) *
            maximumHeightToParcelRatio,
        );
    const random = createSeededRandom(
      deriveSeed(seed, candidate.building.id, seedLabel),
    );
    const variedHeight = plannedHeight * random.float(0.96, 1.05);
    promotedHeights.set(
      candidate.building.id,
      roundToTenth(clamp(variedHeight, minimumHeight, parcelMaximumHeight)),
    );
  }
}

function skylineScore(
  building: BuildingDefinition,
  districtProfiles: ReadonlyMap<string, DistrictProfile>,
  config: CityMassingConfig,
): number {
  const districtProfile = districtProfiles.get(building.districtId);

  if (districtProfile === undefined) {
    throw new Error(
      `Building "${building.id}" references an unknown skyline district.`,
    );
  }

  const center = footprintCenter(building);
  const fieldInfluence = sampleCityHeightField(
    center,
    config.profiles[districtProfile],
    config.heightField,
  );
  const roleBonus = building.role === 'anchor' ? 80 : 0;
  const parcelBonus = minimumFootprintDimension(building) * 1.5;

  return fieldInfluence * 1_000 + roleBonus + building.heightMetres + parcelBonus;
}

function scaleBuildingHeight(
  building: BuildingDefinition,
  heightMetres: number,
): BuildingDefinition {
  const scale = heightMetres / building.heightMetres;

  return {
    ...building,
    heightMetres,
    parts: building.parts.map((part) => scalePartHeight(part, scale)),
  };
}

function scalePartHeight(
  part: BuildingMassPart,
  scale: number,
): BuildingMassPart {
  return {
    ...part,
    baseHeightMetres: part.baseHeightMetres * scale,
    heightMetres: part.heightMetres * scale,
  };
}

function minimumFootprintDimension(building: BuildingDefinition): number {
  const first = building.footprint[0];
  const second = building.footprint[1];
  const third = building.footprint[2];

  if (first === undefined || second === undefined || third === undefined) {
    return 0;
  }

  return Math.min(distance(first, second), distance(second, third));
}

function footprintCenter(building: BuildingDefinition): Point2 {
  const total = building.footprint.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]] as Point2,
    [0, 0] as Point2,
  );
  return [total[0] / building.footprint.length, total[1] / building.footprint.length];
}

function distance(first: Point2, second: Point2): number {
  return Math.hypot(second[0] - first[0], second[1] - first[1]);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
