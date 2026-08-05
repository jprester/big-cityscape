import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';
import type { SyntheticDistrictCompositionProfileId } from '../model/proofDistrict';
import type { SyntheticCity } from '../model/syntheticCity';

const DISTRICT_PROFILE_COLORS: Readonly<
  Record<SyntheticDistrictCompositionProfileId, number>
> = {
  centre: 0xd69bc5,
  urban: 0x77aaca,
  edge: 0x76aa86,
};

export function addSyntheticCityDebugLayer(
  layers: DebugLayerManager,
  city: SyntheticCity,
): void {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();

  for (const district of city.districts) {
    const { minX, maxX, minZ, maxZ } = district.bounds;
    color.setHex(DISTRICT_PROFILE_COLORS[district.compositionProfileId]);
    addSegment(positions, colors, color, minX, minZ, maxX, minZ);
    addSegment(positions, colors, color, maxX, minZ, maxX, maxZ);
    addSegment(positions, colors, color, maxX, maxZ, minX, maxZ);
    addSegment(positions, colors, color, minX, maxZ, minX, minZ);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({ vertexColors: true });
  const outlines = new THREE.LineSegments(geometry, material);
  outlines.name = 'synthetic:district-chunk-outlines';

  layers.add({
    id: 'district-chunks',
    label: '500 m chunks · rose centre · blue urban · green edge',
    object: outlines,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
}

function addSegment(
  positions: number[],
  colors: number[],
  color: THREE.Color,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
): void {
  positions.push(startX, 1.05, startZ, endX, 1.05, endZ);
  colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
}
