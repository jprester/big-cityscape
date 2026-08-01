import { describe, expect, it } from 'vitest';
import type { LocalBounds } from '../../src/city/model/processedCity';
import { clipLineString, clipPolygonRings } from './clipping';

const BOUNDS: LocalBounds = {
  minX: -10,
  minZ: -10,
  maxX: 10,
  maxZ: 10,
};

describe('clipLineString', () => {
  it('clips a continuous path to the rectangle', () => {
    expect(
      clipLineString(
        [
          [-20, 0],
          [0, 0],
          [20, 0],
        ],
        BOUNDS,
      ),
    ).toEqual([
      [
        [-10, 0],
        [0, 0],
        [10, 0],
      ],
    ]);
  });

  it('preserves separate re-entry paths', () => {
    expect(
      clipLineString(
        [
          [-5, 0],
          [20, 0],
          [20, 5],
          [-5, 5],
        ],
        BOUNDS,
      ),
    ).toEqual([
      [
        [-5, 0],
        [10, 0],
      ],
      [
        [10, 5],
        [-5, 5],
      ],
    ]);
  });

  it('discards a path wholly outside the rectangle', () => {
    expect(
      clipLineString(
        [
          [20, 20],
          [30, 30],
        ],
        BOUNDS,
      ),
    ).toEqual([]);
  });
});

describe('clipPolygonRings', () => {
  it('clips a polygon ring and removes its repeated closing point', () => {
    const rings = clipPolygonRings(
      [
        [
          [-20, -20],
          [20, -20],
          [20, 20],
          [-20, 20],
          [-20, -20],
        ],
      ],
      BOUNDS,
    );

    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);

    for (const point of rings[0] ?? []) {
      expect(point[0]).toBeGreaterThanOrEqual(BOUNDS.minX);
      expect(point[0]).toBeLessThanOrEqual(BOUNDS.maxX);
      expect(point[1]).toBeGreaterThanOrEqual(BOUNDS.minZ);
      expect(point[1]).toBeLessThanOrEqual(BOUNDS.maxZ);
    }
  });
});
