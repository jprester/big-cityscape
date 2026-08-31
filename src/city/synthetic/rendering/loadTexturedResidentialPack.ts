import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PACK_DIRECTORY =
  'assets/models/buildings/textured-residential-pilot';

type PackManifestModel = Readonly<{
  id: string;
  knownCatalogAssetId: string | null;
}>;

type PackManifest = Readonly<{
  schemaVersion: number;
  sourceSha256: string;
  packSha256: string;
  packFile: string;
  models: readonly PackManifestModel[];
}>;

export type TexturedResidentialModelPart = Readonly<{
  geometry: THREE.BufferGeometry;
  material: THREE.Material | readonly THREE.Material[];
  triangles: number;
}>;

export type LoadedTexturedResidentialModel = Readonly<{
  id: string;
  knownCatalogAssetId: string | null;
  parts: readonly TexturedResidentialModelPart[];
  widthMetres: number;
  heightMetres: number;
  depthMetres: number;
  triangles: number;
}>;

export type TexturedResidentialModelLibrary = Readonly<{
  models: readonly LoadedTexturedResidentialModel[];
  dispose: () => void;
}>;

export async function loadTexturedResidentialPack(): Promise<TexturedResidentialModelLibrary> {
  const manifestUrl = publicAssetUrl(`${PACK_DIRECTORY}/manifest.json`);
  const response = await fetch(manifestUrl, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Could not load textured residential manifest (${response.status}).`);
  }

  const manifest = validateManifest(await response.json());
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(
    publicAssetUrl(
      `${PACK_DIRECTORY}/${manifest.packFile}?revision=${manifest.packSha256.slice(0, 12)}`,
    ),
  );
  gltf.scene.updateMatrixWorld(true);
  const models = manifest.models.map((definition) =>
    extractModel(gltf.scene, definition),
  );
  const sourceGeometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    sourceGeometries.add(object.geometry);
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
  sourceGeometries.forEach((geometry) => geometry.dispose());

  return {
    models,
    dispose: () => {
      models.forEach((model) =>
        model.parts.forEach((part) => part.geometry.dispose()),
      );
      textures.forEach((texture) => texture.dispose());
      materials.forEach((material) => material.dispose());
    },
  };
}

function extractModel(
  scene: THREE.Group,
  definition: PackManifestModel,
): LoadedTexturedResidentialModel {
  const root = scene.getObjectByName(definition.id);
  if (root === undefined) {
    throw new Error(`Textured pack is missing model node ${definition.id}.`);
  }

  const parts: TexturedResidentialModelPart[] = [];
  const bounds = new THREE.Box3();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    geometry.computeBoundingBox();
    if (geometry.boundingBox !== null) {
      bounds.union(geometry.boundingBox);
    }
    const triangles =
      (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
    parts.push({ geometry, material: object.material, triangles });
  });

  if (parts.length === 0 || bounds.isEmpty()) {
    throw new Error(`Textured pack model ${definition.id} has no mesh geometry.`);
  }
  const size = bounds.getSize(new THREE.Vector3());
  return {
    id: definition.id,
    knownCatalogAssetId: definition.knownCatalogAssetId,
    parts,
    widthMetres: size.x,
    heightMetres: size.y,
    depthMetres: size.z,
    triangles: parts.reduce((total, part) => total + part.triangles, 0),
  };
}

function validateManifest(value: unknown): PackManifest {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    value.schemaVersion !== 1 ||
    !('sourceSha256' in value) ||
    typeof value.sourceSha256 !== 'string' ||
    !('packSha256' in value) ||
    typeof value.packSha256 !== 'string' ||
    !('packFile' in value) ||
    typeof value.packFile !== 'string' ||
    !('models' in value) ||
    !Array.isArray(value.models)
  ) {
    throw new Error('Textured residential manifest has an unsupported shape.');
  }
  return value as PackManifest;
}

function publicAssetUrl(assetPath: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${assetPath}`;
}
