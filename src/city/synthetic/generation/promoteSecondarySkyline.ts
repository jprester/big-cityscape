import { deriveSeed } from '../../../core/random';
import type {
  SyntheticBlockDefinition,
  SyntheticBlockTemplateId,
  SyntheticProofDistrict,
} from '../model/proofDistrict';
import { createBlockSlots } from './createBlockSlots';

export type SecondarySkylineConfig = Readonly<{
  anchorCount: number;
  maximumPerDistrict: number;
  minimumSeparationMetres: number;
}>;

export type SecondarySkylineResult = Readonly<{
  districts: readonly SyntheticProofDistrict[];
  anchorBlockIds: readonly string[];
}>;

type SkylineCandidate = Readonly<{
  block: SyntheticBlockDefinition;
  district: SyntheticProofDistrict;
  center: readonly [xMetres: number, zMetres: number];
  score: number;
}>;

export function promoteSecondarySkyline(
  citySeed: number,
  districts: readonly SyntheticProofDistrict[],
  config: SecondarySkylineConfig,
): SecondarySkylineResult {
  validateConfig(citySeed, config);
  const landmarkCenter = findLandmarkCenter(districts);
  const eligibleDistricts = districts
    .filter(
      (district) =>
        district.compositionProfileId === 'centre' && !district.hasLandmark,
    )
    .toSorted((first, second) => first.id.localeCompare(second.id));

  if (config.anchorCount < eligibleDistricts.length) {
    throw new RangeError(
      'The secondary skyline must place at least one anchor in every non-landmark centre district.',
    );
  }

  const candidates = eligibleDistricts
    .flatMap((district) => createCandidates(citySeed, district))
    .toSorted(compareCandidates);
  const selected: SkylineCandidate[] = [];
  const countsByDistrict = new Map<string, number>();

  for (const district of eligibleDistricts) {
    const candidate = candidates.find(
      (entry) =>
        entry.district.id === district.id &&
        isSeparated(entry.center, landmarkCenter, selected, config),
    );

    if (candidate === undefined) {
      throw new Error(
        `Could not place a separated secondary skyline anchor in ${district.id}.`,
      );
    }

    selectCandidate(candidate, selected, countsByDistrict);
  }

  for (const candidate of candidates) {
    if (selected.length >= config.anchorCount) {
      break;
    }

    if (
      selected.includes(candidate) ||
      (countsByDistrict.get(candidate.district.id) ?? 0) >=
        config.maximumPerDistrict ||
      !isSeparated(candidate.center, landmarkCenter, selected, config)
    ) {
      continue;
    }

    selectCandidate(candidate, selected, countsByDistrict);
  }

  if (selected.length !== config.anchorCount) {
    throw new Error(
      `Could only place ${selected.length} of ${config.anchorCount} separated secondary skyline anchors.`,
    );
  }

  const anchorBlockIds = selected
    .map((candidate) => candidate.block.id)
    .sort((first, second) => first.localeCompare(second));
  const selectedIds = new Set(anchorBlockIds);

  return {
    districts: districts.map((district) =>
      promoteDistrictBlocks(district, selectedIds),
    ),
    anchorBlockIds,
  };
}

function createCandidates(
  citySeed: number,
  district: SyntheticProofDistrict,
): readonly SkylineCandidate[] {
  return district.blocks
    .filter((block) => block.templateId === 'anchor-and-fill')
    .map((block) => ({
      block,
      district,
      center: requireAnchorCenter(block),
      score: deriveSeed(citySeed, 'secondary-skyline', block.id),
    }));
}

function findLandmarkCenter(
  districts: readonly SyntheticProofDistrict[],
): readonly [xMetres: number, zMetres: number] {
  const landmarkSlots = districts.flatMap((district) =>
    district.slots.filter((slot) => slot.role === 'landmark'),
  );

  if (landmarkSlots.length !== 1) {
    throw new Error(
      'The secondary skyline requires exactly one primary landmark.',
    );
  }

  const landmark = landmarkSlots[0];

  if (landmark === undefined) {
    throw new Error('The secondary skyline is missing its primary landmark.');
  }

  return landmark.center;
}

function requireAnchorCenter(
  block: SyntheticBlockDefinition,
): readonly [xMetres: number, zMetres: number] {
  const anchor = block.slots.find((slot) => slot.role === 'anchor');

  if (anchor === undefined) {
    throw new Error(`Skyline candidate ${block.id} is missing its anchor slot.`);
  }

  return anchor.center;
}

function compareCandidates(
  first: SkylineCandidate,
  second: SkylineCandidate,
): number {
  return (
    first.score - second.score || first.block.id.localeCompare(second.block.id)
  );
}

function isSeparated(
  center: readonly [number, number],
  landmarkCenter: readonly [number, number],
  selected: readonly SkylineCandidate[],
  config: SecondarySkylineConfig,
): boolean {
  return [landmarkCenter, ...selected.map((candidate) => candidate.center)].every(
    (otherCenter) =>
      Math.hypot(center[0] - otherCenter[0], center[1] - otherCenter[1]) >=
      config.minimumSeparationMetres,
  );
}

function selectCandidate(
  candidate: SkylineCandidate,
  selected: SkylineCandidate[],
  countsByDistrict: Map<string, number>,
): void {
  selected.push(candidate);
  countsByDistrict.set(
    candidate.district.id,
    (countsByDistrict.get(candidate.district.id) ?? 0) + 1,
  );
}

function promoteDistrictBlocks(
  district: SyntheticProofDistrict,
  selectedIds: ReadonlySet<string>,
): SyntheticProofDistrict {
  if (!district.blocks.some((block) => selectedIds.has(block.id))) {
    return district;
  }

  const blocks = district.blocks.map((block) =>
    selectedIds.has(block.id) ? promoteBlock(block) : block,
  );
  const slots = blocks.flatMap((block) => block.slots);

  return {
    ...district,
    blocks,
    slots,
    metadata: {
      ...district.metadata,
      slotCount: slots.length,
      templateCounts: countTemplates(blocks),
    },
  };
}

function promoteBlock(
  block: SyntheticBlockDefinition,
): SyntheticBlockDefinition {
  const templateId = 'skyline-anchor' as const;

  return {
    ...block,
    templateId,
    slots: createBlockSlots({
      districtId: block.districtId,
      blockId: block.id,
      blockSeed: block.seed,
      buildableBounds: block.buildableBounds,
      templateId,
    }),
  };
}

function countTemplates(
  blocks: readonly SyntheticBlockDefinition[],
): Readonly<Record<SyntheticBlockTemplateId, number>> {
  return {
    'fabric-grid': countTemplate(blocks, 'fabric-grid'),
    'edge-slabs': countTemplate(blocks, 'edge-slabs'),
    'anchor-and-fill': countTemplate(blocks, 'anchor-and-fill'),
    'skyline-anchor': countTemplate(blocks, 'skyline-anchor'),
    'landmark-plaza': countTemplate(blocks, 'landmark-plaza'),
    'open-space': countTemplate(blocks, 'open-space'),
  };
}

function countTemplate(
  blocks: readonly SyntheticBlockDefinition[],
  templateId: SyntheticBlockTemplateId,
): number {
  return blocks.filter((block) => block.templateId === templateId).length;
}

function validateConfig(
  citySeed: number,
  config: SecondarySkylineConfig,
): void {
  if (!Number.isSafeInteger(citySeed)) {
    throw new RangeError('The secondary skyline seed must be a safe integer.');
  }

  if (
    !Number.isSafeInteger(config.anchorCount) ||
    config.anchorCount < 4 ||
    config.anchorCount > 6
  ) {
    throw new RangeError(
      'The secondary skyline requires between four and six anchors.',
    );
  }

  if (
    !Number.isSafeInteger(config.maximumPerDistrict) ||
    config.maximumPerDistrict < 1
  ) {
    throw new RangeError(
      'The secondary skyline district limit must be a positive integer.',
    );
  }

  if (
    !Number.isFinite(config.minimumSeparationMetres) ||
    config.minimumSeparationMetres <= 0
  ) {
    throw new RangeError('The secondary skyline separation must be positive and finite.');
  }
}
