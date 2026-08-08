import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';
import {
  SYNTHETIC_ROAD_MARKING_KINDS,
  type SyntheticRoadMarkingKind,
  type SyntheticRoadMarkingPlan,
} from '../model/roadMarking';

const MARKING_COLORS: Readonly<Record<SyntheticRoadMarkingKind, number>> = {
  'centre-line-dash': 0xd4ad55,
  'crosswalk-bar': 0xe3e0cf,
};

export function addSyntheticRoadMarkingLayer(
  layers: DebugLayerManager,
  plan: SyntheticRoadMarkingPlan,
): void {
  const group = new THREE.Group();
  group.name = 'synthetic:road-markings';
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.rotateX(-Math.PI / 2);
  const materials: THREE.MeshBasicMaterial[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();

  for (const kind of SYNTHETIC_ROAD_MARKING_KINDS) {
    const markings = plan.markings.filter((marking) => marking.kind === kind);

    if (markings.length === 0) {
      continue;
    }

    const material = new THREE.MeshBasicMaterial({
      color: MARKING_COLORS[kind],
      toneMapped: false,
    });
    const mesh = new THREE.InstancedMesh(
      geometry,
      material,
      markings.length,
    );
    mesh.name = `synthetic:road-markings:${kind}`;

    markings.forEach((marking, index) => {
      const { bounds } = marking;
      position.set(
        (bounds.minX + bounds.maxX) / 2,
        0.065,
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

  const { metadata } = plan;
  layers.add({
    id: 'road-markings',
    label: `${metadata.centreLineDashCount} arterial dashes · ${metadata.markedIntersectionCount} zebra intersections`,
    object: group,
    dispose: () => {
      meshes.forEach((mesh) => mesh.dispose());
      geometry.dispose();
      materials.forEach((material) => material.dispose());
    },
  });
}
