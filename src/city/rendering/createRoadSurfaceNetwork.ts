import type {
  LocalBounds,
  Point2,
  RoadClass,
  RoadPath,
} from '../model/processedCity';

export const ROAD_SURFACE_HEIGHT_METRES = 0.28;

const BRIDGE_BASE_HEIGHT_METRES = 6;
const BRIDGE_LAYER_STEP_METRES = 1.5;
const TARGET_APPROACH_GRADE = 0.07;
const MAXIMUM_ELEVATED_ROAD_SAMPLE_LENGTH_METRES = 15;
const MAXIMUM_IMPLICIT_CONNECTION_METRES = 18;
const MINIMUM_IMPLICIT_CONNECTION_ALIGNMENT = 0.97;

export type RoadSurfacePoint = readonly [
  xMetres: number,
  heightMetres: number,
  zMetres: number,
];

export type RoadSurfacePath = Readonly<{
  road: RoadPath;
  sourcePathIndex: number;
  points: readonly RoadSurfacePoint[];
  joinPointIndices: readonly number[];
}>;

export type RoadSurfaceNetwork = Readonly<{
  paths: readonly RoadSurfacePath[];
  metadata: Readonly<{
    sourceRoads: number;
    renderedRoads: number;
    sourcePaths: number;
    junctions: number;
    bridgeComponents: number;
    bridgeTransitions: number;
    implicitConnections: number;
    suppressedDanglingElevatedPaths: number;
  }>;
}>;

type SampledPoint = Readonly<{
  key: string;
  point: Point2;
  join: boolean;
}>;

type SampledRoadPath = Readonly<{
  road: RoadPath;
  sourcePathIndex: number;
  points: readonly SampledPoint[];
}>;

type BridgeNode = {
  readonly key: string;
  readonly neighbours: Set<string>;
  readonly layers: number[];
  boundary: boolean;
  componentId: number;
};

type BridgeEndpointTarget = Readonly<{
  roadClass: RoadClass;
  heightMetres: number;
}>;

/**
 * Converts split OSM ways into one height-consistent render network.
 * Bridge spans remain at clearance height; ramps live on compatible approach
 * ways so smaller roads cannot intersect a partially lowered bridge deck.
 */
export function createRoadSurfaceNetwork(
  roads: readonly RoadPath[],
  workingBounds?: LocalBounds,
): RoadSurfaceNetwork {
  const surfaceRoads = roads.filter((road) => !road.tunnel);
  const surfaceEndpointCounts = countEndpointOccurrences(surfaceRoads);
  const nonBridgeEndpointClasses = collectEndpointClasses(
    surfaceRoads.filter((road) => !road.bridge),
  );
  const bridgeNodes = new Map<string, BridgeNode>();
  const sampledPaths: SampledRoadPath[] = [];

  for (const road of surfaceRoads) {
    for (let pathIndex = 0; pathIndex < road.paths.length; pathIndex += 1) {
      const sourcePath = road.paths[pathIndex];

      if (sourcePath === undefined || sourcePath.length < 2) {
        continue;
      }

      const points = road.bridge || road.class === 'motorway'
        ? sampleElevatedRoadPath(road, pathIndex, sourcePath)
        : sourcePath.map((point) => ({
            key: coordinateKey(point),
            point,
            join: true,
          }));
      sampledPaths.push({ road, sourcePathIndex: pathIndex, points });

      if (!road.bridge) {
        continue;
      }

      for (const sample of points) {
        getOrCreateBridgeNode(bridgeNodes, sample.key).layers.push(road.layer);
      }

      for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
        const previous = points[pointIndex - 1];
        const current = points[pointIndex];

        if (previous === undefined || current === undefined) {
          continue;
        }

        if (pointDistance(previous.point, current.point) <= Number.EPSILON) {
          continue;
        }

        bridgeNodes.get(previous.key)?.neighbours.add(current.key);
        bridgeNodes.get(current.key)?.neighbours.add(previous.key);
      }
    }
  }

  const componentDeckHeights = assignBridgeComponents(bridgeNodes);
  const motorwayCorridorDeckHeights = createMotorwayCorridorDeckHeights(
    sampledPaths,
    bridgeNodes,
    componentDeckHeights,
  );
  const bridgeEndpointTargets = createBridgeEndpointTargets(
    sampledPaths,
    bridgeNodes,
    componentDeckHeights,
    nonBridgeEndpointClasses,
  );
  const sourceSurfacePaths = sampledPaths.map((path): RoadSurfacePath => ({
    road: path.road,
    sourcePathIndex: path.sourcePathIndex,
    joinPointIndices: path.points.flatMap((point, index) =>
      point.join ? [index] : [],
    ),
    points: createSurfacePoints(
      path,
      bridgeNodes,
      componentDeckHeights,
      bridgeEndpointTargets,
      motorwayCorridorDeckHeights,
      nonBridgeEndpointClasses,
    ),
  }));
  const implicitConnections = createImplicitRoadConnections(sourceSurfacePaths);
  const connectedPaths = [...sourceSurfacePaths, ...implicitConnections];
  const paths =
    workingBounds === undefined
      ? connectedPaths
      : suppressDanglingElevatedPaths(connectedPaths, workingBounds);
  const retainedImplicitConnections = paths.filter(
    (path) => path.road.sourceKind === 'implicit-connection',
  ).length;

  return {
    paths,
    metadata: {
      sourceRoads: roads.length,
      renderedRoads: surfaceRoads.length,
      sourcePaths: sampledPaths.length,
      junctions: [...surfaceEndpointCounts.values()].filter((count) => count > 1)
        .length,
      bridgeComponents: componentDeckHeights.length,
      bridgeTransitions: [...bridgeNodes.values()].filter((node) => node.boundary)
        .length,
      implicitConnections: retainedImplicitConnections,
      suppressedDanglingElevatedPaths:
        connectedPaths.length - paths.length,
    },
  };
}

function suppressDanglingElevatedPaths(
  paths: readonly RoadSurfacePath[],
  workingBounds: LocalBounds,
): readonly RoadSurfacePath[] {
  let retained = [...paths];
  let changed = true;

  while (changed) {
    changed = false;
    const endpointOccurrences = countSurfaceEndpointOccurrences(retained);
    const next = retained.filter((path) => {
      if (!isElevatedLimitedAccessPath(path)) {
        return true;
      }

      const supported = [path.points[0], path.points.at(-1)].every(
        (endpoint) =>
          endpoint !== undefined &&
          ((endpointOccurrences.get(surfacePointKey(endpoint)) ?? 0) > 1 ||
            pointTouchesWorkingBoundary(endpoint, workingBounds)),
      );

      changed ||= !supported;
      return supported;
    });
    retained = next;
  }

  return retained;
}

function isElevatedLimitedAccessPath(path: RoadSurfacePath): boolean {
  return (
    isLimitedAccessRoad(path.road.class) &&
    path.points.some(
      (point) => point[1] > ROAD_SURFACE_HEIGHT_METRES + 0.5,
    )
  );
}

function pointTouchesWorkingBoundary(
  point: RoadSurfacePoint,
  bounds: LocalBounds,
): boolean {
  const toleranceMetres = 5;
  return (
    Math.abs(point[0] - bounds.minX) <= toleranceMetres ||
    Math.abs(point[0] - bounds.maxX) <= toleranceMetres ||
    Math.abs(point[2] - bounds.minZ) <= toleranceMetres ||
    Math.abs(point[2] - bounds.maxZ) <= toleranceMetres
  );
}

type RoadEndpointCandidate = Readonly<{
  id: string;
  path: RoadSurfacePath;
  point: RoadSurfacePoint;
  outward: readonly [x: number, z: number];
}>;

/**
 * The clipped structure omits OSM node IDs and occasionally leaves short gaps
 * between collinear fragments. Only mutually-nearest, same-class singleton
 * endpoints are bridged, with a strict heading threshold and distance cap.
 * This repairs visually obvious clipping seams without globally snapping the
 * much denser set of nearby but semantically distinct carriageways.
 */
function createImplicitRoadConnections(
  paths: readonly RoadSurfacePath[],
): readonly RoadSurfacePath[] {
  const endpointOccurrences = countSurfaceEndpointOccurrences(paths);
  const endpoints = paths.flatMap(createRoadEndpointCandidates).filter(
    (endpoint) =>
      (endpointOccurrences.get(surfacePointKey(endpoint.point)) ?? 0) === 1,
  );
  const nearest = new Map<RoadEndpointCandidate, RoadEndpointCandidate>();

  for (const endpoint of endpoints) {
    const match = [...endpoints]
      .filter((candidate) => candidate !== endpoint)
      .flatMap((candidate) => {
        const distanceMetres = implicitConnectionDistance(endpoint, candidate);
        return distanceMetres === undefined
          ? []
          : [{ candidate, distanceMetres }];
      })
      .sort(
        (first, second) =>
          first.distanceMetres - second.distanceMetres ||
          first.candidate.id.localeCompare(second.candidate.id),
      )[0]?.candidate;

    if (match !== undefined) {
      nearest.set(endpoint, match);
    }
  }

  const connections: RoadSurfacePath[] = [];
  const connected = new Set<RoadEndpointCandidate>();

  for (const endpoint of [...endpoints].sort((first, second) =>
    first.id.localeCompare(second.id),
  )) {
    const match = nearest.get(endpoint);

    if (
      match === undefined ||
      nearest.get(match) !== endpoint ||
      connected.has(endpoint) ||
      connected.has(match)
    ) {
      continue;
    }

    connected.add(endpoint);
    connected.add(match);
    const ordered = [endpoint, match].sort((first, second) =>
      first.id.localeCompare(second.id),
    );
    const start = ordered[0];
    const end = ordered[1];

    if (start === undefined || end === undefined) {
      continue;
    }

    const connectorId = `implicit:${start.id}:${end.id}`;
    connections.push({
      road: {
        id: connectorId,
        sourceKind: 'implicit-connection',
        class: start.path.road.class,
        layer: Math.max(start.path.road.layer, end.path.road.layer),
        bridge:
          start.point[1] > ROAD_SURFACE_HEIGHT_METRES + 0.5 ||
          end.point[1] > ROAD_SURFACE_HEIGHT_METRES + 0.5,
        tunnel: false,
        paths: [
          [
            [start.point[0], start.point[2]],
            [end.point[0], end.point[2]],
          ],
        ],
      },
      sourcePathIndex: 0,
      points: [start.point, end.point],
      joinPointIndices: [0, 1],
    });
  }

  return connections;
}

function createRoadEndpointCandidates(
  path: RoadSurfacePath,
): readonly RoadEndpointCandidate[] {
  if (path.points.length < 2) {
    return [];
  }

  const first = path.points[0];
  const second = path.points[1];
  const last = path.points.at(-1);
  const penultimate = path.points.at(-2);

  if (
    first === undefined ||
    second === undefined ||
    last === undefined ||
    penultimate === undefined
  ) {
    return [];
  }

  return [
    {
      id: `${path.road.id}:${path.sourcePathIndex}:start`,
      path,
      point: first,
      outward: normalizedDirection(second, first),
    },
    {
      id: `${path.road.id}:${path.sourcePathIndex}:end`,
      path,
      point: last,
      outward: normalizedDirection(penultimate, last),
    },
  ];
}

function implicitConnectionDistance(
  first: RoadEndpointCandidate,
  second: RoadEndpointCandidate,
): number | undefined {
  if (
    first.path.road.class !== second.path.road.class ||
    first.path.road.id === second.path.road.id
  ) {
    return undefined;
  }

  const deltaX = second.point[0] - first.point[0];
  const deltaZ = second.point[2] - first.point[2];
  const distanceMetres = Math.hypot(deltaX, deltaZ);

  if (
    distanceMetres <= Number.EPSILON ||
    distanceMetres > MAXIMUM_IMPLICIT_CONNECTION_METRES
  ) {
    return undefined;
  }

  const directionX = deltaX / distanceMetres;
  const directionZ = deltaZ / distanceMetres;
  const firstAlignment =
    first.outward[0] * directionX + first.outward[1] * directionZ;
  const secondAlignment =
    second.outward[0] * -directionX + second.outward[1] * -directionZ;

  return firstAlignment >= MINIMUM_IMPLICIT_CONNECTION_ALIGNMENT &&
    secondAlignment >= MINIMUM_IMPLICIT_CONNECTION_ALIGNMENT
    ? distanceMetres
    : undefined;
}

function normalizedDirection(
  start: RoadSurfacePoint,
  end: RoadSurfacePoint,
): readonly [number, number] {
  const deltaX = end[0] - start[0];
  const deltaZ = end[2] - start[2];
  const length = Math.hypot(deltaX, deltaZ);
  return length <= Number.EPSILON
    ? [0, 0]
    : [deltaX / length, deltaZ / length];
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

function surfacePointKey(point: RoadSurfacePoint): string {
  return `${point[0].toFixed(3)}:${point[1].toFixed(3)}:${point[2].toFixed(3)}`;
}

function createSurfacePoints(
  path: SampledRoadPath,
  bridgeNodes: ReadonlyMap<string, BridgeNode>,
  componentDeckHeights: readonly number[],
  bridgeEndpointTargets: ReadonlyMap<
    string,
    readonly BridgeEndpointTarget[]
  >,
  motorwayCorridorDeckHeights: ReadonlyMap<SampledRoadPath, number>,
  nonBridgeEndpointClasses: ReadonlyMap<string, ReadonlySet<RoadClass>>,
): readonly RoadSurfacePoint[] {
  const motorwayDeckHeight = motorwayCorridorDeckHeights.get(path);

  if (motorwayDeckHeight !== undefined) {
    if (path.road.bridge) {
      return createConstantHeightSurfacePoints(path, motorwayDeckHeight);
    }

    const first = path.points[0];
    const last = path.points.at(-1);
    const startsAtSurfaceArterial =
      first !== undefined &&
      endpointMeetsSurfaceArterial(
        nonBridgeEndpointClasses.get(first.key),
      );
    const endsAtSurfaceArterial =
      last !== undefined &&
      endpointMeetsSurfaceArterial(
        nonBridgeEndpointClasses.get(last.key),
      );

    if (startsAtSurfaceArterial || endsAtSurfaceArterial) {
      return createMotorwayTerminalSurfacePoints(
        path,
        motorwayDeckHeight,
        startsAtSurfaceArterial,
        endsAtSurfaceArterial,
      );
    }

    return createConstantHeightSurfacePoints(path, motorwayDeckHeight);
  }

  return path.road.bridge
    ? createBridgeSurfacePoints(path, bridgeNodes, componentDeckHeights)
    : createApproachSurfacePoints(path, bridgeEndpointTargets);
}

function endpointMeetsSurfaceArterial(
  roadClasses: ReadonlySet<RoadClass> | undefined,
): boolean {
  return (
    roadClasses?.has('trunk') === true || roadClasses?.has('primary') === true
  );
}

function createMotorwayTerminalSurfacePoints(
  path: SampledRoadPath,
  deckHeightMetres: number,
  startsAtSurfaceArterial: boolean,
  endsAtSurfaceArterial: boolean,
): readonly RoadSurfacePoint[] {
  const cumulativeDistances = calculateCumulativeDistances(path.points);
  const totalDistance = cumulativeDistances.at(-1) ?? 0;

  return path.points.map((sample, index): RoadSurfacePoint => {
    const distanceFromStart = cumulativeDistances[index] ?? 0;
    const distanceFromEnd = totalDistance - distanceFromStart;
    const startRise = startsAtSurfaceArterial
      ? 0
      : calculateApproachRise(
          deckHeightMetres,
          distanceFromStart,
          totalDistance,
        );
    const endRise = endsAtSurfaceArterial
      ? 0
      : calculateApproachRise(
          deckHeightMetres,
          distanceFromEnd,
          totalDistance,
        );

    return [
      sample.point[0],
      ROAD_SURFACE_HEIGHT_METRES + Math.max(startRise, endRise),
      sample.point[1],
    ];
  });
}

/**
 * OSM commonly splits one elevated motorway into bridge-tagged spans and short
 * untagged connector ways. Treating every connector as a ground ramp makes the
 * rendered deck intersect roads that pass underneath it. A motorway endpoint
 * component containing any bridge is therefore rendered as one continuous
 * deck. Trunk roads are deliberately excluded because the source uses trunk
 * for long surface arterials as well as a small number of overpasses.
 */
function createMotorwayCorridorDeckHeights(
  paths: readonly SampledRoadPath[],
  bridgeNodes: ReadonlyMap<string, BridgeNode>,
  componentDeckHeights: readonly number[],
): ReadonlyMap<SampledRoadPath, number> {
  const motorwayPaths = paths.filter((path) => path.road.class === 'motorway');
  const pathsByEndpoint = new Map<string, SampledRoadPath[]>();

  for (const path of motorwayPaths) {
    for (const endpoint of [path.points[0], path.points.at(-1)]) {
      if (endpoint === undefined) {
        continue;
      }

      const connectedPaths = pathsByEndpoint.get(endpoint.key) ?? [];
      connectedPaths.push(path);
      pathsByEndpoint.set(endpoint.key, connectedPaths);
    }
  }

  const visited = new Set<SampledRoadPath>();
  const deckHeights = new Map<SampledRoadPath, number>();

  for (const start of motorwayPaths) {
    if (visited.has(start)) {
      continue;
    }

    const pending = [start];
    const componentPaths: SampledRoadPath[] = [];
    const componentBridgeHeights: number[] = [];
    visited.add(start);

    while (pending.length > 0) {
      const path = pending.pop();

      if (path === undefined) {
        continue;
      }

      componentPaths.push(path);

      if (path.road.bridge) {
        const bridgeEndpoint = path.points[0];
        const bridgeNode =
          bridgeEndpoint === undefined
            ? undefined
            : bridgeNodes.get(bridgeEndpoint.key);
        const bridgeHeight =
          bridgeNode === undefined
            ? undefined
            : componentDeckHeights[bridgeNode.componentId];

        if (bridgeHeight !== undefined) {
          componentBridgeHeights.push(bridgeHeight);
        }
      }

      for (const endpoint of [path.points[0], path.points.at(-1)]) {
        if (endpoint === undefined) {
          continue;
        }

        for (const connectedPath of pathsByEndpoint.get(endpoint.key) ?? []) {
          if (!visited.has(connectedPath)) {
            visited.add(connectedPath);
            pending.push(connectedPath);
          }
        }
      }
    }

    if (componentBridgeHeights.length === 0) {
      continue;
    }

    const corridorHeight = Math.max(...componentBridgeHeights);

    for (const path of componentPaths) {
      deckHeights.set(path, corridorHeight);
    }
  }

  return deckHeights;
}

function createConstantHeightSurfacePoints(
  path: SampledRoadPath,
  heightMetres: number,
): readonly RoadSurfacePoint[] {
  return path.points.map(
    (sample): RoadSurfacePoint => [
      sample.point[0],
      heightMetres,
      sample.point[1],
    ],
  );
}

function createBridgeSurfacePoints(
  path: SampledRoadPath,
  bridgeNodes: ReadonlyMap<string, BridgeNode>,
  componentDeckHeights: readonly number[],
): readonly RoadSurfacePoint[] {
  return path.points.map((sample): RoadSurfacePoint => {
    const node = bridgeNodes.get(sample.key);

    if (node === undefined) {
      throw new Error(`Missing bridge topology node "${sample.key}".`);
    }

    const deckHeight = componentDeckHeights[node.componentId];

    if (deckHeight === undefined) {
      throw new Error(`Missing bridge height for component ${node.componentId}.`);
    }

    return [sample.point[0], deckHeight, sample.point[1]];
  });
}

function createApproachSurfacePoints(
  path: SampledRoadPath,
  endpointTargets: ReadonlyMap<string, readonly BridgeEndpointTarget[]>,
): readonly RoadSurfacePoint[] {
  const cumulativeDistances = calculateCumulativeDistances(path.points);
  const totalDistance = cumulativeDistances.at(-1) ?? 0;
  const first = path.points[0];
  const last = path.points.at(-1);
  const startTarget =
    first === undefined
      ? undefined
      : findCompatibleTarget(endpointTargets.get(first.key), path.road.class);
  const endTarget =
    last === undefined
      ? undefined
      : findCompatibleTarget(endpointTargets.get(last.key), path.road.class);

  return path.points.map((sample, index): RoadSurfacePoint => {
    const distanceFromStart = cumulativeDistances[index] ?? 0;
    const distanceFromEnd = totalDistance - distanceFromStart;
    const startRise = calculateApproachRise(
      startTarget,
      distanceFromStart,
      totalDistance,
    );
    const endRise = calculateApproachRise(
      endTarget,
      distanceFromEnd,
      totalDistance,
    );

    return [
      sample.point[0],
      ROAD_SURFACE_HEIGHT_METRES + Math.max(startRise, endRise),
      sample.point[1],
    ];
  });
}

function calculateApproachRise(
  targetHeightMetres: number | undefined,
  distanceFromRaisedEndMetres: number,
  totalPathDistanceMetres: number,
): number {
  if (targetHeightMetres === undefined) {
    return 0;
  }

  const riseMetres = targetHeightMetres - ROAD_SURFACE_HEIGHT_METRES;
  const desiredRampLength = riseMetres / TARGET_APPROACH_GRADE;
  const availableRampLength = Math.min(desiredRampLength, totalPathDistanceMetres);

  if (availableRampLength <= Number.EPSILON) {
    return riseMetres;
  }

  return (
    riseMetres *
    Math.max(0, 1 - distanceFromRaisedEndMetres / availableRampLength)
  );
}

function createBridgeEndpointTargets(
  paths: readonly SampledRoadPath[],
  bridgeNodes: ReadonlyMap<string, BridgeNode>,
  componentDeckHeights: readonly number[],
  nonBridgeEndpointClasses: ReadonlyMap<string, ReadonlySet<RoadClass>>,
): ReadonlyMap<string, readonly BridgeEndpointTarget[]> {
  const targets = new Map<string, BridgeEndpointTarget[]>();

  for (const path of paths) {
    if (!path.road.bridge) {
      continue;
    }

    for (const endpoint of [path.points[0], path.points.at(-1)]) {
      if (endpoint === undefined) {
        continue;
      }

      const surfaceClasses = nonBridgeEndpointClasses.get(endpoint.key);

      if (
        surfaceClasses === undefined ||
        ![...surfaceClasses].some((roadClass) =>
          roadClassesAreCompatible(path.road.class, roadClass),
        )
      ) {
        continue;
      }

      const node = bridgeNodes.get(endpoint.key);

      if (node === undefined) {
        continue;
      }

      const heightMetres = componentDeckHeights[node.componentId];

      if (heightMetres === undefined) {
        continue;
      }

      node.boundary = true;
      const existingTargets = targets.get(endpoint.key) ?? [];

      if (
        !existingTargets.some(
          (target) =>
            target.roadClass === path.road.class &&
            target.heightMetres === heightMetres,
        )
      ) {
        existingTargets.push({ roadClass: path.road.class, heightMetres });
        targets.set(endpoint.key, existingTargets);
      }
    }
  }

  return targets;
}

function findCompatibleTarget(
  targets: readonly BridgeEndpointTarget[] | undefined,
  roadClass: RoadClass,
): number | undefined {
  const heights =
    targets
      ?.filter((target) =>
        roadClassesAreCompatible(target.roadClass, roadClass),
      )
      .map((target) => target.heightMetres) ?? [];

  return heights.length === 0 ? undefined : Math.max(...heights);
}

function roadClassesAreCompatible(first: RoadClass, second: RoadClass): boolean {
  if (first === second) {
    return true;
  }

  return isLimitedAccessRoad(first) && isLimitedAccessRoad(second);
}

function isLimitedAccessRoad(roadClass: RoadClass): boolean {
  return roadClass === 'motorway' || roadClass === 'trunk';
}

function calculateCumulativeDistances(
  points: readonly SampledPoint[],
): readonly number[] {
  const distances = [0];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const previousDistance = distances[index - 1] ?? 0;
    distances.push(
      previousDistance +
        (previous === undefined || current === undefined
          ? 0
          : pointDistance(previous.point, current.point)),
    );
  }

  return distances;
}

function sampleElevatedRoadPath(
  road: RoadPath,
  pathIndex: number,
  path: readonly Point2[],
): readonly SampledPoint[] {
  const samples: SampledPoint[] = [];
  const first = path[0];

  if (first === undefined) {
    return samples;
  }

  samples.push({ key: coordinateKey(first), point: first, join: true });

  for (let segmentIndex = 1; segmentIndex < path.length; segmentIndex += 1) {
    const start = path[segmentIndex - 1];
    const end = path[segmentIndex];

    if (start === undefined || end === undefined) {
      continue;
    }

    const distanceMetres = pointDistance(start, end);
    const subdivisions = Math.max(
      1,
      Math.ceil(distanceMetres / MAXIMUM_ELEVATED_ROAD_SAMPLE_LENGTH_METRES),
    );

    for (let subdivision = 1; subdivision <= subdivisions; subdivision += 1) {
      const fraction = subdivision / subdivisions;
      const point = [
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
      ] as const;
      const originalEndpoint = subdivision === subdivisions;
      samples.push({
        key: originalEndpoint
          ? coordinateKey(end)
          : `sample:${road.id}:${pathIndex}:${segmentIndex}:${subdivision}`,
        point,
        join: originalEndpoint,
      });
    }
  }

  return samples;
}

function getOrCreateBridgeNode(
  nodes: Map<string, BridgeNode>,
  key: string,
): BridgeNode {
  const existing = nodes.get(key);

  if (existing !== undefined) {
    return existing;
  }

  const node: BridgeNode = {
    key,
    neighbours: new Set(),
    layers: [],
    boundary: false,
    componentId: -1,
  };
  nodes.set(key, node);
  return node;
}

function assignBridgeComponents(nodes: Map<string, BridgeNode>): readonly number[] {
  const deckHeights: number[] = [];

  for (const start of nodes.values()) {
    if (start.componentId >= 0) {
      continue;
    }

    const componentId = deckHeights.length;
    const pending = [start];
    const layers: number[] = [];
    start.componentId = componentId;

    while (pending.length > 0) {
      const node = pending.pop();

      if (node === undefined) {
        continue;
      }

      layers.push(...node.layers);

      for (const neighbourKey of node.neighbours) {
        const neighbour = nodes.get(neighbourKey);

        if (neighbour !== undefined && neighbour.componentId < 0) {
          neighbour.componentId = componentId;
          pending.push(neighbour);
        }
      }
    }

    layers.sort((first, second) => first - second);
    const medianLayer = layers[Math.floor(layers.length / 2)] ?? 1;
    const effectiveLayer = Math.min(3, Math.max(1, medianLayer));
    deckHeights.push(
      BRIDGE_BASE_HEIGHT_METRES +
        (effectiveLayer - 1) * BRIDGE_LAYER_STEP_METRES,
    );
  }

  return deckHeights;
}

function countEndpointOccurrences(
  roads: readonly RoadPath[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();

  for (const road of roads) {
    for (const path of road.paths) {
      for (const endpoint of [path[0], path.at(-1)]) {
        if (endpoint === undefined) {
          continue;
        }

        const key = coordinateKey(endpoint);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  return counts;
}

function collectEndpointClasses(
  roads: readonly RoadPath[],
): ReadonlyMap<string, ReadonlySet<RoadClass>> {
  const classesByEndpoint = new Map<string, Set<RoadClass>>();

  for (const road of roads) {
    for (const path of road.paths) {
      for (const endpoint of [path[0], path.at(-1)]) {
        if (endpoint === undefined) {
          continue;
        }

        const key = coordinateKey(endpoint);
        const roadClasses = classesByEndpoint.get(key) ?? new Set<RoadClass>();
        roadClasses.add(road.class);
        classesByEndpoint.set(key, roadClasses);
      }
    }
  }

  return classesByEndpoint;
}

function coordinateKey(point: Point2): string {
  return `point:${point[0].toFixed(3)}:${point[1].toFixed(3)}`;
}

function pointDistance(first: Point2, second: Point2): number {
  return Math.hypot(second[0] - first[0], second[1] - first[1]);
}
