import * as THREE from 'three';
import type { CityMassingFrameStats } from '../../rendering/addCityMassingLayer';
import type { BuildingModelCatalogEntry } from '../../rendering/buildingModelCatalog';
import {
  loadBuildingModels,
  type BuildingModelLibrary,
  type LoadedBuildingModel,
} from '../../rendering/loadBuildingModels';
import {
  BUILDING_ASSET_CATALOG,
  type BuildingAssetCatalogEntry,
  type BuildingHeightClass,
} from '../../assets/buildingAssetCatalog';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';
import type { SyntheticBuildingPlacement } from '../model/buildingPlacement';
import type { SyntheticCityPopulation } from '../model/cityPopulation';
import type { SyntheticProofDistrict } from '../model/proofDistrict';
import type { SyntheticCity } from '../model/syntheticCity';
import { isSyntheticDistrictWithinVisibilityRange } from './syntheticDistrictVisibility';

const BUILDING_COLORS: Readonly<Record<BuildingHeightClass, number>> = {
  'low-rise': 0xb6c9bd,
  'mid-rise': 0x9eb9c8,
  'high-rise': 0xd0b37e,
  skyscraper: 0xdfc4d0,
};

export type SyntheticCityBuildingRenderStats = Readonly<{
  instances: number;
  batches: number;
  loadedModels: number;
  failedModels: number;
  triangles: number;
}>;

export type SyntheticCityBuildingRenderLayer = Readonly<{
  stats: SyntheticCityBuildingRenderStats;
  beginFrame: () => void;
  updateVisibility: (camera: THREE.Camera) => void;
  getFrameStats: () => CityMassingFrameStats;
}>;

type DistrictBatch = Readonly<{
  district: SyntheticProofDistrict;
  mesh: THREE.BatchedMesh;
  instanceCount: number;
  triangles: number;
}>;

export async function addSyntheticCityBuildingLayer(
  layers: DebugLayerManager,
  city: SyntheticCity,
  population: SyntheticCityPopulation,
): Promise<SyntheticCityBuildingRenderLayer> {
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
  const placementsByDistrict = groupPlacementsByDistrict(population.placements);
  const fallbackGeometry = new THREE.BoxGeometry(1, 1, 1);
  fallbackGeometry.translate(0, 0.5, 0);
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0x111315,
  });
  const group = new THREE.Group();
  group.name = 'synthetic:city-building-chunks';
  const batches: DistrictBatch[] = [];
  const renderedDistrictIds = new Set<string>();
  let renderedBatches = 0;
  let renderedInstances = 0;

  for (const district of [...city.districts].sort((first, second) =>
    first.id.localeCompare(second.id),
  )) {
    const placements = placementsByDistrict.get(district.id) ?? [];
    const batch = createDistrictBatch(
      district,
      placements,
      assetsById,
      modelsById,
      fallbackGeometry,
      material,
    );
    const prepareBatch = batch.mesh.onBeforeRender.bind(batch.mesh);
    batch.mesh.onBeforeRender = (
      renderer,
      scene,
      camera,
      geometry,
      renderMaterial,
      renderGroup,
    ) => {
      prepareBatch(
        renderer,
        scene,
        camera,
        geometry,
        renderMaterial,
        renderGroup,
      );
      renderedDistrictIds.add(district.id);
      renderedBatches += 1;
      renderedInstances += batch.instanceCount;
    };
    group.add(batch.mesh);
    batches.push(batch);
  }

  layers.add({
    id: 'selected-building-models',
    label: `${population.metadata.placedCount} selected GLBs · ${population.metadata.distinctAssetCount} variants · ${batches.length} district batches`,
    object: group,
    dispose: () => {
      batches.forEach((batch) => batch.mesh.dispose());
      disposeModelLibrary(library);
      fallbackGeometry.dispose();
      material.dispose();
    },
  });

  const stats: SyntheticCityBuildingRenderStats = {
    instances: population.metadata.placedCount,
    batches: batches.length,
    loadedModels: requestedAssets.filter((asset) => modelsById.has(asset.id))
      .length,
    failedModels: requestedAssets.filter((asset) => !modelsById.has(asset.id))
      .length,
    triangles: batches.reduce((total, batch) => total + batch.triangles, 0),
  };

  return {
    stats,
    beginFrame: () => {
      renderedDistrictIds.clear();
      renderedBatches = 0;
      renderedInstances = 0;
    },
    updateVisibility: (camera) => {
      for (const batch of batches) {
        batch.mesh.visible = isSyntheticDistrictWithinVisibilityRange(
          batch.district.bounds,
          camera.position,
        );
      }
    },
    getFrameStats: () => ({
      renderedChunks: renderedDistrictIds.size,
      totalChunks: batches.length,
      renderedBatches,
      totalBatches: batches.length,
      renderedInstances,
      totalInstances: population.metadata.placedCount,
    }),
  };
}

function createDistrictBatch(
  district: SyntheticProofDistrict,
  placements: readonly SyntheticBuildingPlacement[],
  assetsById: ReadonlyMap<string, BuildingAssetCatalogEntry>,
  modelsById: ReadonlyMap<string, LoadedBuildingModel>,
  fallbackGeometry: THREE.BufferGeometry,
  material: THREE.MeshLambertMaterial,
): DistrictBatch {
  const geometryKeys = new Set<string>();

  for (const placement of placements) {
    geometryKeys.add(
      modelsById.has(placement.assetId) ? placement.assetId : 'fallback',
    );
  }

  const geometries = [...geometryKeys].map((key) =>
    key === 'fallback' ? fallbackGeometry : requireModel(modelsById, key).geometry,
  );
  const maximumVertexCount = geometries.reduce(
    (total, geometry) => total + geometry.getAttribute('position').count,
    0,
  );
  const maximumIndexCount = geometries.reduce(
    (total, geometry) => total + (geometry.index?.count ?? 0),
    0,
  );
  const mesh = new THREE.BatchedMesh(
    placements.length,
    maximumVertexCount,
    maximumIndexCount,
    material,
  );
  mesh.name = `synthetic:district-batch:${district.id}`;
  mesh.userData = {
    districtId: district.id,
    profileId: district.compositionProfileId,
  };
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.perObjectFrustumCulled = false;
  mesh.sortObjects = false;
  const geometryIds = new Map<string, number>();

  for (const key of [...geometryKeys].sort()) {
    const geometry =
      key === 'fallback' ? fallbackGeometry : requireModel(modelsById, key).geometry;
    geometryIds.set(key, mesh.addGeometry(geometry));
  }

  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  let triangles = 0;

  for (const placement of placements) {
    const asset = requireCatalogAsset(assetsById, placement.assetId);
    const model = modelsById.get(placement.assetId);
    const geometryKey = model === undefined ? 'fallback' : placement.assetId;
    const geometryId = geometryIds.get(geometryKey);

    if (geometryId === undefined) {
      throw new Error(`District ${district.id} is missing geometry ${geometryKey}.`);
    }

    const instanceId = mesh.addInstance(geometryId);
    composePlacementTransform(
      placement,
      model,
      transform,
      position,
      rotation,
      scale,
      yAxis,
    );
    mesh.setMatrixAt(instanceId, transform);
    color.setHex(BUILDING_COLORS[asset.heightClass]);
    mesh.setColorAt(instanceId, color);
    triangles += model?.triangles ?? 12;
  }

  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return {
    district,
    mesh,
    instanceCount: placements.length,
    triangles,
  };
}

function composePlacementTransform(
  placement: SyntheticBuildingPlacement,
  model: LoadedBuildingModel | undefined,
  transform: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  yAxis: THREE.Vector3,
): void {
  position.set(placement.center[0], 0.5, placement.center[1]);
  rotation.setFromAxisAngle(yAxis, placement.rotationRadians);

  if (model === undefined) {
    scale.set(
      placement.dimensionsMetres.width,
      placement.dimensionsMetres.height,
      placement.dimensionsMetres.depth,
    );
  } else if (placement.rotateAssetQuarterTurn) {
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
}

function groupPlacementsByDistrict(
  placements: readonly SyntheticBuildingPlacement[],
): ReadonlyMap<string, readonly SyntheticBuildingPlacement[]> {
  const grouped = new Map<string, SyntheticBuildingPlacement[]>();

  for (const placement of placements) {
    const existing = grouped.get(placement.districtId);

    if (existing === undefined) {
      grouped.set(placement.districtId, [placement]);
    } else {
      existing.push(placement);
    }
  }

  return grouped;
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

function requireModel(
  modelsById: ReadonlyMap<string, LoadedBuildingModel>,
  modelId: string,
): LoadedBuildingModel {
  const model = modelsById.get(modelId);

  if (model === undefined) {
    throw new Error(`Synthetic district batch is missing model ${modelId}.`);
  }

  return model;
}

function disposeModelLibrary(library: BuildingModelLibrary): void {
  for (const model of library.models) {
    model.geometry.dispose();
  }
}
