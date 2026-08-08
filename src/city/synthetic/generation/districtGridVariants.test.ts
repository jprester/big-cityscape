import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_DISTRICT_GRID_ORIENTATION_IDS,
  SYNTHETIC_DISTRICT_GRID_VARIANT_IDS,
} from '../model/proofDistrict';
import {
  selectDistrictGridLayout,
  SYNTHETIC_DISTRICT_GRID_RHYTHMS,
} from './districtGridVariants';

const DISTRICT_SIZE_METRES = 500;
const OUTER_MARGIN_METRES = 20;

describe('districtGridVariants', () => {
  it('fills every 500 m district exactly with five buildable block bands', () => {
    for (const variantId of SYNTHETIC_DISTRICT_GRID_VARIANT_IDS) {
      const rhythm = SYNTHETIC_DISTRICT_GRID_RHYTHMS[variantId];

      expect(rhythm.columnWidthsMetres).toHaveLength(5);
      expect(rhythm.rowDepthsMetres).toHaveLength(5);
      expect(rhythm.columnStreetWidthsMetres).toHaveLength(4);
      expect(rhythm.rowStreetWidthsMetres).toHaveLength(4);
      expect(axisLength(rhythm.columnWidthsMetres, rhythm.columnStreetWidthsMetres)).toBe(
        DISTRICT_SIZE_METRES,
      );
      expect(axisLength(rhythm.rowDepthsMetres, rhythm.rowStreetWidthsMetres)).toBe(
        DISTRICT_SIZE_METRES,
      );
      expect(Math.min(...rhythm.columnWidthsMetres)).toBeGreaterThan(10);
      expect(Math.min(...rhythm.rowDepthsMetres)).toBeGreaterThan(10);
    }
  });

  it('selects all rhythms and valid orientations repeatably across the city', () => {
    const layouts = Array.from({ length: 4 }, (_, row) =>
      Array.from({ length: 4 }, (_, column) =>
        selectDistrictGridLayout(20_260_805, column, row, 4),
      ),
    ).flat();

    expect(new Set(layouts.map((layout) => layout.variantId))).toEqual(
      new Set(SYNTHETIC_DISTRICT_GRID_VARIANT_IDS),
    );
    expect(
      layouts.every((layout) =>
        SYNTHETIC_DISTRICT_GRID_ORIENTATION_IDS.includes(layout.orientationId),
      ),
    ).toBe(true);
    expect(selectDistrictGridLayout(20_260_805, 2, 3, 4)).toEqual(
      selectDistrictGridLayout(20_260_805, 2, 3, 4),
    );
  });

  it('mirrors both block sizes and their following street gaps together', () => {
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const layout = selectDistrictGridLayout(20_260_805, column, row, 4);
        const base = SYNTHETIC_DISTRICT_GRID_RHYTHMS[layout.variantId];
        const mirrorX =
          layout.orientationId === 'mirror-x' ||
          layout.orientationId === 'mirror-both';
        const mirrorZ =
          layout.orientationId === 'mirror-z' ||
          layout.orientationId === 'mirror-both';

        expect(layout.columnWidthsMetres).toEqual(
          mirrorX ? [...base.columnWidthsMetres].reverse() : base.columnWidthsMetres,
        );
        expect(layout.columnStreetWidthsMetres).toEqual(
          mirrorX
            ? [...base.columnStreetWidthsMetres].reverse()
            : base.columnStreetWidthsMetres,
        );
        expect(layout.rowDepthsMetres).toEqual(
          mirrorZ ? [...base.rowDepthsMetres].reverse() : base.rowDepthsMetres,
        );
        expect(layout.rowStreetWidthsMetres).toEqual(
          mirrorZ
            ? [...base.rowStreetWidthsMetres].reverse()
            : base.rowStreetWidthsMetres,
        );
      }
    }
  });

  it('rejects invalid layout coordinates', () => {
    expect(() => selectDistrictGridLayout(20_260_805, 4, 0, 4)).toThrow(
      'outside the city layout',
    );
    expect(() => selectDistrictGridLayout(20_260_805, 0, 0, 0)).toThrow(
      'outside the city layout',
    );
  });
});

function axisLength(
  blockSizesMetres: readonly number[],
  streetWidthsMetres: readonly number[],
): number {
  return (
    OUTER_MARGIN_METRES * 2 +
    blockSizesMetres.reduce((total, value) => total + value, 0) +
    streetWidthsMetres.reduce((total, value) => total + value, 0)
  );
}
