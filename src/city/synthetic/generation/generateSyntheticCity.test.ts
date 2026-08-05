import { describe, expect, it } from 'vitest';
import type { BuildingSlot } from '../model/buildingSlot';
import type { SyntheticBounds2 } from '../model/proofDistrict';
import {
  DEFAULT_SYNTHETIC_CITY_CONFIG,
  generateSyntheticCity,
} from './generateSyntheticCity';

describe('generateSyntheticCity', () => {
  it('composes the centred 2 km city from sixteen positioned districts', () => {
    const city = generateSyntheticCity();

    expect(city.bounds).toEqual({
      minX: -1_000,
      maxX: 1_000,
      minZ: -1_000,
      maxZ: 1_000,
    });
    expect(city.metadata).toEqual({
      districtCount: 16,
      blockCount: 400,
      slotCount: 1_242,
      landmarkDistrictId: 'synthetic-city/district-r1-c1',
      profileCounts: {
        centre: 4,
        urban: 8,
        edge: 4,
      },
    });
    expect(city.districts.filter((district) => district.hasLandmark)).toHaveLength(1);
    expect(new Set(city.districts.map((district) => district.id)).size).toBe(16);
    expect(new Set(city.blocks.map((block) => block.id)).size).toBe(400);
    expect(new Set(city.slots.map((slot) => slot.id)).size).toBe(1_242);
  });

  it('keeps districts inside the city and touching only at boundaries', () => {
    const city = generateSyntheticCity();

    for (const [index, district] of city.districts.entries()) {
      expect(contains(city.bounds, district.bounds)).toBe(true);

      for (const other of city.districts.slice(index + 1)) {
        expect(overlaps(district.bounds, other.bounds)).toBe(false);
      }
    }
  });

  it('creates a coherent centre-to-edge height gradient', () => {
    const city = generateSyntheticCity();
    const averageByProfile = {
      centre: averageSlotHeight(slotsForProfile(city, 'centre')),
      urban: averageSlotHeight(slotsForProfile(city, 'urban')),
      edge: averageSlotHeight(slotsForProfile(city, 'edge')),
    };
    const edgeTallSlots = slotsForProfile(city, 'edge').filter(
      (slot) =>
        slot.heightClass === 'high-rise' || slot.heightClass === 'skyscraper',
    );

    expect(averageByProfile.centre).toBeGreaterThan(averageByProfile.urban);
    expect(averageByProfile.urban).toBeGreaterThan(averageByProfile.edge);
    expect(edgeTallSlots).toEqual([]);
    expect(city.slots.filter((slot) => slot.role === 'landmark')).toHaveLength(1);
  });

  it('is repeatable while allowing a new seed to change semantic output', () => {
    const first = generateSyntheticCity();
    const repeated = generateSyntheticCity();
    const changed = generateSyntheticCity({
      ...DEFAULT_SYNTHETIC_CITY_CONFIG,
      seed: DEFAULT_SYNTHETIC_CITY_CONFIG.seed + 1,
    });

    expect(repeated).toEqual(first);
    expect(changed.districts.map((district) => district.bounds)).toEqual(
      first.districts.map((district) => district.bounds),
    );
    expect(changed).not.toEqual(first);
  });
});

function slotsForProfile(
  city: ReturnType<typeof generateSyntheticCity>,
  profileId: 'centre' | 'urban' | 'edge',
): readonly BuildingSlot[] {
  return city.districts
    .filter((district) => district.compositionProfileId === profileId)
    .flatMap((district) => district.slots);
}

function averageSlotHeight(slots: readonly BuildingSlot[]): number {
  return (
    slots.reduce((total, slot) => total + slot.targetHeightMetres, 0) /
    slots.length
  );
}

function contains(outer: SyntheticBounds2, inner: SyntheticBounds2): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minZ >= outer.minZ &&
    inner.maxZ <= outer.maxZ
  );
}

function overlaps(first: SyntheticBounds2, second: SyntheticBounds2): boolean {
  return (
    first.minX < second.maxX &&
    first.maxX > second.minX &&
    first.minZ < second.maxZ &&
    first.maxZ > second.minZ
  );
}
