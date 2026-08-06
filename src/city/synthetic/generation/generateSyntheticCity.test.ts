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
      slotCount: 1_188,
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
    expect(new Set(city.slots.map((slot) => slot.id)).size).toBe(1_188);
  });

  it('places sparse deterministic open space toward urban and edge districts', () => {
    const city = generateSyntheticCity();
    const parks = city.blocks.filter(
      (block) => block.templateId === 'open-space',
    );

    expect(parks).toHaveLength(16);
    expect(parks.every((park) => park.slots.length === 0)).toBe(true);

    for (const district of city.districts) {
      const districtParks = district.blocks.filter(
        (block) => block.templateId === 'open-space',
      );
      const expectedCount =
        district.compositionProfileId === 'centre'
          ? 0
          : district.compositionProfileId === 'urban'
            ? 1
            : 2;

      expect(districtParks, district.id).toHaveLength(expectedCount);

      if (district.compositionProfileId === 'urban') {
        expect(districtParks[0]?.profileId).toBe('transition');
      }

      if (district.compositionProfileId === 'edge') {
        const [first, second] = districtParks;
        expect(first).toBeDefined();
        expect(second).toBeDefined();
        expect(
          Math.abs((first?.gridColumn ?? 0) - (second?.gridColumn ?? 0)) +
            Math.abs((first?.gridRow ?? 0) - (second?.gridRow ?? 0)),
        ).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('creates one continuous gently offset spine across four districts', () => {
    const city = generateSyntheticCity();
    const bandBlocks = city.blocks
      .filter((block) => block.layoutVariationId === 'offset-band')
      .toSorted(
        (first, second) => blockCenterZ(first) - blockCenterZ(second),
      );
    const offsets = bandBlocks.map((block) => block.layoutOffsetMetres[0]);

    expect(bandBlocks).toHaveLength(20);
    expect(bandBlocks.every((block) => block.gridColumn === 2)).toBe(true);
    expect(new Set(bandBlocks.map((block) => block.districtId))).toEqual(
      new Set([
        'synthetic-city/district-r0-c2',
        'synthetic-city/district-r1-c2',
        'synthetic-city/district-r2-c2',
        'synthetic-city/district-r3-c2',
      ]),
    );
    expect(offsets[0]).toBe(0);
    expect(offsets.at(-1)).toBe(0);
    expect(Math.max(...offsets)).toBeGreaterThan(7.9);
    expect(Math.min(...offsets)).toBeLessThan(-7.9);

    for (let index = 1; index < offsets.length; index += 1) {
      expect(
        Math.abs((offsets[index] ?? 0) - (offsets[index - 1] ?? 0)),
      ).toBeLessThan(2.7);
    }
  });

  it('keeps districts inside the city and touching only at boundaries', () => {
    const city = generateSyntheticCity();

    for (const [index, district] of city.districts.entries()) {
      expect(contains(city.bounds, district.bounds)).toBe(true);

      for (const [blockIndex, block] of district.blocks.entries()) {
        expect(contains(district.bounds, block.bounds)).toBe(true);

        for (const otherBlock of district.blocks.slice(blockIndex + 1)) {
          expect(overlaps(block.bounds, otherBlock.bounds)).toBe(false);
        }

        for (const slot of block.slots) {
          expect(contains(block.buildableBounds, slotBounds(slot))).toBe(true);
        }
      }

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
    expect(changed.blocks.map((block) => block.bounds)).toEqual(
      first.blocks.map((block) => block.bounds),
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

function blockCenterZ(
  block: ReturnType<typeof generateSyntheticCity>['blocks'][number],
): number {
  return (block.bounds.minZ + block.bounds.maxZ) / 2;
}

function slotBounds(slot: BuildingSlot): SyntheticBounds2 {
  return {
    minX: slot.center[0] - slot.widthMetres / 2,
    maxX: slot.center[0] + slot.widthMetres / 2,
    minZ: slot.center[1] - slot.depthMetres / 2,
    maxZ: slot.center[1] + slot.depthMetres / 2,
  };
}

function averageSlotHeight(slots: readonly BuildingSlot[]): number {
  return (
    slots.reduce((total, slot) => total + slot.targetHeightMetres, 0) /
    slots.length
  );
}

function contains(outer: SyntheticBounds2, inner: SyntheticBounds2): boolean {
  const toleranceMetres = 1e-9;

  return (
    inner.minX >= outer.minX - toleranceMetres &&
    inner.maxX <= outer.maxX + toleranceMetres &&
    inner.minZ >= outer.minZ - toleranceMetres &&
    inner.maxZ <= outer.maxZ + toleranceMetres
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
