import * as THREE from 'three';
import type { DebugLayerManager } from '../../debug/DebugLayerManager';
import type { ChunkedCityMassing, CityMassingChunk } from '../model/cityChunks';
import type { MassingMaterialCategory } from '../model/cityMassing';
import {
  loadBuildingModels,
  type BuildingModelLibrary,
  type LoadedBuildingModel,
} from './loadBuildingModels';
import type { BuildingModelCategory } from './buildingModelCatalog';
import {
  selectBuildingModel,
  type BuildingModelPlacement,
} from './selectBuildingModel';
import {
  planHighRiseModelCoverage,
  planSkylineModelCoverage,
} from './planSkylineModelCoverage';

const MATERIAL_COLORS: Readonly<Record<MassingMaterialCategory, number>> = {
  commercial: 0x8c8a84,
  'mixed-use': 0x8c8a84,
  landmark: 0x8c8a84,
};
const MODEL_FOOTPRINT_FILL = 0.96;

export type CityMassingFrameStats = Readonly<{
  renderedChunks: number;
  totalChunks: number;
  renderedBatches: number;
  totalBatches: number;
  renderedInstances: number;
  totalInstances: number;
}>;

export type CityMassingRenderLayer = Readonly<{
  beginFrame: () => void;
  getFrameStats: () => CityMassingFrameStats;
}>;

export async function addCityMassingLayer(
  layers: DebugLayerManager,
  massing: ChunkedCityMassing,
): Promise<CityMassingRenderLayer> {
  const library = await loadBuildingModels();
  const group = new THREE.Group();
  group.name = 'city:building-models';
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0x10100f,
  });
  const renderedChunkIds = new Set<string>();
  const modelInstancesByCategory: Record<BuildingModelCategory, number> = {
    residential: 0,
    'high-rise': 0,
    skyscraper: 0,
  };
  const modelIdsByCategory: Record<BuildingModelCategory, Set<string>> = {
    residential: new Set(),
    'high-rise': new Set(),
    skyscraper: new Set(),
  };
  const buildings = massing.chunks.flatMap((chunk) => chunk.buildings);
  const skylineModelCoverage = planSkylineModelCoverage(
    buildings,
    library.models,
  );
  const highRiseModelCoverage = planHighRiseModelCoverage(
    buildings,
    library.models,
    new Set(skylineModelCoverage.keys()),
  );
  const reservedModelCoverage = new Map([
    ...skylineModelCoverage,
    ...highRiseModelCoverage,
  ]);
  let renderedBatches = 0;
  let renderedInstances = 0;

  for (const chunk of massing.chunks) {
    const placements = chunk.buildings.map((building) =>
      selectBuildingModel(
        building,
        library.models,
        reservedModelCoverage.get(building.id),
      ),
    );

    for (const placement of placements) {
      modelInstancesByCategory[placement.model.category] += 1;
      modelIdsByCategory[placement.model.category].add(placement.model.id);
    }

    const batch = createChunkBatch(chunk, placements, material);
    const prepareBatch = batch.onBeforeRender.bind(batch);
    batch.onBeforeRender = (
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
      renderedChunkIds.add(chunk.id);
      renderedBatches += 1;
      renderedInstances += placements.length;
    };
    group.add(batch);
  }

  disposeModelLibrary(library);

  const hemisphereLight = new THREE.HemisphereLight(0xe3e1da, 0x252624, 2.1);
  hemisphereLight.name = 'massing:hemisphere-light';
  const directionalLight = new THREE.DirectionalLight(0xfff4e5, 2.4);
  directionalLight.name = 'massing:key-light';
  directionalLight.position.set(-650, 900, 420);
  group.add(hemisphereLight, directionalLight);

  layers.add({
    id: 'building-models',
    label: `${massing.metadata.buildings} model buildings · ${modelInstancesByCategory.residential} residential · ${modelInstancesByCategory['high-rise']} high-rises (${modelIdsByCategory['high-rise'].size} variants) · ${modelInstancesByCategory.skyscraper} skyscrapers`,
    object: group,
    dispose: () => {
      group.traverse((object) => {
        if (object instanceof THREE.BatchedMesh) {
          object.dispose();
        }
      });
      material.dispose();
    },
  });

  return {
    beginFrame: () => {
      renderedChunkIds.clear();
      renderedBatches = 0;
      renderedInstances = 0;
    },
    getFrameStats: () => ({
      renderedChunks: renderedChunkIds.size,
      totalChunks: massing.metadata.chunks,
      renderedBatches,
      totalBatches: massing.metadata.chunks,
      renderedInstances,
      totalInstances: massing.metadata.buildings,
    }),
  };
}

function createChunkBatch(
  chunk: CityMassingChunk,
  placements: readonly BuildingModelPlacement[],
  material: THREE.MeshLambertMaterial,
): THREE.BatchedMesh {
  const models = uniqueModels(placements);
  const maximumVertexCount = models.reduce(
    (total, model) => total + model.geometry.getAttribute('position').count,
    0,
  );
  const maximumIndexCount = models.reduce(
    (total, model) => total + (model.geometry.index?.count ?? 0),
    0,
  );
  const batch = new THREE.BatchedMesh(
    placements.length,
    maximumVertexCount,
    maximumIndexCount,
    material,
  );
  batch.name = `building-models:${chunk.id}`;
  batch.userData = {
    chunkId: chunk.id,
    gridX: chunk.gridX,
    gridZ: chunk.gridZ,
  };
  batch.castShadow = false;
  batch.receiveShadow = false;
  batch.perObjectFrustumCulled = false;
  batch.sortObjects = false;

  const geometryIds = new Map<string, number>();

  for (const model of models) {
    geometryIds.set(model.id, batch.addGeometry(model.geometry));
  }

  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();

  for (const placement of placements) {
    const geometryId = geometryIds.get(placement.model.id);

    if (geometryId === undefined) {
      throw new Error(`Model "${placement.model.id}" is missing from its chunk batch.`);
    }

    const instanceId = batch.addInstance(geometryId);
    composeModelTransform(
      placement,
      transform,
      position,
      rotation,
      scale,
      yAxis,
    );
    batch.setMatrixAt(instanceId, transform);
    color.setHex(MATERIAL_COLORS[placement.building.material]);
    batch.setColorAt(instanceId, color);
  }

  batch.computeBoundingBox();
  batch.computeBoundingSphere();
  return batch;
}

function composeModelTransform(
  placement: BuildingModelPlacement,
  transform: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  yAxis: THREE.Vector3,
): void {
  position.set(placement.center[0], 0, placement.center[1]);
  rotation.setFromAxisAngle(
    yAxis,
    -placement.rotationRadians +
      (placement.rotateModelQuarterTurn ? Math.PI / 2 : 0),
  );

  if (placement.rotateModelQuarterTurn) {
    scale.set(
      (placement.depthMetres * MODEL_FOOTPRINT_FILL) /
        placement.model.widthMetres,
      placement.building.heightMetres / placement.model.heightMetres,
      (placement.widthMetres * MODEL_FOOTPRINT_FILL) /
        placement.model.depthMetres,
    );
  } else {
    scale.set(
      (placement.widthMetres * MODEL_FOOTPRINT_FILL) /
        placement.model.widthMetres,
      placement.building.heightMetres / placement.model.heightMetres,
      (placement.depthMetres * MODEL_FOOTPRINT_FILL) /
        placement.model.depthMetres,
    );
  }

  transform.compose(position, rotation, scale);
}

function uniqueModels(
  placements: readonly BuildingModelPlacement[],
): readonly LoadedBuildingModel[] {
  const models = new Map<string, LoadedBuildingModel>();

  for (const placement of placements) {
    models.set(placement.model.id, placement.model);
  }

  return Array.from(models.values()).sort((first, second) =>
    first.id.localeCompare(second.id),
  );
}

function disposeModelLibrary(library: BuildingModelLibrary): void {
  for (const model of library.models) {
    model.geometry.dispose();
  }
}
