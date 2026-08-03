import { describe, expect, it } from 'vitest';
import type { CityBlock, ProcessedCityBlocks } from '../model/cityBlocks';
import type { Point2, RoadPath } from '../model/processedCity';
import type { ResidualFabricDefinition } from '../model/residualFabric';
import {
  fitStreetAlignedRectangle,
  orientedRectangleCorners,
  pointInPolygon,
} from './blockPlacement';
import { generateCityMassing } from './generateCityMassing';
import { CITY_MASSING_CONFIG } from './massingConfig';

const CITY_BLOCKS: ProcessedCityBlocks = {
  schemaVersion: 2,
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
      minimumRegionAreaSquareMetres: 100,
      concaveStrategy: 'all-viable-inset-triangles',
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
      discardedBuildableRegions: 0,
      discardedRegionsByReason: {
        area: 0,
        railClearance: 0,
        waterClearance: 0,
        roadClearance: 0,
      },
      buildableRegions: 3,
      regionsByDerivation: {
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

  it('searches off-centre when a narrow triangular lot cannot fit at its centroid', () => {
    const polygon = [
      [262.27, 77.59],
      [373.65, 113.54],
      [360.62, 97.06],
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
    const cityBlocks = addSecondaryRegion(CITY_BLOCKS);
    const first = generateCityMassing(cityBlocks);
    const repeated = generateCityMassing(cityBlocks);
    const reversed = generateCityMassing({
      ...cityBlocks,
      blocks: [...cityBlocks.blocks]
        .reverse()
        .map((block) => ({
          ...block,
          buildableRegions: [...block.buildableRegions].reverse(),
        })),
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

  it('uses one canonical orientation for every region in a semantic block', () => {
    const result = generateCityMassing(addSecondaryRegion(CITY_BLOCKS));
    const rotations = new Set(
      result.buildings
        .filter((building) => building.blockId === 'east-block')
        .flatMap((building) => building.parts)
        .map((part) => part.rotationRadians.toFixed(6)),
    );

    expect(rotations.size).toBe(1);
  });

  it('keeps every footprint inside its block and selects one landmark', () => {
    const result = generateCityMassing(CITY_BLOCKS);
    const blocksById = new Map(CITY_BLOCKS.blocks.map((block) => [block.id, block]));
    const regionsById = new Map(
      CITY_BLOCKS.blocks.flatMap((block) =>
        block.buildableRegions.map((region) => [region.id, region] as const),
      ),
    );
    const landmarks = result.buildings.filter((building) => building.role === 'landmark');

    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]?.archetype).toBe('landmark-spire');
    expect(landmarks[0]?.heightMetres).toBe(CITY_MASSING_CONFIG.landmark.heightMetres);
    expect(
      Math.min(
        landmarks[0]?.parts[0]?.widthMetres ?? 0,
        landmarks[0]?.parts[0]?.depthMetres ?? 0,
      ),
    ).toBeGreaterThan(30);
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
      const region = regionsById.get(building.regionId);

      expect(block).toBeDefined();
      expect(region).toBeDefined();
      expect(
        building.footprint.every((point) =>
          pointInPolygon(point, region?.polygon ?? []),
        ),
      ).toBe(true);
      expect(building.parts.every((part) => part.heightMetres > 0)).toBe(true);
      expect(building.parts.length).toBeGreaterThanOrEqual(1);
      expect(building.parts.length).toBeLessThanOrEqual(4);
      expect(
        Math.max(
          ...building.parts.map(
            (part) => part.baseHeightMetres + part.heightMetres,
          ),
        ),
      ).toBeCloseTo(building.heightMetres, 5);
    }
  });

  it('adds residual fabric as deterministic background massing', () => {
    const fabric: ResidualFabricDefinition = {
      seed: CITY_MASSING_CONFIG.seed,
      lots: [
        {
          id: 'fabric-x0-z0',
          districtId: 'west-mixed',
          center: [0, 0],
          widthMetres: 8,
          depthMetres: 10,
          rotationRadians: 0,
          footprint: createRectangle([0, 0], 8, 10),
        },
      ],
      metadata: {
        gridSpacingMetres: 12,
        candidates: 1,
        lots: 1,
        discardedCandidates: 0,
        discardedByReason: {
          bounds: 0,
          coverage: 0,
          roadClearance: 0,
          railClearance: 0,
          waterClearance: 0,
          existingBuilding: 0,
          fabricOverlap: 0,
        },
      },
    };
    const result = generateCityMassing(
      CITY_BLOCKS,
      CITY_MASSING_CONFIG,
      fabric,
    );
    const generated = result.buildings.find(
      (building) => building.source === 'residual-fabric',
    );

    expect(result.metadata.sourceFabricLots).toBe(1);
    expect(result.metadata.countsBySource).toEqual({
      'road-block': result.metadata.buildings - 1,
      'residual-fabric': 1,
    });
    expect(generated).toMatchObject({
      id: 'fabric-x0-z0/building-1',
      blockId: 'fabric:west-mixed',
      regionId: 'fabric-x0-z0',
      role: 'background',
    });
  });

  it('removes block-derived buildings that collide with a visible road corridor', () => {
    const baseline = generateCityMassing(CITY_BLOCKS);
    const road: RoadPath = {
      id: 'elevated-road/through-west-block',
      sourceKind: 'motorway',
      class: 'motorway',
      layer: 2,
      bridge: true,
      tunnel: false,
      paths: [[[-830, -450], [-710, -450]]],
    };
    const cleared = generateCityMassing(
      CITY_BLOCKS,
      CITY_MASSING_CONFIG,
      undefined,
      [road],
    );

    expect(cleared.buildings.length).toBeLessThan(baseline.buildings.length);
    expect(
      cleared.buildings.some((building) => building.blockId === 'west-block'),
    ).toBe(false);
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
  const regionId = `${id}/region-main`;

  return {
    id,
    districtId,
    profile: 'regular-urban',
    derivation: 'road-polygonized',
    polygon,
    buildableRegions: [
      {
        id: regionId,
        derivation: 'convex-inset',
        polygon: buildablePolygon,
        centroid: center,
        areaSquareMetres: buildableAreaSquareMetres,
      },
    ],
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

function addSecondaryRegion(
  cityBlocks: ProcessedCityBlocks,
): ProcessedCityBlocks {
  return {
    ...cityBlocks,
    blocks: cityBlocks.blocks.map((block, blockIndex) =>
      blockIndex === 0
        ? {
            ...block,
            buildableRegions: [
              ...block.buildableRegions,
              {
                id: `${block.id}/region-secondary`,
                derivation: 'convex-inset',
                polygon: createRectangle([610, -260], 20, 20),
                centroid: [610, -260],
                areaSquareMetres: 400,
              },
            ],
          }
        : block,
    ),
  };
}
