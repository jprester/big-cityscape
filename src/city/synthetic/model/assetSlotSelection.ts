import type { SyntheticBuildingPlacement } from './buildingPlacement';

export const ASSET_SLOT_REJECTION_REASONS = [
  'disabled',
  'use-mismatch',
  'form-mismatch',
  'height-class-mismatch',
  'role-mismatch',
  'city-limit-reached',
  'footprint-incompatible',
  'height-incompatible',
] as const;

export type AssetSlotRejectionReason =
  (typeof ASSET_SLOT_REJECTION_REASONS)[number];

export type AssetUsageCounts = ReadonlyMap<string, number>;

export type SelectedAssetSlotResult = Readonly<{
  status: 'selected';
  placement: SyntheticBuildingPlacement;
  compatibleCandidates: number;
}>;

export type RejectedAssetSlotResult = Readonly<{
  status: 'rejected';
  slotId: string;
  consideredAssets: number;
  rejectedByReason: Readonly<Record<AssetSlotRejectionReason, number>>;
}>;

export type AssetSlotSelectionResult =
  | SelectedAssetSlotResult
  | RejectedAssetSlotResult;
