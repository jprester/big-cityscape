import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROOF_DISTRICT_CONFIG,
  generateProofDistrict,
} from './generateProofDistrict';
import { populateSyntheticDistrict } from './populateSyntheticDistrict';
import {
  DEFAULT_SYNTHETIC_SIGNAGE_CONFIG,
  deriveSyntheticSignage,
} from './deriveSyntheticSignage';

describe('deriveSyntheticSignage', () => {
  it('is deterministic and independent of input traversal order', () => {
    const district = generateProofDistrict(DEFAULT_PROOF_DISTRICT_CONFIG);
    const population = populateSyntheticDistrict(district);
    const first = deriveSyntheticSignage(
      'test/signage',
      district.seed,
      population.placements,
      district.blocks,
      [district],
    );
    const reordered = deriveSyntheticSignage(
      'test/signage',
      district.seed,
      [...population.placements].reverse(),
      [...district.blocks].reverse(),
      [district],
    );

    expect(reordered).toEqual(first);
  });

  it('fits every mounting zone inside its intended façade band', () => {
    const district = generateProofDistrict(DEFAULT_PROOF_DISTRICT_CONFIG);
    const population = populateSyntheticDistrict(district);
    const plan = deriveSyntheticSignage(
      'test/full-signage',
      district.seed,
      population.placements,
      district.blocks,
      [district],
      undefined,
      {
        ...DEFAULT_SYNTHETIC_SIGNAGE_CONFIG,
        facadeSpawnChanceByProfile: { centre: 1, urban: 1, edge: 1 },
        storefrontSpawnChanceByProfile: { centre: 1, urban: 1, edge: 1 },
        crownSpawnChanceByProfile: { centre: 1, urban: 1, edge: 1 },
        spawnMultiplierByUse: {
          residential: 1,
          'mixed-use': 1,
          office: 1,
          commercial: 1,
          civic: 1,
          industrial: 1,
          landmark: 1,
        },
      },
    );

    expect(plan.metadata.eligibleBuildingCount).toBe(
      population.placements.length,
    );
    expect(plan.metadata.mountingZoneCounts.facade).toBe(
      population.placements.length,
    );
    expect(plan.metadata.mountingZoneCounts.storefront).toBeGreaterThan(0);
    expect(plan.metadata.mountingZoneCounts.crown).toBeGreaterThan(0);
    expect(
      plan.placements.every(
        (sign) =>
          sign.widthMetres > 0 &&
          sign.heightMetres > 0 &&
          sign.center.every(Number.isFinite),
      ),
    ).toBe(true);
    expect(
      Object.values(plan.metadata.kindCounts).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(plan.metadata.signCount);
    expect(
      Object.values(plan.metadata.mountingZoneCounts).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(plan.metadata.signCount);
    expect(
      plan.placements
        .filter((sign) => sign.mountingZone === 'storefront')
        .every(
          (sign) =>
            sign.center[1] - sign.heightMetres / 2 >= 2.4 - 1e-4 &&
            sign.center[1] + sign.heightMetres / 2 <= 7 + 1e-4,
        ),
    ).toBe(true);
    const buildingsById = new Map(
      population.placements.map((building) => [building.id, building]),
    );
    expect(
      plan.placements
        .filter((sign) => sign.mountingZone === 'crown')
        .every((sign) => {
          const building = buildingsById.get(sign.buildingId);

          if (building === undefined) {
            return false;
          }

          const buildingTop = 0.5 + building.dimensionsMetres.height;
          const crownBandHeight = Math.min(
            22,
            building.dimensionsMetres.height * 0.22,
          );

          return (
            sign.center[1] - sign.heightMetres / 2 >=
              buildingTop - crownBandHeight - 1e-4 &&
            sign.center[1] + sign.heightMetres / 2 <=
              buildingTop - 1.5 + 1e-4
          );
        }),
    ).toBe(true);
    expect(
      new Set(
        plan.placements.map(
          (sign) => `${sign.buildingId}/${sign.mountingZone}`,
        ),
      ).size,
    ).toBe(plan.placements.length);
  });
});
