import { describe, expect, it } from 'vitest';
import {
  BUILDING_ASSET_CATALOG,
  BUILDING_ASSET_FORMS,
  BUILDING_ASSET_USES,
  BUILDING_HEIGHT_CLASSES,
  BUILDING_PLACEMENT_ROLES,
  GENERATED_BUILDING_ASSET_CATALOG,
  findOrphanedBuildingAssetOverrideIds,
} from './buildingAssetCatalog';

describe('BUILDING_ASSET_CATALOG', () => {
  it('catalogues all exported GLBs with unique stable IDs', () => {
    expect(BUILDING_ASSET_CATALOG).toHaveLength(
      GENERATED_BUILDING_ASSET_CATALOG.assets.length,
    );
    expect(new Set(BUILDING_ASSET_CATALOG.map((asset) => asset.id)).size).toBe(
      BUILDING_ASSET_CATALOG.length,
    );
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

  it('reports stale overrides without making the catalogue fail', () => {
    expect(
      findOrphanedBuildingAssetOverrideIds(
        new Set(['retained-a', 'retained-b']),
        ['removed-z', 'retained-a', 'removed-c'],
      ),
    ).toEqual(['removed-c', 'removed-z']);
  });

  it('keeps the latest visually reviewed intake enabled and classified', () => {
    expect(reviewedAsset('high-rise-38')).toMatchObject({
      use: 'office',
      form: 'tower',
      heightClass: 'mid-rise',
      enabled: true,
    });
    expect(reviewedAsset('high-rise-39')).toMatchObject({
      use: 'office',
      form: 'slab',
      heightClass: 'mid-rise',
      enabled: true,
    });
    expect(reviewedAsset('high-rise-40')).toMatchObject({
      use: 'commercial',
      form: 'podium-tower',
      heightClass: 'low-rise',
      allowedUniformScale: [0.6, 1],
      enabled: true,
    });
    expect(reviewedAsset('residential-31')).toMatchObject({
      use: 'residential',
      form: 'tower',
      heightClass: 'mid-rise',
      enabled: true,
    });
    expect(reviewedAsset('residential-32')).toMatchObject({
      use: 'residential',
      form: 'podium-tower',
      heightClass: 'low-rise',
      enabled: true,
    });
  });
});

function reviewedAsset(id: string) {
  const asset = BUILDING_ASSET_CATALOG.find((candidate) => candidate.id === id);

  expect(asset, `Expected reviewed catalogue asset ${id}.`).toBeDefined();
  return asset;
}
