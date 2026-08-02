import { describe, expect, it } from 'vitest';
import type { ProcessedCityBlocks } from '../model/cityBlocks';
import type { ProcessedCityStructure } from '../model/processedCity';
import {
  generateResidualFabric,
  type ResidualFabricConfig,
} from './generateResidualFabric';

const CONFIG: ResidualFabricConfig = {
  gridSpacingMetres: 18,
  coverageProbability: 1,
  widthRangeMetres: [8, 9],
  depthRangeMetres: [10, 11],
  railClearanceMetres: 8,
  waterClearanceMetres: 5,
  roadClearanceMetres: {
    motorway: 8,
    trunk: 8,
    primary: 7,
    secondary: 6,
    tertiary: 5,
    local: 4,
    pedestrian: 3,
  },
};

const CITY: ProcessedCityStructure = {
  schemaVersion: 1,
  metadata: {
    source: {
      file: 'test.geojson',
      featureCount: 0,
      boundsLonLat: [[0, 0], [0, 0]],
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
      id: 'test',
      widthMetres: 120,
      depthMetres: 120,
      areaSquareKilometres: 0.0144,
      bounds: { minX: -60, minZ: -60, maxX: 60, maxZ: 60 },
    },
    outputBounds: { minX: -60, minZ: -60, maxX: 60, maxZ: 60 },
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
      id: 'road/vertical',
      sourceKind: 'residential',
      class: 'local',
      layer: 0,
      bridge: false,
      tunnel: false,
      paths: [[[-0, -60], [0, 60]]],
    },
    {
      id: 'road/elevated-horizontal',
      sourceKind: 'motorway',
      class: 'motorway',
      layer: 2,
      bridge: true,
      tunnel: false,
      paths: [[[-60, -18], [60, -18]]],
    },
  ],
  railways: [
    {
      id: 'rail/horizontal',
      sourceKind: 'rail',
      layer: 0,
      bridge: false,
      tunnel: false,
      paths: [[[-60, 36], [60, 36]]],
    },
  ],
  waterways: [],
  waterRegions: [
    {
      id: 'water/corner',
      kind: 'water',
      rings: [[[-60, 36], [-36, 36], [-36, 60], [-60, 60]]],
    },
  ],
};

const BLOCKS: ProcessedCityBlocks = {
  schemaVersion: 2,
  metadata: {
    sourceStructureFile: 'test.json',
    sourceStructureSha256: 'test',
    workingAreaId: 'test',
    derivation: 'surface-road-polygonization',
    exclusions: {
      railBufferMetres: 8,
      waterBufferMetres: 5,
      surfaceRoadBufferMetres: 4,
    },
    buildable: {
      insetMetres: 6,
      minimumAreaSquareMetres: 100,
      minimumRegionAreaSquareMetres: 50,
      concaveStrategy: 'all-viable-inset-triangles',
    },
    counts: {
      districts: 3,
      sourceSurfaceRoadPaths: 1,
      polygonCandidates: 1,
      blocks: 1,
      manualOverrides: 0,
      discardedCandidates: 0,
      discardedByReason: {
        area: 0,
        unsupportedTopology: 0,
        concaveDerivationFailure: 0,
        railExclusion: 0,
        waterExclusion: 0,
        roadExclusion: 0,
        insetFailure: 0,
        insufficientBuildableArea: 0,
      },
      discardedBuildableRegions: 0,
      discardedRegionsByReason: {
        area: 0,
        railClearance: 0,
        waterClearance: 0,
        roadClearance: 0,
      },
      buildableRegions: 1,
      regionsByDerivation: { convexInset: 1, triangulatedInset: 0 },
    },
    totalBlockAreaSquareMetres: 400,
    totalBuildableAreaSquareMetres: 256,
  },
  districts: [
    { id: 'east-core', label: 'East Core', profile: 'dense-central-core' },
    { id: 'west-mixed', label: 'West Mixed', profile: 'dense-mixed' },
    {
      id: 'riverfront-transition',
      label: 'Riverfront',
      profile: 'commercial-transition',
    },
  ],
  candidateAudit: [],
  blocks: [
    {
      id: 'block/test',
      districtId: 'west-mixed',
      profile: 'regular-urban',
      derivation: 'road-polygonized',
      polygon: [[-50, -50], [-22, -50], [-22, -22], [-50, -22]],
      buildableRegions: [
        {
          id: 'block/test/region-main',
          derivation: 'convex-inset',
          polygon: [[-44, -44], [-28, -44], [-28, -28], [-44, -28]],
          centroid: [-36, -36],
          areaSquareMetres: 256,
        },
      ],
      centroid: [-36, -36],
      areaSquareMetres: 400,
      buildableAreaSquareMetres: 256,
    },
  ],
};

describe('generateResidualFabric', () => {
  it('is deterministic and independent of source feature order', () => {
    const occupied = BLOCKS.blocks.flatMap((block) =>
      block.buildableRegions.map((region) => region.polygon),
    );
    const first = generateResidualFabric(CITY, occupied, 123, CONFIG);
    const repeated = generateResidualFabric(CITY, occupied, 123, CONFIG);
    const reordered = generateResidualFabric(
      {
        ...CITY,
        roads: [...CITY.roads].reverse(),
        railways: [...CITY.railways].reverse(),
      },
      [...occupied].reverse(),
      123,
      CONFIG,
    );

    expect(repeated).toEqual(first);
    expect(reordered).toEqual(first);
    expect(generateResidualFabric(CITY, occupied, 124, CONFIG)).not.toEqual(first);
  });

  it('accounts for every grid candidate and respects exclusion corridors', () => {
    const occupied = BLOCKS.blocks.flatMap((block) =>
      block.buildableRegions.map((region) => region.polygon),
    );
    const result = generateResidualFabric(CITY, occupied, 123, CONFIG);

    expect(result.lots.length).toBeGreaterThan(0);
    expect(result.metadata.candidates).toBe(49);
    expect(
      result.metadata.lots + result.metadata.discardedCandidates,
    ).toBe(result.metadata.candidates);
    expect(result.metadata.discardedByReason.roadClearance).toBeGreaterThan(0);
    expect(result.metadata.discardedByReason.railClearance).toBeGreaterThan(0);
    expect(result.metadata.discardedByReason.existingBuilding).toBeGreaterThan(0);

    for (const lot of result.lots) {
      expect(Math.abs(lot.center[0])).toBeGreaterThan(0);
      expect(lot.center[1]).not.toBe(-18);
      expect(lot.center[1]).not.toBe(36);
      expect(lot.footprint).toHaveLength(4);
    }
  });
});
