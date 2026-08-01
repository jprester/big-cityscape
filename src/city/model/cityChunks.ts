import type { BuildingDefinition } from './cityMassing';
import type { LocalBounds } from './processedCity';

export type CityMassingChunk = Readonly<{
  id: string;
  gridX: number;
  gridZ: number;
  bounds: LocalBounds;
  buildings: readonly BuildingDefinition[];
}>;

export type ChunkedCityMassing = Readonly<{
  chunkSizeMetres: number;
  chunks: readonly CityMassingChunk[];
  metadata: Readonly<{
    chunks: number;
    buildings: number;
    primitiveParts: number;
    maximumBuildingsPerChunk: number;
    maximumPartsPerChunk: number;
  }>;
}>;
