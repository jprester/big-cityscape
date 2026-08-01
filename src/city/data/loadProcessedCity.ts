import type { ProcessedCityStructure } from '../model/processedCity';
import { parseProcessedCity } from '../model/parseProcessedCity';

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
  return parseProcessedCity(data);
}
