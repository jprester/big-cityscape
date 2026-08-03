import type { BuildingDefinition } from '../model/cityMassing';
import type { Point2 } from '../model/processedCity';
import { minimumPolygonDistance } from './generateResidualFabric';

export type TallBuildingClearanceConfig = Readonly<{
  minimumHeightMetres: number;
  minimumSetbackMetres: number;
  maximumSetbackMetres: number;
  heightToSetbackRatio: number;
}>;

type FootprintBounds = Readonly<{
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}>;

/**
 * Gives taller buildings a deterministic setback by removing lower neighbors.
 * This changes semantic city definitions before chunking and rendering, so the
 * cleared space remains consistent across every debug and model layer.
 */
export function enforceTallBuildingClearance(
  buildings: readonly BuildingDefinition[],
  config: TallBuildingClearanceConfig,
): BuildingDefinition[] {
  validateConfig(config);

  const rankedTallBuildings = buildings
    .filter((building) => building.heightMetres >= config.minimumHeightMetres)
    .sort(
      (first, second) =>
        second.heightMetres - first.heightMetres ||
        first.id.localeCompare(second.id),
    );
  const boundsById = new Map(
    buildings.map((building) => [building.id, footprintBounds(building.footprint)]),
  );
  const removedBuildingIds = new Set<string>();

  for (const tower of rankedTallBuildings) {
    if (removedBuildingIds.has(tower.id)) {
      continue;
    }

    const towerBounds = boundsById.get(tower.id);

    if (towerBounds === undefined) {
      continue;
    }

    const setbackMetres = clamp(
      tower.heightMetres * config.heightToSetbackRatio,
      config.minimumSetbackMetres,
      config.maximumSetbackMetres,
    );

    for (const candidate of buildings) {
      if (
        candidate.id === tower.id ||
        removedBuildingIds.has(candidate.id) ||
        outranks(candidate, tower)
      ) {
        continue;
      }

      const candidateBounds = boundsById.get(candidate.id);

      if (
        candidateBounds === undefined ||
        boundsDistance(towerBounds, candidateBounds) >= setbackMetres
      ) {
        continue;
      }

      if (
        minimumPolygonDistance(tower.footprint, candidate.footprint) <
        setbackMetres
      ) {
        removedBuildingIds.add(candidate.id);
      }
    }
  }

  return buildings.filter((building) => !removedBuildingIds.has(building.id));
}

function outranks(
  candidate: BuildingDefinition,
  tower: BuildingDefinition,
): boolean {
  return (
    candidate.heightMetres > tower.heightMetres ||
    (candidate.heightMetres === tower.heightMetres &&
      candidate.id.localeCompare(tower.id) < 0)
  );
}

function footprintBounds(points: readonly Point2[]): FootprintBounds {
  return points.reduce<FootprintBounds>(
    (bounds, [x, z]) => ({
      minX: Math.min(bounds.minX, x),
      minZ: Math.min(bounds.minZ, z),
      maxX: Math.max(bounds.maxX, x),
      maxZ: Math.max(bounds.maxZ, z),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    },
  );
}

function boundsDistance(
  first: FootprintBounds,
  second: FootprintBounds,
): number {
  const gapX = Math.max(0, first.minX - second.maxX, second.minX - first.maxX);
  const gapZ = Math.max(0, first.minZ - second.maxZ, second.minZ - first.maxZ);
  return Math.hypot(gapX, gapZ);
}

function validateConfig(config: TallBuildingClearanceConfig): void {
  const values = [
    config.minimumHeightMetres,
    config.minimumSetbackMetres,
    config.maximumSetbackMetres,
    config.heightToSetbackRatio,
  ];

  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('Tall-building clearance values must be finite and non-negative.');
  }

  if (config.maximumSetbackMetres < config.minimumSetbackMetres) {
    throw new RangeError(
      'Tall-building maximum setback cannot be smaller than its minimum setback.',
    );
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
