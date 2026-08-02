import { describe, expect, it } from 'vitest';
import type { Point2, RoadPath } from '../model/processedCity';
import {
  createRoadSurfaceNetwork,
  ROAD_SURFACE_HEIGHT_METRES,
} from './createRoadSurfaceNetwork';

describe('createRoadSurfaceNetwork', () => {
  it('keeps surface ways at one shared height and reports exact junctions', () => {
    const network = createRoadSurfaceNetwork([
      createRoad('first', [[-20, 0], [0, 0]]),
      createRoad('second', [[0, 0], [20, 0]]),
    ]);

    expect(network.metadata.junctions).toBe(1);
    expect(
      network.paths.flatMap((path) => path.points.map((point) => point[1])),
    ).toEqual([
      ROAD_SURFACE_HEIGHT_METRES,
      ROAD_SURFACE_HEIGHT_METRES,
      ROAD_SURFACE_HEIGHT_METRES,
      ROAD_SURFACE_HEIGHT_METRES,
    ]);
  });

  it('creates continuous ramps between surface ways and a bridge component', () => {
    const network = createRoadSurfaceNetwork([
      createRoad('west', [[-100, 0], [0, 0]]),
      createRoad('bridge', [[0, 0], [200, 0]], { bridge: true, layer: 2 }),
      createRoad('east', [[200, 0], [300, 0]]),
    ]);
    const bridge = network.paths.find((path) => path.road.id === 'bridge');
    const west = network.paths.find((path) => path.road.id === 'west');
    const east = network.paths.find((path) => path.road.id === 'east');

    expect(bridge?.points.every((point) => point[1] === 7.5)).toBe(true);
    expect(west?.points[0]?.[1]).toBe(ROAD_SURFACE_HEIGHT_METRES);
    expect(west?.points.at(-1)?.[1]).toBe(7.5);
    expect(east?.points[0]?.[1]).toBe(7.5);
    expect(east?.points.at(-1)?.[1]).toBe(ROAD_SURFACE_HEIGHT_METRES);
    expect(network.metadata.bridgeTransitions).toBe(2);
  });

  it('keeps connected motorway ways on one deck above smaller roads', () => {
    const network = createRoadSurfaceNetwork([
      createRoad('approach', [[-100, 0], [0, 0]], { class: 'motorway' }),
      createRoad('bridge', [[0, 0], [120, 0]], {
        bridge: true,
        class: 'motorway',
        layer: 2,
      }),
      createRoad('local-crossing', [[0, -40], [0, 0]], { class: 'local' }),
    ]);
    const approach = network.paths.find((path) => path.road.id === 'approach');
    const local = network.paths.find(
      (path) => path.road.id === 'local-crossing',
    );

    expect(approach?.points.every((point) => point[1] === 7.5)).toBe(true);
    expect(local?.points.every(
      (point) => point[1] === ROAD_SURFACE_HEIGHT_METRES,
    )).toBe(true);
  });

  it('does not elevate a disconnected surface motorway without a bridge', () => {
    const network = createRoadSurfaceNetwork([
      createRoad('surface-motorway', [[-50, 0], [50, 0]], {
        class: 'motorway',
      }),
    ]);
    const motorway = network.paths[0];

    expect(
      motorway?.points.every(
        (point) => point[1] === ROAD_SURFACE_HEIGHT_METRES,
      ),
    ).toBe(true);
  });

  it('uses the highest bridge deck across a split motorway corridor', () => {
    const network = createRoadSurfaceNetwork([
      createRoad('bridge-west', [[-120, 0], [-20, 0]], {
        bridge: true,
        class: 'motorway',
        layer: 1,
      }),
      createRoad('untagged-connector', [[-20, 0], [20, 0]], {
        class: 'motorway',
      }),
      createRoad('bridge-east', [[20, 0], [120, 0]], {
        bridge: true,
        class: 'motorway',
        layer: 3,
      }),
    ]);

    expect(
      network.paths.every((path) =>
        path.points.every((point) => point[1] === 9),
      ),
    ).toBe(true);
  });

  it('descends a terminal motorway link where it meets a surface arterial', () => {
    const network = createRoadSurfaceNetwork([
      createRoad('bridge', [[0, 0], [100, 0]], {
        bridge: true,
        class: 'motorway',
        layer: 2,
      }),
      createRoad('terminal-link', [[100, 0], [200, 0]], {
        class: 'motorway',
      }),
      createRoad('surface-primary', [[200, 0], [200, 80]], {
        class: 'primary',
      }),
    ]);
    const terminalLink = network.paths.find(
      (path) => path.road.id === 'terminal-link',
    );

    expect(terminalLink?.points[0]?.[1]).toBe(7.5);
    expect(terminalLink?.points.at(-1)?.[1]).toBe(
      ROAD_SURFACE_HEIGHT_METRES,
    );
    expect(terminalLink?.points.length).toBeGreaterThan(2);
  });

  it('removes layer-tag jumps between connected bridge ways', () => {
    const network = createRoadSurfaceNetwork([
      createRoad('west', [[-30, 0], [0, 0]]),
      createRoad('bridge-low-layer', [[0, 0], [120, 0]], {
        bridge: true,
        layer: 1,
      }),
      createRoad('bridge-high-layer', [[120, 0], [240, 0]], {
        bridge: true,
        layer: 3,
      }),
      createRoad('east', [[240, 0], [270, 0]]),
    ]);
    const firstBridge = network.paths.find(
      (path) => path.road.id === 'bridge-low-layer',
    );
    const secondBridge = network.paths.find(
      (path) => path.road.id === 'bridge-high-layer',
    );
    const firstJoinHeight = firstBridge?.points.at(-1)?.[1];
    const secondJoinHeight = secondBridge?.points[0]?.[1];

    expect(firstJoinHeight).toBe(secondJoinHeight);
    expect(firstJoinHeight).toBeGreaterThan(ROAD_SURFACE_HEIGHT_METRES);
    expect(network.metadata.bridgeComponents).toBe(1);
  });

  it('omits tunnel paths from the visible surface network', () => {
    const network = createRoadSurfaceNetwork([
      createRoad('surface', [[0, 0], [20, 0]]),
      createRoad('tunnel', [[0, 10], [20, 10]], { tunnel: true, layer: 1 }),
    ]);

    expect(network.metadata.sourceRoads).toBe(2);
    expect(network.metadata.renderedRoads).toBe(1);
    expect(network.paths.map((path) => path.road.id)).toEqual(['surface']);
  });

  it('connects only mutually-nearest aligned gaps of the same road class', () => {
    const network = createRoadSurfaceNetwork([
      createRoad('west', [[-30, 0], [-4, 0]], { class: 'local' }),
      createRoad('east', [[3, 0], [30, 0]], { class: 'local' }),
      createRoad('nearby-but-turning', [[3, 5], [3, 30]], {
        class: 'local',
      }),
    ]);
    const connector = network.paths.find((path) =>
      path.road.id.startsWith('implicit:'),
    );

    expect(network.metadata.implicitConnections).toBe(1);
    expect(connector?.points.map((point) => point[0]).sort((a, b) => a - b)).toEqual([
      -4,
      3,
    ]);
    expect(
      connector?.points.every(
        (point) => point[1] === ROAD_SURFACE_HEIGHT_METRES,
      ),
    ).toBe(true);
  });

  it('suppresses an unsupported elevated branch inside the working bounds', () => {
    const network = createRoadSurfaceNetwork(
      [
        createRoad('dangling-bridge', [[-20, 0], [20, 0]], {
          bridge: true,
          class: 'motorway',
          layer: 2,
        }),
      ],
      { minX: -100, minZ: -100, maxX: 100, maxZ: 100 },
    );

    expect(network.paths).toHaveLength(0);
    expect(network.metadata.suppressedDanglingElevatedPaths).toBe(1);
  });

  it('keeps an elevated corridor that exits through the working boundary', () => {
    const network = createRoadSurfaceNetwork(
      [
        createRoad('boundary-bridge', [[-100, 0], [100, 0]], {
          bridge: true,
          class: 'motorway',
          layer: 2,
        }),
      ],
      { minX: -100, minZ: -100, maxX: 100, maxZ: 100 },
    );

    expect(network.paths).toHaveLength(1);
    expect(network.metadata.suppressedDanglingElevatedPaths).toBe(0);
  });
});

function createRoad(
  id: string,
  path: readonly Point2[],
  overrides: Partial<
    Pick<RoadPath, 'bridge' | 'tunnel' | 'layer' | 'class'>
  > = {},
): RoadPath {
  return {
    id,
    sourceKind: 'highway',
    class: overrides.class ?? 'primary',
    layer: overrides.layer ?? 0,
    bridge: overrides.bridge ?? false,
    tunnel: overrides.tunnel ?? false,
    paths: [path],
  };
}
