import { describe, expect, it } from 'vitest';
import type { SyntheticStreetCorridor } from '../model/streetCorridor';
import { deriveSyntheticStreetLamps } from './deriveSyntheticStreetLamps';

const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 } as const;
const streets: readonly SyntheticStreetCorridor[] = [
  {
    id: 'secondary-ns',
    districtId: 'district',
    hierarchyId: 'secondary',
    axis: 'north-south',
    context: 'district-internal',
    bounds: { minX: -12, maxX: 12, minZ: -90, maxZ: 90 },
  },
  {
    id: 'arterial-ew',
    districtId: null,
    hierarchyId: 'arterial',
    axis: 'east-west',
    context: 'district-boundary',
    bounds: { minX: -100, maxX: 100, minZ: -18, maxZ: 18 },
  },
  {
    id: 'local-ew',
    districtId: 'district',
    hierarchyId: 'local',
    axis: 'east-west',
    context: 'district-internal',
    bounds: { minX: -90, maxX: 90, minZ: 40, maxZ: 52 },
  },
];

describe('deriveSyntheticStreetLamps', () => {
  it('is deterministic and independent of incoming street order', () => {
    const first = deriveSyntheticStreetLamps('lamps', 123, bounds, streets);
    const reordered = deriveSyntheticStreetLamps(
      'lamps',
      123,
      bounds,
      [...streets].reverse(),
    );

    expect(reordered).toEqual(first);
    expect(first.metadata.lampCount).toBeGreaterThan(0);
    expect(new Set(first.lamps.map((lamp) => lamp.id)).size).toBe(
      first.lamps.length,
    );
  });

  it('uses both road edges, skips local streets, and remains inside bounds', () => {
    const plan = deriveSyntheticStreetLamps('lamps', 123, bounds, streets);

    expect(plan.lamps.every((lamp) => lamp.streetId !== 'local-ew')).toBe(true);
    expect(plan.metadata).toMatchObject({
      lampCount: plan.lamps.length,
      arterialLampCount: expect.any(Number),
      secondaryLampCount: expect.any(Number),
    });
    expect(plan.lamps.some((lamp) => lamp.facing[0] === 1)).toBe(true);
    expect(plan.lamps.some((lamp) => lamp.facing[0] === -1)).toBe(true);
    expect(plan.lamps.some((lamp) => lamp.facing[1] === 1)).toBe(true);
    expect(plan.lamps.some((lamp) => lamp.facing[1] === -1)).toBe(true);

    for (const lamp of plan.lamps) {
      expect(lamp.position[0]).toBeGreaterThanOrEqual(bounds.minX);
      expect(lamp.position[0]).toBeLessThanOrEqual(bounds.maxX);
      expect(lamp.position[1]).toBeGreaterThanOrEqual(bounds.minZ);
      expect(lamp.position[1]).toBeLessThanOrEqual(bounds.maxZ);
    }
  });

  it('rejects invalid derivation inputs', () => {
    expect(() => deriveSyntheticStreetLamps('', 123, bounds, streets)).toThrow(
      /non-empty ID/,
    );
    expect(() =>
      deriveSyntheticStreetLamps(
        'lamps',
        123,
        { minX: 1, maxX: 1, minZ: 0, maxZ: 1 },
        streets,
      ),
    ).toThrow(/positive city bounds/);
  });
});
