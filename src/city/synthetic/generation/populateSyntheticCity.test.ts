import { describe, expect, it } from 'vitest';
import {
  BUILDING_ASSET_CATALOG,
  type BuildingAssetCatalogEntry,
} from '../../assets/buildingAssetCatalog';
import type { BuildingSlot } from '../model/buildingSlot';
import type { SyntheticProofDistrict } from '../model/proofDistrict';
import type { SyntheticCity } from '../model/syntheticCity';
import { generateSyntheticCity } from './generateSyntheticCity';
import { populateSyntheticCity } from './populateSyntheticCity';

describe('populateSyntheticCity', () => {
  it('fills the 2 km city while enforcing every catalogue cap globally', () => {
    const city = generateSyntheticCity();
    const population = populateSyntheticCity(city);
    const catalogById = new Map(
      BUILDING_ASSET_CATALOG.map((asset) => [asset.id, asset]),
    );

    expect(population.metadata).toEqual({
      districtCount: 16,
      slotCount: 1_188,
      placedCount: 1_188,
      rejectedCount: 0,
      distinctAssetCount: population.assetUsage.length,
    });
    expect(population.metadata.distinctAssetCount).toBeGreaterThan(50);
    expect(population.rejections).toEqual([]);
    expect(population.districts).toHaveLength(16);
    expect(
      population.assetUsage.reduce((total, usage) => total + usage.count, 0),
    ).toBe(1_188);
    expect(Math.max(...population.assetUsage.map((usage) => usage.count))).toBeLessThan(90);

    for (const usage of population.assetUsage) {
      const asset = catalogById.get(usage.assetId);
      expect(asset, usage.assetId).toBeDefined();

      if (asset?.maximumPerCity !== null && asset?.maximumPerCity !== undefined) {
        expect(usage.count).toBeLessThanOrEqual(asset.maximumPerCity);
      }
    }
  });

  it('is independent of incoming district and catalogue order', () => {
    const city = generateSyntheticCity();
    const first = populateSyntheticCity(city);
    const reordered = populateSyntheticCity(
      { ...city, districts: [...city.districts].reverse() },
      [...BUILDING_ASSET_CATALOG].reverse(),
    );

    expect(reordered).toEqual(first);
  });

  it('carries a hard repetition cap across district boundaries', () => {
    const city = generateSyntheticCity();
    const firstDistrict = requireDistrict(city.districts[0]);
    const secondDistrict = requireDistrict(city.districts[1]);
    const firstSlot = requireLowRiseSlot(firstDistrict);
    const secondSlot = requireLowRiseSlot(secondDistrict);
    const cappedAsset = {
      ...requireAsset('residential-3'),
      maximumPerCity: 1,
    } satisfies BuildingAssetCatalogEntry;
    const firstReducedDistrict = withSlots(firstDistrict, [firstSlot]);
    const secondReducedDistrict = withSlots(secondDistrict, [secondSlot]);
    const reducedCity: SyntheticCity = {
      ...city,
      districts: [firstReducedDistrict, secondReducedDistrict],
      blocks: [],
      slots: [firstSlot, secondSlot],
      metadata: {
        ...city.metadata,
        districtCount: 2,
        blockCount: 0,
        slotCount: 2,
      },
    };
    const population = populateSyntheticCity(reducedCity, [cappedAsset]);

    expect(population.metadata.placedCount).toBe(1);
    expect(population.metadata.rejectedCount).toBe(1);
    expect(population.assetUsage).toEqual([
      { assetId: cappedAsset.id, count: 1 },
    ]);
    expect(population.rejections[0]?.rejectedByReason['city-limit-reached']).toBe(1);
  });
});

function requireDistrict(
  district: SyntheticProofDistrict | undefined,
): SyntheticProofDistrict {
  if (district === undefined) {
    throw new Error('Expected the synthetic city to contain a district.');
  }

  return district;
}

function requireLowRiseSlot(district: SyntheticProofDistrict): BuildingSlot {
  const slot = district.slots.find(
    (candidate) => candidate.heightClass === 'low-rise',
  );

  if (slot === undefined) {
    throw new Error(`Expected ${district.id} to contain a low-rise slot.`);
  }

  return slot;
}

function withSlots(
  district: SyntheticProofDistrict,
  slots: readonly BuildingSlot[],
): SyntheticProofDistrict {
  return {
    ...district,
    slots,
    metadata: {
      ...district.metadata,
      slotCount: slots.length,
    },
  };
}

function requireAsset(id: string): BuildingAssetCatalogEntry {
  const asset = BUILDING_ASSET_CATALOG.find((candidate) => candidate.id === id);

  if (asset === undefined) {
    throw new Error(`Expected catalogue asset ${id}.`);
  }

  return asset;
}
