import type { ProcessedCityStructure } from '../model/processedCity';

const PROCESSED_CITY_URL = new URL(
  '../../../references/processed/city-structure.json',
  import.meta.url,
);

export async function loadProcessedCity(): Promise<ProcessedCityStructure> {
  const response = await fetch(PROCESSED_CITY_URL);

  if (!response.ok) {
    throw new Error(
      `Processed city data could not be loaded (${response.status} ${response.statusText}). Run npm run preprocess.`,
    );
  }

  const data: unknown = await response.json();
  assertProcessedCity(data);
  return data;
}

function assertProcessedCity(value: unknown): asserts value is ProcessedCityStructure {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.metadata)) {
    throw new Error('Processed city data has an unsupported schema.');
  }

  for (const collectionName of ['roads', 'railways', 'waterways'] as const) {
    const collection = value[collectionName];

    if (!Array.isArray(collection)) {
      throw new Error(`Processed city collection "${collectionName}" is missing.`);
    }

    for (const feature of collection) {
      if (!isRecord(feature) || typeof feature.id !== 'string' || !areValidPaths(feature.paths)) {
        throw new Error(`Processed city collection "${collectionName}" is malformed.`);
      }
    }
  }

  if (!Array.isArray(value.waterRegions)) {
    throw new Error('Processed city collection "waterRegions" is missing.');
  }

  for (const region of value.waterRegions) {
    if (!isRecord(region) || typeof region.id !== 'string' || !areValidPaths(region.rings, 3)) {
      throw new Error('Processed city collection "waterRegions" is malformed.');
    }
  }
}

function areValidPaths(value: unknown, minimumPoints = 2): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (path) =>
        Array.isArray(path) &&
        path.length >= minimumPoints &&
        path.every(
          (point) =>
            Array.isArray(point) &&
            point.length === 2 &&
            typeof point[0] === 'number' &&
            Number.isFinite(point[0]) &&
            typeof point[1] === 'number' &&
            Number.isFinite(point[1]),
        ),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
