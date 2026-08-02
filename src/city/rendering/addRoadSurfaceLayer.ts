import * as THREE from 'three';
import type { DebugLayerManager } from '../../debug/DebugLayerManager';
import type { RoadClass, RoadPath } from '../model/processedCity';
import {
  createRoadSurfaceNetwork,
  type RoadSurfaceNetwork,
  type RoadSurfacePath,
} from './createRoadSurfaceNetwork';

const ROUND_JOIN_SEGMENTS = 8;
const HIGHWAY_SURFACE_OFFSET_METRES = 0.03;
const COORDINATE_KEY_PRECISION = 3;
const BRANCH_JUNCTION_WIDTH_SCALE = 0.55;

type RoadSurfaceStyle = Readonly<{
  widthMetres: number;
  color: number;
}>;

const ROAD_SURFACE_STYLES: Readonly<Record<RoadClass, RoadSurfaceStyle>> = {
  motorway: {
    widthMetres: 10,
    color: 0x58626a,
  },
  trunk: {
    widthMetres: 9,
    color: 0x58626a,
  },
  primary: { widthMetres: 9, color: 0x33434c },
  secondary: { widthMetres: 7, color: 0x33434c },
  tertiary: { widthMetres: 6, color: 0x33434c },
  local: { widthMetres: 4.5, color: 0x33434c },
  pedestrian: { widthMetres: 3, color: 0x33434c },
};

/** Adds render-only road decks derived from the normalized transport paths. */
export function addRoadSurfaceLayer(
  layers: DebugLayerManager,
  network: RoadSurfaceNetwork,
): void {
  const group = new THREE.Group();
  group.name = 'city:road-surfaces';
  const resources: Array<THREE.BufferGeometry | THREE.Material> = [];
  const highwayPaths = network.paths.filter(
    (path) => path.road.class === 'motorway' || path.road.class === 'trunk',
  );
  const streetPaths = network.paths.filter(
    (path) => path.road.class !== 'motorway' && path.road.class !== 'trunk',
  );

  addRoadMesh(
    group,
    resources,
    highwayPaths,
    (path) => ROAD_SURFACE_STYLES[path.road.class].widthMetres,
    ROAD_SURFACE_STYLES.motorway.color,
    'road-surfaces:highways',
    HIGHWAY_SURFACE_OFFSET_METRES,
  );
  addRoadMesh(
    group,
    resources,
    streetPaths,
    (path) => ROAD_SURFACE_STYLES[path.road.class].widthMetres,
    ROAD_SURFACE_STYLES.local.color,
    'road-surfaces:streets',
    0,
  );

  layers.add({
    id: 'road-surfaces',
    label: `${network.metadata.renderedRoads} roads · ${network.metadata.junctions} junctions · ${network.metadata.implicitConnections} gap repairs · ${network.metadata.suppressedDanglingElevatedPaths} dead ends hidden`,
    object: group,
    dispose: () => {
      for (const resource of resources) {
        resource.dispose();
      }
    },
  });
}

function addRoadMesh(
  group: THREE.Group,
  resources: Array<THREE.BufferGeometry | THREE.Material>,
  paths: readonly RoadSurfacePath[],
  getWidthMetres: (path: RoadSurfacePath) => number,
  color: number,
  name: string,
  heightOffsetMetres: number,
): void {
  const geometry = createVariableWidthRoadSurfaceGeometry(
    paths,
    getWidthMetres,
    heightOffsetMetres,
  );

  if (geometry === undefined) {
    return;
  }

  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  group.add(mesh);
  resources.push(geometry, material);
}

export function createRoadSurfaceGeometry(
  roads: readonly RoadPath[],
  widthMetres: number,
  heightOffsetMetres = 0,
): THREE.BufferGeometry | undefined {
  if (!Number.isFinite(widthMetres) || widthMetres <= 0) {
    throw new RangeError('Road surface width must be a positive finite distance.');
  }

  return createVariableWidthRoadSurfaceGeometry(
    createRoadSurfaceNetwork(roads).paths,
    () => widthMetres,
    heightOffsetMetres,
  );
}

function createVariableWidthRoadSurfaceGeometry(
  paths: readonly RoadSurfacePath[],
  getWidthMetres: (path: RoadSurfacePath) => number,
  heightOffsetMetres: number,
): THREE.BufferGeometry | undefined {
  const positions: number[] = [];
  const endpointOccurrences = countSurfaceEndpointOccurrences(paths);
  const endpointFills = new Map<
    string,
    Readonly<{
      point: RoadSurfacePath['points'][number];
      radiusMetres: number;
      occurrences: number;
    }>
  >();

  for (const path of paths) {
    const halfWidth = getWidthMetres(path) / 2;

    if (!Number.isFinite(halfWidth) || halfWidth <= 0) {
      throw new RangeError('Road surface width must be a positive finite distance.');
    }

    for (let index = 1; index < path.points.length; index += 1) {
      const start = path.points[index - 1];
      const end = path.points[index];

      if (start === undefined || end === undefined) {
        continue;
      }

      const deltaX = end[0] - start[0];
      const deltaZ = end[2] - start[2];
      const length = Math.hypot(deltaX, deltaZ);

      if (length <= Number.EPSILON) {
        continue;
      }

      const startHalfWidth =
        halfWidth * endpointWidthScale(start, index - 1, path, endpointOccurrences);
      const endHalfWidth =
        halfWidth * endpointWidthScale(end, index, path, endpointOccurrences);
      const startNormalX = (-deltaZ / length) * startHalfWidth;
      const startNormalZ = (deltaX / length) * startHalfWidth;
      const endNormalX = (-deltaZ / length) * endHalfWidth;
      const endNormalZ = (deltaX / length) * endHalfWidth;
      const startHeight = start[1] + heightOffsetMetres;
      const endHeight = end[1] + heightOffsetMetres;
      const startLeft = [
        start[0] + startNormalX,
        start[2] + startNormalZ,
      ] as const;
      const startRight = [
        start[0] - startNormalX,
        start[2] - startNormalZ,
      ] as const;
      const endLeft = [end[0] + endNormalX, end[2] + endNormalZ] as const;
      const endRight = [end[0] - endNormalX, end[2] - endNormalZ] as const;

      positions.push(
        startLeft[0], startHeight, startLeft[1],
        startRight[0], startHeight, startRight[1],
        endLeft[0], endHeight, endLeft[1],
        startRight[0], startHeight, startRight[1],
        endRight[0], endHeight, endRight[1],
        endLeft[0], endHeight, endLeft[1],
      );
    }

    const lastPointIndex = path.points.length - 1;

    for (const pointIndex of path.joinPointIndices) {
      const point = path.points[pointIndex];

      if (point === undefined) {
        continue;
      }

      if (pointIndex === 0 || pointIndex === lastPointIndex) {
        collectEndpointFill(
          endpointFills,
          point,
          halfWidth *
            endpointWidthScale(
              point,
              pointIndex,
              path,
              endpointOccurrences,
            ),
        );
      } else {
        appendBevelJoin(
          positions,
          path.points[pointIndex - 1],
          point,
          path.points[pointIndex + 1],
          halfWidth,
          heightOffsetMetres,
        );
      }
    }
  }

  for (const fill of endpointFills.values()) {
    if (fill.occurrences < 2) {
      continue;
    }

    appendRoundJoin(
      positions,
      fill.point[0],
      fill.point[1] + heightOffsetMetres,
      fill.point[2],
      fill.radiusMetres,
    );
  }

  if (positions.length === 0) {
    return undefined;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function countSurfaceEndpointOccurrences(
  paths: readonly RoadSurfacePath[],
): ReadonlyMap<string, number> {
  const occurrences = new Map<string, number>();

  for (const path of paths) {
    for (const endpoint of [path.points[0], path.points.at(-1)]) {
      if (endpoint === undefined) {
        continue;
      }

      const key = surfacePointKey(endpoint);
      occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
    }
  }

  return occurrences;
}

function endpointWidthScale(
  point: RoadSurfacePath['points'][number],
  pointIndex: number,
  path: RoadSurfacePath,
  endpointOccurrences: ReadonlyMap<string, number>,
): number {
  if (pointIndex !== 0 && pointIndex !== path.points.length - 1) {
    return 1;
  }

  return (endpointOccurrences.get(surfacePointKey(point)) ?? 0) >= 3
    ? BRANCH_JUNCTION_WIDTH_SCALE
    : 1;
}

function collectEndpointFill(
  fills: Map<
    string,
    Readonly<{
      point: RoadSurfacePath['points'][number];
      radiusMetres: number;
      occurrences: number;
    }>
  >,
  point: RoadSurfacePath['points'][number],
  radiusMetres: number,
): void {
  const key = surfacePointKey(point);
  const existing = fills.get(key);

  if (existing === undefined) {
    fills.set(key, { point, radiusMetres, occurrences: 1 });
    return;
  }

  fills.set(key, {
    point: existing.point,
    radiusMetres: Math.max(existing.radiusMetres, radiusMetres),
    occurrences: existing.occurrences + 1,
  });
}

function surfacePointKey(point: RoadSurfacePath['points'][number]): string {
  return point
    .map((coordinate) => coordinate.toFixed(COORDINATE_KEY_PRECISION))
    .join(':');
}

/**
 * Fills only the outside of a source-polyline bend. Unlike a circular join,
 * this triangle cannot flare beyond either segment's half-width at acute
 * turns, and it does not add a stack of coplanar discs through intersections.
 */
function appendBevelJoin(
  positions: number[],
  previous: RoadSurfacePath['points'][number] | undefined,
  point: RoadSurfacePath['points'][number],
  next: RoadSurfacePath['points'][number] | undefined,
  halfWidthMetres: number,
  heightOffsetMetres: number,
): void {
  if (previous === undefined || next === undefined) {
    return;
  }

  const incomingX = point[0] - previous[0];
  const incomingZ = point[2] - previous[2];
  const outgoingX = next[0] - point[0];
  const outgoingZ = next[2] - point[2];
  const incomingLength = Math.hypot(incomingX, incomingZ);
  const outgoingLength = Math.hypot(outgoingX, outgoingZ);

  if (
    incomingLength <= Number.EPSILON ||
    outgoingLength <= Number.EPSILON
  ) {
    return;
  }

  const turn = incomingX * outgoingZ - incomingZ * outgoingX;

  if (Math.abs(turn) <= Number.EPSILON) {
    return;
  }

  const outerSide = turn > 0 ? -1 : 1;
  const incomingNormalX = (-incomingZ / incomingLength) * halfWidthMetres;
  const incomingNormalZ = (incomingX / incomingLength) * halfWidthMetres;
  const outgoingNormalX = (-outgoingZ / outgoingLength) * halfWidthMetres;
  const outgoingNormalZ = (outgoingX / outgoingLength) * halfWidthMetres;
  const heightMetres = point[1] + heightOffsetMetres;

  positions.push(
    point[0],
    heightMetres,
    point[2],
    point[0] + incomingNormalX * outerSide,
    heightMetres,
    point[2] + incomingNormalZ * outerSide,
    point[0] + outgoingNormalX * outerSide,
    heightMetres,
    point[2] + outgoingNormalZ * outerSide,
  );
}

function appendRoundJoin(
  positions: number[],
  centerX: number,
  heightMetres: number,
  centerZ: number,
  radiusMetres: number,
): void {
  for (let index = 0; index < ROUND_JOIN_SEGMENTS; index += 1) {
    const startAngle = (index / ROUND_JOIN_SEGMENTS) * Math.PI * 2;
    const endAngle = ((index + 1) / ROUND_JOIN_SEGMENTS) * Math.PI * 2;
    positions.push(
      centerX,
      heightMetres,
      centerZ,
      centerX + Math.cos(startAngle) * radiusMetres,
      heightMetres,
      centerZ + Math.sin(startAngle) * radiusMetres,
      centerX + Math.cos(endAngle) * radiusMetres,
      heightMetres,
      centerZ + Math.sin(endAngle) * radiusMetres,
    );
  }
}
