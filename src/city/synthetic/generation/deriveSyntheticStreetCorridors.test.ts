import { describe, expect, it } from 'vitest';
import type { SyntheticBounds2 } from '../model/proofDistrict';
import { countStreetHierarchies } from '../model/streetCorridor';
import {
  DEFAULT_PROOF_DISTRICT_CONFIG,
  generateProofDistrict,
} from './generateProofDistrict';
import {
  createCityArterialCorridors,
  deriveDistrictStreetCorridors,
} from './deriveSyntheticStreetCorridors';

describe('deriveSyntheticStreetCorridors', () => {
  it('covers every internal gap and intersection without entering blocks', () => {
    const district = generateProofDistrict();

    expect(district.streetCorridors).toHaveLength(56);
    expect(countStreetHierarchies(district.streetCorridors)).toEqual({
      arterial: 0,
      secondary: 17,
      local: 39,
    });
    expect(new Set(district.streetCorridors.map((street) => street.id)).size).toBe(
      district.streetCorridors.length,
    );

    for (const street of district.streetCorridors) {
      expect(contains(district.bounds, street.bounds), street.id).toBe(true);
      expect(
        district.blocks.some((block) => overlaps(block.bounds, street.bounds)),
        street.id,
      ).toBe(false);
    }
  });

  it('follows the offset spine using the actual neighboring block edges', () => {
    const district = generateProofDistrict({
      ...DEFAULT_PROOF_DISTRICT_CONFIG,
      offsetBand: {
        column: 2,
        rowOffsetsMetres: [-8, -4, 0, 4, 8],
      },
    });
    const westSide = district.streetCorridors
      .filter((street) => street.id.includes('street-ns') && street.id.endsWith('-g1'))
      .toSorted((first, second) => first.bounds.minZ - second.bounds.minZ);
    const widths = westSide.map(
      (street) => street.bounds.maxX - street.bounds.minX,
    );

    expect(widths).toEqual([6, 10, 14, 18, 22]);
    expect(
      district.streetCorridors.every((street) =>
        district.blocks.every((block) => !overlaps(block.bounds, street.bounds)),
      ),
    ).toBe(true);
  });

  it('creates six cross-city and four perimeter arterial corridors', () => {
    const cityBounds = {
      minX: -1_000,
      maxX: 1_000,
      minZ: -1_000,
      maxZ: 1_000,
    } as const;
    const arterials = createCityArterialCorridors({
      cityId: 'street-test-city',
      cityBounds,
      districtsPerAxis: 4,
      districtSizeMetres: 500,
      outerMarginMetres: 20,
    });

    expect(arterials).toHaveLength(10);
    expect(arterials.every((street) => street.hierarchyId === 'arterial')).toBe(
      true,
    );
    expect(
      arterials.filter((street) => street.context === 'district-boundary'),
    ).toHaveLength(6);
    expect(
      arterials.filter((street) => street.context === 'city-edge'),
    ).toHaveLength(4);
    expect(arterials.every((street) => contains(cityBounds, street.bounds))).toBe(
      true,
    );
    expect(arterials.find((street) => street.id.endsWith('arterial-ns-2'))?.bounds)
      .toEqual({ minX: -20, maxX: 20, minZ: -1_000, maxZ: 1_000 });
  });

  it('rejects an incomplete district block grid', () => {
    const district = generateProofDistrict();

    expect(() =>
      deriveDistrictStreetCorridors(
        district.id,
        district.blocks.filter((block) => block.gridColumn !== 2),
      ),
    ).toThrow('complete block grid');
  });
});

function contains(outer: SyntheticBounds2, inner: SyntheticBounds2): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minZ >= outer.minZ &&
    inner.maxZ <= outer.maxZ
  );
}

function overlaps(first: SyntheticBounds2, second: SyntheticBounds2): boolean {
  return (
    first.minX < second.maxX &&
    first.maxX > second.minX &&
    first.minZ < second.maxZ &&
    first.maxZ > second.minZ
  );
}
