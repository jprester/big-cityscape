import * as THREE from 'three';
import type { DebugLayerManager } from '../../debug/DebugLayerManager';
import type { ChunkedCityMassing } from '../model/cityChunks';

const CHUNK_LINE_HEIGHT_METRES = 1.22;

export function addChunkDebugLayer(
  layers: DebugLayerManager,
  massing: ChunkedCityMassing,
): void {
  const positions: number[] = [];

  for (const chunk of massing.chunks) {
    const { minX, minZ, maxX, maxZ } = chunk.bounds;
    positions.push(
      minX,
      CHUNK_LINE_HEIGHT_METRES,
      minZ,
      maxX,
      CHUNK_LINE_HEIGHT_METRES,
      minZ,
      maxX,
      CHUNK_LINE_HEIGHT_METRES,
      minZ,
      maxX,
      CHUNK_LINE_HEIGHT_METRES,
      maxZ,
      maxX,
      CHUNK_LINE_HEIGHT_METRES,
      maxZ,
      minX,
      CHUNK_LINE_HEIGHT_METRES,
      maxZ,
      minX,
      CHUNK_LINE_HEIGHT_METRES,
      maxZ,
      minX,
      CHUNK_LINE_HEIGHT_METRES,
      minZ,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  const material = new THREE.LineBasicMaterial({
    color: 0xf0b85f,
    transparent: true,
    opacity: 0.88,
    depthTest: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'debug:chunk-boundaries';
  lines.renderOrder = 12;

  layers.add({
    id: 'chunk-boundaries',
    label: `${massing.metadata.chunks} occupied ${massing.chunkSizeMetres} m chunks`,
    object: lines,
    visible: false,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
}
