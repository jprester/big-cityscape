import type { SyntheticBuildingPlacement } from './buildingPlacement';
import type { RejectedAssetSlotResult } from './assetSlotSelection';

export type SyntheticAssetUsage = Readonly<{
  assetId: string;
  count: number;
}>;

export type SyntheticPlacementDiagnostic = Readonly<{
  slotId: string;
  compatibleCandidates: number;
}>;

export type SyntheticDistrictPopulation = Readonly<{
  districtId: string;
  districtSeed: number;
  placements: readonly SyntheticBuildingPlacement[];
  placementDiagnostics: readonly SyntheticPlacementDiagnostic[];
  rejections: readonly RejectedAssetSlotResult[];
  assetUsage: readonly SyntheticAssetUsage[];
  metadata: Readonly<{
    slotCount: number;
    placedCount: number;
    rejectedCount: number;
    distinctAssetCount: number;
  }>;
}>;
