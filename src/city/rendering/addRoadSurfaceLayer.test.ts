import { describe, expect, it } from 'vitest';
import type { RoadPath } from '../model/processedCity';
import { createRoadSurfaceGeometry } from './addRoadSurfaceLayer';

describe('createRoadSurfaceGeometry', () => {
  it('creates a width-correct quad for each road segment', () => {
    const geometry = createRoadSurfaceGeometry(
      [createRoad([[0, 0], [20, 0]])],
      10,
    );
    const position = geometry?.getAttribute('position');
    const zCoordinates = Array.from(
      { length: position?.count ?? 0 },
      (_, index) => position?.getZ(index) ?? 0,
    );

    expect(position?.count).toBe(6);
    expect(Math.min(...zCoordinates)).toBe(-5);
    expect(Math.max(...zCoordinates)).toBe(5);
    geometry?.dispose();
  });

  it('raises bridge decks and omits tunnel paths', () => {
    const bridge = createRoad([[0, 0], [10, 0]], { bridge: true, layer: 2 });
    const tunnel = createRoad([[0, 10], [10, 10]], { tunnel: true });
    const geometry = createRoadSurfaceGeometry([bridge, tunnel], 8);
    const position = geometry?.getAttribute('position');

    expect(position?.count).toBe(6);
    expect(position?.getY(0)).toBe(7.5);
    geometry?.dispose();
  });

  it('deduplicates the endpoint fill shared by connected ways', () => {
    const geometry = createRoadSurfaceGeometry(
      [
        createRoad([[-20, 0], [0, 0]], { id: 'west' }),
        createRoad([[0, 0], [20, 0]], { id: 'east' }),
      ],
      10,
    );

    expect(geometry?.getAttribute('position').count).toBe(36);
    geometry?.dispose();
  });

  it('uses one bounded bevel triangle at an internal bend', () => {
    const geometry = createRoadSurfaceGeometry(
      [createRoad([[0, 0], [20, 0], [20, 20]])],
      10,
    );
    const position = geometry?.getAttribute('position');
    const xCoordinates = Array.from(
      { length: position?.count ?? 0 },
      (_, index) => position?.getX(index) ?? 0,
    );
    const zCoordinates = Array.from(
      { length: position?.count ?? 0 },
      (_, index) => position?.getZ(index) ?? 0,
    );

    expect(position?.count).toBe(15);
    expect(Math.min(...xCoordinates)).toBe(0);
    expect(Math.max(...xCoordinates)).toBe(25);
    expect(Math.min(...zCoordinates)).toBe(-5);
    expect(Math.max(...zCoordinates)).toBe(20);
    geometry?.dispose();
  });

  it('tapers the surfaces that enter a three-way branch', () => {
    const geometry = createRoadSurfaceGeometry(
      [
        createRoad([[-20, 0], [0, 0]], { id: 'west' }),
        createRoad([[0, 0], [20, 0]], { id: 'east' }),
        createRoad([[0, 0], [0, 20]], { id: 'north' }),
      ],
      10,
    );
    const position = geometry?.getAttribute('position');
    const sharedEndpointDistances: number[] = [];

    for (let index = 0; index < (position?.count ?? 0); index += 1) {
      const x = position?.getX(index) ?? 0;
      const z = position?.getZ(index) ?? 0;

      if (Math.abs(x) <= 3 && Math.abs(z) <= 3) {
        sharedEndpointDistances.push(Math.hypot(x, z));
      }
    }

    expect(position?.count).toBe(42);
    expect(Math.max(...sharedEndpointDistances)).toBeLessThanOrEqual(2.75);
    geometry?.dispose();
  });

  it('rejects invalid surface widths', () => {
    expect(() => createRoadSurfaceGeometry([], 0)).toThrow(RangeError);
  });
});

function createRoad(
  path: RoadPath['paths'][number],
  overrides: Partial<Pick<RoadPath, 'id' | 'bridge' | 'tunnel' | 'layer'>> = {},
): RoadPath {
  return {
    id: overrides.id ?? 'test-road',
    sourceKind: 'highway',
    class: 'primary',
    layer: overrides.layer ?? 0,
    bridge: overrides.bridge ?? false,
    tunnel: overrides.tunnel ?? false,
    paths: [path],
  };
}
