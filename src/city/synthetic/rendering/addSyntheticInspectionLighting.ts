import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';

export function addSyntheticInspectionLighting(
  layers: DebugLayerManager,
  worldSizeMetres: number,
): void {
  if (!Number.isFinite(worldSizeMetres) || worldSizeMetres <= 0) {
    throw new RangeError('Inspection-lighting world size must be positive and finite.');
  }

  const group = new THREE.Group();
  group.name = 'synthetic:inspection-lighting';
  const hemisphere = new THREE.HemisphereLight(0xd7e3e8, 0x202a30, 2.15);
  const key = new THREE.DirectionalLight(0xffe2c2, 2.65);
  key.position.set(
    worldSizeMetres * -0.55,
    worldSizeMetres * 0.9,
    worldSizeMetres * 0.65,
  );
  group.add(hemisphere, key);

  layers.add({
    id: 'synthetic-lighting',
    label: 'Atmospheric inspection lighting',
    object: group,
  });
}
