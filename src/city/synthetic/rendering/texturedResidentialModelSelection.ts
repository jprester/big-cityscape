import { deriveSeed } from '../../../core/random';

export type TexturedBuildingModelDescriptor = Readonly<{
  id: string;
  widthMetres: number;
  heightMetres: number;
  depthMetres: number;
}>;

export type TexturedBuildingModelSelection = Readonly<{
  modelId: string;
  rotateQuarterTurn: boolean;
  compatibilityScore: number;
}>;

type Candidate = TexturedBuildingModelSelection;

const COMPATIBLE_VARIANT_COUNT = 4;
const FIT_EPSILON_METRES = 1e-6;

/** Selects a repeatable authored-scale model that fits inside a city slot. */
export function selectTexturedBuildingModel(
  placementId: string,
  target: Readonly<{ width: number; height: number; depth: number }>,
  models: readonly TexturedBuildingModelDescriptor[],
  selectionNamespace = 'textured-residential-pilot',
): TexturedBuildingModelSelection | undefined {
  if (models.length === 0) {
    throw new Error('Textured residential selection requires at least one model.');
  }

  const bestByModel = rankTexturedBuildingModelCandidates(target, models).slice(
    0,
    COMPATIBLE_VARIANT_COUNT,
  );

  if (bestByModel.length === 0) {
    return undefined;
  }

  const selectedIndex =
    deriveSeed(0, selectionNamespace, placementId) % bestByModel.length;
  return bestByModel[selectedIndex];
}

export function rankTexturedBuildingModelCandidates(
  target: Readonly<{ width: number; height: number; depth: number }>,
  models: readonly TexturedBuildingModelDescriptor[],
): readonly TexturedBuildingModelSelection[] {
  const candidates = models
    .flatMap((model) =>
      [
        scoreCandidate(model, target, false),
        scoreCandidate(model, target, true),
      ].filter((candidate): candidate is Candidate => candidate !== undefined),
    )
    .sort(
      (first, second) =>
        first.compatibilityScore - second.compatibilityScore ||
        first.modelId.localeCompare(second.modelId) ||
        Number(first.rotateQuarterTurn) - Number(second.rotateQuarterTurn),
    );

  return uniqueModels(candidates);
}

function scoreCandidate(
  model: TexturedBuildingModelDescriptor,
  target: Readonly<{ width: number; height: number; depth: number }>,
  rotateQuarterTurn: boolean,
): Candidate | undefined {
  const width = rotateQuarterTurn ? model.depthMetres : model.widthMetres;
  const depth = rotateQuarterTurn ? model.widthMetres : model.depthMetres;
  if (
    width > target.width + FIT_EPSILON_METRES ||
    depth > target.depth + FIT_EPSILON_METRES
  ) {
    return undefined;
  }

  const targetAspect = target.width / target.depth;
  const modelAspect = width / depth;
  const footprintUtilization =
    (width / target.width) * (depth / target.depth);
  const heightPenalty = Math.abs(Math.log(model.heightMetres / target.height));
  const footprintPenalty = -Math.log(footprintUtilization);
  const aspectPenalty = Math.abs(Math.log(modelAspect / targetAspect));

  return {
    modelId: model.id,
    rotateQuarterTurn,
    compatibilityScore:
      heightPenalty * 0.65 +
      footprintPenalty * 0.25 +
      aspectPenalty * 0.1,
  };
}

function uniqueModels(candidates: readonly Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.modelId)) {
      return false;
    }
    seen.add(candidate.modelId);
    return true;
  });
}
