import type { DistrictDefinition } from '../../src/city/model/cityBlocks';

export type BlockPreprocessConfig = Readonly<{
  sourceStructureFile: string;
  outputFile: string;
  minimumBlockAreaSquareMetres: number;
  maximumBlockAreaSquareMetres: number;
  buildableInsetMetres: number;
  minimumBuildableAreaSquareMetres: number;
  railBufferMetres: number;
  waterBufferMetres: number;
  surfaceRoadBufferMetres: number;
  coordinatePrecisionDecimals: number;
  districts: readonly DistrictDefinition[];
}>;

export const BLOCK_PREPROCESS_CONFIG: BlockPreprocessConfig = {
  sourceStructureFile: 'references/processed/city-structure.json',
  outputFile: 'references/processed/city-blocks.json',
  minimumBlockAreaSquareMetres: 1_500,
  maximumBlockAreaSquareMetres: 40_000,
  buildableInsetMetres: 6,
  minimumBuildableAreaSquareMetres: 600,
  railBufferMetres: 14,
  waterBufferMetres: 10,
  surfaceRoadBufferMetres: 4,
  coordinatePrecisionDecimals: 2,
  districts: [
    {
      id: 'east-core',
      label: 'East Core',
      profile: 'dense-central-core',
    },
    {
      id: 'west-mixed',
      label: 'West Mixed',
      profile: 'dense-mixed',
    },
    {
      id: 'riverfront-transition',
      label: 'Riverfront Transition',
      profile: 'commercial-transition',
    },
  ],
};
