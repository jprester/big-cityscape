import {
  BUILDING_ASSET_CATALOG,
  type BuildingAssetCatalogEntry,
} from '../../assets/buildingAssetCatalog';
import type { BuildingSlot } from '../model/buildingSlot';
import type { SyntheticDistrictPopulation } from '../model/districtPopulation';
import type { AssetUsageCounts } from '../model/assetSlotSelection';
import { selectAssetForSlot } from './selectAssetForSlot';

const EMPTY_USAGE_COUNTS: AssetUsageCounts = new Map();

export type SyntheticDistrictSlotSource = Readonly<{
  id: string;
  seed: number;
  slots: readonly BuildingSlot[];
}>;

export function populateSyntheticDistrict(
  district: SyntheticDistrictSlotSource,
  assets: readonly BuildingAssetCatalogEntry[] = BUILDING_ASSET_CATALOG,
  initialUsageCounts: AssetUsageCounts = EMPTY_USAGE_COUNTS,
): SyntheticDistrictPopulation {
  validateInputs(district, assets, initialUsageCounts);

  const orderedSlots = [...district.slots].sort((first, second) =>
    first.id.localeCompare(second.id),
  );
  const usageCounts = new Map(initialUsageCounts);
  const placements: SyntheticDistrictPopulation['placements'][number][] = [];
  const placementDiagnostics: SyntheticDistrictPopulation['placementDiagnostics'][number][] = [];
  const rejections: SyntheticDistrictPopulation['rejections'][number][] = [];

  for (const slot of orderedSlots) {
    const result = selectAssetForSlot(slot, assets, usageCounts);

    if (result.status === 'rejected') {
      rejections.push(result);
      continue;
    }

    placements.push(result.placement);
    placementDiagnostics.push({
      slotId: slot.id,
      compatibleCandidates: result.compatibleCandidates,
    });
    usageCounts.set(
      result.placement.assetId,
      (usageCounts.get(result.placement.assetId) ?? 0) + 1,
    );
  }

  const assetUsage = [...usageCounts]
    .map(([assetId, count]) => ({ assetId, count }))
    .sort((first, second) => first.assetId.localeCompare(second.assetId));

  return {
    districtId: district.id,
    districtSeed: district.seed,
    placements,
    placementDiagnostics,
    rejections,
    assetUsage,
    metadata: {
      slotCount: orderedSlots.length,
      placedCount: placements.length,
      rejectedCount: rejections.length,
      distinctAssetCount: assetUsage.length,
    },
  };
}

function validateInputs(
  district: SyntheticDistrictSlotSource,
  assets: readonly BuildingAssetCatalogEntry[],
  initialUsageCounts: AssetUsageCounts,
): void {
  if (district.id.trim().length === 0) {
    throw new Error('A populated district must have a non-empty ID.');
  }

  if (!Number.isSafeInteger(district.seed)) {
    throw new RangeError('A populated district seed must be a safe integer.');
  }

  assertUniqueIds('building slot', district.slots.map((slot) => slot.id));
  assertUniqueIds('building asset', assets.map((asset) => asset.id));
  const assetIds = new Set(assets.map((asset) => asset.id));

  for (const [assetId, count] of initialUsageCounts) {
    if (!assetIds.has(assetId)) {
      throw new Error(`Initial usage references unknown building asset ${assetId}.`);
    }

    if (!Number.isSafeInteger(count) || count < 0) {
      throw new RangeError(`Initial usage for ${assetId} must be a non-negative integer.`);
    }
  }

  for (const slot of district.slots) {
    if (slot.districtId !== district.id) {
      throw new Error(
        `Building slot ${slot.id} belongs to ${slot.districtId}, not ${district.id}.`,
      );
    }
  }
}

function assertUniqueIds(label: string, ids: readonly string[]): void {
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate ${label} ID: ${id}.`);
    }

    seen.add(id);
  }
}
