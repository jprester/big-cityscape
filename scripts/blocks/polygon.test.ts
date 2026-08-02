import { describe, expect, it } from 'vitest';
import {
  insetConvexPolygon,
  isConvexPolygon,
  minimumPolygonDistance,
  minimumPolygonPathDistance,
  polygonArea,
  polygonCentroid,
  polygonsIntersect,
} from './polygon';

const SQUARE = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
] as const;

describe('block polygon geometry', () => {
  it('insets a convex block by a constant distance', () => {
    expect(insetConvexPolygon(SQUARE, 10)).toEqual([
      [10, 10],
      [90, 10],
      [90, 90],
      [10, 90],
    ]);
    expect(polygonArea(SQUARE)).toBe(10_000);
    expect(polygonCentroid(SQUARE)).toEqual([50, 50]);
  });

  it('rejects concave input for the current inset stage', () => {
    const concave = [
      [0, 0],
      [100, 0],
      [50, 50],
      [100, 100],
      [0, 100],
    ] as const;

    expect(isConvexPolygon(concave)).toBe(false);
    expect(() => insetConvexPolygon(concave, 10)).toThrow(/convex/);
  });

  it('rejects an acute-corner miter that escapes the source polygon', () => {
    const acuteTriangle = [
      [0, 0],
      [100, 0],
      [1, 0.1],
    ] as const;

    expect(() => insetConvexPolygon(acuteTriangle, 6)).toThrow(/escapes/);
  });

  it('detects polygon intersections and true separation', () => {
    const overlapping = [
      [90, 20],
      [120, 20],
      [120, 80],
      [90, 80],
    ] as const;
    const separated = [
      [120, 20],
      [140, 20],
      [140, 80],
      [120, 80],
    ] as const;

    expect(polygonsIntersect(SQUARE, overlapping)).toBe(true);
    expect(polygonsIntersect(SQUARE, separated)).toBe(false);
    expect(minimumPolygonDistance(SQUARE, separated)).toBe(20);
  });

  it('measures the closest rail-path distance', () => {
    expect(
      minimumPolygonPathDistance(SQUARE, [
        [
          [115, -50],
          [115, 150],
        ],
      ]),
    ).toBe(15);
  });
});
