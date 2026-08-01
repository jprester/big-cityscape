import { describe, expect, it } from 'vitest';
import { polygonArea } from './polygon';
import { triangulateSimplePolygon } from './triangulation';

const CONCAVE_BLOCK = [
  [0, 0],
  [80, 0],
  [80, 30],
  [40, 30],
  [40, 70],
  [0, 70],
] as const;

describe('triangulateSimplePolygon', () => {
  it('triangulates a concave block while preserving exact area', () => {
    const triangles = triangulateSimplePolygon(CONCAVE_BLOCK);

    expect(triangles).toHaveLength(CONCAVE_BLOCK.length - 2);
    expect(
      triangles.reduce((total, triangle) => total + polygonArea(triangle), 0),
    ).toBeCloseTo(polygonArea(CONCAVE_BLOCK), 8);
  });

  it('is deterministic across polygon winding', () => {
    const forwardAreas = triangulateSimplePolygon(CONCAVE_BLOCK)
      .map(polygonArea)
      .sort((first, second) => first - second);
    const reversedAreas = triangulateSimplePolygon([...CONCAVE_BLOCK].reverse())
      .map(polygonArea)
      .sort((first, second) => first - second);

    expect(reversedAreas).toEqual(forwardAreas);
  });

  it('removes redundant collinear vertices', () => {
    const polygon = [
      [0, 0],
      [40, 0],
      [80, 0],
      [80, 60],
      [0, 60],
    ] as const;

    expect(triangulateSimplePolygon(polygon)).toHaveLength(2);
  });
});
