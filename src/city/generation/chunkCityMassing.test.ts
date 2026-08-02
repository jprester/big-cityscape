import { describe, expect, it } from 'vitest';
import type { BuildingDefinition, CityMassingDefinition } from '../model/cityMassing';
import type { Point2 } from '../model/processedCity';
import { chunkCityMassing } from './chunkCityMassing';

const BUILDINGS = [
  createBuilding('far-west', [-201, -1], 1),
  createBuilding('west', [-1, -1], 2),
  createBuilding('origin', [0, 0], 1),
  createBuilding('north-east', [199, 200], 3),
] as const;

const MASSING: CityMassingDefinition = {
  seed: 42,
  buildings: BUILDINGS,
  metadata: {
    sourceBlocks: 4,
    sourceRegions: 4,
    sourceFabricLots: 0,
    populatedRegions: 4,
    skippedRegions: 0,
    buildings: 4,
    primitiveParts: 7,
    landmarkBuildingId: 'origin',
    minimumHeightMetres: 40,
    maximumHeightMetres: 40,
    countsByArchetype: {
      'box-tower': 4,
      slab: 0,
      'podium-tower': 0,
      'stepped-tower': 0,
    },
    countsByMaterial: {
      commercial: 4,
      'mixed-use': 0,
      landmark: 0,
    },
    countsBySource: {
      'road-block': 4,
      'residual-fabric': 0,
    },
  },
};

describe('chunkCityMassing', () => {
  it('assigns every building to a stable signed grid cell', () => {
    const result = chunkCityMassing(MASSING, 200);

    expect(result.chunks.map((chunk) => chunk.id)).toEqual([
      'chunk-200m-xn2-zn1',
      'chunk-200m-xn1-zn1',
      'chunk-200m-x0-z0',
      'chunk-200m-x0-zp1',
    ]);
    expect(result.metadata).toEqual({
      chunks: 4,
      buildings: 4,
      primitiveParts: 7,
      maximumBuildingsPerChunk: 1,
      maximumPartsPerChunk: 3,
    });
  });

  it('is independent of source building order', () => {
    const first = chunkCityMassing(MASSING, 200);
    const reversed = chunkCityMassing(
      { ...MASSING, buildings: [...MASSING.buildings].reverse() },
      200,
    );

    expect(reversed).toEqual(first);
  });

  it('reports exact cell bounds and rejects invalid sizes', () => {
    const result = chunkCityMassing(MASSING, 200);
    const originChunk = result.chunks.find(
      (chunk) => chunk.id === 'chunk-200m-x0-z0',
    );

    expect(originChunk?.bounds).toEqual({
      minX: 0,
      minZ: 0,
      maxX: 200,
      maxZ: 200,
    });
    expect(() => chunkCityMassing(MASSING, 0)).toThrow(RangeError);
    expect(() => chunkCityMassing(MASSING, Number.NaN)).toThrow(RangeError);
  });
});

function createBuilding(
  id: string,
  center: Point2,
  partCount: number,
): BuildingDefinition {
  const footprint = createRectangle(center, 20);

  return {
    id,
    source: 'road-block',
    blockId: `block-${id}`,
    regionId: `block-${id}/region-main`,
    districtId: 'test',
    seed: 1,
    role: 'background',
    archetype: 'box-tower',
    material: 'commercial',
    footprint,
    heightMetres: 40,
    parts: Array.from({ length: partCount }, () => ({
      center,
      widthMetres: 20,
      depthMetres: 20,
      baseHeightMetres: 0,
      heightMetres: 40,
      rotationRadians: 0,
    })),
  };
}

function createRectangle(center: Point2, sizeMetres: number): readonly Point2[] {
  const halfSize = sizeMetres / 2;

  return [
    [center[0] - halfSize, center[1] - halfSize],
    [center[0] + halfSize, center[1] - halfSize],
    [center[0] + halfSize, center[1] + halfSize],
    [center[0] - halfSize, center[1] + halfSize],
  ];
}
