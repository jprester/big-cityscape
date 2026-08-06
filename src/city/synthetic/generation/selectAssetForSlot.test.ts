import { describe, expect, it } from 'vitest';
import type { BuildingAssetCatalogEntry } from '../../assets/buildingAssetCatalog';
import type { BuildingSlot } from '../model/buildingSlot';
import { selectAssetForSlot } from './selectAssetForSlot';

describe('selectAssetForSlot', () => {
  it('is deterministic and independent of catalogue order', () => {
    const slot = createSlot();
    const assets = [
      createAsset('office-a', { selectionWeight: 1.4 }),
      createAsset('office-b', { selectionWeight: 0.8 }),
      createAsset('office-c', { selectionWeight: 1.1 }),
    ];
    const first = selectAssetForSlot(slot, assets);
    const repeated = selectAssetForSlot(slot, [...assets].reverse());

    expect(first).toEqual(repeated);
    expect(first.status).toBe('selected');
  });

  it('softly favours a less-used compatible asset without rejecting reuse', () => {
    const slot = createSlot();
    const frequent = createAsset('z-frequent');
    const fresh = createAsset('a-fresh');
    const balanced = selectAssetForSlot(
      slot,
      [frequent, fresh],
      new Map([[frequent.id, 1_000]]),
    );
    const onlyFrequent = selectAssetForSlot(
      slot,
      [frequent],
      new Map([[frequent.id, 1_000]]),
    );

    expect(balanced.status).toBe('selected');
    expect(onlyFrequent.status).toBe('selected');

    if (balanced.status === 'selected') {
      expect(balanced.placement.assetId).toBe(fresh.id);
      expect(balanced.compatibleCandidates).toBe(2);
    }

    if (onlyFrequent.status === 'selected') {
      expect(onlyFrequent.placement.assetId).toBe(frequent.id);
    }
  });

  it('rotates an elongated asset when only the quarter-turned footprint fits', () => {
    const result = selectAssetForSlot(
      createSlot({
        widthMetres: 22,
        depthMetres: 52,
        targetHeightMetres: 80,
      }),
      [
        createAsset('wide-office', {
          nominalSizeMetres: { width: 50, height: 100, depth: 20 },
          allowedUniformScale: [0.8, 1.2],
          allowedHeightScale: [1, 1],
        }),
      ],
    );

    expect(result.status).toBe('selected');

    if (result.status !== 'selected') {
      return;
    }

    expect(result.placement.rotateAssetQuarterTurn).toBe(true);
    expect(result.placement.rotationRadians).toBeCloseTo(Math.PI / 2, 8);
    expect(result.placement.dimensionsMetres).toEqual({
      width: 16,
      height: 80,
      depth: 40,
    });
  });

  it('uses compatible uniform and height scales without distorting the footprint', () => {
    const result = selectAssetForSlot(
      createSlot({
        widthMetres: 30,
        depthMetres: 15,
        targetHeightMetres: 75,
      }),
      [
        createAsset('exact-fit', {
          nominalSizeMetres: { width: 20, height: 50, depth: 10 },
          allowedUniformScale: [1, 1.5],
          allowedHeightScale: [1, 1],
        }),
      ],
    );

    expect(result.status).toBe('selected');

    if (result.status !== 'selected') {
      return;
    }

    expect(result.placement.uniformScale).toBeCloseTo(1.5, 8);
    expect(result.placement.heightScale).toBeCloseTo(1, 8);
    expect(result.placement.dimensionsMetres).toEqual({
      width: 30,
      height: 75,
      depth: 15,
    });
  });

  it('reports the first incompatible stage for every rejected asset', () => {
    const slot = createSlot({ widthMetres: 50, depthMetres: 50 });
    const assets = [
      createAsset('disabled', { enabled: false }),
      createAsset('wrong-use', { use: 'residential' }),
      createAsset('wrong-form', { form: 'slab' }),
      createAsset('wrong-height-class', { heightClass: 'mid-rise' }),
      createAsset('wrong-role', { placementRoles: ['fabric'] }),
      createAsset('at-limit', { maximumPerCity: 1 }),
      createAsset('too-wide', {
        nominalSizeMetres: { width: 80, height: 100, depth: 80 },
      }),
      createAsset('too-short', {
        nominalSizeMetres: { width: 20, height: 30, depth: 20 },
      }),
    ];
    const result = selectAssetForSlot(
      slot,
      assets,
      new Map([['at-limit', 1]]),
    );

    expect(result).toEqual({
      status: 'rejected',
      slotId: slot.id,
      consideredAssets: 8,
      rejectedByReason: {
        disabled: 1,
        'use-mismatch': 1,
        'form-mismatch': 1,
        'height-class-mismatch': 1,
        'role-mismatch': 1,
        'city-limit-reached': 1,
        'footprint-incompatible': 1,
        'height-incompatible': 1,
      },
    });
  });

  it('rejects invalid slot definitions before selection', () => {
    expect(() =>
      selectAssetForSlot(createSlot({ widthMetres: 0 }), [createAsset('a')]),
    ).toThrow(RangeError);
    expect(() =>
      selectAssetForSlot(createSlot({ allowedForms: [] }), [createAsset('a')]),
    ).toThrow('at least one use and form');
    expect(() =>
      selectAssetForSlot(
        createSlot(),
        [createAsset('a')],
        new Map([['a', -1]]),
      ),
    ).toThrow('non-negative integer');
  });
});

function createSlot(overrides: Partial<BuildingSlot> = {}): BuildingSlot {
  return {
    id: 'district-a/block-3/slot-2',
    districtId: 'district-a',
    blockId: 'block-3',
    seed: 42,
    center: [120, -80],
    widthMetres: 30,
    depthMetres: 30,
    targetHeightMetres: 100,
    rotationRadians: 0,
    allowedUses: ['office'],
    allowedForms: ['tower'],
    heightClass: 'high-rise',
    role: 'anchor',
    ...overrides,
  };
}

function createAsset(
  id: string,
  overrides: Partial<BuildingAssetCatalogEntry> = {},
): BuildingAssetCatalogEntry {
  const base: BuildingAssetCatalogEntry = {
    id,
    sourceCategory: 'high-rise',
    assetPath: `assets/test/${id}.glb`,
    sourceDimensions: { width: 20, height: 100, depth: 20 },
    sourceBounds: { min: [-10, 0, -10], max: [10, 100, 10] },
    proportions: { footprintAspect: 1, slenderness: 5 },
    geometry: {
      meshes: 1,
      vertices: 8,
      triangles: 12,
      materials: 1,
      indexedMeshes: 1,
      meshesWithNormals: 1,
      meshesWithUvs: 1,
    },
    audit: {
      horizontalCenterOffsetRatio: 0,
      groundOffsetRatio: 0,
      shapeFingerprint: `fingerprint-${id}`,
      duplicateShapeOf: null,
      warnings: [],
    },
    use: 'office',
    form: 'tower',
    heightClass: 'high-rise',
    placementRoles: ['anchor'],
    nominalSizeMetres: { width: 20, height: 100, depth: 20 },
    allowedUniformScale: [1, 1],
    allowedHeightScale: [1, 1],
    maximumPerCity: null,
    selectionWeight: 1,
    enabled: true,
  };

  return { ...base, ...overrides };
}
