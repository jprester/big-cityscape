import type { BuildingDefinition } from '../model/cityMassing';
import { SKYSCRAPER_MODEL_TARGET_COUNT } from './buildingModelCatalog';
import type { LoadedBuildingModel } from './loadBuildingModels';

const BROAD_SKYLINE_MODEL_ID = 'high-rise-31';
const BROAD_SKYLINE_MINIMUM_FOOTPRINT_SQUARE_METRES = 1_800;

/**
 * Reserves a representative skyscraper subset on the tallest planned sites.
 * The smaller target keeps rare skyline assets visually special.
 */
export function planSkylineModelCoverage(
  buildings: readonly BuildingDefinition[],
  models: readonly LoadedBuildingModel[],
): ReadonlyMap<string, string> {
  const availableSkyscraperModels = models
    .filter((model) => model.category === 'skyscraper')
    .sort(
      (first, second) =>
        second.heightMetres - first.heightMetres ||
        first.id.localeCompare(second.id),
    );
  const skylineSites = buildings
    .filter((building) => building.source === 'road-block')
    .sort(
      (first, second) =>
        skylineSiteScore(second) - skylineSiteScore(first) ||
        first.id.localeCompare(second.id),
    )
    .slice(
      0,
      Math.min(SKYSCRAPER_MODEL_TARGET_COUNT, availableSkyscraperModels.length),
    );
  const broadModel = models.find((model) => model.id === BROAD_SKYLINE_MODEL_ID);
  const broadSite = broadModel === undefined
    ? undefined
    : selectBroadSkylineSite(skylineSites);
  const skyscraperSites = skylineSites.filter(
    (building) => building.id !== broadSite?.id,
  );
  const skyscraperModels = selectEvenlyDistributedModels(
    availableSkyscraperModels,
    skyscraperSites.length,
  );
  const assignments = new Map<string, string>();

  if (broadSite !== undefined && broadModel !== undefined) {
    assignments.set(broadSite.id, broadModel.id);
  }

  for (let index = 0; index < skyscraperSites.length; index += 1) {
    const building = skyscraperSites[index];
    const model = skyscraperModels[index];

    if (building !== undefined && model !== undefined) {
      assignments.set(building.id, model.id);
    }
  }

  return assignments;
}

function selectBroadSkylineSite(
  skylineSites: readonly BuildingDefinition[],
): BuildingDefinition | undefined {
  return skylineSites
    .filter(
      (building) =>
        building.role !== 'landmark' &&
        footprintAreaSquareMetres(building) >=
          BROAD_SKYLINE_MINIMUM_FOOTPRINT_SQUARE_METRES,
    )
    .sort(
      (first, second) =>
        footprintAreaSquareMetres(second) - footprintAreaSquareMetres(first) ||
        second.heightMetres - first.heightMetres ||
        first.id.localeCompare(second.id),
    )[0];
}

function footprintAreaSquareMetres(building: BuildingDefinition): number {
  let twiceArea = 0;

  for (let index = 0; index < building.footprint.length; index += 1) {
    const current = building.footprint[index];
    const next = building.footprint[(index + 1) % building.footprint.length];

    if (current !== undefined && next !== undefined) {
      twiceArea += current[0] * next[1] - next[0] * current[1];
    }
  }

  return Math.abs(twiceArea) / 2;
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
