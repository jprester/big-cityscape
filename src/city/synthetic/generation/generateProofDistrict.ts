import { createSeededRandom, deriveSeed } from '../../../core/random';
import { createBlockSlots } from './createBlockSlots';
import type {
  SyntheticBlockDefinition,
  SyntheticBlockTemplateId,
  SyntheticBounds2,
  SyntheticDistrictProfileId,
  SyntheticProofDistrict,
} from '../model/proofDistrict';

export type ProofDistrictConfig = Readonly<{
  id: string;
  seed: number;
  sizeMetres: number;
  outerMarginMetres: number;
  blockInsetMetres: number;
  columnWidthsMetres: readonly number[];
  rowDepthsMetres: readonly number[];
  columnStreetWidthsMetres: readonly number[];
  rowStreetWidthsMetres: readonly number[];
}>;

export const DEFAULT_PROOF_DISTRICT_CONFIG: ProofDistrictConfig = {
  id: 'proof-district',
  seed: 20_260_805,
  sizeMetres: 500,
  outerMarginMetres: 20,
  blockInsetMetres: 5,
  columnWidthsMetres: [70, 85, 90, 75, 70],
  rowDepthsMetres: [68, 82, 96, 74, 70],
  columnStreetWidthsMetres: [18, 14, 24, 14],
  rowStreetWidthsMetres: [16, 22, 14, 18],
};

export function generateProofDistrict(
  config: ProofDistrictConfig = DEFAULT_PROOF_DISTRICT_CONFIG,
): SyntheticProofDistrict {
  validateConfig(config);

  const districtBounds: SyntheticBounds2 = {
    minX: -config.sizeMetres / 2,
    maxX: config.sizeMetres / 2,
    minZ: -config.sizeMetres / 2,
    maxZ: config.sizeMetres / 2,
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

  for (let row = 0; row < rowBounds.length; row += 1) {
    for (let column = 0; column < columnBounds.length; column += 1) {
      const xBounds = columnBounds[column];
      const zBounds = rowBounds[row];

      if (xBounds === undefined || zBounds === undefined) {
        throw new Error('Proof-district axis generation produced a missing block.');
      }

      const blockId = `${config.id}/block-r${row}-c${column}`;
      const blockSeed = deriveSeed(config.seed, blockId);
      const profileId = profileForCell(column, row);
      const templateId = templateForCell(column, row, profileId, blockSeed);
      const bounds: SyntheticBounds2 = {
        minX: xBounds[0],
        maxX: xBounds[1],
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

function profileForCell(
  column: number,
  row: number,
): SyntheticDistrictProfileId {
  return column >= 1 && column <= 3 && row >= 1 && row <= 3
    ? 'core'
    : 'transition';
}

function templateForCell(
  column: number,
  row: number,
  profileId: SyntheticDistrictProfileId,
  blockSeed: number,
): SyntheticBlockTemplateId {
  if (column === 2 && row === 2) {
    return 'landmark-plaza';
  }

  if (profileId === 'core') {
    return 'anchor-and-fill';
  }

  const random = createSeededRandom(deriveSeed(blockSeed, 'template-choice'));
  return random.next() < 0.35 ? 'edge-slabs' : 'fabric-grid';
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
  };
}

function validateConfig(config: ProofDistrictConfig): void {
  if (config.id.trim().length === 0) {
    throw new RangeError('The proof district ID must not be empty.');
  }

  if (!Number.isSafeInteger(config.seed)) {
    throw new RangeError('The proof district seed must be a safe integer.');
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
