import { describe, expect, it } from 'vitest';
import {
  BUILDING_ASSET_CATALOG,
  type BuildingAssetCatalogEntry,
} from '../../assets/buildingAssetCatalog';
import type { BuildingSlot } from '../model/buildingSlot';
import { generateProofDistrict } from './generateProofDistrict';
import { populateSyntheticDistrict } from './populateSyntheticDistrict';

describe('populateSyntheticDistrict', () => {
  it('fills the default proof district while respecting catalogue limits', () => {
    const district = generateProofDistrict();
    const population = populateSyntheticDistrict(district);
    const catalogById = new Map(
      BUILDING_ASSET_CATALOG.map((asset) => [asset.id, asset]),
    );

    expect(population.metadata).toEqual({
      slotCount: 79,
      placedCount: 79,
      rejectedCount: 0,
      distinctAssetCount: population.assetUsage.length,
    });
    expect(population.rejections).toEqual([]);
    expect(population.placementDiagnostics).toHaveLength(79);
    expect(
      population.placementDiagnostics.every(
        (diagnostic) => diagnostic.compatibleCandidates > 0,
      ),
    ).toBe(true);
    expect(
      population.assetUsage.reduce((sum, usage) => sum + usage.count, 0),
    ).toBe(79);

    for (const usage of population.assetUsage) {
      const asset = catalogById.get(usage.assetId);
      expect(asset, usage.assetId).toBeDefined();

      if (asset?.maximumPerCity !== null && asset?.maximumPerCity !== undefined) {
        expect(usage.count).toBeLessThanOrEqual(asset.maximumPerCity);
      }
    }
  });

  it('is independent of incoming slot and catalogue order', () => {
    const district = generateProofDistrict();
    const first = populateSyntheticDistrict(district);
    const reordered = populateSyntheticDistrict(
      { ...district, slots: [...district.slots].reverse() },
      [...BUILDING_ASSET_CATALOG].reverse(),
    );

    expect(reordered).toEqual(first);
    expect(first.placements.map((placement) => placement.slotId)).toEqual(
      [...district.slots.map((slot) => slot.id)].sort((a, b) =>
        a.localeCompare(b),
      ),
    );
  });

  it('records a rejection after the only compatible asset reaches its cap', () => {
    const district = generateProofDistrict();
    const slots = district.blocks
      .filter((block) => block.templateId === 'fabric-grid')
      .flatMap((block) => block.slots)
      .slice(0, 2);
    const cappedAsset = withMaximumPerCity(
      requireAsset('residential-3'),
      1,
    );
    const population = populateSyntheticDistrict(
      { id: district.id, seed: district.seed, slots },
      [cappedAsset],
    );

    expect(population.metadata).toEqual({
      slotCount: 2,
      placedCount: 1,
      rejectedCount: 1,
      distinctAssetCount: 1,
    });
    expect(population.assetUsage).toEqual([
      { assetId: cappedAsset.id, count: 1 },
    ]);
    expect(population.rejections[0]?.rejectedByReason).toEqual({
      disabled: 0,
      'use-mismatch': 0,
      'form-mismatch': 0,
      'height-class-mismatch': 0,
      'role-mismatch': 0,
      'city-limit-reached': 1,
      'footprint-incompatible': 0,
      'height-incompatible': 0,
    });
  });

  it('rejects duplicate slot IDs and cross-district slots', () => {
    const district = generateProofDistrict();
    const slot = requireSlot(district.slots[0]);

    expect(() =>
      populateSyntheticDistrict({
        id: district.id,
        seed: district.seed,
        slots: [slot, slot],
      }),
    ).toThrow(`Duplicate building slot ID: ${slot.id}.`);

    expect(() =>
      populateSyntheticDistrict({
        id: 'another-district',
        seed: district.seed,
        slots: [slot],
      }),
    ).toThrow(`belongs to ${district.id}, not another-district`);
  });
});

function requireAsset(id: string): BuildingAssetCatalogEntry {
  const asset = BUILDING_ASSET_CATALOG.find((entry) => entry.id === id);

  if (asset === undefined) {
    throw new Error(`Test asset ${id} is missing.`);
  }

  return asset;
}

function requireSlot(slot: BuildingSlot | undefined): BuildingSlot {
  if (slot === undefined) {
    throw new Error('Expected the proof district to contain a building slot.');
  }

  return slot;
}

function withMaximumPerCity(
  asset: BuildingAssetCatalogEntry,
  maximumPerCity: number,
): BuildingAssetCatalogEntry {
  return { ...asset, maximumPerCity };
}
