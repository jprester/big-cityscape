import { describe, expect, it } from 'vitest';
import type { BuildingDefinition } from '../model/cityMassing';
import { CITY_MASSING_CONFIG } from './massingConfig';
import { promoteCitySkyline } from './promoteCitySkyline';

describe('promoteCitySkyline', () => {
  it('deterministically creates separate skyscraper and high-rise tiers', () => {
    const buildings = Array.from({ length: 40 }, (_, index) =>
      createBuilding(index),
    );
    const districtProfiles = new Map([
      ['east-core', 'dense-central-core'] as const,
    ]);
    const config = {
      ...CITY_MASSING_CONFIG,
      skyline: {
        promotedTowerCount: 10,
        minimumParcelDimensionMetres: 24,
        heightRangeMetres: [160, 220] as const,
      },
      highRise: {
        promotedBuildingCount: 20,
        distributedBuildingCount: 0,
        distributionCellSizeMetres: 220,
        minimumParcelDimensionMetres: 10,
        distributedMinimumParcelDimensionMetres: 10,
        heightRangeMetres: [62, 120] as const,
        maximumHeightToParcelRatio: 9.5,
      },
    };
    const first = promoteCitySkyline(
      buildings,
      districtProfiles,
      config,
    );
    const repeated = promoteCitySkyline(
      [...buildings].reverse(),
      districtProfiles,
      config,
    );
    const skyscrapers = first.filter(
      (building) => building.heightMetres >= 160,
    );
    const highRises = first.filter(
      (building) =>
        building.heightMetres >= 62 && building.heightMetres <= 120,
    );

    expect(skyscrapers).toHaveLength(10);
    expect(highRises).toHaveLength(20);
    expect(
      [...repeated].sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([...first].sort((a, b) => a.id.localeCompare(b.id)));
    expect(
      Math.max(...skyscrapers.map((building) => building.heightMetres)),
    ).toBeLessThanOrEqual(220);

    for (const building of [...skyscrapers, ...highRises]) {
      expect(
        Math.max(
          ...building.parts.map(
            (part) => part.baseHeightMetres + part.heightMetres,
          ),
        ),
      ).toBeCloseTo(building.heightMetres, 5);
    }
  });

  it('adds high-rises to cells outside the central cluster', () => {
    const buildings = Array.from({ length: 40 }, (_, index) =>
      createBuilding(index),
    );
    const districtProfiles = new Map([
      ['east-core', 'dense-central-core'] as const,
    ]);
    const config = {
      ...CITY_MASSING_CONFIG,
      skyline: {
        promotedTowerCount: 1,
        minimumParcelDimensionMetres: 24,
        heightRangeMetres: [160, 180] as const,
      },
      highRise: {
        promotedBuildingCount: 2,
        distributedBuildingCount: 5,
        distributionCellSizeMetres: 50,
        minimumParcelDimensionMetres: 10,
        distributedMinimumParcelDimensionMetres: 10,
        heightRangeMetres: [62, 120] as const,
        maximumHeightToParcelRatio: 9.5,
      },
    };
    const promoted = promoteCitySkyline(buildings, districtProfiles, config);

    expect(
      promoted.filter(
        (building) =>
          building.heightMetres >= 62 && building.heightMetres <= 120,
      ),
    ).toHaveLength(7);
  });

  it('can place secondary high-rises in residual-fabric cells', () => {
    const buildings = Array.from({ length: 12 }, (_, index) =>
      createBuilding(index, 'residual-fabric'),
    );
    const districtProfiles = new Map([
      ['east-core', 'dense-central-core'] as const,
    ]);
    const config = {
      ...CITY_MASSING_CONFIG,
      skyline: {
        promotedTowerCount: 0,
        minimumParcelDimensionMetres: 24,
        heightRangeMetres: [160, 180] as const,
      },
      highRise: {
        promotedBuildingCount: 0,
        distributedBuildingCount: 5,
        distributionCellSizeMetres: 50,
        minimumParcelDimensionMetres: 10,
        distributedMinimumParcelDimensionMetres: 10,
        heightRangeMetres: [62, 120] as const,
        maximumHeightToParcelRatio: 9.5,
      },
    };
    const promoted = promoteCitySkyline(buildings, districtProfiles, config);

    expect(
      promoted.filter((building) => building.heightMetres >= 62),
    ).toHaveLength(5);
  });
});

function createBuilding(
  index: number,
  source: BuildingDefinition['source'] = 'road-block',
): BuildingDefinition {
  const centerX = 520 + (index % 8) * 35;
  const centerZ = -330 + Math.floor(index / 8) * 40;
  const halfSize = 15;
  const heightMetres = 40;

  return {
    id: `east-core/block-${index}/building-1`,
    source,
    blockId: `block-${index}`,
    regionId: `region-${index}`,
    districtId: 'east-core',
    seed: 1_000 + index,
    role: index % 3 === 0 ? 'anchor' : 'background',
    archetype: index % 2 === 0 ? 'podium-tower' : 'stepped-tower',
    material: 'commercial',
    footprint: [
      [centerX - halfSize, centerZ - halfSize],
      [centerX + halfSize, centerZ - halfSize],
      [centerX + halfSize, centerZ + halfSize],
      [centerX - halfSize, centerZ + halfSize],
    ],
    heightMetres,
    parts: [
      {
        center: [centerX, centerZ],
        widthMetres: halfSize * 2,
        depthMetres: halfSize * 2,
        baseHeightMetres: 0,
        heightMetres,
        rotationRadians: 0,
      },
    ],
  };
}
