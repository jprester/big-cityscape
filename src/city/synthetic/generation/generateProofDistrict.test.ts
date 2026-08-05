import { describe, expect, it } from 'vitest';
import { BUILDING_ASSET_CATALOG } from '../../assets/buildingAssetCatalog';
import type { BuildingSlot } from '../model/buildingSlot';
import type { SyntheticBounds2 } from '../model/proofDistrict';
import {
  DEFAULT_PROOF_DISTRICT_CONFIG,
  generateProofDistrict,
} from './generateProofDistrict';
import { selectAssetForSlot } from './selectAssetForSlot';

describe('generateProofDistrict', () => {
  it('creates the centred 500 m proof district with stable block hierarchy', () => {
    const district = generateProofDistrict();

    expect(district.bounds).toEqual({
      minX: -250,
      maxX: 250,
      minZ: -250,
      maxZ: 250,
    });
    expect(district.metadata.blockCount).toBe(25);
    expect(district.metadata.profileCounts).toEqual({
      core: 9,
      transition: 16,
    });
    expect(district.metadata.templateCounts['anchor-and-fill']).toBe(8);
    expect(district.metadata.templateCounts['landmark-plaza']).toBe(1);
    expect(district.metadata.templateCounts['fabric-grid']).toBeGreaterThan(0);
    expect(district.metadata.templateCounts['edge-slabs']).toBeGreaterThan(0);
    expect(district.metadata.slotCount).toBe(district.slots.length);
    expect(new Set(district.blocks.map((block) => block.id)).size).toBe(25);
    expect(new Set(district.slots.map((slot) => slot.id)).size).toBe(
      district.slots.length,
    );
  });

  it('is repeatable for one seed and varies semantic output for another', () => {
    const first = generateProofDistrict();
    const repeated = generateProofDistrict();
    const changed = generateProofDistrict({
      ...DEFAULT_PROOF_DISTRICT_CONFIG,
      seed: DEFAULT_PROOF_DISTRICT_CONFIG.seed + 1,
    });

    expect(repeated).toEqual(first);
    expect(changed.blocks.map((block) => block.bounds)).toEqual(
      first.blocks.map((block) => block.bounds),
    );
    expect(changed).not.toEqual(first);
  });

  it('keeps blocks separated and every slot inside its buildable block', () => {
    const district = generateProofDistrict();

    for (const [firstIndex, first] of district.blocks.entries()) {
      expect(contains(district.bounds, first.bounds)).toBe(true);

      for (const second of district.blocks.slice(firstIndex + 1)) {
        expect(overlaps(first.bounds, second.bounds)).toBe(false);
      }

      for (const slot of first.slots) {
        expect(contains(first.buildableBounds, slotBounds(slot))).toBe(true);
      }

      for (const [slotIndex, slot] of first.slots.entries()) {
        for (const other of first.slots.slice(slotIndex + 1)) {
          expect(
            overlaps(slotBounds(slot), slotBounds(other)),
          ).toBe(false);
        }
      }
    }
  });

  it('emits slots that have at least one compatible reviewed real asset', () => {
    const district = generateProofDistrict();
    const failures = district.slots.flatMap((slot) => {
      const result = selectAssetForSlot(slot, BUILDING_ASSET_CATALOG);
      return result.status === 'selected' ? [] : [result];
    });

    expect(failures).toEqual([]);
  });

  it('rejects axis dimensions that do not fill the configured district', () => {
    expect(() =>
      generateProofDistrict({
        ...DEFAULT_PROOF_DISTRICT_CONFIG,
        columnWidthsMetres: [70, 85, 90, 75, 71],
      }),
    ).toThrow('occupy 501 m, not 500 m');
  });
});

function slotBounds(slot: BuildingSlot): SyntheticBounds2 {
  return {
    minX: slot.center[0] - slot.widthMetres / 2,
    maxX: slot.center[0] + slot.widthMetres / 2,
    minZ: slot.center[1] - slot.depthMetres / 2,
    maxZ: slot.center[1] + slot.depthMetres / 2,
  };
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
