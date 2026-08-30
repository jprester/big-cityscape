import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';
import type { SyntheticBuildingPlacement } from '../model/buildingPlacement';
import type { SyntheticCityPopulation } from '../model/cityPopulation';
import type { SyntheticDistrictPopulation } from '../model/districtPopulation';
import type { SyntheticBuildingRenderStats } from './addSyntheticBuildingLayer';
import {
  loadTexturedResidentialPack,
  type LoadedTexturedResidentialModel,
} from './loadTexturedResidentialPack';
import { selectTexturedResidentialModel } from './texturedResidentialModelSelection';

type Assignment = Readonly<{
  placement: SyntheticBuildingPlacement;
  rotationRadians: number;
  rotateQuarterTurn: boolean;
}>;

export type TexturedResidentialBuildingLayerOptions = Readonly<{
  placements?: readonly SyntheticBuildingPlacement[];
  layerId?: string;
  label?: string;
}>;

export async function addTexturedResidentialBuildingLayer(
  layers: DebugLayerManager,
  population: SyntheticCityPopulation | SyntheticDistrictPopulation,
  options: TexturedResidentialBuildingLayerOptions = {},
): Promise<SyntheticBuildingRenderStats> {
  const placements = options.placements ?? population.placements;
  const library = await loadTexturedResidentialPack();
  const modelsById = new Map(library.models.map((model) => [model.id, model]));
  const assignments = assignPlacements(placements, library.models);
  const group = new THREE.Group();
  group.name = 'synthetic:textured-residential-pilot';
  const meshes: THREE.InstancedMesh[] = [];
  let triangles = 0;

  for (const [modelId, modelAssignments] of assignments) {
    const model = modelsById.get(modelId);
    if (model === undefined) {
      throw new Error(`Textured residential assignment lost model ${modelId}.`);
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
      `${placements.length} textured residential instances · ${assignments.size} variants`,
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
  models: readonly LoadedTexturedResidentialModel[],
): ReadonlyMap<string, readonly Assignment[]> {
  const modelsById = new Map(models.map((model) => [model.id, model]));
  const assignments = new Map<string, Assignment[]>();
  const selectedByPlacementId = new Map<string, Readonly<{
    modelId: string;
    rotateQuarterTurn: boolean;
  }>>();
  const usedModelIds = new Set<string>();

  for (const placement of placements) {
    const exactModel = modelsById.get(placement.assetId);
    if (exactModel === undefined) {
      continue;
    }
    selectedByPlacementId.set(placement.id, {
      modelId: exactModel.id,
      rotateQuarterTurn: placement.rotateAssetQuarterTurn,
    });
    usedModelIds.add(exactModel.id);
  }

  const availablePlacements = placements.filter(
    (placement) => !selectedByPlacementId.has(placement.id),
  );
  for (const model of models.filter((candidate) => !usedModelIds.has(candidate.id))) {
    const best = availablePlacements
      .filter((placement) => !selectedByPlacementId.has(placement.id))
      .map((placement) => ({
        placement,
        selection: selectTexturedResidentialModel(
          placement.id,
          placement.dimensionsMetres,
          [model],
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
  }

  for (const placement of placements) {
    const selection =
      selectedByPlacementId.get(placement.id) ??
      selectTexturedResidentialModel(
        placement.id,
        placement.dimensionsMetres,
        models,
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
  model: LoadedTexturedResidentialModel,
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
