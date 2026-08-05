import {
  BUILDING_ASSET_CATALOG,
  type BuildingAssetCatalogEntry,
} from '../../assets/buildingAssetCatalog';
import type { SyntheticCityPopulation } from '../model/cityPopulation';
import type { SyntheticCity } from '../model/syntheticCity';
import { populateSyntheticDistrict } from './populateSyntheticDistrict';

export function populateSyntheticCity(
  city: SyntheticCity,
  assets: readonly BuildingAssetCatalogEntry[] = BUILDING_ASSET_CATALOG,
): SyntheticCityPopulation {
  validateCity(city);
  const orderedDistricts = [...city.districts].sort((first, second) =>
    first.id.localeCompare(second.id),
  );
  const placements: SyntheticCityPopulation['placements'][number][] = [];
  const placementDiagnostics: SyntheticCityPopulation['placementDiagnostics'][number][] = [];
  const rejections: SyntheticCityPopulation['rejections'][number][] = [];
  const districtSummaries: SyntheticCityPopulation['districts'][number][] = [];
  let usageCounts = new Map<string, number>();

  for (const district of orderedDistricts) {
    const population = populateSyntheticDistrict(
      district,
      assets,
      usageCounts,
    );
    placements.push(...population.placements);
    placementDiagnostics.push(...population.placementDiagnostics);
    rejections.push(...population.rejections);
    districtSummaries.push({
      districtId: district.id,
      slotCount: population.metadata.slotCount,
      placedCount: population.metadata.placedCount,
      rejectedCount: population.metadata.rejectedCount,
    });
    usageCounts = new Map(
      population.assetUsage.map((usage) => [usage.assetId, usage.count]),
    );
  }

  const assetUsage = [...usageCounts]
    .map(([assetId, count]) => ({ assetId, count }))
    .sort((first, second) => first.assetId.localeCompare(second.assetId));
  const slotCount = districtSummaries.reduce(
    (total, district) => total + district.slotCount,
    0,
  );

  return {
    cityId: city.id,
    citySeed: city.seed,
    placements,
    placementDiagnostics,
    rejections,
    assetUsage,
    districts: districtSummaries,
    metadata: {
      districtCount: orderedDistricts.length,
      slotCount,
      placedCount: placements.length,
      rejectedCount: rejections.length,
      distinctAssetCount: assetUsage.length,
    },
  };
}

function validateCity(city: SyntheticCity): void {
  if (city.id.trim().length === 0) {
    throw new Error('A populated synthetic city must have a non-empty ID.');
  }

  if (!Number.isSafeInteger(city.seed)) {
    throw new RangeError('A populated synthetic city seed must be a safe integer.');
  }

  if (city.districts.length === 0) {
    throw new Error('A populated synthetic city must contain districts.');
  }

  assertUniqueIds(
    'synthetic district',
    city.districts.map((district) => district.id),
  );
  assertUniqueIds(
    'building slot',
    city.districts.flatMap((district) =>
      district.slots.map((slot) => slot.id),
    ),
  );
  assertCitySlotAlignment(city);

  for (const district of city.districts) {
    if (!district.id.startsWith(`${city.id}/`)) {
      throw new Error(
        `Synthetic district ${district.id} does not belong to city ${city.id}.`,
      );
    }
  }
}

function assertCitySlotAlignment(city: SyntheticCity): void {
  const citySlotIds = city.slots.map((slot) => slot.id).sort();
  const districtSlotIds = city.districts
    .flatMap((district) => district.slots.map((slot) => slot.id))
    .sort();

  if (
    citySlotIds.length !== districtSlotIds.length ||
    citySlotIds.some((slotId, index) => slotId !== districtSlotIds[index])
  ) {
    throw new Error('Synthetic city slots do not match its district slots.');
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
