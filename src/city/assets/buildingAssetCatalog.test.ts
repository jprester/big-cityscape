import { describe, expect, it } from 'vitest';
import {
  BUILDING_ASSET_CATALOG,
  BUILDING_ASSET_FORMS,
  BUILDING_ASSET_USES,
  BUILDING_HEIGHT_CLASSES,
  BUILDING_PLACEMENT_ROLES,
} from './buildingAssetCatalog';

describe('BUILDING_ASSET_CATALOG', () => {
  it('catalogues all exported GLBs with unique stable IDs', () => {
    expect(BUILDING_ASSET_CATALOG).toHaveLength(88);
    expect(new Set(BUILDING_ASSET_CATALOG.map((asset) => asset.id)).size).toBe(88);
    expect(countBy(BUILDING_ASSET_CATALOG.map((asset) => asset.sourceCategory))).toEqual({
      'high-rise': 37,
      residential: 29,
      skyscraper: 22,
    });
  });

  it('provides valid placement metadata for every asset', () => {
    for (const asset of BUILDING_ASSET_CATALOG) {
      expect(BUILDING_ASSET_USES).toContain(asset.use);
      expect(BUILDING_ASSET_FORMS).toContain(asset.form);
      expect(BUILDING_HEIGHT_CLASSES).toContain(asset.heightClass);
      expect(asset.placementRoles.length).toBeGreaterThan(0);

      for (const role of asset.placementRoles) {
        expect(BUILDING_PLACEMENT_ROLES).toContain(role);
      }

      expect(asset.nominalSizeMetres.width).toBeGreaterThan(0);
      expect(asset.nominalSizeMetres.height).toBeGreaterThan(0);
      expect(asset.nominalSizeMetres.depth).toBeGreaterThan(0);
      expect(asset.allowedUniformScale[0]).toBeLessThanOrEqual(
        asset.allowedUniformScale[1],
      );
      expect(asset.allowedHeightScale[0]).toBeLessThanOrEqual(
        asset.allowedHeightScale[1],
      );
      expect(asset.selectionWeight).toBeGreaterThan(0);
    }
  });

  it('records reviewed reclassifications and retired duplicates', () => {
    expect(asset('high-rise-17')).toMatchObject({
      use: 'commercial',
      form: 'complex',
      heightClass: 'mid-rise',
    });
    expect(asset('high-rise-31')).toMatchObject({
      use: 'commercial',
      form: 'perimeter',
      heightClass: 'mid-rise',
    });
    expect(asset('residential-20')).toMatchObject({ enabled: false });
    expect(asset('skyscraper-6')).toMatchObject({ enabled: false });
    expect(asset('high-rise-5')).toMatchObject({ enabled: false });
  });
});

function asset(id: string) {
  const result = BUILDING_ASSET_CATALOG.find((entry) => entry.id === id);

  if (result === undefined) {
    throw new Error(`Missing test asset ${id}.`);
  }

  return result;
}

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return counts;
}
