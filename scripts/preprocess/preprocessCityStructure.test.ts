import { describe, expect, it } from 'vitest';
import type { PreprocessConfig } from './config';
import { preprocessCityStructure } from './preprocessCityStructure';

const CONFIG: PreprocessConfig = {
  sourceFile: 'references/raw/test.geojson',
  outputFile: 'references/processed/test.json',
  clip: {
    id: 'test-clip',
    originLonLat: [135.497, 34.6975],
    widthMetres: 1_000,
    depthMetres: 1_000,
  },
  coordinatePrecisionDecimals: 2,
};

const SOURCE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { '@id': 'road/inside', highway: 'primary', bridge: 'yes', layer: '1' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [135.49, 34.6975],
          [135.504, 34.6975],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { '@id': 'rail/outside', railway: 'rail' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [135.6, 34.8],
          [135.61, 34.81],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { '@id': 'water/inside', natural: 'water', water: 'river' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [135.496, 34.697],
            [135.498, 34.697],
            [135.498, 34.698],
            [135.496, 34.698],
            [135.496, 34.697],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { '@id': 'waterway/inside', waterway: 'river' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [135.496, 34.6975],
          [135.498, 34.6975],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { '@id': 'pedestrian/area', highway: 'pedestrian', area: 'yes' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [135.496, 34.697],
            [135.498, 34.697],
            [135.498, 34.698],
            [135.496, 34.697],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { highway: 'residential' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [135.496, 34.6975],
          [135.498, 34.6975],
        ],
      },
    },
  ],
};

describe('preprocessCityStructure', () => {
  it('normalizes, clips, classifies, and accounts for every source feature', () => {
    const result = preprocessCityStructure(SOURCE, CONFIG);

    expect(result.schemaVersion).toBe(1);
    expect(result.roads).toHaveLength(1);
    expect(result.roads[0]).toMatchObject({
      id: 'road/inside',
      class: 'primary',
      bridge: true,
      layer: 1,
    });
    expect(result.railways).toHaveLength(0);
    expect(result.waterRegions).toHaveLength(1);
    expect(result.waterways).toHaveLength(1);
    expect(result.metadata.counts).toMatchObject({
      retained: 3,
      discarded: 3,
      discardedByReason: {
        outsideClip: 1,
        unsupportedCategory: 0,
        unsupportedGeometry: 1,
        invalidFeature: 1,
        invalidGeometry: 0,
        degenerateGeometry: 0,
      },
    });
  });

  it('is deterministic for the same source and configuration', () => {
    expect(preprocessCityStructure(SOURCE, CONFIG)).toEqual(
      preprocessCityStructure(SOURCE, CONFIG),
    );
  });
});
