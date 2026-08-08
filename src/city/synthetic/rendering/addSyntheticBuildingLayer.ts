import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';
import {
  BUILDING_ASSET_CATALOG,
  type BuildingAssetCatalogEntry,
  type BuildingHeightClass,
} from '../../assets/buildingAssetCatalog';
import type { BuildingModelCatalogEntry } from '../../rendering/buildingModelCatalog';
import {
  loadBuildingModels,
  type BuildingModelLibrary,
  type LoadedBuildingModel,
} from '../../rendering/loadBuildingModels';
import type { SyntheticBuildingPlacement } from '../model/buildingPlacement';
import type { SyntheticDistrictPopulation } from '../model/districtPopulation';
import { addSyntheticInspectionLighting } from './addSyntheticInspectionLighting';

const BUILDING_COLORS: Readonly<Record<BuildingHeightClass, number>> = {
  'low-rise': 0xb6c9bd,
  'mid-rise': 0x9eb9c8,
  'high-rise': 0xd0b37e,
  skyscraper: 0xdfc4d0,
};

export type SyntheticBuildingRenderStats = Readonly<{
  instances: number;
  batches: number;
  loadedModels: number;
  failedModels: number;
  triangles: number;
}>;

export async function addSyntheticBuildingLayer(
  layers: DebugLayerManager,
  population: SyntheticDistrictPopulation,
  worldSizeMetres: number,
): Promise<SyntheticBuildingRenderStats> {
  const assetsById = new Map(
    BUILDING_ASSET_CATALOG.map((asset) => [asset.id, asset]),
  );
  const requestedAssets = population.assetUsage.map((usage) =>
    requireCatalogAsset(assetsById, usage.assetId),
  );
  const library = await loadBuildingModels(
    requestedAssets.map(toModelCatalogEntry),
  );
  const modelsById = new Map(library.models.map((model) => [model.id, model]));
  const placementsByAsset = groupPlacementsByAsset(population.placements);
  const group = new THREE.Group();
  group.name = 'synthetic:selected-building-models';
  const materials = createBuildingMaterials();
  const meshes: THREE.InstancedMesh[] = [];
  const missingPlacements: SyntheticBuildingPlacement[] = [];
  let renderedTriangles = 0;

  for (const [assetId, placements] of placementsByAsset) {
    const asset = requireCatalogAsset(assetsById, assetId);
    const model = modelsById.get(assetId);

    if (model === undefined) {
      missingPlacements.push(...placements);
      continue;
    }

    const mesh = createModelInstances(
      model,
      placements,
      materials[asset.heightClass],
    );
    group.add(mesh);
    meshes.push(mesh);
    renderedTriangles += model.triangles * placements.length;
  }

  const fallback = createFallbackInstances(missingPlacements);

  if (fallback !== undefined) {
    group.add(fallback.mesh);
    meshes.push(fallback.mesh);
    renderedTriangles += fallback.triangles;
  }

  layers.add({
    id: 'selected-building-models',
    label: `${population.metadata.placedCount} selected GLBs · ${population.metadata.distinctAssetCount} asset variants`,
    object: group,
    dispose: () => {
      meshes.forEach((mesh) => mesh.dispose());
      disposeModelLibrary(library);
      Object.values(materials).forEach((material) => material.dispose());
      fallback?.geometry.dispose();
      fallback?.material.dispose();
    },
  });

  addSyntheticInspectionLighting(layers, worldSizeMetres);

  return {
    instances: population.metadata.placedCount,
    batches: meshes.length,
    loadedModels: requestedAssets.filter((asset) => modelsById.has(asset.id))
      .length,
    failedModels: library.failedAssets.length,
    triangles: renderedTriangles,
  };
}

function createModelInstances(
  model: LoadedBuildingModel,
  placements: readonly SyntheticBuildingPlacement[],
  material: THREE.MeshLambertMaterial,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    model.geometry,
    material,
    placements.length,
  );
  mesh.name = `synthetic:model:${model.id}`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  placements.forEach((placement, index) => {
    position.set(placement.center[0], 0.5, placement.center[1]);
    rotation.setFromAxisAngle(yAxis, placement.rotationRadians);

    if (placement.rotateAssetQuarterTurn) {
      scale.set(
        placement.dimensionsMetres.depth / model.widthMetres,
        placement.dimensionsMetres.height / model.heightMetres,
        placement.dimensionsMetres.width / model.depthMetres,
      );
    } else {
      scale.set(
        placement.dimensionsMetres.width / model.widthMetres,
        placement.dimensionsMetres.height / model.heightMetres,
        placement.dimensionsMetres.depth / model.depthMetres,
      );
    }

    transform.compose(position, rotation, scale);
    mesh.setMatrixAt(index, transform);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}

function createFallbackInstances(
  placements: readonly SyntheticBuildingPlacement[],
):
  | Readonly<{
      mesh: THREE.InstancedMesh;
      geometry: THREE.BoxGeometry;
      material: THREE.MeshLambertMaterial;
      triangles: number;
    }>
  | undefined {
  if (placements.length === 0) {
    return undefined;
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  const material = new THREE.MeshLambertMaterial({ color: 0xff5c5c });
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  mesh.name = 'synthetic:missing-model-fallbacks';
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  placements.forEach((placement, index) => {
    position.set(placement.center[0], 0.5, placement.center[1]);
    rotation.setFromAxisAngle(yAxis, placement.rotationRadians);
    scale.set(
      placement.dimensionsMetres.width,
      placement.dimensionsMetres.height,
      placement.dimensionsMetres.depth,
    );
    transform.compose(position, rotation, scale);
    mesh.setMatrixAt(index, transform);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return {
    mesh,
    geometry,
    material,
    triangles: 12 * placements.length,
  };
}

function createBuildingMaterials(): Readonly<
  Record<BuildingHeightClass, THREE.MeshLambertMaterial>
> {
  return {
    'low-rise': createBuildingMaterial('low-rise'),
    'mid-rise': createBuildingMaterial('mid-rise'),
    'high-rise': createBuildingMaterial('high-rise'),
    skyscraper: createBuildingMaterial('skyscraper'),
  };
}

function createBuildingMaterial(
  heightClass: BuildingHeightClass,
): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color: BUILDING_COLORS[heightClass],
    emissive: 0x111315,
  });
}

function groupPlacementsByAsset(
  placements: readonly SyntheticBuildingPlacement[],
): ReadonlyMap<string, readonly SyntheticBuildingPlacement[]> {
  const grouped = new Map<string, SyntheticBuildingPlacement[]>();

  for (const placement of placements) {
    const existing = grouped.get(placement.assetId);

    if (existing === undefined) {
      grouped.set(placement.assetId, [placement]);
    } else {
      existing.push(placement);
    }
  }

  return new Map(
    [...grouped].sort(([firstId], [secondId]) =>
      firstId.localeCompare(secondId),
    ),
  );
}

function toModelCatalogEntry(
  asset: BuildingAssetCatalogEntry,
): BuildingModelCatalogEntry {
  return {
    id: asset.id,
    category: asset.sourceCategory,
    assetPath: `${asset.assetPath}?revision=${asset.audit.shapeFingerprint}`,
  };
}

function requireCatalogAsset(
  assetsById: ReadonlyMap<string, BuildingAssetCatalogEntry>,
  assetId: string,
): BuildingAssetCatalogEntry {
  const asset = assetsById.get(assetId);

  if (asset === undefined) {
    throw new Error(`Synthetic placement references unknown asset ${assetId}.`);
  }

  return asset;
}

function disposeModelLibrary(library: BuildingModelLibrary): void {
  for (const model of library.models) {
    model.geometry.dispose();
  }
}
