import { describe, expect, it } from 'vitest';
import type { CityBlock, ProcessedCityBlocks } from '../model/cityBlocks';
import type { Point2 } from '../model/processedCity';
import {
  fitStreetAlignedRectangle,
  orientedRectangleCorners,
  pointInPolygon,
} from './blockPlacement';
import { generateCityMassing } from './generateCityMassing';
import { CITY_MASSING_CONFIG } from './massingConfig';

const CITY_BLOCKS: ProcessedCityBlocks = {
  schemaVersion: 1,
  metadata: {
    sourceStructureFile: 'test.json',
    sourceStructureSha256: 'test',
    workingAreaId: 'test',
    derivation: 'surface-road-polygonization',
    exclusions: {
      railBufferMetres: 14,
      waterBufferMetres: 10,
      surfaceRoadBufferMetres: 4,
    },
    buildable: {
      insetMetres: 6,
      minimumAreaSquareMetres: 600,
      concaveStrategy: 'largest-inset-triangle',
    },
    counts: {
      districts: 3,
      sourceSurfaceRoadPaths: 12,
      polygonCandidates: 3,
      blocks: 3,
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
      blocksByBuildableDerivation: {
        convexInset: 3,
        triangulatedInset: 0,
      },
    },
    totalBlockAreaSquareMetres: 22_800,
    totalBuildableAreaSquareMetres: 17_000,
  },
  districts: [
    { id: 'east-core', label: 'East Core', profile: 'dense-central-core' },
    {
      id: 'riverfront-transition',
      label: 'Riverfront Transition',
      profile: 'commercial-transition',
    },
    { id: 'west-mixed', label: 'West Mixed', profile: 'dense-mixed' },
  ],
  candidateAudit: [],
  blocks: [
    createBlock('east-block', 'east-core', [640, -260], 100, 70, 8_000, 7_000),
    createBlock(
      'river-block',
      'riverfront-transition',
      [540, 130],
      100,
      80,
      9_000,
      8_000,
    ),
    createBlock('west-block', 'west-mixed', [-770, -450], 80, 60, 5_800, 4_800),
  ],
};

describe('block-aligned massing placement', () => {
  it('fits a street-aligned rectangle inside a convex irregular block', () => {
    const polygon = [
      [0, 0],
      [90, 15],
      [78, 62],
      [-8, 45],
    ] as const;
    const placement = fitStreetAlignedRectangle(polygon);

    expect(placement.widthMetres).toBeGreaterThan(30);
    expect(placement.depthMetres).toBeGreaterThan(20);
    expect(
      orientedRectangleCorners(placement).every((point) =>
        pointInPolygon(point, polygon),
      ),
    ).toBe(true);
  });

  it('fits independent width and depth scales inside an acute triangle', () => {
    const polygon = [
      [0, 0],
      [50.46, 3.13],
      [49.39, 27.81],
    ] as const;
    const placement = fitStreetAlignedRectangle(polygon);

    expect(placement.widthMetres).toBeGreaterThanOrEqual(8);
    expect(placement.depthMetres).toBeGreaterThanOrEqual(8);
    expect(
      orientedRectangleCorners(placement).every((point) =>
        pointInPolygon(point, polygon),
      ),
    ).toBe(true);
  });
});

describe('generateCityMassing', () => {
  it('is stable for the same semantic input regardless of block order', () => {
    const first = generateCityMassing(CITY_BLOCKS);
    const repeated = generateCityMassing(CITY_BLOCKS);
    const reversed = generateCityMassing({
      ...CITY_BLOCKS,
      blocks: [...CITY_BLOCKS.blocks].reverse(),
    });

    expect(repeated).toEqual(first);
    expect(reversed).toEqual(first);
  });

  it('changes local variation when the root seed changes', () => {
    const first = generateCityMassing(CITY_BLOCKS);
    const changed = generateCityMassing(CITY_BLOCKS, {
      ...CITY_MASSING_CONFIG,
      seed: CITY_MASSING_CONFIG.seed + 1,
    });

    expect(changed.buildings).not.toEqual(first.buildings);
    expect(changed.buildings.map((building) => building.blockId)).toEqual(
      first.buildings.map((building) => building.blockId),
    );
  });

  it('keeps every footprint inside its block and selects one landmark', () => {
    const result = generateCityMassing(CITY_BLOCKS);
    const blocksById = new Map(CITY_BLOCKS.blocks.map((block) => [block.id, block]));
    const landmarks = result.buildings.filter((building) => building.role === 'landmark');

    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]?.heightMetres).toBe(CITY_MASSING_CONFIG.landmark.heightMetres);
    expect(result.metadata.maximumHeightMetres).toBe(
      CITY_MASSING_CONFIG.landmark.heightMetres,
    );
    expect(
      Object.values(result.metadata.countsByArchetype).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(result.metadata.buildings);

    for (const building of result.buildings) {
      const block = blocksById.get(building.blockId);

      expect(block).toBeDefined();
      expect(
        building.footprint.every((point) =>
          pointInPolygon(point, block?.buildablePolygon ?? []),
        ),
      ).toBe(true);
      expect(building.parts.every((part) => part.heightMetres > 0)).toBe(true);
      expect(building.parts).toHaveLength(
        building.archetype === 'podium-tower'
          ? 2
          : building.archetype === 'stepped-tower'
            ? 3
            : 1,
      );
      expect(
        Math.max(
          ...building.parts.map(
            (part) => part.baseHeightMetres + part.heightMetres,
          ),
        ),
      ).toBeCloseTo(building.heightMetres, 5);
    }
  });
});

function createBlock(
  id: string,
  districtId: string,
  center: Point2,
  widthMetres: number,
  depthMetres: number,
  areaSquareMetres: number,
  buildableAreaSquareMetres: number,
): CityBlock {
  const polygon = createRectangle(center, widthMetres + 12, depthMetres + 12);
  const buildablePolygon = createRectangle(center, widthMetres, depthMetres);

  return {
    id,
    districtId,
    profile: 'regular-urban',
    derivation: 'road-polygonized',
    buildableDerivation: 'convex-inset',
    polygon,
    buildablePolygon,
    centroid: center,
    areaSquareMetres,
    buildableAreaSquareMetres,
  };
}

function createRectangle(
  [centerX, centerZ]: Point2,
  widthMetres: number,
  depthMetres: number,
): readonly Point2[] {
  const halfWidth = widthMetres / 2;
  const halfDepth = depthMetres / 2;

  return [
    [centerX - halfWidth, centerZ - halfDepth],
    [centerX + halfWidth, centerZ - halfDepth],
    [centerX + halfWidth, centerZ + halfDepth],
    [centerX - halfWidth, centerZ + halfDepth],
  ];
}
