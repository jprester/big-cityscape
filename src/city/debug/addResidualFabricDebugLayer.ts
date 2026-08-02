import * as THREE from 'three';
import type { DebugLayerManager } from '../../debug/DebugLayerManager';
import type { ResidualFabricDefinition } from '../model/residualFabric';

const FABRIC_HEIGHT_METRES = 1.02;

export function addResidualFabricDebugLayer(
  layers: DebugLayerManager,
  fabric: ResidualFabricDefinition,
): void {
  const positions: number[] = [];

  for (const lot of fabric.lots) {
    for (let index = 0; index < lot.footprint.length; index += 1) {
      const start = lot.footprint[index];
      const end = lot.footprint[(index + 1) % lot.footprint.length];

      if (start !== undefined && end !== undefined) {
        positions.push(
          start[0],
          FABRIC_HEIGHT_METRES,
          start[1],
          end[0],
          FABRIC_HEIGHT_METRES,
          end[1],
        );
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  const material = new THREE.LineBasicMaterial({
    color: 0xd4ee8c,
    depthTest: false,
    transparent: true,
    opacity: 0.9,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'debug:residual-fabric';
  lines.renderOrder = 9;

  layers.add({
    id: 'residual-fabric',
    label: `${fabric.metadata.lots} residual fabric lots`,
    object: lines,
    visible: false,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
}
