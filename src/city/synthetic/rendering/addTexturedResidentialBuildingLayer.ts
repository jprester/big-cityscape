import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';
import type { SyntheticBuildingPlacement } from '../model/buildingPlacement';
import type { SyntheticCityPopulation } from '../model/cityPopulation';
import type { SyntheticDistrictPopulation } from '../model/districtPopulation';
import type { SyntheticBuildingRenderStats } from './addSyntheticBuildingLayer';
import {
  loadTexturedBuildingPack,
  type LoadedTexturedBuildingModel,
  type TexturedBuildingPackId,
} from './loadTexturedResidentialPack';
import { selectTexturedBuildingModel } from './texturedResidentialModelSelection';

type Assignment = Readonly<{
  placement: SyntheticBuildingPlacement;
  rotationRadians: number;
  rotateQuarterTurn: boolean;
}>;

const MINIMUM_MODEL_INSTANCES: Readonly<Record<string, number>> = {
  'residential-pilot-asian-a': 8,
  'residential-pilot-asian-b': 8,
};

export type TexturedBuildingLayerOptions = Readonly<{
  packId?: TexturedBuildingPackId;
  placements?: readonly SyntheticBuildingPlacement[];
  layerId?: string;
  label?: string;
}>;

export async function addTexturedBuildingLayer(
  layers: DebugLayerManager,
  population: SyntheticCityPopulation | SyntheticDistrictPopulation,
  options: TexturedBuildingLayerOptions = {},
): Promise<SyntheticBuildingRenderStats> {
  const placements = options.placements ?? population.placements;
  const packId = options.packId ?? 'residential';
  const selectionNamespace = `textured-${packId}-pilot`;
  const library = await loadTexturedBuildingPack(packId);
  const modelsById = new Map(library.models.map((model) => [model.id, model]));
  const assignments = assignPlacements(
    placements,
    library.models,
    selectionNamespace,
  );
  const group = new THREE.Group();
  group.name = `synthetic:${selectionNamespace}`;
  const meshes: THREE.InstancedMesh[] = [];
  let triangles = 0;

  for (const [modelId, modelAssignments] of assignments) {
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
      populateInstanceTransforms(mesh, model, modelAssignments);
      group.add(mesh);
      meshes.push(mesh);
      triangles += part.triangles * modelAssignments.length;
    }
  }

  layers.add({
    id: options.layerId ?? 'selected-building-models',
    label:
      options.label ??
      defaultLayerLabel(packId, placements.length, assignments),
    object: group,
    dispose: () => {
      meshes.forEach((mesh) => mesh.dispose());
      library.dispose();
    },
  });

  return {
    instances: placements.length,
    batches: meshes.length,
    loadedModels: assignments.size,
    failedModels: 0,
    triangles,
  };
}

function assignPlacements(
  placements: readonly SyntheticBuildingPlacement[],
  models: readonly LoadedTexturedBuildingModel[],
  selectionNamespace: string,
): ReadonlyMap<string, readonly Assignment[]> {
  const modelsById = new Map(models.map((model) => [model.id, model]));
  const assignments = new Map<string, Assignment[]>();
  const selectedByPlacementId = new Map<string, Readonly<{
    modelId: string;
    rotateQuarterTurn: boolean;
  }>>();
  const modelUseCounts = new Map<string, number>();

  for (const placement of placements) {
    const exactModel = modelsById.get(placement.assetId);
    if (exactModel === undefined) {
      continue;
    }
    selectedByPlacementId.set(placement.id, {
      modelId: exactModel.id,
      rotateQuarterTurn: placement.rotateAssetQuarterTurn,
    });
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
        .map((placement) => ({
          placement,
          selection: selectTexturedBuildingModel(
            placement.id,
            placement.dimensionsMetres,
            [model],
            selectionNamespace,
          ),
        }))
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

  for (const placement of placements) {
    const selection =
      selectedByPlacementId.get(placement.id) ??
      selectTexturedBuildingModel(
        placement.id,
        placement.dimensionsMetres,
        models,
        selectionNamespace,
      );
    const existing = assignments.get(selection.modelId) ?? [];
    const slotRotationRadians =
      placement.rotationRadians -
      (placement.rotateAssetQuarterTurn ? Math.PI / 2 : 0);
    existing.push({
      placement,
      rotationRadians:
        slotRotationRadians + (selection.rotateQuarterTurn ? Math.PI / 2 : 0),
      rotateQuarterTurn: selection.rotateQuarterTurn,
    });
    assignments.set(selection.modelId, existing);
  }

  return new Map(
    [...assignments].sort(([firstId], [secondId]) =>
      firstId.localeCompare(secondId),
    ),
  );
}

function populateInstanceTransforms(
  mesh: THREE.InstancedMesh,
  model: LoadedTexturedBuildingModel,
  assignments: readonly Assignment[],
): void {
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  assignments.forEach(({ placement, rotationRadians, rotateQuarterTurn }, index) => {
    position.set(placement.center[0], 0.5, placement.center[1]);
    rotation.setFromAxisAngle(yAxis, rotationRadians);
    const modelWidth = rotateQuarterTurn ? model.depthMetres : model.widthMetres;
    const modelDepth = rotateQuarterTurn ? model.widthMetres : model.depthMetres;
    const uniformScale = Math.min(
      placement.dimensionsMetres.width / modelWidth,
      placement.dimensionsMetres.depth / modelDepth,
    );
    scale.setScalar(uniformScale);
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
): string {
  const base = `${placementCount} textured ${packId} instances · ${assignments.size} variants`;

  if (packId !== 'residential') {
    return base;
  }

  return `${base} · podium A/B ${assignments.get('residential-pilot-asian-a')?.length ?? 0}×/${assignments.get('residential-pilot-asian-b')?.length ?? 0}×`;
}
