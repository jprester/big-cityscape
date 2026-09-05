import type { SyntheticBuildingPlacement } from '../model/buildingPlacement';
import type { BuildingSlot } from '../model/buildingSlot';
import {
  rankTexturedBuildingModelCandidates,
  selectTexturedBuildingModel,
  type TexturedBuildingModelDescriptor,
  type TexturedBuildingModelSelection,
} from './texturedResidentialModelSelection';

const MINIMUM_MODEL_INSTANCES: Readonly<Record<string, number>> = {
  'residential-pilot-asian-a': 8,
  'residential-pilot-asian-b': 8,
};

export type PlannedTexturedBuildingAssignment = Readonly<{
  modelId: string;
  placement: SyntheticBuildingPlacement;
}>;

export type TexturedBuildingPlacementPlan = Readonly<{
  assignments: readonly PlannedTexturedBuildingAssignment[];
  placements: readonly SyntheticBuildingPlacement[];
  unfilledPlacementIds: readonly string[];
}>;

/**
 * Resolves semantic building requests to authored-scale models. This planner is
 * deliberately Three.js-free so the browser and Blender look-development scene
 * can consume exactly the same deterministic assignments.
 */
export function planTexturedBuildingPlacements(
  placements: readonly SyntheticBuildingPlacement[],
  models: readonly TexturedBuildingModelDescriptor[],
  slots: readonly BuildingSlot[],
  selectionNamespace: string,
): TexturedBuildingPlacementPlan {
  const modelsById = new Map(models.map((model) => [model.id, model]));
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const selectedByPlacementId = new Map<
    string,
    TexturedBuildingModelSelection
  >();
  const modelUseCounts = new Map<string, number>();

  for (const placement of placements) {
    const exactModel = modelsById.get(placement.assetId);
    if (exactModel === undefined) {
      continue;
    }
    const selection = rankTexturedBuildingModelCandidates(
      selectionTarget(placement, slotsById),
      [exactModel],
    )[0];
    if (selection === undefined) {
      continue;
    }
    selectedByPlacementId.set(placement.id, selection);
    modelUseCounts.set(exactModel.id, (modelUseCounts.get(exactModel.id) ?? 0) + 1);
  }

  const availablePlacements = placements.filter(
    (placement) => !selectedByPlacementId.has(placement.id),
  );
  for (const model of models) {
    const minimumInstances = MINIMUM_MODEL_INSTANCES[model.id] ?? 1;
    while ((modelUseCounts.get(model.id) ?? 0) < minimumInstances) {
      const best = availablePlacements
        .filter((placement) => !selectedByPlacementId.has(placement.id))
        .flatMap((placement) => {
          const selection = rankTexturedBuildingModelCandidates(
            selectionTarget(placement, slotsById),
            [model],
          )[0];
          return selection === undefined ? [] : [{ placement, selection }];
        })
        .sort(
          (first, second) =>
            first.selection.compatibilityScore -
              second.selection.compatibilityScore ||
            first.placement.id.localeCompare(second.placement.id),
        )[0];
      if (best === undefined) {
        break;
      }
      selectedByPlacementId.set(best.placement.id, best.selection);
      modelUseCounts.set(model.id, (modelUseCounts.get(model.id) ?? 0) + 1);
    }
  }

  const assignments: PlannedTexturedBuildingAssignment[] = [];
  const unfilledPlacementIds: string[] = [];
  for (const placement of placements) {
    const selection =
      selectedByPlacementId.get(placement.id) ??
      selectTexturedBuildingModel(
        placement.id,
        selectionTarget(placement, slotsById),
        models,
        selectionNamespace,
      );
    if (selection === undefined) {
      unfilledPlacementIds.push(placement.id);
      continue;
    }
    const model = modelsById.get(selection.modelId);
    if (model === undefined) {
      throw new Error(`Textured assignment lost model ${selection.modelId}.`);
    }
    const slotRotationRadians =
      placement.rotationRadians -
      (placement.rotateAssetQuarterTurn ? Math.PI / 2 : 0);
    const rotationRadians =
      slotRotationRadians + (selection.rotateQuarterTurn ? Math.PI / 2 : 0);
    const resolvedPlacement: SyntheticBuildingPlacement = {
      ...placement,
      rotationRadians,
      rotateAssetQuarterTurn: selection.rotateQuarterTurn,
      uniformScale: 1,
      heightScale: 1,
      dimensionsMetres: {
        width: selection.rotateQuarterTurn
          ? model.depthMetres
          : model.widthMetres,
        height: model.heightMetres,
        depth: selection.rotateQuarterTurn
          ? model.widthMetres
          : model.depthMetres,
      },
      compatibilityScore: selection.compatibilityScore,
    };
    assignments.push({ modelId: selection.modelId, placement: resolvedPlacement });
  }

  return {
    assignments,
    placements: assignments.map((assignment) => assignment.placement),
    unfilledPlacementIds,
  };
}

function selectionTarget(
  placement: SyntheticBuildingPlacement,
  slotsById: ReadonlyMap<string, BuildingSlot>,
): Readonly<{ width: number; height: number; depth: number }> {
  const slot = slotsById.get(placement.slotId);
  return {
    width: slot?.widthMetres ?? placement.dimensionsMetres.width,
    height: slot?.targetHeightMetres ?? placement.dimensionsMetres.height,
    depth: slot?.depthMetres ?? placement.dimensionsMetres.depth,
  };
}
