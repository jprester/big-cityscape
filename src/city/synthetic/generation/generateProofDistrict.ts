import { createSeededRandom, deriveSeed } from '../../../core/random';
import { createBlockSlots } from './createBlockSlots';
import type {
  SyntheticBlockDefinition,
  SyntheticBlockTemplateId,
  SyntheticBounds2,
  SyntheticDistrictCompositionProfileId,
  SyntheticDistrictProfileId,
  SyntheticProofDistrict,
} from '../model/proofDistrict';

export type ProofDistrictConfig = Readonly<{
  id: string;
  seed: number;
  center: readonly [xMetres: number, zMetres: number];
  compositionProfileId: SyntheticDistrictCompositionProfileId;
  hasLandmark: boolean;
  sizeMetres: number;
  outerMarginMetres: number;
  blockInsetMetres: number;
  columnWidthsMetres: readonly number[];
  rowDepthsMetres: readonly number[];
  columnStreetWidthsMetres: readonly number[];
  rowStreetWidthsMetres: readonly number[];
  offsetBand: Readonly<{
    column: number;
    rowOffsetsMetres: readonly number[];
  }> | null;
}>;

export const MINIMUM_OFFSET_BAND_STREET_GAP_METRES = 6;

export const DEFAULT_PROOF_DISTRICT_CONFIG: ProofDistrictConfig = {
  id: 'proof-district',
  seed: 20_260_805,
  center: [0, 0],
  compositionProfileId: 'centre',
  hasLandmark: true,
  sizeMetres: 500,
  outerMarginMetres: 20,
  blockInsetMetres: 5,
  columnWidthsMetres: [70, 85, 90, 75, 70],
  rowDepthsMetres: [68, 82, 96, 74, 70],
  columnStreetWidthsMetres: [18, 14, 24, 14],
  rowStreetWidthsMetres: [16, 22, 14, 18],
  offsetBand: null,
};

export function generateProofDistrict(
  config: ProofDistrictConfig = DEFAULT_PROOF_DISTRICT_CONFIG,
): SyntheticProofDistrict {
  validateConfig(config);

  const districtBounds: SyntheticBounds2 = {
    minX: config.center[0] - config.sizeMetres / 2,
    maxX: config.center[0] + config.sizeMetres / 2,
    minZ: config.center[1] - config.sizeMetres / 2,
    maxZ: config.center[1] + config.sizeMetres / 2,
  };
  const columnBounds = createAxisBounds(
    districtBounds.minX + config.outerMarginMetres,
    config.columnWidthsMetres,
    config.columnStreetWidthsMetres,
  );
  const rowBounds = createAxisBounds(
    districtBounds.minZ + config.outerMarginMetres,
    config.rowDepthsMetres,
    config.rowStreetWidthsMetres,
  );
  const blocks: SyntheticBlockDefinition[] = [];
  const openSpaceCells = selectOpenSpaceCells(config);

  for (let row = 0; row < rowBounds.length; row += 1) {
    for (let column = 0; column < columnBounds.length; column += 1) {
      const xBounds = columnBounds[column];
      const zBounds = rowBounds[row];

      if (xBounds === undefined || zBounds === undefined) {
        throw new Error('Proof-district axis generation produced a missing block.');
      }

      const blockId = `${config.id}/block-r${row}-c${column}`;
      const blockSeed = deriveSeed(config.seed, blockId);
      const xOffsetMetres =
        config.offsetBand?.column === column
          ? requireOffset(config.offsetBand.rowOffsetsMetres, row)
          : 0;
      const profileId = profileForCell(
        column,
        row,
        config.compositionProfileId,
      );
      const templateId = templateForCell(
        column,
        row,
        profileId,
        blockSeed,
        config.compositionProfileId,
        config.hasLandmark,
        openSpaceCells.has(cellKey(column, row)),
      );
      const bounds: SyntheticBounds2 = {
        minX: xBounds[0] + xOffsetMetres,
        maxX: xBounds[1] + xOffsetMetres,
        minZ: zBounds[0],
        maxZ: zBounds[1],
      };
      const buildableBounds = insetBounds(bounds, config.blockInsetMetres);
      const slots = createBlockSlots({
        districtId: config.id,
        blockId,
        blockSeed,
        buildableBounds,
        templateId,
      });

      blocks.push({
        id: blockId,
        districtId: config.id,
        seed: blockSeed,
        gridColumn: column,
        gridRow: row,
        profileId,
        templateId,
        layoutVariationId:
          config.offsetBand?.column === column ? 'offset-band' : 'standard',
        layoutOffsetMetres: [xOffsetMetres, 0],
        bounds,
        buildableBounds,
        slots,
      });
    }
  }

  const slots = blocks.flatMap((block) => block.slots);

  return {
    id: config.id,
    seed: config.seed,
    center: config.center,
    compositionProfileId: config.compositionProfileId,
    hasLandmark: config.hasLandmark,
    bounds: districtBounds,
    blocks,
    slots,
    metadata: {
      blockCount: blocks.length,
      slotCount: slots.length,
      profileCounts: countProfiles(blocks),
      templateCounts: countTemplates(blocks),
    },
  };
}

function requireOffset(offsets: readonly number[], row: number): number {
  const offset = offsets[row];

  if (offset === undefined) {
    throw new Error(`The offset band is missing its row ${row} offset.`);
  }

  return offset;
}

function profileForCell(
  column: number,
  row: number,
  compositionProfileId: SyntheticDistrictCompositionProfileId,
): SyntheticDistrictProfileId {
  if (compositionProfileId === 'edge') {
    return 'transition';
  }

  return column >= 1 && column <= 3 && row >= 1 && row <= 3
    ? 'core'
    : 'transition';
}

function templateForCell(
  column: number,
  row: number,
  profileId: SyntheticDistrictProfileId,
  blockSeed: number,
  compositionProfileId: SyntheticDistrictCompositionProfileId,
  hasLandmark: boolean,
  isOpenSpace: boolean,
): SyntheticBlockTemplateId {
  if (isOpenSpace) {
    return 'open-space';
  }

  if (hasLandmark && column === 2 && row === 2) {
    return 'landmark-plaza';
  }

  if (compositionProfileId === 'centre' && profileId === 'core') {
    return 'anchor-and-fill';
  }

  const random = createSeededRandom(deriveSeed(blockSeed, 'template-choice'));

  if (compositionProfileId === 'urban' && profileId === 'core') {
    return random.next() < 0.48 ? 'anchor-and-fill' : 'edge-slabs';
  }

  const edgeSlabProbability =
    compositionProfileId === 'edge'
      ? 0.22
      : compositionProfileId === 'urban'
        ? 0.38
        : 0.35;
  return random.next() < edgeSlabProbability
    ? 'edge-slabs'
    : 'fabric-grid';
}

function selectOpenSpaceCells(
  config: ProofDistrictConfig,
): ReadonlySet<string> {
  const targetCount =
    config.compositionProfileId === 'centre'
      ? 0
      : config.compositionProfileId === 'urban'
        ? 1
        : 2;

  if (targetCount === 0) {
    return new Set();
  }

  const candidates = Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, column) => ({
      column,
      row,
      score: deriveSeed(
        config.seed,
        'open-space-cell',
        cellKey(column, row),
      ),
    })),
  )
    .flat()
    .filter(
      ({ column, row }) =>
        config.compositionProfileId === 'edge' ||
        profileForCell(column, row, config.compositionProfileId) ===
          'transition',
    )
    .sort(
      (first, second) =>
        first.score - second.score ||
        first.row - second.row ||
        first.column - second.column,
    );
  const first = candidates[0];

  if (first === undefined) {
    throw new Error('The district has no eligible open-space block.');
  }

  const selected = [first];

  if (targetCount === 2) {
    const separated = candidates.find(
      (candidate) =>
        candidate !== first &&
        manhattanDistance(candidate, first) >= 4,
    );
    const second =
      separated ?? candidates.find((candidate) => candidate !== first);

    if (second === undefined) {
      throw new Error('The district cannot place its second open-space block.');
    }

    selected.push(second);
  }

  return new Set(selected.map(({ column, row }) => cellKey(column, row)));
}

function cellKey(column: number, row: number): string {
  return `r${row}-c${column}`;
}

function manhattanDistance(
  first: Readonly<{ column: number; row: number }>,
  second: Readonly<{ column: number; row: number }>,
): number {
  return (
    Math.abs(first.column - second.column) + Math.abs(first.row - second.row)
  );
}

function createAxisBounds(
  start: number,
  sizes: readonly number[],
  gaps: readonly number[],
): readonly (readonly [number, number])[] {
  let cursor = start;

  return sizes.map((size, index) => {
    const bounds = [cursor, cursor + size] as const;
    cursor = bounds[1] + (gaps[index] ?? 0);
    return bounds;
  });
}

function insetBounds(
  bounds: SyntheticBounds2,
  insetMetres: number,
): SyntheticBounds2 {
  return {
    minX: bounds.minX + insetMetres,
    maxX: bounds.maxX - insetMetres,
    minZ: bounds.minZ + insetMetres,
    maxZ: bounds.maxZ - insetMetres,
  };
}

function countProfiles(
  blocks: readonly SyntheticBlockDefinition[],
): Readonly<Record<SyntheticDistrictProfileId, number>> {
  return {
    core: blocks.filter((block) => block.profileId === 'core').length,
    transition: blocks.filter((block) => block.profileId === 'transition').length,
  };
}

function countTemplates(
  blocks: readonly SyntheticBlockDefinition[],
): Readonly<Record<SyntheticBlockTemplateId, number>> {
  return {
    'fabric-grid': blocks.filter((block) => block.templateId === 'fabric-grid')
      .length,
    'edge-slabs': blocks.filter((block) => block.templateId === 'edge-slabs')
      .length,
    'anchor-and-fill': blocks.filter(
      (block) => block.templateId === 'anchor-and-fill',
    ).length,
    'landmark-plaza': blocks.filter(
      (block) => block.templateId === 'landmark-plaza',
    ).length,
    'open-space': blocks.filter((block) => block.templateId === 'open-space')
      .length,
  };
}

function validateConfig(config: ProofDistrictConfig): void {
  if (config.id.trim().length === 0) {
    throw new RangeError('The proof district ID must not be empty.');
  }

  if (!Number.isSafeInteger(config.seed)) {
    throw new RangeError('The proof district seed must be a safe integer.');
  }

  if (!Number.isFinite(config.center[0]) || !Number.isFinite(config.center[1])) {
    throw new RangeError('The proof district centre must use finite coordinates.');
  }

  if (config.hasLandmark && config.compositionProfileId !== 'centre') {
    throw new Error('Only a centre-profile district may contain a landmark.');
  }

  assertPositiveFinite('district size', config.sizeMetres);
  assertPositiveFinite('outer margin', config.outerMarginMetres);
  assertPositiveFinite('block inset', config.blockInsetMetres);
  assertAxis('column', config.columnWidthsMetres, config.columnStreetWidthsMetres);
  assertAxis('row', config.rowDepthsMetres, config.rowStreetWidthsMetres);

  if (
    config.columnWidthsMetres.length !== 5 ||
    config.rowDepthsMetres.length !== 5
  ) {
    throw new RangeError('The proof district currently requires a 5 by 5 block grid.');
  }

  assertAxisFillsDistrict(
    'column',
    config.sizeMetres,
    config.outerMarginMetres,
    config.columnWidthsMetres,
    config.columnStreetWidthsMetres,
  );
  assertAxisFillsDistrict(
    'row',
    config.sizeMetres,
    config.outerMarginMetres,
    config.rowDepthsMetres,
    config.rowStreetWidthsMetres,
  );

  const smallestBlockDimension = Math.min(
    ...config.columnWidthsMetres,
    ...config.rowDepthsMetres,
  );

  if (config.blockInsetMetres * 2 >= smallestBlockDimension) {
    throw new RangeError('The block inset leaves no buildable area.');
  }

  validateOffsetBand(config);
}

function validateOffsetBand(config: ProofDistrictConfig): void {
  const band = config.offsetBand;

  if (band === null) {
    return;
  }

  if (!Number.isSafeInteger(band.column) || band.column < 1 || band.column > 3) {
    throw new RangeError('The offset band column must be an inner block column.');
  }

  if (band.rowOffsetsMetres.length !== config.rowDepthsMetres.length) {
    throw new RangeError('The offset band needs one offset per block row.');
  }

  const leftStreetWidth = config.columnStreetWidthsMetres[band.column - 1];
  const rightStreetWidth = config.columnStreetWidthsMetres[band.column];

  if (leftStreetWidth === undefined || rightStreetWidth === undefined) {
    throw new Error('The offset band is missing an adjacent street gap.');
  }

  for (const offset of band.rowOffsetsMetres) {
    if (!Number.isFinite(offset)) {
      throw new RangeError('Offset-band values must be finite metres.');
    }

    if (
      offset < -(
        leftStreetWidth - MINIMUM_OFFSET_BAND_STREET_GAP_METRES
      ) ||
      offset > rightStreetWidth - MINIMUM_OFFSET_BAND_STREET_GAP_METRES
    ) {
      throw new RangeError(
        `Offset-band values must preserve at least ${MINIMUM_OFFSET_BAND_STREET_GAP_METRES} m of street gap.`,
      );
    }
  }
}

function assertAxis(
  label: string,
  sizes: readonly number[],
  gaps: readonly number[],
): void {
  if (sizes.length === 0 || gaps.length !== sizes.length - 1) {
    throw new RangeError(
      `The ${label} axis needs one fewer street widths than block sizes.`,
    );
  }

  for (const value of [...sizes, ...gaps]) {
    assertPositiveFinite(`${label} axis value`, value);
  }
}

function assertAxisFillsDistrict(
  label: string,
  districtSize: number,
  outerMargin: number,
  sizes: readonly number[],
  gaps: readonly number[],
): void {
  const occupied =
    outerMargin * 2 +
    sizes.reduce((sum, value) => sum + value, 0) +
    gaps.reduce((sum, value) => sum + value, 0);

  if (Math.abs(occupied - districtSize) > 1e-9) {
    throw new RangeError(
      `The ${label} blocks, streets, and margins occupy ${occupied} m, not ${districtSize} m.`,
    );
  }
}

function assertPositiveFinite(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`The ${label} must be a positive finite number.`);
  }
}
