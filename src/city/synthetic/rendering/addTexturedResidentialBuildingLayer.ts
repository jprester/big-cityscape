import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';
import type { SyntheticBuildingPlacement } from '../model/buildingPlacement';
import type { BuildingSlot } from '../model/buildingSlot';
import type { SyntheticCityPopulation } from '../model/cityPopulation';
import type { SyntheticDistrictPopulation } from '../model/districtPopulation';
import type { SyntheticBuildingRenderStats } from './addSyntheticBuildingLayer';
import {
  loadTexturedBuildingPack,
  type TexturedBuildingPackId,
} from './loadTexturedResidentialPack';
import { planTexturedBuildingPlacements } from './planTexturedBuildingPlacements';

type Assignment = Readonly<{
  placement: ReturnType<typeof planTexturedBuildingPlacements>['placements'][number];
  rotationRadians: number;
}>;

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
  const plan = planTexturedBuildingPlacements(
    placements,
    library.models,
    options.slots ?? [],
    selectionNamespace,
  );
  const assignments = groupAssignmentsByModel(plan.assignments);
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
        plan.placements.length,
        assignments,
        plan.unfilledPlacementIds.length,
      ),
    object: group,
    dispose: () => {
      meshes.forEach((mesh) => mesh.dispose());
      library.dispose();
    },
  });

  return {
    placements: plan.placements,
    unfilledPlacementIds: plan.unfilledPlacementIds,
    stats: {
      instances: plan.placements.length,
      batches: meshes.length,
      loadedModels: assignments.size,
      failedModels: 0,
      triangles,
    },
  };
}

function groupAssignmentsByModel(
  planned: ReturnType<typeof planTexturedBuildingPlacements>['assignments'],
): ReadonlyMap<string, readonly Assignment[]> {
  const assignments = new Map<string, Assignment[]>();
  for (const { modelId, placement } of planned) {
    const existing = assignments.get(modelId) ?? [];
    existing.push({ placement, rotationRadians: placement.rotationRadians });
    assignments.set(modelId, existing);
  }

  return new Map(
    [...assignments].sort(([firstId], [secondId]) =>
      firstId.localeCompare(secondId),
    ),
  );
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
