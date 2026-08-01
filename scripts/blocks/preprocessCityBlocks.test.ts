import { describe, expect, it } from 'vitest';
import type { ProcessedCityStructure } from '../../src/city/model/processedCity';
import type { BlockPreprocessConfig } from './config';
import { preprocessCityBlocks } from './preprocessCityBlocks';

const STRUCTURE: ProcessedCityStructure = {
  schemaVersion: 1,
  metadata: {
    source: {
      file: 'test.geojson',
      featureCount: 0,
      boundsLonLat: [
        [0, 0],
        [0, 0],
      ],
      attribution: 'test',
    },
    projection: {
      kind: 'local-equirectangular',
      units: 'metres',
      originLonLat: [0, 0],
      earthRadiusMetres: 6_371_008.8,
      axes: { x: 'east', z: 'south' },
    },
    clip: {
      id: 'test-area',
      widthMetres: 1_000,
      depthMetres: 1_000,
      areaSquareKilometres: 1,
      bounds: { minX: -500, minZ: -500, maxX: 500, maxZ: 500 },
    },
    outputBounds: { minX: -500, minZ: -500, maxX: 500, maxZ: 500 },
    counts: {
      retained: 0,
      discarded: 0,
      retainedByKind: { roads: 0, railways: 0, waterways: 0, waterRegions: 0 },
      discardedByReason: {
        outsideClip: 0,
        unsupportedCategory: 0,
        unsupportedGeometry: 0,
        invalidFeature: 0,
        invalidGeometry: 0,
        degenerateGeometry: 0,
      },
    },
  },
  roads: [
    {
      id: 'road/block-boundary',
      sourceKind: 'residential',
      class: 'local',
      layer: 0,
      bridge: false,
      tunnel: false,
      paths: [
        [
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
          [0, 0],
        ],
      ],
    },
  ],
  railways: [],
  waterways: [],
  waterRegions: [],
};

const CONFIG: BlockPreprocessConfig = {
  sourceStructureFile: 'references/processed/test-structure.json',
  outputFile: 'references/processed/test-blocks.json',
  minimumBlockAreaSquareMetres: 100,
  maximumBlockAreaSquareMetres: 20_000,
  buildableInsetMetres: 10,
  minimumBuildableAreaSquareMetres: 500,
  railBufferMetres: 10,
  waterBufferMetres: 10,
  surfaceRoadBufferMetres: 5,
  coordinatePrecisionDecimals: 2,
  districts: [
    {
      id: 'riverfront-transition',
      label: 'Riverfront Transition',
      profile: 'commercial-transition',
    },
  ],
};

describe('preprocessCityBlocks', () => {
  it('polygonizes surface roads into a stable semantic block', () => {
    const result = preprocessCityBlocks(STRUCTURE, CONFIG, 'abc123');

    expect(result.metadata).toMatchObject({
      sourceStructureSha256: 'abc123',
      workingAreaId: 'test-area',
      derivation: 'surface-road-polygonization',
      counts: {
        districts: 1,
        sourceSurfaceRoadPaths: 1,
        polygonCandidates: 1,
        blocks: 1,
        manualOverrides: 0,
        discardedCandidates: 0,
      },
      totalBlockAreaSquareMetres: 10_000,
      totalBuildableAreaSquareMetres: 6_400,
    });
    expect(result.blocks[0]).toMatchObject({
      districtId: 'riverfront-transition',
      profile: 'riverfront',
      derivation: 'road-polygonized',
      buildableDerivation: 'convex-inset',
      centroid: [50, 50],
      areaSquareMetres: 10_000,
      buildableAreaSquareMetres: 6_400,
    });
    expect(result.blocks[0]?.id).toMatch(/^block-[a-f0-9]{10}$/);
    expect(result.blocks[0]?.buildablePolygon).toHaveLength(4);
    expect(result.candidateAudit).toHaveLength(1);
    expect(result.candidateAudit[0]).toMatchObject({
      id: expect.stringMatching(/^candidate-[a-f0-9]{10}$/),
      outcome: 'retained',
      centroid: [50, 50],
      areaSquareMetres: 10_000,
    });
    expect(preprocessCityBlocks(STRUCTURE, CONFIG, 'abc123')).toEqual(result);
  });

  it('accounts for a candidate rejected by the rail exclusion', () => {
    const structureWithRail: ProcessedCityStructure = {
      ...STRUCTURE,
      railways: [
        {
          id: 'rail/test',
          sourceKind: 'rail',
          layer: 0,
          bridge: false,
          tunnel: false,
          paths: [
            [
              [50, -50],
              [50, 150],
            ],
          ],
        },
      ],
    };

    const result = preprocessCityBlocks(structureWithRail, CONFIG, 'abc123');

    expect(result.blocks).toHaveLength(0);
    expect(result.metadata.counts).toMatchObject({
      polygonCandidates: 1,
      blocks: 0,
      discardedCandidates: 1,
      discardedByReason: { railExclusion: 1 },
    });
    expect(result.candidateAudit).toMatchObject([
      {
        outcome: 'railExclusion',
        centroid: [50, 50],
        areaSquareMetres: 10_000,
      },
    ]);
  });
});
