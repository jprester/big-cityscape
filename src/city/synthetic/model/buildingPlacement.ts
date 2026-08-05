import type { SyntheticPoint2 } from './buildingSlot';

export type SyntheticBuildingPlacement = Readonly<{
  id: string;
  slotId: string;
  districtId: string;
  blockId: string;
  seed: number;
  assetId: string;
  center: SyntheticPoint2;
  rotationRadians: number;
  rotateAssetQuarterTurn: boolean;
  uniformScale: number;
  heightScale: number;
  dimensionsMetres: Readonly<{
    width: number;
    height: number;
    depth: number;
  }>;
  compatibilityScore: number;
}>;
