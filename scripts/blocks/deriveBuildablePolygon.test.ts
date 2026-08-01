import { describe, expect, it } from 'vitest';
import { deriveBuildablePolygon } from './deriveBuildablePolygon';
import { pointInPolygon, polygonArea } from './polygon';

describe('deriveBuildablePolygon', () => {
  it('preserves the full constant-distance inset for convex blocks', () => {
    const result = deriveBuildablePolygon(
      [
        [0, 0],
        [100, 0],
        [100, 80],
        [0, 80],
      ],
      10,
    );

    expect(result).toEqual({
      derivation: 'convex-inset',
      polygon: [
        [10, 10],
        [90, 10],
        [90, 70],
        [10, 70],
      ],
    });
  });

  it('selects a conservative inset triangle for a concave block', () => {
    const block = [
      [0, 0],
      [100, 0],
      [100, 35],
      [50, 35],
      [50, 90],
      [0, 90],
    ] as const;
    const result = deriveBuildablePolygon(block, 6);

    expect(result.derivation).toBe('triangulated-inset');
    expect(result.polygon).toHaveLength(3);
    expect(polygonArea(result.polygon)).toBeGreaterThan(300);
    expect(result.polygon.every((point) => pointInPolygon(point, block))).toBe(true);
  });
});
