import type { ProcessedCityBlocks } from '../model/cityBlocks';
import { parseCityBlocks } from '../model/parseCityBlocks';

const PROCESSED_BLOCKS_URL = new URL(
  '../../../references/processed/city-blocks.json',
  import.meta.url,
);

export async function loadCityBlocks(): Promise<ProcessedCityBlocks> {
  const response = await fetch(PROCESSED_BLOCKS_URL);

  if (!response.ok) {
    throw new Error(
      `Processed city blocks could not be loaded (${response.status} ${response.statusText}). Run npm run preprocess.`,
    );
  }

  return parseCityBlocks(await response.json());
}
