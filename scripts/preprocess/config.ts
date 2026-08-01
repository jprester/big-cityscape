import type { LonLat } from '../../src/city/model/processedCity';

export type PreprocessConfig = Readonly<{
  sourceFile: string;
  outputFile: string;
  clip: Readonly<{
    id: string;
    originLonLat: LonLat;
    widthMetres: number;
    depthMetres: number;
  }>;
  coordinatePrecisionDecimals: number;
}>;

export const PREPROCESS_CONFIG: PreprocessConfig = {
  sourceFile: 'references/raw/osaka-structure.geojson',
  outputFile: 'references/processed/city-structure.json',
  clip: {
    id: 'nakanoshima-umeda',
    originLonLat: [135.497, 34.6975],
    widthMetres: 1_800,
    depthMetres: 1_100,
  },
  coordinatePrecisionDecimals: 2,
};
