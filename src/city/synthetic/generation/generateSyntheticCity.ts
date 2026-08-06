import { deriveSeed } from '../../../core/random';
import type { SyntheticDistrictCompositionProfileId } from '../model/proofDistrict';
import type { SyntheticCity } from '../model/syntheticCity';
import {
  DEFAULT_PROOF_DISTRICT_CONFIG,
  generateProofDistrict,
  MINIMUM_OFFSET_BAND_STREET_GAP_METRES,
  type ProofDistrictConfig,
} from './generateProofDistrict';

export type SyntheticCityConfig = Readonly<{
  id: string;
  seed: number;
  districtsPerAxis: number;
  districtSizeMetres: number;
  landmarkDistrict: Readonly<{
    column: number;
    row: number;
  }>;
  offsetBand: Readonly<{
    districtColumn: number;
    blockColumn: number;
    amplitudeMetres: number;
  }> | null;
}>;

export const DEFAULT_SYNTHETIC_CITY_CONFIG: SyntheticCityConfig = {
  id: 'synthetic-city',
  seed: 20_260_805,
  districtsPerAxis: 4,
  districtSizeMetres: 500,
  landmarkDistrict: { column: 1, row: 1 },
  offsetBand: {
    districtColumn: 2,
    blockColumn: 2,
    amplitudeMetres: 8,
  },
};

export function generateSyntheticCity(
  config: SyntheticCityConfig = DEFAULT_SYNTHETIC_CITY_CONFIG,
): SyntheticCity {
  validateConfig(config);
  const citySizeMetres = config.districtsPerAxis * config.districtSizeMetres;
  const cityMinimum = -citySizeMetres / 2;
  const districts = [];

  for (let row = 0; row < config.districtsPerAxis; row += 1) {
    for (let column = 0; column < config.districtsPerAxis; column += 1) {
      const districtId = `${config.id}/district-r${row}-c${column}`;
      const compositionProfileId = profileForDistrict(column, row);
      const center = [
        cityMinimum + (column + 0.5) * config.districtSizeMetres,
        cityMinimum + (row + 0.5) * config.districtSizeMetres,
      ] as const;

      districts.push(
        generateProofDistrict({
          ...DEFAULT_PROOF_DISTRICT_CONFIG,
          id: districtId,
          seed: deriveSeed(config.seed, districtId),
          center,
          compositionProfileId,
          hasLandmark:
            column === config.landmarkDistrict.column &&
            row === config.landmarkDistrict.row,
          sizeMetres: config.districtSizeMetres,
          offsetBand: createDistrictOffsetBand(config, column, row),
        }),
      );
    }
  }

  const blocks = districts.flatMap((district) => district.blocks);
  const slots = districts.flatMap((district) => district.slots);
  const landmarkDistrict = districts.find((district) => district.hasLandmark);

  if (landmarkDistrict === undefined) {
    throw new Error('The synthetic city is missing its landmark district.');
  }

  return {
    id: config.id,
    seed: config.seed,
    bounds: {
      minX: cityMinimum,
      maxX: cityMinimum + citySizeMetres,
      minZ: cityMinimum,
      maxZ: cityMinimum + citySizeMetres,
    },
    districts,
    blocks,
    slots,
    metadata: {
      districtCount: districts.length,
      blockCount: blocks.length,
      slotCount: slots.length,
      landmarkDistrictId: landmarkDistrict.id,
      profileCounts: countProfiles(districts),
    },
  };
}

function createDistrictOffsetBand(
  config: SyntheticCityConfig,
  districtColumn: number,
  districtRow: number,
): ProofDistrictConfig['offsetBand'] {
  const band = config.offsetBand;

  if (band === null || districtColumn !== band.districtColumn) {
    return null;
  }

  const rowsPerDistrict = DEFAULT_PROOF_DISTRICT_CONFIG.rowDepthsMetres.length;
  const totalRows = config.districtsPerAxis * rowsPerDistrict;
  const rowOffsetsMetres = Array.from({ length: rowsPerDistrict }, (_, row) => {
    const globalRow = districtRow * rowsPerDistrict + row;
    const phase = (globalRow / (totalRows - 1)) * Math.PI * 2;
    const offset = Math.sin(phase) * band.amplitudeMetres;
    return Math.abs(offset) < 1e-12 ? 0 : offset;
  });

  return {
    column: band.blockColumn,
    rowOffsetsMetres,
  };
}

function profileForDistrict(
  column: number,
  row: number,
): SyntheticDistrictCompositionProfileId {
  const isInnerColumn = column === 1 || column === 2;
  const isInnerRow = row === 1 || row === 2;

  if (isInnerColumn && isInnerRow) {
    return 'centre';
  }

  const isOuterColumn = column === 0 || column === 3;
  const isOuterRow = row === 0 || row === 3;
  return isOuterColumn && isOuterRow ? 'edge' : 'urban';
}

function countProfiles(
  districts: SyntheticCity['districts'],
): Readonly<Record<SyntheticDistrictCompositionProfileId, number>> {
  return {
    centre: districts.filter(
      (district) => district.compositionProfileId === 'centre',
    ).length,
    urban: districts.filter(
      (district) => district.compositionProfileId === 'urban',
    ).length,
    edge: districts.filter(
      (district) => district.compositionProfileId === 'edge',
    ).length,
  };
}

function validateConfig(config: SyntheticCityConfig): void {
  if (config.id.trim().length === 0) {
    throw new Error('The synthetic city ID must not be empty.');
  }

  if (!Number.isSafeInteger(config.seed)) {
    throw new RangeError('The synthetic city seed must be a safe integer.');
  }

  if (config.districtsPerAxis !== 4) {
    throw new RangeError('The first synthetic city composition requires a 4 by 4 district grid.');
  }

  if (
    !Number.isFinite(config.districtSizeMetres) ||
    config.districtSizeMetres <= 0
  ) {
    throw new RangeError('The synthetic district size must be positive and finite.');
  }

  if (config.districtSizeMetres !== DEFAULT_PROOF_DISTRICT_CONFIG.sizeMetres) {
    throw new RangeError('The first synthetic city composition requires 500 m districts.');
  }

  for (const value of [
    config.landmarkDistrict.column,
    config.landmarkDistrict.row,
  ]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 2) {
      throw new RangeError('The landmark district must be one of the four centre districts.');
    }
  }

  validateOffsetBand(config);
}

function validateOffsetBand(config: SyntheticCityConfig): void {
  const band = config.offsetBand;

  if (band === null) {
    return;
  }

  if (
    !Number.isSafeInteger(band.districtColumn) ||
    band.districtColumn < 0 ||
    band.districtColumn >= config.districtsPerAxis
  ) {
    throw new RangeError('The offset band district column is outside the city.');
  }

  if (
    !Number.isSafeInteger(band.blockColumn) ||
    band.blockColumn < 1 ||
    band.blockColumn > 3
  ) {
    throw new RangeError('The offset band must use an inner block column.');
  }

  const leftStreetWidth =
    DEFAULT_PROOF_DISTRICT_CONFIG.columnStreetWidthsMetres[
      band.blockColumn - 1
    ];
  const rightStreetWidth =
    DEFAULT_PROOF_DISTRICT_CONFIG.columnStreetWidthsMetres[band.blockColumn];

  if (leftStreetWidth === undefined || rightStreetWidth === undefined) {
    throw new Error('The offset band is missing an adjacent street gap.');
  }

  const maximumAmplitude =
    Math.min(leftStreetWidth, rightStreetWidth) -
    MINIMUM_OFFSET_BAND_STREET_GAP_METRES;

  if (
    !Number.isFinite(band.amplitudeMetres) ||
    band.amplitudeMetres <= 0 ||
    band.amplitudeMetres > maximumAmplitude
  ) {
    throw new RangeError(
      `The offset band amplitude must be greater than zero and at most ${maximumAmplitude} m.`,
    );
  }
}
