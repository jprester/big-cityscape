import * as THREE from 'three';
import type { DebugLayerManager } from '../../debug/DebugLayerManager';
import type { ChunkedCityMassing } from '../model/cityChunks';
import type {
  BuildingMassPart,
  MassingMaterialCategory,
} from '../model/cityMassing';

const MATERIAL_COLORS: Readonly<Record<MassingMaterialCategory, number>> = {
  commercial: 0x567c91,
  'mixed-use': 0x777d86,
  landmark: 0x9bb2be,
};

export type CityMassingFrameStats = Readonly<{
  renderedChunks: number;
  totalChunks: number;
  renderedBatches: number;
  totalBatches: number;
  renderedParts: number;
  totalParts: number;
}>;

export type CityMassingRenderLayer = Readonly<{
  beginFrame: () => void;
  getFrameStats: () => CityMassingFrameStats;
}>;

export function addCityMassingLayer(
  layers: DebugLayerManager,
  massing: ChunkedCityMassing,
): CityMassingRenderLayer {
  const group = new THREE.Group();
  group.name = 'city:primitive-massing';
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0x0b1115,
  });
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const renderedChunkIds = new Set<string>();
  let renderedBatches = 0;
  let renderedParts = 0;
  let totalBatches = 0;

  for (const chunk of massing.chunks) {
    const parts = chunk.buildings.flatMap((building) =>
      building.parts.map((part) => ({ part, material: building.material })),
    );
    const instances = new THREE.InstancedMesh(geometry, material, parts.length);
    instances.name = `primitive-masses:${chunk.id}`;
    instances.userData = {
      chunkId: chunk.id,
      gridX: chunk.gridX,
      gridZ: chunk.gridZ,
    };
    instances.castShadow = false;
    instances.receiveShadow = false;
    instances.onBeforeRender = () => {
      renderedChunkIds.add(chunk.id);
      renderedBatches += 1;
      renderedParts += parts.length;
    };

    for (let index = 0; index < parts.length; index += 1) {
      const instance = parts[index];

      if (instance === undefined) {
        continue;
      }

      composePartTransform(
        instance.part,
        transform,
        position,
        rotation,
        scale,
        yAxis,
      );
      instances.setMatrixAt(index, transform);
      instances.setColorAt(index, new THREE.Color(MATERIAL_COLORS[instance.material]));
    }

    instances.instanceMatrix.needsUpdate = true;

    if (instances.instanceColor !== null) {
      instances.instanceColor.needsUpdate = true;
    }

    instances.computeBoundingBox();
    instances.computeBoundingSphere();
    group.add(instances);
    totalBatches += 1;
  }

  const hemisphereLight = new THREE.HemisphereLight(0xc3ddeb, 0x172028, 2.1);
  hemisphereLight.name = 'massing:hemisphere-light';
  const directionalLight = new THREE.DirectionalLight(0xffe5c6, 2.4);
  directionalLight.name = 'massing:key-light';
  directionalLight.position.set(-650, 900, 420);
  group.add(hemisphereLight, directionalLight);

  layers.add({
    id: 'primitive-masses',
    label: `${massing.metadata.buildings} buildings · ${massing.metadata.chunks} chunks`,
    object: group,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });

  return {
    beginFrame: () => {
      renderedChunkIds.clear();
      renderedBatches = 0;
      renderedParts = 0;
    },
    getFrameStats: () => ({
      renderedChunks: renderedChunkIds.size,
      totalChunks: massing.metadata.chunks,
      renderedBatches,
      totalBatches,
      renderedParts,
      totalParts: massing.metadata.primitiveParts,
    }),
  };
}

function composePartTransform(
  part: BuildingMassPart,
  transform: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  yAxis: THREE.Vector3,
): void {
  position.set(
    part.center[0],
    part.baseHeightMetres + part.heightMetres / 2,
    part.center[1],
  );
  rotation.setFromAxisAngle(yAxis, -part.rotationRadians);
  scale.set(part.widthMetres, part.heightMetres, part.depthMetres);
  transform.compose(position, rotation, scale);
}
