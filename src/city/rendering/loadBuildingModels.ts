import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BUILDING_MODEL_CATALOG,
  BUILDING_MODEL_CATEGORIES,
  type BuildingModelCatalogEntry,
  type BuildingModelCategory,
} from './buildingModelCatalog';

export type LoadedBuildingModel = Readonly<{
  id: string;
  category: BuildingModelCategory;
  geometry: THREE.BufferGeometry;
  widthMetres: number;
  heightMetres: number;
  depthMetres: number;
  triangles: number;
}>;

export type BuildingModelLibrary = Readonly<{
  models: readonly LoadedBuildingModel[];
  failedAssets: readonly Readonly<{
    id: string;
    reason: string;
  }>[];
}>;

export async function loadBuildingModels(): Promise<BuildingModelLibrary> {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled(
    BUILDING_MODEL_CATALOG.map((entry) => loadBuildingModel(loader, entry)),
  );
  const models: LoadedBuildingModel[] = [];
  const failedAssets: Array<Readonly<{ id: string; reason: string }>> = [];

  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    const entry = BUILDING_MODEL_CATALOG[index];

    if (result === undefined || entry === undefined) {
      throw new Error('Building model loading lost its catalogue alignment.');
    }

    if (result.status === 'fulfilled') {
      models.push(result.value);
      continue;
    }

    failedAssets.push({
      id: entry.id,
      reason: errorMessage(result.reason),
    });
  }

  for (const category of BUILDING_MODEL_CATEGORIES) {
    if (models.some((model) => model.category === category)) {
      continue;
    }

    models.push(createFallbackModel(category));
    failedAssets.push({
      id: `fallback-${category}`,
      reason: `No ${category} model loaded; using primitive fallback geometry.`,
    });
  }

  if (failedAssets.length > 0) {
    console.warn('Some building models could not be loaded.', failedAssets);
  }

  return {
    models: models.sort((first, second) => first.id.localeCompare(second.id)),
    failedAssets,
  };
}

async function loadBuildingModel(
  loader: GLTFLoader,
  entry: BuildingModelCatalogEntry,
): Promise<LoadedBuildingModel> {
  const gltf = await loader.loadAsync(publicAssetUrl(entry.assetPath));

  try {
    const geometry = createNormalizedGeometry(gltf.scene, entry.id);
    const bounds = geometry.boundingBox;

    if (bounds === null) {
      geometry.dispose();
      throw new Error(`Building model "${entry.id}" has no geometry bounds.`);
    }

    const size = bounds.getSize(new THREE.Vector3());

    return {
      id: entry.id,
      category: entry.category,
      geometry,
      widthMetres: size.x,
      heightMetres: size.y,
      depthMetres: size.z,
      triangles: triangleCount(geometry),
    };
  } finally {
    disposeSourceScene(gltf.scene);
  }
}

function createNormalizedGeometry(
  scene: THREE.Group,
  modelId: string,
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    geometry.clearGroups();

    for (const attributeName of Object.keys(geometry.attributes)) {
      if (attributeName !== 'position') {
        geometry.deleteAttribute(attributeName);
      }
    }

    if (geometry.index === null) {
      geometry.dispose();
      throw new Error(
        `Building model "${modelId}" contains non-indexed geometry.`,
      );
    }

    geometries.push(geometry);
  });

  if (geometries.length === 0) {
    throw new Error(`Building model "${modelId}" contains no mesh geometry.`);
  }

  const merged =
    geometries.length === 1
      ? geometries[0]
      : mergeGeometries(geometries, false);

  if (merged === null || merged === undefined) {
    disposeGeometries(geometries);
    throw new Error(`Building model "${modelId}" geometry could not be merged.`);
  }

  if (merged !== geometries[0]) {
    disposeGeometries(geometries);
  }

  merged.computeVertexNormals();
  merged.computeBoundingBox();

  if (merged.boundingBox === null || merged.boundingBox.isEmpty()) {
    merged.dispose();
    throw new Error(`Building model "${modelId}" has empty geometry bounds.`);
  }

  const center = merged.boundingBox.getCenter(new THREE.Vector3());
  merged.translate(-center.x, -merged.boundingBox.min.y, -center.z);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function createFallbackModel(
  category: BuildingModelCategory,
): LoadedBuildingModel {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return {
    id: `fallback-${category}`,
    category,
    geometry,
    widthMetres: 1,
    heightMetres: 1,
    depthMetres: 1,
    triangles: triangleCount(geometry),
  };
}

function publicAssetUrl(assetPath: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${assetPath}`;
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  return (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
}

function disposeSourceScene(scene: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    geometries.add(object.geometry);

    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      materials.add(material);

      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) {
          textures.add(value);
        }
      }
    }
  });

  disposeGeometries(geometries);
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
}

function disposeGeometries(
  geometries: Iterable<THREE.BufferGeometry>,
): void {
  for (const geometry of geometries) {
    geometry.dispose();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
