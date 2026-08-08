import { deriveSeed } from '../../../core/random';
import {
  SYNTHETIC_DISTRICT_GRID_ORIENTATION_IDS,
  SYNTHETIC_DISTRICT_GRID_VARIANT_IDS,
  type SyntheticDistrictGridOrientationId,
  type SyntheticDistrictGridVariantId,
} from '../model/proofDistrict';

export type SyntheticDistrictGridLayout = Readonly<{
  variantId: SyntheticDistrictGridVariantId;
  orientationId: SyntheticDistrictGridOrientationId;
  columnWidthsMetres: readonly number[];
  rowDepthsMetres: readonly number[];
  columnStreetWidthsMetres: readonly number[];
  rowStreetWidthsMetres: readonly number[];
}>;

type GridRhythm = Omit<
  SyntheticDistrictGridLayout,
  'variantId' | 'orientationId'
>;

export const SYNTHETIC_DISTRICT_GRID_RHYTHMS: Readonly<
  Record<SyntheticDistrictGridVariantId, GridRhythm>
> = {
  balanced: {
    columnWidthsMetres: [70, 85, 90, 75, 70],
    rowDepthsMetres: [68, 82, 96, 74, 70],
    columnStreetWidthsMetres: [18, 14, 24, 14],
    rowStreetWidthsMetres: [16, 22, 14, 18],
  },
  'fine-grain': {
    columnWidthsMetres: [68, 74, 72, 88, 76],
    rowDepthsMetres: [62, 78, 82, 78, 68],
    columnStreetWidthsMetres: [16, 20, 24, 22],
    rowStreetWidthsMetres: [18, 26, 20, 28],
  },
  'large-block': {
    columnWidthsMetres: [94, 72, 100, 68, 68],
    rowDepthsMetres: [78, 80, 100, 80, 62],
    columnStreetWidthsMetres: [14, 18, 16, 10],
    rowStreetWidthsMetres: [14, 20, 12, 14],
  },
};

export function selectDistrictGridLayout(
  layoutSeed: number,
  districtColumn: number,
  districtRow: number,
  districtsPerAxis: number,
): SyntheticDistrictGridLayout {
  if (!Number.isSafeInteger(layoutSeed)) {
    throw new RangeError('The district layout seed must be a safe integer.');
  }

  for (const coordinate of [
    districtColumn,
    districtRow,
    districtsPerAxis,
  ]) {
    if (!Number.isSafeInteger(coordinate) || coordinate < 0) {
      throw new RangeError('District grid coordinates must be non-negative integers.');
    }
  }

  if (
    districtsPerAxis === 0 ||
    districtColumn >= districtsPerAxis ||
    districtRow >= districtsPerAxis
  ) {
    throw new RangeError('District grid coordinates are outside the city layout.');
  }

  const linearIndex = districtRow * districtsPerAxis + districtColumn;
  const variantOffset =
    deriveSeed(layoutSeed, 'district-grid-variant-offset') %
    SYNTHETIC_DISTRICT_GRID_VARIANT_IDS.length;
  const variantId = requireItem(
    SYNTHETIC_DISTRICT_GRID_VARIANT_IDS,
    (linearIndex + variantOffset) % SYNTHETIC_DISTRICT_GRID_VARIANT_IDS.length,
    'grid variant',
  );
  const orientationId = requireItem(
    SYNTHETIC_DISTRICT_GRID_ORIENTATION_IDS,
    deriveSeed(
      layoutSeed,
      'district-grid-orientation',
      `r${districtRow}-c${districtColumn}`,
    ) % SYNTHETIC_DISTRICT_GRID_ORIENTATION_IDS.length,
    'grid orientation',
  );
  const rhythm = SYNTHETIC_DISTRICT_GRID_RHYTHMS[variantId];
  const mirrorX =
    orientationId === 'mirror-x' || orientationId === 'mirror-both';
  const mirrorZ =
    orientationId === 'mirror-z' || orientationId === 'mirror-both';

  return {
    variantId,
    orientationId,
    columnWidthsMetres: orientAxis(rhythm.columnWidthsMetres, mirrorX),
    rowDepthsMetres: orientAxis(rhythm.rowDepthsMetres, mirrorZ),
    columnStreetWidthsMetres: orientAxis(
      rhythm.columnStreetWidthsMetres,
      mirrorX,
    ),
    rowStreetWidthsMetres: orientAxis(rhythm.rowStreetWidthsMetres, mirrorZ),
  };
}

function orientAxis(values: readonly number[], mirror: boolean): readonly number[] {
  return mirror ? [...values].reverse() : values;
}

function requireItem<T>(
  items: readonly T[],
  index: number,
  label: string,
): T {
  const item = items[index];

  if (item === undefined) {
    throw new Error(`The synthetic ${label} index is invalid.`);
  }

  return item;
}
