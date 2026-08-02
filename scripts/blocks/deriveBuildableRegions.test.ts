import { describe, expect, it } from 'vitest';
import { deriveBuildableRegions } from './deriveBuildableRegions';
import { pointInPolygon, polygonArea } from './polygon';

describe('deriveBuildableRegions', () => {
  it('preserves one full constant-distance region for a convex block', () => {
    const result = deriveBuildableRegions(
      [
        [0, 0],
        [100, 0],
        [100, 80],
        [0, 80],
      ],
      10,
    );

    expect(result).toEqual([
      {
        derivation: 'convex-inset',
        polygon: [
          [10, 10],
          [90, 10],
          [90, 70],
          [10, 70],
        ],
      },
    ]);
  });

  it('preserves several non-overlapping inset regions for a concave block', () => {
    const block = [
      [0, 0],
      [100, 0],
      [100, 35],
      [50, 35],
      [50, 90],
      [0, 90],
    ] as const;
    const result = deriveBuildableRegions(block, 6);

    expect(result.length).toBeGreaterThan(1);
    expect(result.every((region) => region.derivation === 'triangulated-inset')).toBe(
      true,
    );
    expect(
      result.every((region) =>
        region.polygon.every((point) => pointInPolygon(point, block)),
      ),
    ).toBe(true);
  });

  it('skips an acute ear whose miter escapes and retains other viable regions', () => {
    const block = [
      [0, 0],
      [100, 0],
      [1, 0.1],
      [100, 100],
      [0, 100],
    ] as const;
    const result = deriveBuildableRegions(block, 6);

    expect(result.length).toBeGreaterThan(0);
    expect(
      result.reduce((total, region) => total + polygonArea(region.polygon), 0),
    ).toBeGreaterThan(3_000);
    expect(
      result.every((region) =>
        region.polygon.every((point) => pointInPolygon(point, block)),
      ),
    ).toBe(true);
  });
});
