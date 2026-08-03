import type { BuildingDefinition } from '../model/cityMassing';
import { SKYSCRAPER_MODEL_TARGET_COUNT } from './buildingModelCatalog';
import type { LoadedBuildingModel } from './loadBuildingModels';

/**
 * Reserves a representative skyscraper subset on the tallest planned sites.
 * The smaller target keeps rare skyline assets visually special.
 */
export function planSkylineModelCoverage(
  buildings: readonly BuildingDefinition[],
  models: readonly LoadedBuildingModel[],
): ReadonlyMap<string, string> {
  const skyscraperModels = selectEvenlyDistributedModels(
    models
      .filter((model) => model.category === 'skyscraper')
      .sort(
        (first, second) =>
          second.heightMetres - first.heightMetres ||
          first.id.localeCompare(second.id),
      ),
    SKYSCRAPER_MODEL_TARGET_COUNT,
  );
  const skylineSites = buildings
    .filter((building) => building.source === 'road-block')
    .sort(
      (first, second) =>
        skylineSiteScore(second) - skylineSiteScore(first) ||
        first.id.localeCompare(second.id),
    )
    .slice(0, skyscraperModels.length);
  const assignments = new Map<string, string>();

  for (let index = 0; index < skylineSites.length; index += 1) {
    const building = skylineSites[index];
    const model = skyscraperModels[index];

    if (building !== undefined && model !== undefined) {
      assignments.set(building.id, model.id);
    }
  }

  return assignments;
}

/** Reserves every high-rise variant once inside the downtown height belt. */
export function planHighRiseModelCoverage(
  buildings: readonly BuildingDefinition[],
  models: readonly LoadedBuildingModel[],
  excludedBuildingIds: ReadonlySet<string>,
): ReadonlyMap<string, string> {
  const highRiseModels = models
    .filter((model) => model.category === 'high-rise')
    .sort(
      (first, second) =>
        second.heightMetres - first.heightMetres ||
        first.id.localeCompare(second.id),
    );
  const highRiseSites = buildings
    .filter(
      (building) =>
        building.source === 'road-block' &&
        !excludedBuildingIds.has(building.id),
    )
    .sort(
      (first, second) =>
        skylineSiteScore(second) - skylineSiteScore(first) ||
        first.id.localeCompare(second.id),
    )
    .slice(0, highRiseModels.length);
  const assignments = new Map<string, string>();

  for (let index = 0; index < highRiseSites.length; index += 1) {
    const building = highRiseSites[index];
    const model = highRiseModels[index];

    if (building !== undefined && model !== undefined) {
      assignments.set(building.id, model.id);
    }
  }

  return assignments;
}

function selectEvenlyDistributedModels(
  models: readonly LoadedBuildingModel[],
  targetCount: number,
): readonly LoadedBuildingModel[] {
  if (models.length <= targetCount) {
    return models;
  }

  return Array.from({ length: targetCount }, (_, index) => {
    const modelIndex = Math.round(
      (index * (models.length - 1)) / Math.max(1, targetCount - 1),
    );
    const model = models[modelIndex];

    if (model === undefined) {
      throw new Error('Could not select a representative skyscraper model.');
    }

    return model;
  });
}

function skylineSiteScore(building: BuildingDefinition): number {
  const roleBonus = building.role === 'landmark' ? 1_000 : 0;
  return roleBonus + building.heightMetres;
}
