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

/** Selects a repeatable, proportionally similar model for a city placement. */
export function selectTexturedBuildingModel(
  placementId: string,
  target: Readonly<{ width: number; height: number; depth: number }>,
  models: readonly TexturedBuildingModelDescriptor[],
  selectionNamespace = 'textured-residential-pilot',
): TexturedBuildingModelSelection {
  if (models.length === 0) {
    throw new Error('Textured residential selection requires at least one model.');
  }

  const candidates = models
    .flatMap((model) => [
      scoreCandidate(model, target, false),
      scoreCandidate(model, target, true),
    ])
    .sort(
      (first, second) =>
        first.compatibilityScore - second.compatibilityScore ||
        first.modelId.localeCompare(second.modelId) ||
        Number(first.rotateQuarterTurn) - Number(second.rotateQuarterTurn),
    );
  const bestByModel = uniqueModels(candidates).slice(0, COMPATIBLE_VARIANT_COUNT);
  const selectedIndex =
    deriveSeed(0, selectionNamespace, placementId) % bestByModel.length;
  const selected = bestByModel[selectedIndex];

  if (selected === undefined) {
    throw new Error('Textured residential selection lost its candidates.');
  }

  return selected;
}

function scoreCandidate(
  model: TexturedBuildingModelDescriptor,
  target: Readonly<{ width: number; height: number; depth: number }>,
  rotateQuarterTurn: boolean,
): Candidate {
  const width = rotateQuarterTurn ? model.depthMetres : model.widthMetres;
  const depth = rotateQuarterTurn ? model.widthMetres : model.depthMetres;
  const targetAspect = target.width / target.depth;
  const modelAspect = width / depth;
  const targetSlenderness = target.height / Math.sqrt(target.width * target.depth);
  const modelSlenderness =
    model.heightMetres / Math.sqrt(model.widthMetres * model.depthMetres);

  return {
    modelId: model.id,
    rotateQuarterTurn,
    compatibilityScore:
      Math.abs(Math.log(targetAspect / modelAspect)) +
      Math.abs(Math.log(targetSlenderness / modelSlenderness)) * 0.65,
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
