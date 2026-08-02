import { createSeededRandom, deriveSeed } from '../../core/random';
import type {
  LocalBounds,
  Point2,
  ProcessedCityStructure,
  RoadClass,
  RoadPath,
} from '../model/processedCity';
import type {
  ResidualFabricDefinition,
  ResidualFabricDiscardReason,
  ResidualFabricLot,
} from '../model/residualFabric';
import { orientedRectangleCorners, type OrientedRectangle } from './blockPlacement';

const EPSILON = 1e-7;

export type ResidualFabricConfig = Readonly<{
  gridSpacingMetres: number;
  coverageProbability: number;
  widthRangeMetres: readonly [minimum: number, maximum: number];
  depthRangeMetres: readonly [minimum: number, maximum: number];
  railClearanceMetres: number;
  waterClearanceMetres: number;
  roadClearanceMetres: Readonly<Record<RoadClass, number>>;
}>;

export const RESIDUAL_FABRIC_CONFIG: ResidualFabricConfig = {
  gridSpacingMetres: 12,
  coverageProbability: 1,
  widthRangeMetres: [5, 7],
  depthRangeMetres: [7, 9],
  railClearanceMetres: 14,
  waterClearanceMetres: 10,
  roadClearanceMetres: {
    motorway: 16,
    trunk: 14,
    primary: 12,
    secondary: 10,
    tertiary: 8,
    local: 5,
    pedestrian: 4,
  },
};

type PathSegment = Readonly<{
  start: Point2;
  end: Point2;
  rotationRadians: number;
  clearanceMetres: number;
}>;

type Bounds2 = Readonly<{
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}>;

type SegmentIndex = Readonly<{
  cellSizeMetres: number;
  maximumClearanceMetres: number;
  buckets: ReadonlyMap<string, readonly PathSegment[]>;
}>;

type PolygonIndex = Readonly<{
  cellSizeMetres: number;
  buckets: ReadonlyMap<string, readonly (readonly Point2[])[]>;
}>;

export function createRoadClearancePredicate(
  roads: readonly RoadPath[],
  clearances: Readonly<Record<RoadClass, number>>,
): (footprint: readonly Point2[]) => boolean {
  const segments = roads
    .filter((road) => !road.tunnel)
    .flatMap((road) =>
      createPathSegments(road.paths, clearances[road.class]),
    )
    .sort(compareSegments);
  const index = createSegmentIndex(segments);

  return (footprint) => !violatesSegmentClearance(footprint, index);
}

export function generateResidualFabric(
  city: ProcessedCityStructure,
  occupiedFootprints: readonly (readonly Point2[])[],
  seed: number,
  config: ResidualFabricConfig = RESIDUAL_FABRIC_CONFIG,
): ResidualFabricDefinition {
  validateConfig(config);

  if (!Number.isSafeInteger(seed)) {
    throw new RangeError('The residual-fabric seed must be a safe integer.');
  }

  const roadSegments = city.roads
    // Buildings have no vertical occupancy model yet, so every visible road
    // corridor is a plan-view exclusion. Allowing lots below a 6–9 m deck lets
    // even modest primitive buildings pierce the carriageway.
    .filter((road) => !road.tunnel)
    .flatMap((road) =>
      createPathSegments(
        road.paths,
        config.roadClearanceMetres[road.class],
      ),
    )
    .sort(compareSegments);
  const railSegments = city.railways.flatMap((railway) =>
    createPathSegments(railway.paths, config.railClearanceMetres),
  ).sort(compareSegments);
  const roadIndex = createSegmentIndex(roadSegments);
  const railIndex = createSegmentIndex(railSegments);
  const occupiedIndex = createPolygonIndex(
    occupiedFootprints.map((footprint) => footprint.map(roundPoint)),
  );
  const discardedByReason = createDiscardCounts();
  const lots: ResidualFabricLot[] = [];
  let candidates = 0;
  const spacing = config.gridSpacingMetres;
  const minimumGridX = Math.ceil(city.metadata.clip.bounds.minX / spacing);
  const maximumGridX = Math.floor(city.metadata.clip.bounds.maxX / spacing);
  const minimumGridZ = Math.ceil(city.metadata.clip.bounds.minZ / spacing);
  const maximumGridZ = Math.floor(city.metadata.clip.bounds.maxZ / spacing);

  for (let gridZ = minimumGridZ; gridZ <= maximumGridZ; gridZ += 1) {
    for (let gridX = minimumGridX; gridX <= maximumGridX; gridX += 1) {
      candidates += 1;
      const center: Point2 = [gridX * spacing, gridZ * spacing];
      const lotSeed = deriveSeed(seed, 'residual-fabric', `${gridX},${gridZ}`);
      const random = createSeededRandom(lotSeed);

      if (random.next() > config.coverageProbability) {
        discardedByReason.coverage += 1;
        continue;
      }

      const nearestRoad = findNearestSegment(
        center,
        querySegmentIndex(roadIndex, expandPoint(center, 120)),
      );
      const rotationRadians = roundToMillionth(
        nearestRoad?.rotationRadians ?? 0,
      );
      const placement: OrientedRectangle = {
        center,
        widthMetres: random.float(...config.widthRangeMetres),
        depthMetres: random.float(...config.depthRangeMetres),
        rotationRadians,
      };
      const footprint = orientedRectangleCorners(placement).map(roundPoint);
      if (!footprint.every((point) => pointInBounds(point, city.metadata.clip.bounds))) {
        discardedByReason.bounds += 1;
        continue;
      }

      if (
        violatesSegmentClearance(footprint, roadIndex)
      ) {
        discardedByReason.roadClearance += 1;
        continue;
      }

      if (
        violatesSegmentClearance(footprint, railIndex)
      ) {
        discardedByReason.railClearance += 1;
        continue;
      }

      if (
        city.waterRegions.some((region) =>
          region.rings.some(
            (ring) =>
              roundToHundredth(minimumPolygonDistance(footprint, ring)) <
              config.waterClearanceMetres,
          ),
        )
      ) {
        discardedByReason.waterClearance += 1;
        continue;
      }

      if (
        queryPolygonIndex(occupiedIndex, polygonBounds(footprint)).some(
          (occupied) =>
            roundToHundredth(
              minimumPolygonDistance(footprint, occupied),
            ) < 0.1,
        )
      ) {
        discardedByReason.existingBuilding += 1;
        continue;
      }

      lots.push({
        id: `fabric-x${encodeGridIndex(gridX)}-z${encodeGridIndex(gridZ)}`,
        districtId: assignDistrict(center),
        center,
        widthMetres: roundToHundredth(placement.widthMetres),
        depthMetres: roundToHundredth(placement.depthMetres),
        rotationRadians,
        footprint,
      });
    }
  }

  lots.sort((first, second) => first.id.localeCompare(second.id));

  const discardedCandidates = Object.values(discardedByReason).reduce(
    (total, count) => total + count,
    0,
  );

  if (lots.length + discardedCandidates !== candidates) {
    throw new Error('Residual-fabric candidate accounting is inconsistent.');
  }

  return {
    seed: seed >>> 0,
    lots,
    metadata: {
      gridSpacingMetres: spacing,
      candidates,
      lots: lots.length,
      discardedCandidates,
      discardedByReason,
    },
  };
}

function validateConfig(config: ResidualFabricConfig): void {
  if (!Number.isFinite(config.gridSpacingMetres) || config.gridSpacingMetres <= 0) {
    throw new RangeError('Residual-fabric grid spacing must be positive.');
  }

  if (
    !Number.isFinite(config.coverageProbability) ||
    config.coverageProbability < 0 ||
    config.coverageProbability > 1
  ) {
    throw new RangeError('Residual-fabric coverage probability must be in [0, 1].');
  }

  for (const [minimum, maximum] of [
    config.widthRangeMetres,
    config.depthRangeMetres,
  ]) {
    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum <= 0 ||
      maximum < minimum
    ) {
      throw new RangeError('Residual-fabric dimensions must be positive ranges.');
    }
  }

  const maximumRadius = Math.hypot(
    config.widthRangeMetres[1],
    config.depthRangeMetres[1],
  ) / 2;

  if (maximumRadius * 2 >= config.gridSpacingMetres) {
    throw new RangeError(
      'Residual-fabric footprints must fit inside the grid without overlap.',
    );
  }

  const clearances = [
    config.railClearanceMetres,
    config.waterClearanceMetres,
    ...Object.values(config.roadClearanceMetres),
  ];

  if (
    clearances.some(
      (clearance) => !Number.isFinite(clearance) || clearance < 0,
    )
  ) {
    throw new RangeError('Residual-fabric clearances must be finite and non-negative.');
  }
}

function createDiscardCounts(): Record<ResidualFabricDiscardReason, number> {
  return {
    bounds: 0,
    coverage: 0,
    roadClearance: 0,
    railClearance: 0,
    waterClearance: 0,
    existingBuilding: 0,
  };
}

function createPathSegments(
  paths: readonly (readonly Point2[])[],
  clearanceMetres: number,
): readonly PathSegment[] {
  return paths.flatMap((path) =>
    path.slice(1).flatMap((end, index) => {
      const start = path[index];

      if (start === undefined || pointsEqual(start, end)) {
        return [];
      }

      return [
        {
          start,
          end,
          rotationRadians: Math.atan2(end[1] - start[1], end[0] - start[0]),
          clearanceMetres,
        },
      ];
    }),
  );
}

function findNearestSegment(
  point: Point2,
  segments: readonly PathSegment[],
): (PathSegment & Readonly<{ distanceMetres: number }>) | undefined {
  let nearest: (PathSegment & Readonly<{ distanceMetres: number }>) | undefined;

  for (const segment of segments) {
    const distanceMetres = roundToHundredth(
      pointSegmentDistance(point, segment.start, segment.end),
    );

    if (
      nearest === undefined ||
      distanceMetres < nearest.distanceMetres - EPSILON ||
      (Math.abs(distanceMetres - nearest.distanceMetres) <= EPSILON &&
        compareSegments(segment, nearest) < 0)
    ) {
      nearest = { ...segment, distanceMetres };
    }
  }

  return nearest;
}

function violatesSegmentClearance(
  polygon: readonly Point2[],
  index: SegmentIndex,
): boolean {
  const bounds = expandBounds(
    polygonBounds(polygon),
    index.maximumClearanceMetres,
  );

  return querySegmentIndex(index, bounds).some(
    (segment) =>
      roundToHundredth(
        minimumPolygonSegmentDistance(polygon, segment.start, segment.end),
      ) <
      segment.clearanceMetres,
  );
}

function createSegmentIndex(
  segments: readonly PathSegment[],
  cellSizeMetres = 64,
): SegmentIndex {
  const buckets = new Map<string, PathSegment[]>();

  for (const segment of segments) {
    const bounds = segmentBounds(segment);
    const minimumCellX = Math.floor(bounds.minX / cellSizeMetres);
    const maximumCellX = Math.floor(bounds.maxX / cellSizeMetres);
    const minimumCellZ = Math.floor(bounds.minZ / cellSizeMetres);
    const maximumCellZ = Math.floor(bounds.maxZ / cellSizeMetres);

    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ += 1) {
      for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
        const key = `${cellX},${cellZ}`;
        const bucket = buckets.get(key);

        if (bucket === undefined) {
          buckets.set(key, [segment]);
        } else {
          bucket.push(segment);
        }
      }
    }
  }

  return {
    cellSizeMetres,
    maximumClearanceMetres: Math.max(
      0,
      ...segments.map((segment) => segment.clearanceMetres),
    ),
    buckets,
  };
}

function querySegmentIndex(
  index: SegmentIndex,
  bounds: Bounds2,
): readonly PathSegment[] {
  const minimumCellX = Math.floor(bounds.minX / index.cellSizeMetres);
  const maximumCellX = Math.floor(bounds.maxX / index.cellSizeMetres);
  const minimumCellZ = Math.floor(bounds.minZ / index.cellSizeMetres);
  const maximumCellZ = Math.floor(bounds.maxZ / index.cellSizeMetres);
  const segments = new Set<PathSegment>();

  for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ += 1) {
    for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
      for (const segment of index.buckets.get(`${cellX},${cellZ}`) ?? []) {
        segments.add(segment);
      }
    }
  }

  return [...segments];
}

function createPolygonIndex(
  polygons: readonly (readonly Point2[])[],
  cellSizeMetres = 64,
): PolygonIndex {
  const buckets = new Map<string, Array<readonly Point2[]>>();

  for (const polygon of polygons) {
    const bounds = polygonBounds(polygon);
    const minimumCellX = Math.floor(bounds.minX / cellSizeMetres);
    const maximumCellX = Math.floor(bounds.maxX / cellSizeMetres);
    const minimumCellZ = Math.floor(bounds.minZ / cellSizeMetres);
    const maximumCellZ = Math.floor(bounds.maxZ / cellSizeMetres);

    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ += 1) {
      for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
        const key = `${cellX},${cellZ}`;
        const bucket = buckets.get(key);

        if (bucket === undefined) {
          buckets.set(key, [polygon]);
        } else {
          bucket.push(polygon);
        }
      }
    }
  }

  return { cellSizeMetres, buckets };
}

function queryPolygonIndex(
  index: PolygonIndex,
  bounds: Bounds2,
): readonly (readonly Point2[])[] {
  const minimumCellX = Math.floor(bounds.minX / index.cellSizeMetres);
  const maximumCellX = Math.floor(bounds.maxX / index.cellSizeMetres);
  const minimumCellZ = Math.floor(bounds.minZ / index.cellSizeMetres);
  const maximumCellZ = Math.floor(bounds.maxZ / index.cellSizeMetres);
  const polygons = new Set<readonly Point2[]>();

  for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ += 1) {
    for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
      for (const polygon of index.buckets.get(`${cellX},${cellZ}`) ?? []) {
        polygons.add(polygon);
      }
    }
  }

  return [...polygons];
}

function segmentBounds(segment: PathSegment): Bounds2 {
  return {
    minX: Math.min(segment.start[0], segment.end[0]),
    minZ: Math.min(segment.start[1], segment.end[1]),
    maxX: Math.max(segment.start[0], segment.end[0]),
    maxZ: Math.max(segment.start[1], segment.end[1]),
  };
}

function polygonBounds(polygon: readonly Point2[]): Bounds2 {
  return polygon.reduce<Bounds2>(
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

function expandPoint([x, z]: Point2, distanceMetres: number): Bounds2 {
  return {
    minX: x - distanceMetres,
    minZ: z - distanceMetres,
    maxX: x + distanceMetres,
    maxZ: z + distanceMetres,
  };
}

function expandBounds(bounds: Bounds2, distanceMetres: number): Bounds2 {
  return {
    minX: bounds.minX - distanceMetres,
    minZ: bounds.minZ - distanceMetres,
    maxX: bounds.maxX + distanceMetres,
    maxZ: bounds.maxZ + distanceMetres,
  };
}

function minimumPolygonSegmentDistance(
  polygon: readonly Point2[],
  segmentStart: Point2,
  segmentEnd: Point2,
): number {
  if (
    pointInPolygon(segmentStart, polygon) ||
    pointInPolygon(segmentEnd, polygon)
  ) {
    return 0;
  }

  let minimum = Number.POSITIVE_INFINITY;

  forEachEdge(polygon, (start, end) => {
    minimum = Math.min(
      minimum,
      segmentDistance(start, end, segmentStart, segmentEnd),
    );
  });

  return minimum;
}

function compareSegments(first: PathSegment, second: PathSegment): number {
  return (
    first.start[0] - second.start[0] ||
    first.start[1] - second.start[1] ||
    first.end[0] - second.end[0] ||
    first.end[1] - second.end[1] ||
    first.clearanceMetres - second.clearanceMetres
  );
}

function minimumPolygonDistance(
  first: readonly Point2[],
  second: readonly Point2[],
): number {
  if (polygonsIntersect(first, second)) {
    return 0;
  }

  let minimum = Number.POSITIVE_INFINITY;

  forEachEdge(first, (firstStart, firstEnd) => {
    forEachEdge(second, (secondStart, secondEnd) => {
      minimum = Math.min(
        minimum,
        segmentDistance(firstStart, firstEnd, secondStart, secondEnd),
      );
    });
  });

  return minimum;
}

function polygonsIntersect(
  first: readonly Point2[],
  second: readonly Point2[],
): boolean {
  let intersects = false;

  forEachEdge(first, (firstStart, firstEnd) => {
    forEachEdge(second, (secondStart, secondEnd) => {
      intersects ||= segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd);
    });
  });

  return (
    intersects ||
    pointInPolygon(first[0], second) ||
    pointInPolygon(second[0], first)
  );
}

function pointInPolygon(
  point: Point2 | undefined,
  polygon: readonly Point2[],
): boolean {
  if (point === undefined || polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[previousIndex];

    if (current === undefined || previous === undefined) {
      continue;
    }

    if (pointOnSegment(point, previous, current)) {
      return true;
    }

    const crosses =
      current[1] > point[1] !== previous[1] > point[1] &&
      point[0] <
        ((previous[0] - current[0]) * (point[1] - current[1])) /
          (previous[1] - current[1]) +
          current[0];

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
}

function segmentDistance(
  firstStart: Point2,
  firstEnd: Point2,
  secondStart: Point2,
  secondEnd: Point2,
): number {
  if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
    return 0;
  }

  return Math.min(
    pointSegmentDistance(firstStart, secondStart, secondEnd),
    pointSegmentDistance(firstEnd, secondStart, secondEnd),
    pointSegmentDistance(secondStart, firstStart, firstEnd),
    pointSegmentDistance(secondEnd, firstStart, firstEnd),
  );
}

function pointSegmentDistance(point: Point2, start: Point2, end: Point2): number {
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;

  if (lengthSquared <= EPSILON) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }

  const ratio = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaZ) /
        lengthSquared,
    ),
  );

  return Math.hypot(
    point[0] - (start[0] + ratio * deltaX),
    point[1] - (start[1] + ratio * deltaZ),
  );
}

function segmentsIntersect(
  firstStart: Point2,
  firstEnd: Point2,
  secondStart: Point2,
  secondEnd: Point2,
): boolean {
  const firstA = crossProduct(firstStart, firstEnd, secondStart);
  const firstB = crossProduct(firstStart, firstEnd, secondEnd);
  const secondA = crossProduct(secondStart, secondEnd, firstStart);
  const secondB = crossProduct(secondStart, secondEnd, firstEnd);

  if (firstA * firstB < -EPSILON && secondA * secondB < -EPSILON) {
    return true;
  }

  return (
    (Math.abs(firstA) <= EPSILON && pointOnSegment(secondStart, firstStart, firstEnd)) ||
    (Math.abs(firstB) <= EPSILON && pointOnSegment(secondEnd, firstStart, firstEnd)) ||
    (Math.abs(secondA) <= EPSILON && pointOnSegment(firstStart, secondStart, secondEnd)) ||
    (Math.abs(secondB) <= EPSILON && pointOnSegment(firstEnd, secondStart, secondEnd))
  );
}

function pointOnSegment(point: Point2, start: Point2, end: Point2): boolean {
  return (
    Math.abs(crossProduct(start, end, point)) <= EPSILON &&
    point[0] >= Math.min(start[0], end[0]) - EPSILON &&
    point[0] <= Math.max(start[0], end[0]) + EPSILON &&
    point[1] >= Math.min(start[1], end[1]) - EPSILON &&
    point[1] <= Math.max(start[1], end[1]) + EPSILON
  );
}

function crossProduct(origin: Point2, first: Point2, second: Point2): number {
  return (
    (first[0] - origin[0]) * (second[1] - origin[1]) -
    (first[1] - origin[1]) * (second[0] - origin[0])
  );
}

function forEachEdge(
  polygon: readonly Point2[],
  callback: (start: Point2, end: Point2) => void,
): void {
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];

    if (start !== undefined && end !== undefined) {
      callback(start, end);
    }
  }
}

function pointInBounds([x, z]: Point2, bounds: LocalBounds): boolean {
  return (
    x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ
  );
}

function assignDistrict([x, z]: Point2): string {
  if (z >= 0) {
    return 'riverfront-transition';
  }

  return x >= 450 ? 'east-core' : 'west-mixed';
}

function encodeGridIndex(index: number): string {
  if (index === 0) {
    return '0';
  }

  return index > 0 ? `p${index}` : `n${Math.abs(index)}`;
}

function roundPoint([x, z]: Point2): Point2 {
  return [roundToHundredth(x), roundToHundredth(z)];
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundToMillionth(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function pointsEqual(first: Point2, second: Point2): boolean {
  return first[0] === second[0] && first[1] === second[1];
}
