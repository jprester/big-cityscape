import { describe, expect, it } from 'vitest';
import type { SyntheticBuildingPlacement } from '../model/buildingPlacement';
import type { BuildingSlot } from '../model/buildingSlot';
import { planTexturedBuildingPlacements } from './planTexturedBuildingPlacements';

const SLOT: BuildingSlot = {
  id: 'slot-1',
  districtId: 'district-1',
  blockId: 'block-1',
  seed: 1,
  center: [10, 20],
  widthMetres: 18,
  depthMetres: 32,
  targetHeightMetres: 55,
  rotationRadians: 0.25,
  allowedUses: ['residential'],
  allowedForms: ['tower'],
  heightClass: 'mid-rise',
  role: 'fabric',
};

const PLACEMENT: SyntheticBuildingPlacement = {
  id: 'placement-1',
  slotId: SLOT.id,
  districtId: SLOT.districtId,
  blockId: SLOT.blockId,
  seed: 2,
  assetId: 'semantic-placeholder',
  center: SLOT.center,
  rotationRadians: SLOT.rotationRadians,
  rotateAssetQuarterTurn: false,
  uniformScale: 0.5,
  heightScale: 1.4,
  dimensionsMetres: { width: 18, height: 55, depth: 32 },
  compatibilityScore: 0,
};

describe('planTexturedBuildingPlacements', () => {
  it('keeps authored dimensions and unit scale while allowing a quarter turn', () => {
    const plan = planTexturedBuildingPlacements(
      [PLACEMENT],
      [{ id: 'authored', widthMetres: 30, heightMetres: 48, depthMetres: 16 }],
      [SLOT],
      'test-pack',
    );

    expect(plan.unfilledPlacementIds).toEqual([]);
    expect(plan.assignments).toHaveLength(1);
    expect(plan.assignments[0]).toMatchObject({
      modelId: 'authored',
      placement: {
        uniformScale: 1,
        heightScale: 1,
        rotateAssetQuarterTurn: true,
        dimensionsMetres: { width: 16, height: 48, depth: 30 },
      },
    });
    expect(plan.assignments[0]?.placement.rotationRadians).toBeCloseTo(
      SLOT.rotationRadians + Math.PI / 2,
    );
  });

  it('reports a slot when no authored footprint fits', () => {
    const plan = planTexturedBuildingPlacements(
      [PLACEMENT],
      [{ id: 'oversize', widthMetres: 50, heightMetres: 48, depthMetres: 40 }],
      [SLOT],
      'test-pack',
    );

    expect(plan.assignments).toEqual([]);
    expect(plan.placements).toEqual([]);
    expect(plan.unfilledPlacementIds).toEqual([PLACEMENT.id]);
  });
});
