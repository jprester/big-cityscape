import type {
  SyntheticAssetUsage,
  SyntheticPlacementDiagnostic,
} from './districtPopulation';
import type { SyntheticBuildingPlacement } from './buildingPlacement';
import type { RejectedAssetSlotResult } from './assetSlotSelection';

export type SyntheticDistrictPopulationSummary = Readonly<{
  districtId: string;
  slotCount: number;
  placedCount: number;
  rejectedCount: number;
}>;

export type SyntheticCityPopulation = Readonly<{
  cityId: string;
  citySeed: number;
  placements: readonly SyntheticBuildingPlacement[];
  placementDiagnostics: readonly SyntheticPlacementDiagnostic[];
  rejections: readonly RejectedAssetSlotResult[];
  assetUsage: readonly SyntheticAssetUsage[];
  districts: readonly SyntheticDistrictPopulationSummary[];
  metadata: Readonly<{
    districtCount: number;
    slotCount: number;
    placedCount: number;
    rejectedCount: number;
    distinctAssetCount: number;
  }>;
}>;
