import { createSeededRandom, deriveSeed } from '../../../core/random';
import {
  BUILDING_ASSET_CATALOG,
  type BuildingAssetCatalogEntry,
} from '../../assets/buildingAssetCatalog';
import {
  type AssetSlotRejectionReason,
  type AssetSlotSelectionResult,
  type AssetUsageCounts,
} from '../model/assetSlotSelection';
import type { BuildingSlot } from '../model/buildingSlot';

export { ASSET_SLOT_REJECTION_REASONS } from '../model/assetSlotSelection';
export type {
  AssetSlotRejectionReason,
  AssetSlotSelectionResult,
  AssetUsageCounts,
} from '../model/assetSlotSelection';

type CompatibleCandidate = Readonly<{
  asset: BuildingAssetCatalogEntry;
  rotateAssetQuarterTurn: boolean;
  widthMetres: number;
  heightMetres: number;
  depthMetres: number;
  uniformScale: number;
  heightScale: number;
  score: number;
  selectionWeight: number;
}>;

const EMPTY_USAGE_COUNTS: AssetUsageCounts = new Map();
const SCALE_EPSILON = 1e-9;
const REUSE_BALANCE_EXPONENT = 1.35;

export function selectAssetForSlot(
  slot: BuildingSlot,
  assets: readonly BuildingAssetCatalogEntry[] = BUILDING_ASSET_CATALOG,
  usageCounts: AssetUsageCounts = EMPTY_USAGE_COUNTS,
): AssetSlotSelectionResult {
  assertValidSlot(slot);
  const rejectedByReason = emptyRejectionCounts();
  const candidates: CompatibleCandidate[] = [];

  for (const asset of assets) {
    const priorUses = assetUsageCount(usageCounts, asset.id);
    const rejectionReason = catalogRejectionReason(slot, asset, priorUses);

    if (rejectionReason !== undefined) {
      rejectedByReason[rejectionReason] += 1;
      continue;
    }

    const direct = fitCandidate(slot, asset, false);
    const rotated = isSquareFootprint(asset)
      ? undefined
      : fitCandidate(slot, asset, true);
    const best = bestOrientation(direct, rotated);

    if (best.candidate !== undefined) {
      candidates.push({
        ...best.candidate,
        selectionWeight:
          best.candidate.selectionWeight * reuseWeightMultiplier(priorUses),
      });
    } else {
      rejectedByReason[best.rejectionReason] += 1;
    }
  }

  if (candidates.length === 0) {
    return {
      status: 'rejected',
      slotId: slot.id,
      consideredAssets: assets.length,
      rejectedByReason,
    };
  }

  const sortedCandidates = [...candidates].sort((first, second) =>
    first.asset.id.localeCompare(second.asset.id),
  );
  const selectionSeed = deriveSeed(
    slot.seed,
    slot.districtId,
    slot.blockId,
    slot.id,
    'asset-selection',
  );
  const selected = selectWeightedCandidate(sortedCandidates, selectionSeed);

  return {
    status: 'selected',
    compatibleCandidates: candidates.length,
    placement: {
      id: `${slot.id}/building`,
      slotId: slot.id,
      districtId: slot.districtId,
      blockId: slot.blockId,
      seed: selectionSeed,
      assetId: selected.asset.id,
      center: slot.center,
      rotationRadians:
        slot.rotationRadians +
        (selected.rotateAssetQuarterTurn ? Math.PI / 2 : 0),
      rotateAssetQuarterTurn: selected.rotateAssetQuarterTurn,
      uniformScale: selected.uniformScale,
      heightScale: selected.heightScale,
      dimensionsMetres: {
        width: selected.widthMetres,
        height: selected.heightMetres,
        depth: selected.depthMetres,
      },
      compatibilityScore: selected.score,
    },
  };
}

function catalogRejectionReason(
  slot: BuildingSlot,
  asset: BuildingAssetCatalogEntry,
  priorUses: number,
): AssetSlotRejectionReason | undefined {
  if (!asset.enabled) {
    return 'disabled';
  }

  if (!slot.allowedUses.includes(asset.use)) {
    return 'use-mismatch';
  }

  if (!slot.allowedForms.includes(asset.form)) {
    return 'form-mismatch';
  }

  if (asset.heightClass !== slot.heightClass) {
    return 'height-class-mismatch';
  }

  if (!asset.placementRoles.includes(slot.role)) {
    return 'role-mismatch';
  }

  if (
    asset.maximumPerCity !== null &&
    priorUses >= asset.maximumPerCity
  ) {
    return 'city-limit-reached';
  }

  return undefined;
}

/**
 * Softly favours less-used compatible assets without turning variety into a
 * hard constraint. Fit score and reviewed catalogue weight still participate.
 */
function reuseWeightMultiplier(priorUses: number): number {
  return Math.pow(priorUses + 1, -REUSE_BALANCE_EXPONENT);
}

function assetUsageCount(
  usageCounts: AssetUsageCounts,
  assetId: string,
): number {
  const count = usageCounts.get(assetId) ?? 0;

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(
      `Building asset usage for ${assetId} must be a non-negative integer.`,
    );
  }

  return count;
}

function fitCandidate(
  slot: BuildingSlot,
  asset: BuildingAssetCatalogEntry,
  rotateAssetQuarterTurn: boolean,
): Readonly<{
  candidate?: CompatibleCandidate;
  rejectionReason: 'footprint-incompatible' | 'height-incompatible';
}> {
  const sourceWidth = rotateAssetQuarterTurn
    ? asset.nominalSizeMetres.depth
    : asset.nominalSizeMetres.width;
  const sourceDepth = rotateAssetQuarterTurn
    ? asset.nominalSizeMetres.width
    : asset.nominalSizeMetres.depth;
  const footprintFitScale = Math.min(
    slot.widthMetres / sourceWidth,
    slot.depthMetres / sourceDepth,
  );
  const uniformMinimum = asset.allowedUniformScale[0];
  const uniformMaximum = Math.min(
    asset.allowedUniformScale[1],
    footprintFitScale,
  );

  if (uniformMaximum + SCALE_EPSILON < uniformMinimum) {
    return { rejectionReason: 'footprint-incompatible' };
  }

  const heightImpliedUniformMinimum =
    slot.targetHeightMetres /
    (asset.nominalSizeMetres.height * asset.allowedHeightScale[1]);
  const heightImpliedUniformMaximum =
    slot.targetHeightMetres /
    (asset.nominalSizeMetres.height * asset.allowedHeightScale[0]);
  const feasibleUniformMinimum = Math.max(
    uniformMinimum,
    heightImpliedUniformMinimum,
  );
  const feasibleUniformMaximum = Math.min(
    uniformMaximum,
    heightImpliedUniformMaximum,
  );

  if (feasibleUniformMaximum + SCALE_EPSILON < feasibleUniformMinimum) {
    return { rejectionReason: 'height-incompatible' };
  }

  const uniformScale = feasibleUniformMaximum;
  const heightScale =
    slot.targetHeightMetres /
    (asset.nominalSizeMetres.height * uniformScale);
  const widthMetres = sourceWidth * uniformScale;
  const depthMetres = sourceDepth * uniformScale;
  const heightMetres = asset.nominalSizeMetres.height * uniformScale * heightScale;
  const widthUtilization = widthMetres / slot.widthMetres;
  const depthUtilization = depthMetres / slot.depthMetres;
  const footprintPenalty = -Math.log(widthUtilization * depthUtilization);
  const balancePenalty = Math.abs(
    Math.log(widthUtilization / depthUtilization),
  );
  const transformPenalty =
    Math.abs(Math.log(uniformScale)) + Math.abs(Math.log(heightScale));
  const formPreferenceIndex = slot.allowedForms.indexOf(asset.form);
  const score =
    footprintPenalty +
    balancePenalty * 0.2 +
    transformPenalty * 0.35 +
    formPreferenceIndex * 0.08;

  return {
    candidate: {
      asset,
      rotateAssetQuarterTurn,
      widthMetres,
      heightMetres,
      depthMetres,
      uniformScale,
      heightScale,
      score,
      selectionWeight: asset.selectionWeight * Math.exp(-score * 1.8),
    },
    rejectionReason: 'height-incompatible',
  };
}

function bestOrientation(
  direct: ReturnType<typeof fitCandidate>,
  rotated: ReturnType<typeof fitCandidate> | undefined,
): Readonly<{
  candidate?: CompatibleCandidate;
  rejectionReason: 'footprint-incompatible' | 'height-incompatible';
}> {
  if (direct.candidate !== undefined && rotated?.candidate !== undefined) {
    return direct.candidate.score <= rotated.candidate.score ? direct : rotated;
  }

  if (direct.candidate !== undefined) {
    return direct;
  }

  if (rotated?.candidate !== undefined) {
    return rotated;
  }

  return {
    rejectionReason:
      direct.rejectionReason === 'height-incompatible' ||
      rotated?.rejectionReason === 'height-incompatible'
        ? 'height-incompatible'
        : 'footprint-incompatible',
  };
}

function selectWeightedCandidate(
  candidates: readonly CompatibleCandidate[],
  seed: number,
): CompatibleCandidate {
  const totalWeight = candidates.reduce(
    (total, candidate) => total + candidate.selectionWeight,
    0,
  );

  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new Error('Compatible building assets must have a positive total weight.');
  }

  let threshold = createSeededRandom(seed).float(0, totalWeight);

  for (const candidate of candidates) {
    threshold -= candidate.selectionWeight;

    if (threshold < 0) {
      return candidate;
    }
  }

  const finalCandidate = candidates.at(-1);

  if (finalCandidate === undefined) {
    throw new Error('At least one compatible building asset is required.');
  }

  return finalCandidate;
}

function isSquareFootprint(asset: BuildingAssetCatalogEntry): boolean {
  return (
    Math.abs(
      asset.nominalSizeMetres.width - asset.nominalSizeMetres.depth,
    ) <= SCALE_EPSILON
  );
}

function emptyRejectionCounts(): Record<AssetSlotRejectionReason, number> {
  return {
    disabled: 0,
    'use-mismatch': 0,
    'form-mismatch': 0,
    'height-class-mismatch': 0,
    'role-mismatch': 0,
    'city-limit-reached': 0,
    'footprint-incompatible': 0,
    'height-incompatible': 0,
  };
}

function assertValidSlot(slot: BuildingSlot): void {
  if (
    slot.id.length === 0 ||
    slot.blockId.length === 0 ||
    slot.districtId.length === 0
  ) {
    throw new Error('Building slot IDs must not be empty.');
  }

  if (!Number.isSafeInteger(slot.seed)) {
    throw new RangeError('A building slot seed must be a safe integer.');
  }

  for (const [label, value] of [
    ['width', slot.widthMetres],
    ['depth', slot.depthMetres],
    ['target height', slot.targetHeightMetres],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`Building slot ${label} must be a positive finite distance.`);
    }
  }

  if (
    !Number.isFinite(slot.center[0]) ||
    !Number.isFinite(slot.center[1]) ||
    !Number.isFinite(slot.rotationRadians)
  ) {
    throw new RangeError('Building slot transforms must be finite numbers.');
  }

  if (slot.allowedUses.length === 0 || slot.allowedForms.length === 0) {
    throw new Error('A building slot must allow at least one use and form.');
  }
}
