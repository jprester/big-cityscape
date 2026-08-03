import { createSeededRandom, deriveSeed } from '../../core/random';
import type { BuildingDefinition } from '../model/cityMassing';
import type { Point2 } from '../model/processedCity';
import type {
  BuildingModelCategory,
} from './buildingModelCatalog';
import type { LoadedBuildingModel } from './loadBuildingModels';

export type BuildingModelPlacement = Readonly<{
  building: BuildingDefinition;
  model: LoadedBuildingModel;
  center: Point2;
  widthMetres: number;
  depthMetres: number;
  rotationRadians: number;
  rotateModelQuarterTurn: boolean;
}>;

const HIGH_RISE_MINIMUM_HEIGHT_METRES = 62;
const MODEL_SELECTION_WINDOW = 7;

export function selectBuildingModel(
  building: BuildingDefinition,
  models: readonly LoadedBuildingModel[],
  reservedModelId?: string,
): BuildingModelPlacement {
  const footprint = measureBuildingFootprint(building);
  const requestedCategory = selectBuildingModelCategory(building);
  const reservedModel = reservedModelId === undefined
    ? undefined
    : models.find((model) => model.id === reservedModelId);
  const categoryModels = reservedModel === undefined
    ? models.filter((model) => model.category === requestedCategory)
    : [reservedModel];
  const candidates = categoryModels.length > 0 ? categoryModels : models;

  if (reservedModelId !== undefined && reservedModel === undefined) {
    throw new Error(
      `Building "${building.id}" reserved unknown model "${reservedModelId}".`,
    );
  }

  if (candidates.length === 0) {
    throw new Error('At least one loaded building model is required.');
  }

  const ranked = candidates
    .map((model) => rankModel(model, footprint, building.heightMetres))
    .sort(
      (first, second) =>
        first.score - second.score || first.model.id.localeCompare(second.model.id),
    );
  const selectionWindow = Math.min(MODEL_SELECTION_WINDOW, ranked.length);
  const random = createSeededRandom(
    deriveSeed(building.seed, building.id, 'building-model'),
  );
  const selected = ranked[random.integer(0, selectionWindow)];

  if (selected === undefined) {
    throw new Error(`Building "${building.id}" could not select a model.`);
  }

  return {
    building,
    model: selected.model,
    center: footprint.center,
    widthMetres: footprint.widthMetres,
    depthMetres: footprint.depthMetres,
    rotationRadians: footprint.rotationRadians,
    rotateModelQuarterTurn: selected.rotateModelQuarterTurn,
  };
}

export function selectBuildingModelCategory(
  building: BuildingDefinition,
): BuildingModelCategory {
  if (building.role === 'landmark') {
    return 'skyscraper';
  }

  if (
    building.heightMetres >= HIGH_RISE_MINIMUM_HEIGHT_METRES ||
    building.role === 'anchor' ||
    (building.source === 'road-block' &&
      usesCommercialHighRiseModel(building.archetype))
  ) {
    return 'high-rise';
  }

  return 'residential';
}

function usesCommercialHighRiseModel(
  archetype: BuildingDefinition['archetype'],
): boolean {
  switch (archetype) {
    case 'podium-tower':
    case 'multi-tower-podium':
    case 'stepped-tower':
    case 'commercial-block':
    case 'megastructure':
      return true;
    case 'box-tower':
    case 'slab':
    case 'perimeter-block':
    case 'landmark-spire':
      return false;
  }
}

type FootprintMeasurement = Readonly<{
  center: Point2;
  widthMetres: number;
  depthMetres: number;
  rotationRadians: number;
}>;

function measureBuildingFootprint(
  building: BuildingDefinition,
): FootprintMeasurement {
  const firstPart = building.parts[0];

  if (firstPart === undefined || building.footprint.length === 0) {
    throw new Error(`Building "${building.id}" has no measurable footprint.`);
  }

  const center = averagePoints(building.footprint);
  const rotationRadians = firstPart.rotationRadians;
  const cosine = Math.cos(rotationRadians);
  const sine = Math.sin(rotationRadians);
  let minimumWidth = Number.POSITIVE_INFINITY;
  let maximumWidth = Number.NEGATIVE_INFINITY;
  let minimumDepth = Number.POSITIVE_INFINITY;
  let maximumDepth = Number.NEGATIVE_INFINITY;

  for (const point of building.footprint) {
    const offsetX = point[0] - center[0];
    const offsetZ = point[1] - center[1];
    const widthCoordinate = offsetX * cosine + offsetZ * sine;
    const depthCoordinate = -offsetX * sine + offsetZ * cosine;
    minimumWidth = Math.min(minimumWidth, widthCoordinate);
    maximumWidth = Math.max(maximumWidth, widthCoordinate);
    minimumDepth = Math.min(minimumDepth, depthCoordinate);
    maximumDepth = Math.max(maximumDepth, depthCoordinate);
  }

  const widthMetres = maximumWidth - minimumWidth;
  const depthMetres = maximumDepth - minimumDepth;

  if (widthMetres <= 0 || depthMetres <= 0) {
    throw new Error(`Building "${building.id}" has degenerate footprint bounds.`);
  }

  return {
    center,
    widthMetres,
    depthMetres,
    rotationRadians,
  };
}

function rankModel(
  model: LoadedBuildingModel,
  footprint: FootprintMeasurement,
  heightMetres: number,
): Readonly<{
  model: LoadedBuildingModel;
  score: number;
  rotateModelQuarterTurn: boolean;
}> {
  const targetAspect = footprint.widthMetres / footprint.depthMetres;
  const modelAspect = model.widthMetres / model.depthMetres;
  const directAspectError = ratioError(targetAspect, modelAspect);
  const rotatedAspectError = ratioError(targetAspect, 1 / modelAspect);
  const rotateModelQuarterTurn = rotatedAspectError < directAspectError;
  const aspectError = Math.min(directAspectError, rotatedAspectError);
  const heightError = ratioError(heightMetres, model.heightMetres);

  return {
    model,
    score: aspectError + heightError * 0.22,
    rotateModelQuarterTurn,
  };
}

function ratioError(first: number, second: number): number {
  return Math.abs(Math.log(first / second));
}

function averagePoints(points: readonly Point2[]): Point2 {
  const total = points.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]] as Point2,
    [0, 0] as Point2,
  );
  return [total[0] / points.length, total[1] / points.length];
}
