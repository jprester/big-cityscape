import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';
import type {
  SyntheticBlockDefinition,
  SyntheticBounds2,
} from '../model/proofDistrict';
import {
  countStreetHierarchies,
  SYNTHETIC_STREET_HIERARCHY_IDS,
  type SyntheticStreetCorridor,
  type SyntheticStreetHierarchyId,
} from '../model/streetCorridor';

const ROAD_COLORS: Readonly<Record<SyntheticStreetHierarchyId, number>> = {
  arterial: 0x1b242c,
  secondary: 0x242f37,
  local: 0x2d3941,
};

const ROAD_HEIGHTS: Readonly<Record<SyntheticStreetHierarchyId, number>> = {
  arterial: 0.04,
  secondary: 0.025,
  local: 0.015,
};

export function addSyntheticStreetLayers(
  layers: DebugLayerManager,
  spatial: Readonly<{
    blocks: readonly SyntheticBlockDefinition[];
    streetCorridors: readonly SyntheticStreetCorridor[];
  }>,
): void {
  addRoadHierarchyLayer(layers, spatial.streetCorridors);
  addSidewalkLayer(layers, spatial.blocks);
}

function addRoadHierarchyLayer(
  layers: DebugLayerManager,
  streets: readonly SyntheticStreetCorridor[],
): void {
  const group = new THREE.Group();
  group.name = 'synthetic:road-hierarchy';
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const materials: THREE.MeshBasicMaterial[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();

  for (const hierarchyId of SYNTHETIC_STREET_HIERARCHY_IDS) {
    const corridors = streets.filter(
      (street) => street.hierarchyId === hierarchyId,
    );

    if (corridors.length === 0) {
      continue;
    }

    const material = new THREE.MeshBasicMaterial({
      color: ROAD_COLORS[hierarchyId],
    });
    const mesh = new THREE.InstancedMesh(
      geometry,
      material,
      corridors.length,
    );
    mesh.name = `synthetic:roads:${hierarchyId}`;

    corridors.forEach((corridor, index) => {
      const { bounds } = corridor;
      position.set(
        (bounds.minX + bounds.maxX) / 2,
        ROAD_HEIGHTS[hierarchyId] + axisLayerOffset(corridor.axis),
        (bounds.minZ + bounds.maxZ) / 2,
      );
      scale.set(bounds.maxX - bounds.minX, 1, bounds.maxZ - bounds.minZ);
      transform.compose(position, rotation, scale);
      mesh.setMatrixAt(index, transform);
    });

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
    meshes.push(mesh);
    materials.push(material);
  }

  const counts = countStreetHierarchies(streets);
  layers.add({
    id: 'road-hierarchy',
    label: `${counts.arterial} arterial · ${counts.secondary} secondary · ${counts.local} local road surfaces`,
    object: group,
    dispose: () => {
      meshes.forEach((mesh) => mesh.dispose());
      geometry.dispose();
      materials.forEach((material) => material.dispose());
    },
  });
}

function addSidewalkLayer(
  layers: DebugLayerManager,
  blocks: readonly SyntheticBlockDefinition[],
): void {
  const surfaces = blocks.flatMap(sidewalkSurfacesForBlock);
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshLambertMaterial({
    color: 0x748087,
    emissive: 0x101416,
  });
  const mesh = new THREE.InstancedMesh(
    geometry,
    material,
    surfaces.length,
  );
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  mesh.name = 'synthetic:sidewalk-surfaces';

  surfaces.forEach((bounds, index) => {
    position.set(
      (bounds.minX + bounds.maxX) / 2,
      0.19,
      (bounds.minZ + bounds.maxZ) / 2,
    );
    scale.set(bounds.maxX - bounds.minX, 1, bounds.maxZ - bounds.minZ);
    transform.compose(position, rotation, scale);
    mesh.setMatrixAt(index, transform);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();

  layers.add({
    id: 'sidewalk-surfaces',
    label: `${surfaces.length.toLocaleString('en-US')} block-edge sidewalk strips`,
    object: mesh,
    dispose: () => {
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  });
}

function sidewalkSurfacesForBlock(
  block: SyntheticBlockDefinition,
): readonly SyntheticBounds2[] {
  const { bounds, buildableBounds } = block;
  return [
    {
      minX: bounds.minX,
      maxX: bounds.maxX,
      minZ: bounds.minZ,
      maxZ: buildableBounds.minZ,
    },
    {
      minX: bounds.minX,
      maxX: bounds.maxX,
      minZ: buildableBounds.maxZ,
      maxZ: bounds.maxZ,
    },
    {
      minX: bounds.minX,
      maxX: buildableBounds.minX,
      minZ: buildableBounds.minZ,
      maxZ: buildableBounds.maxZ,
    },
    {
      minX: buildableBounds.maxX,
      maxX: bounds.maxX,
      minZ: buildableBounds.minZ,
      maxZ: buildableBounds.maxZ,
    },
  ];
}

function axisLayerOffset(
  axis: SyntheticStreetCorridor['axis'],
): number {
  switch (axis) {
    case 'north-south':
      return 0;
    case 'east-west':
      return 0.001;
    case 'intersection':
      return 0.002;
  }
}
