import type {
  DiscardReason,
  LocalBounds,
  LonLat,
  Point2,
  ProcessedCityStructure,
  RoadClass,
  RoadPath,
  TransportPath,
  WaterRegion,
} from '../../src/city/model/processedCity';
import { clipLineString, clipPolygonRings } from './clipping';
import type { PreprocessConfig } from './config';
import { createLocalProjection, LOCAL_EARTH_RADIUS_METRES } from './projection';

type UnknownRecord = Record<string, unknown>;
type MutableBounds = {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
};

type RetainedKind = keyof ProcessedCityStructure['metadata']['counts']['retainedByKind'];

const DISCARD_REASONS: readonly DiscardReason[] = [
  'outsideClip',
  'unsupportedCategory',
  'unsupportedGeometry',
  'invalidFeature',
  'invalidGeometry',
  'degenerateGeometry',
];

export function preprocessCityStructure(
  source: unknown,
  config: PreprocessConfig,
): ProcessedCityStructure {
  const sourceCollection = requireRecord(source, 'GeoJSON root');

  if (sourceCollection.type !== 'FeatureCollection' || !Array.isArray(sourceCollection.features)) {
    throw new Error('The structural source must be a GeoJSON FeatureCollection.');
  }

  const sourceBounds = collectSourceBounds(sourceCollection.features);
  const projection = createLocalProjection(config.clip.originLonLat);
  const clipBounds: LocalBounds = {
    minX: -config.clip.widthMetres / 2,
    minZ: -config.clip.depthMetres / 2,
    maxX: config.clip.widthMetres / 2,
    maxZ: config.clip.depthMetres / 2,
  };
  const precisionFactor = 10 ** config.coordinatePrecisionDecimals;
  const roads: RoadPath[] = [];
  const railways: TransportPath[] = [];
  const waterways: TransportPath[] = [];
  const waterRegions: WaterRegion[] = [];
  const discardedByReason = createDiscardCounts();
  const retainedByKind: Record<RetainedKind, number> = {
    roads: 0,
    railways: 0,
    waterways: 0,
    waterRegions: 0,
  };

  const discard = (reason: DiscardReason): void => {
    discardedByReason[reason] += 1;
  };

  for (const unknownFeature of sourceCollection.features) {
    if (!isRecord(unknownFeature)) {
      discard('invalidFeature');
      continue;
    }

    const properties = unknownFeature.properties;
    const geometry = unknownFeature.geometry;

    if (!isRecord(properties) || !isRecord(geometry) || typeof geometry.type !== 'string') {
      discard('invalidFeature');
      continue;
    }

    const id = readString(properties, '@id');

    if (id === undefined) {
      discard('invalidFeature');
      continue;
    }

    const highway = readString(properties, 'highway');
    const railway = readString(properties, 'railway');
    const waterway = readString(properties, 'waterway');
    const natural = readString(properties, 'natural');

    if (highway !== undefined) {
      if (geometry.type !== 'LineString') {
        discard('unsupportedGeometry');
        continue;
      }

      const sourcePoints = parseLineString(geometry.coordinates);

      if (sourcePoints === undefined) {
        discard('invalidGeometry');
        continue;
      }

      const clippedPaths = clipAndRoundLine(
        sourcePoints,
        projection.project,
        clipBounds,
        precisionFactor,
      );

      if (clippedPaths.kind === 'outside') {
        discard('outsideClip');
        continue;
      }

      if (clippedPaths.paths.length === 0) {
        discard('degenerateGeometry');
        continue;
      }

      roads.push({
        id,
        sourceKind: highway,
        class: classifyRoad(highway),
        layer: readLayer(properties),
        bridge: readFlag(properties, 'bridge'),
        tunnel: readFlag(properties, 'tunnel'),
        paths: clippedPaths.paths,
      });
      retainedByKind.roads += 1;
      continue;
    }

    if (railway !== undefined) {
      if (geometry.type !== 'LineString') {
        discard('unsupportedGeometry');
        continue;
      }

      const sourcePoints = parseLineString(geometry.coordinates);

      if (sourcePoints === undefined) {
        discard('invalidGeometry');
        continue;
      }

      const clippedPaths = clipAndRoundLine(
        sourcePoints,
        projection.project,
        clipBounds,
        precisionFactor,
      );

      if (clippedPaths.kind === 'outside') {
        discard('outsideClip');
        continue;
      }

      if (clippedPaths.paths.length === 0) {
        discard('degenerateGeometry');
        continue;
      }

      railways.push({
        id,
        sourceKind: railway,
        layer: readLayer(properties),
        bridge: readFlag(properties, 'bridge'),
        tunnel: readFlag(properties, 'tunnel'),
        paths: clippedPaths.paths,
      });
      retainedByKind.railways += 1;
      continue;
    }

    if (geometry.type === 'Polygon' && natural === 'water') {
      const sourceRings = parsePolygon(geometry.coordinates);

      if (sourceRings === undefined) {
        discard('invalidGeometry');
        continue;
      }

      const projectedRings = sourceRings.map((ring) => ring.map(projection.project));
      const clippedRings = clipPolygonRings(projectedRings, clipBounds);

      if (clippedRings.length === 0) {
        discard('outsideClip');
        continue;
      }

      const roundedRings = clippedRings
        .map((ring) => roundAndDedupe(ring, precisionFactor))
        .filter((ring) => ring.length >= 3);

      if (roundedRings.length === 0) {
        discard('degenerateGeometry');
        continue;
      }

      waterRegions.push({
        id,
        kind: readString(properties, 'water') ?? 'water',
        rings: roundedRings,
      });
      retainedByKind.waterRegions += 1;
      continue;
    }

    if (waterway !== undefined) {
      if (geometry.type !== 'LineString') {
        discard('unsupportedGeometry');
        continue;
      }

      const sourcePoints = parseLineString(geometry.coordinates);

      if (sourcePoints === undefined) {
        discard('invalidGeometry');
        continue;
      }

      const clippedPaths = clipAndRoundLine(
        sourcePoints,
        projection.project,
        clipBounds,
        precisionFactor,
      );

      if (clippedPaths.kind === 'outside') {
        discard('outsideClip');
        continue;
      }

      if (clippedPaths.paths.length === 0) {
        discard('degenerateGeometry');
        continue;
      }

      waterways.push({
        id,
        sourceKind: waterway,
        layer: readLayer(properties),
        bridge: false,
        tunnel: false,
        paths: clippedPaths.paths,
      });
      retainedByKind.waterways += 1;
      continue;
    }

    discard('unsupportedCategory');
  }

  const retained = roads.length + railways.length + waterways.length + waterRegions.length;
  const discarded = Object.values(discardedByReason).reduce((total, count) => total + count, 0);
  const outputBounds = collectOutputBounds({ roads, railways, waterways, waterRegions });

  if (retained + discarded !== sourceCollection.features.length) {
    throw new Error('Preprocessing accounting does not match the number of source features.');
  }

  return {
    schemaVersion: 1,
    metadata: {
      source: {
        file: getBaseName(config.sourceFile),
        featureCount: sourceCollection.features.length,
        boundsLonLat: sourceBounds,
        attribution: 'Map data © OpenStreetMap contributors',
      },
      projection: {
        kind: 'local-equirectangular',
        units: 'metres',
        originLonLat: config.clip.originLonLat,
        earthRadiusMetres: LOCAL_EARTH_RADIUS_METRES,
        axes: {
          x: 'east',
          z: 'south',
        },
      },
      clip: {
        id: config.clip.id,
        widthMetres: config.clip.widthMetres,
        depthMetres: config.clip.depthMetres,
        areaSquareKilometres: (config.clip.widthMetres * config.clip.depthMetres) / 1_000_000,
        bounds: clipBounds,
      },
      outputBounds,
      counts: {
        retained,
        discarded,
        retainedByKind,
        discardedByReason,
      },
    },
    roads,
    railways,
    waterways,
    waterRegions,
  };
}

function clipAndRoundLine(
  points: readonly LonLat[],
  project: (point: LonLat) => Point2,
  bounds: LocalBounds,
  precisionFactor: number,
): Readonly<{
  kind: 'retained' | 'outside';
  paths: readonly (readonly Point2[])[];
}> {
  const clipped = clipLineString(points.map(project), bounds);

  if (clipped.length === 0) {
    return { kind: 'outside', paths: [] };
  }

  return {
    kind: 'retained',
    paths: clipped
      .map((path) => roundAndDedupe(path, precisionFactor))
      .filter((path) => path.length >= 2),
  };
}

function parseLineString(value: unknown): readonly LonLat[] | undefined {
  if (!Array.isArray(value) || value.length < 2) {
    return undefined;
  }

  const points: LonLat[] = [];

  for (const coordinate of value) {
    const point = parseLonLat(coordinate);

    if (point === undefined) {
      return undefined;
    }

    points.push(point);
  }

  return points;
}

function parsePolygon(value: unknown): readonly (readonly LonLat[])[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const rings: LonLat[][] = [];

  for (const unknownRing of value) {
    if (!Array.isArray(unknownRing) || unknownRing.length < 4) {
      return undefined;
    }

    const ring: LonLat[] = [];

    for (const coordinate of unknownRing) {
      const point = parseLonLat(coordinate);

      if (point === undefined) {
        return undefined;
      }

      ring.push(point);
    }

    rings.push(ring);
  }

  return rings;
}

function parseLonLat(value: unknown): LonLat | undefined {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    typeof value[0] !== 'number' ||
    typeof value[1] !== 'number' ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1])
  ) {
    return undefined;
  }

  return [value[0], value[1]];
}

function roundAndDedupe(points: readonly Point2[], precisionFactor: number): Point2[] {
  const rounded: Point2[] = [];

  for (const [x, z] of points) {
    const point: Point2 = [
      Math.round(x * precisionFactor) / precisionFactor,
      Math.round(z * precisionFactor) / precisionFactor,
    ];
    const previous = rounded.at(-1);

    if (previous === undefined || previous[0] !== point[0] || previous[1] !== point[1]) {
      rounded.push(point);
    }
  }

  if (rounded.length > 1) {
    const first = rounded[0];
    const last = rounded.at(-1);

    if (first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1]) {
      rounded.pop();
    }
  }

  return rounded;
}

function collectSourceBounds(features: readonly unknown[]): readonly [LonLat, LonLat] {
  const bounds = createMutableBounds();

  const visit = (value: unknown): void => {
    const coordinate = parseLonLat(value);

    if (coordinate !== undefined) {
      includePoint(bounds, coordinate);
      return;
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        visit(child);
      }
    }
  };

  for (const feature of features) {
    if (isRecord(feature) && isRecord(feature.geometry)) {
      visit(feature.geometry.coordinates);
    }
  }

  if (!hasFiniteBounds(bounds)) {
    throw new Error('The structural source contains no valid coordinates.');
  }

  return [
    [bounds.minX, bounds.minZ],
    [bounds.maxX, bounds.maxZ],
  ];
}

function collectOutputBounds(data: {
  readonly roads: readonly RoadPath[];
  readonly railways: readonly TransportPath[];
  readonly waterways: readonly TransportPath[];
  readonly waterRegions: readonly WaterRegion[];
}): LocalBounds {
  const bounds = createMutableBounds();

  for (const feature of [...data.roads, ...data.railways, ...data.waterways]) {
    for (const path of feature.paths) {
      for (const point of path) {
        includePoint(bounds, point);
      }
    }
  }

  for (const region of data.waterRegions) {
    for (const ring of region.rings) {
      for (const point of ring) {
        includePoint(bounds, point);
      }
    }
  }

  if (!hasFiniteBounds(bounds)) {
    throw new Error('The configured clip retained no valid geometry.');
  }

  return bounds;
}

function classifyRoad(highway: string): RoadClass {
  if (highway === 'motorway' || highway === 'motorway_link') {
    return 'motorway';
  }

  if (highway === 'trunk' || highway === 'trunk_link') {
    return 'trunk';
  }

  if (highway === 'primary' || highway === 'primary_link') {
    return 'primary';
  }

  if (highway === 'secondary' || highway === 'secondary_link') {
    return 'secondary';
  }

  if (highway === 'tertiary' || highway === 'tertiary_link') {
    return 'tertiary';
  }

  if (highway === 'pedestrian') {
    return 'pedestrian';
  }

  return 'local';
}

function readLayer(properties: UnknownRecord): number {
  const value = readString(properties, 'layer');

  if (value === undefined) {
    return 0;
  }

  const layer = Number(value);
  return Number.isInteger(layer) ? layer : 0;
}

function readFlag(properties: UnknownRecord, key: string): boolean {
  const value = properties[key];
  return value !== undefined && value !== null && value !== false && value !== 'no';
}

function readString(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getBaseName(filePath: string): string {
  return filePath.split(/[\\/]/).at(-1) ?? filePath;
}

function createDiscardCounts(): Record<DiscardReason, number> {
  return Object.fromEntries(DISCARD_REASONS.map((reason) => [reason, 0])) as Record<
    DiscardReason,
    number
  >;
}

function createMutableBounds(): MutableBounds {
  return {
    minX: Number.POSITIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
  };
}

function includePoint(bounds: MutableBounds, [x, z]: readonly [number, number]): void {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxZ = Math.max(bounds.maxZ, z);
}

function hasFiniteBounds(bounds: MutableBounds): boolean {
  return (
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.minZ) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.maxZ)
  );
}

function requireRecord(value: unknown, label: string): UnknownRecord {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
