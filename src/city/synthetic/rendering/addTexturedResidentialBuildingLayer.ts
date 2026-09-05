import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';
import type { SyntheticBuildingPlacement } from '../model/buildingPlacement';
import type { BuildingSlot } from '../model/buildingSlot';
import type { SyntheticCityPopulation } from '../model/cityPopulation';
import type { SyntheticDistrictPopulation } from '../model/districtPopulation';
import type { SyntheticBuildingRenderStats } from './addSyntheticBuildingLayer';
import {
  loadTexturedBuildingPack,
  type LoadedTexturedBuildingModel,
  type TexturedBuildingPackId,
} from './loadTexturedResidentialPack';
import {
  rankTexturedBuildingModelCandidates,
  selectTexturedBuildingModel,
  type TexturedBuildingModelSelection,
} from './texturedResidentialModelSelection';

type Assignment = Readonly<{
  placement: SyntheticBuildingPlacement;
  rotationRadians: number;
}>;

const MINIMUM_MODEL_INSTANCES: Readonly<Record<string, number>> = {
  'residential-pilot-asian-a': 8,
  'residential-pilot-asian-b': 8,
};

export type TexturedBuildingLayerOptions = Readonly<{
  packId?: TexturedBuildingPackId;
  placements?: readonly SyntheticBuildingPlacement[];
  slots?: readonly BuildingSlot[];
  layerId?: string;
  label?: string;
}>;

export type TexturedBuildingLayerResult = Readonly<{
  stats: SyntheticBuildingRenderStats;
  placements: readonly SyntheticBuildingPlacement[];
  unfilledPlacementIds: readonly string[];
}>;

export async function addTexturedBuildingLayer(
  layers: DebugLayerManager,
  population: SyntheticCityPopulation | SyntheticDistrictPopulation,
  options: TexturedBuildingLayerOptions = {},
): Promise<TexturedBuildingLayerResult> {
  const placements = options.placements ?? population.placements;
  const packId = options.packId ?? 'residential';
  const selectionNamespace = `textured-${packId}-pilot`;
  const library = await loadTexturedBuildingPack(packId);
  const modelsById = new Map(library.models.map((model) => [model.id, model]));
  const assignments = assignPlacements(
    placements,
    library.models,
    options.slots ?? [],
    selectionNamespace,
  );
  const group = new THREE.Group();
  group.name = `synthetic:${selectionNamespace}`;
  const meshes: THREE.InstancedMesh[] = [];
  let triangles = 0;

  for (const [modelId, modelAssignments] of assignments.byModelId) {
    const model = modelsById.get(modelId);
    if (model === undefined) {
      throw new Error(`Textured ${packId} assignment lost model ${modelId}.`);
    }
    for (const [partIndex, part] of model.parts.entries()) {
      const mesh = new THREE.InstancedMesh(
        part.geometry,
        part.material as THREE.Material | THREE.Material[],
        modelAssignments.length,
      );
      mesh.name = `synthetic:textured:${model.id}:part-${partIndex}`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      populateInstanceTransforms(mesh, modelAssignments);
      group.add(mesh);
      meshes.push(mesh);
      triangles += part.triangles * modelAssignments.length;
    }
  }

  layers.add({
    id: options.layerId ?? 'selected-building-models',
    label:
      options.label ??
      defaultLayerLabel(
        packId,
        assignments.placements.length,
        assignments.byModelId,
        assignments.unfilledPlacementIds.length,
      ),
    object: group,
    dispose: () => {
      meshes.forEach((mesh) => mesh.dispose());
      library.dispose();
    },
  });

  return {
    placements: assignments.placements,
    unfilledPlacementIds: assignments.unfilledPlacementIds,
    stats: {
      instances: assignments.placements.length,
      batches: meshes.length,
      loadedModels: assignments.byModelId.size,
      failedModels: 0,
      triangles,
    },
  };
}

type AssignmentPlan = Readonly<{
  byModelId: ReadonlyMap<string, readonly Assignment[]>;
  placements: readonly SyntheticBuildingPlacement[];
  unfilledPlacementIds: readonly string[];
}>;

function assignPlacements(
  placements: readonly SyntheticBuildingPlacement[],
  models: readonly LoadedTexturedBuildingModel[],
  slots: readonly BuildingSlot[],
  selectionNamespace: string,
): AssignmentPlan {
  const modelsById = new Map(models.map((model) => [model.id, model]));
  const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
  const assignments = new Map<string, Assignment[]>();
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

  const resolvedPlacements: SyntheticBuildingPlacement[] = [];
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
    const existing = assignments.get(selection.modelId) ?? [];
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
    existing.push({
      placement: resolvedPlacement,
      rotationRadians,
    });
    assignments.set(selection.modelId, existing);
    resolvedPlacements.push(resolvedPlacement);
  }

  return {
    byModelId: new Map(
      [...assignments].sort(([firstId], [secondId]) =>
        firstId.localeCompare(secondId),
      ),
    ),
    placements: resolvedPlacements,
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

function populateInstanceTransforms(
  mesh: THREE.InstancedMesh,
  assignments: readonly Assignment[],
): void {
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  assignments.forEach(({ placement, rotationRadians }, index) => {
    position.set(placement.center[0], 0.5, placement.center[1]);
    rotation.setFromAxisAngle(yAxis, rotationRadians);
    scale.setScalar(1);
    transform.compose(position, rotation, scale);
    mesh.setMatrixAt(index, transform);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}

function defaultLayerLabel(
  packId: TexturedBuildingPackId,
  placementCount: number,
  assignments: ReadonlyMap<string, readonly Assignment[]>,
  unfilledPlacementCount: number,
): string {
  const base = `${placementCount} textured ${packId} instances · ${assignments.size} variants`;
  const fillStatus =
    unfilledPlacementCount === 0
      ? ''
      : ` · ${unfilledPlacementCount} slots unfilled`;

  if (packId !== 'residential') {
    return `${base}${fillStatus}`;
  }

  return `${base} · podium A/B ${assignments.get('residential-pilot-asian-a')?.length ?? 0}×/${assignments.get('residential-pilot-asian-b')?.length ?? 0}×${fillStatus}`;
}
