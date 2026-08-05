import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_ROOT = path.resolve(
  'public/assets/models/buildings/lowpoly-buildings-pack',
);
const OUTPUT_PATH = path.resolve(
  'src/city/assets/buildingAssetCatalog.generated.json',
);
const SOURCE_CATEGORIES = ['residential', 'high-rise', 'skyscraper'] as const;

type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

type CatalogAsset = Readonly<{
  id: string;
  sourceCategory: SourceCategory;
  assetPath: string;
  sourceDimensions: Readonly<{
    width: number;
    height: number;
    depth: number;
  }>;
  sourceBounds: Readonly<{
    min: readonly [number, number, number];
    max: readonly [number, number, number];
  }>;
  proportions: Readonly<{
    footprintAspect: number;
    slenderness: number;
  }>;
  geometry: Readonly<{
    meshes: number;
    vertices: number;
    triangles: number;
    materials: number;
    indexedMeshes: number;
    meshesWithNormals: number;
    meshesWithUvs: number;
  }>;
  audit: Readonly<{
    horizontalCenterOffsetRatio: number;
    groundOffsetRatio: number;
    shapeFingerprint: string;
    duplicateShapeOf: string | null;
    warnings: readonly string[];
  }>;
}>;

async function main(): Promise<void> {
  const assetFiles = await findAssetFiles();
  const loader = new GLTFLoader();
  const inspectedAssets: CatalogAsset[] = [];

  for (const assetFile of assetFiles) {
    inspectedAssets.push(await inspectAsset(loader, assetFile));
  }

  const assets = markDuplicateShapes(inspectedAssets);

  const output = {
    schemaVersion: 1,
    generatedFrom: 'public/assets/models/buildings/lowpoly-buildings-pack',
    assets,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  const counts = Object.fromEntries(
    SOURCE_CATEGORIES.map((category) => [
      category,
      assets.filter((asset) => asset.sourceCategory === category).length,
    ]),
  );
  const warningCount = assets.filter((asset) => asset.audit.warnings.length > 0).length;

  console.log(`Catalogued ${assets.length} building assets.`);
  console.log(`Source categories: ${JSON.stringify(counts)}`);
  console.log(`Assets with audit warnings: ${warningCount}`);
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}.`);
}

async function findAssetFiles(): Promise<readonly string[]> {
  const assetFiles: string[] = [];

  for (const category of SOURCE_CATEGORIES) {
    const categoryPath = path.join(MODEL_ROOT, category);
    const entries = await fs.readdir(categoryPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.glb')) {
        assetFiles.push(path.join(categoryPath, entry.name));
      }
    }
  }

  return assetFiles.sort((first, second) =>
    createAssetId(first).localeCompare(createAssetId(second), undefined, {
      numeric: true,
    }),
  );
}

async function inspectAsset(
  loader: GLTFLoader,
  assetFile: string,
): Promise<CatalogAsset> {
  const bytes = await fs.readFile(assetFile);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const gltf = await loader.parseAsync(arrayBuffer, '');

  try {
    gltf.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    const materialIds = new Set<string>();
    let meshes = 0;
    let vertices = 0;
    let triangles = 0;
    let indexedMeshes = 0;
    let meshesWithNormals = 0;
    let meshesWithUvs = 0;

    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      meshes += 1;
      const geometry = object.geometry;
      const positions = geometry.getAttribute('position');

      if (positions === undefined) {
        return;
      }

      vertices += positions.count;
      triangles += (geometry.index?.count ?? positions.count) / 3;
      indexedMeshes += geometry.index === null ? 0 : 1;
      meshesWithNormals += geometry.getAttribute('normal') === undefined ? 0 : 1;
      meshesWithUvs += geometry.getAttribute('uv') === undefined ? 0 : 1;

      geometry.computeBoundingBox();

      if (geometry.boundingBox !== null) {
        bounds.union(geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
      }

      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        materialIds.add(material.uuid);
      }
    });

    if (bounds.isEmpty() || meshes === 0) {
      throw new Error(`Asset ${assetFile} contains no measurable mesh geometry.`);
    }

    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maximumFootprintDimension = Math.max(size.x, size.z);
    const horizontalCenterOffsetRatio =
      Math.hypot(center.x, center.z) / maximumFootprintDimension;
    const groundOffsetRatio = Math.abs(bounds.min.y) / size.y;
    const warnings: string[] = [];

    if (horizontalCenterOffsetRatio > 0.02) {
      warnings.push('off-centre-horizontal-origin');
    }

    if (groundOffsetRatio > 0.02) {
      warnings.push('base-not-at-ground');
    }

    if (indexedMeshes !== meshes) {
      warnings.push('contains-non-indexed-mesh');
    }

    if (meshesWithNormals !== meshes) {
      warnings.push('missing-normals');
    }

    if (meshesWithUvs !== meshes) {
      warnings.push('missing-uvs');
    }

    return {
      id: createAssetId(assetFile),
      sourceCategory: sourceCategory(assetFile),
      assetPath: path
        .relative(path.resolve('public'), assetFile)
        .split(path.sep)
        .join('/'),
      sourceDimensions: {
        width: rounded(size.x),
        height: rounded(size.y),
        depth: rounded(size.z),
      },
      sourceBounds: {
        min: vectorTuple(bounds.min),
        max: vectorTuple(bounds.max),
      },
      proportions: {
        footprintAspect: rounded(
          Math.max(size.x, size.z) / Math.min(size.x, size.z),
        ),
        slenderness: rounded(size.y / maximumFootprintDimension),
      },
      geometry: {
        meshes,
        vertices,
        triangles: Math.round(triangles),
        materials: materialIds.size,
        indexedMeshes,
        meshesWithNormals,
        meshesWithUvs,
      },
      audit: {
        horizontalCenterOffsetRatio: rounded(horizontalCenterOffsetRatio),
        groundOffsetRatio: rounded(groundOffsetRatio),
        shapeFingerprint: createShapeFingerprint(gltf.scene, bounds),
        duplicateShapeOf: null,
        warnings,
      },
    };
  } finally {
    disposeScene(gltf.scene);
  }
}

function markDuplicateShapes(
  assets: readonly CatalogAsset[],
): readonly CatalogAsset[] {
  const firstAssetByFingerprint = new Map<string, string>();

  return assets.map((asset) => {
    const duplicateShapeOf = firstAssetByFingerprint.get(
      asset.audit.shapeFingerprint,
    );

    if (duplicateShapeOf === undefined) {
      firstAssetByFingerprint.set(asset.audit.shapeFingerprint, asset.id);
    }

    return {
      ...asset,
      audit: {
        ...asset.audit,
        duplicateShapeOf: duplicateShapeOf ?? null,
      },
    };
  });
}

function createShapeFingerprint(
  scene: THREE.Object3D,
  bounds: THREE.Box3,
): string {
  const hash = createHash('sha256');
  const size = bounds.getSize(new THREE.Vector3());
  const position = new THREE.Vector3();

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const positions = object.geometry.getAttribute('position');
    hash.update(`mesh:${positions?.count ?? 0}:`);

    if (positions !== undefined) {
      for (let index = 0; index < positions.count; index += 1) {
        position
          .fromBufferAttribute(positions, index)
          .applyMatrix4(object.matrixWorld);
        hash.update(
          `${normalizedCoordinate(position.x, bounds.min.x, size.x)},` +
            `${normalizedCoordinate(position.y, bounds.min.y, size.y)},` +
            `${normalizedCoordinate(position.z, bounds.min.z, size.z)};`,
        );
      }
    }

    const geometryIndex = object.geometry.index;

    if (geometryIndex !== null) {
      hash.update(`indices:${Array.from(geometryIndex.array).join(',')};`);
    }
  });

  return hash.digest('hex').slice(0, 16);
}

function normalizedCoordinate(
  value: number,
  minimum: number,
  size: number,
): string {
  return ((value - minimum) / size).toFixed(5);
}

function sourceCategory(assetFile: string): SourceCategory {
  const directoryName = path.basename(path.dirname(assetFile));

  if (SOURCE_CATEGORIES.includes(directoryName as SourceCategory)) {
    return directoryName as SourceCategory;
  }

  throw new Error(`Unknown building source category: ${directoryName}`);
}

function createAssetId(assetFile: string): string {
  return path
    .basename(assetFile, '.glb')
    .replace('-lp-', '-');
}

function vectorTuple(vector: THREE.Vector3): readonly [number, number, number] {
  return [rounded(vector.x), rounded(vector.y), rounded(vector.z)];
}

function rounded(value: number): number {
  return Number(value.toFixed(4));
}

function disposeScene(scene: THREE.Object3D): void {
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

  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
}

await main();
