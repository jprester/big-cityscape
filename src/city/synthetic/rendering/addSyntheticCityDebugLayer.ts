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

  addOffsetBandLayer(layers, city);
}

function addOffsetBandLayer(
  layers: DebugLayerManager,
  city: SyntheticCity,
): void {
  const blocks = city.blocks
    .filter((block) => block.layoutVariationId === 'offset-band')
    .toSorted(
      (first, second) =>
        blockCenter(first.bounds)[1] - blockCenter(second.bounds)[1],
    );

  if (blocks.length === 0) {
    return;
  }

  const positions = blocks.flatMap((block) => {
    const [x, z] = blockCenter(block.bounds);
    return [x, 1.35, z];
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  const material = new THREE.LineBasicMaterial({
    color: 0x70e2dc,
    depthTest: false,
    transparent: true,
    opacity: 0.88,
  });
  const trace = new THREE.Line(geometry, material);
  const maximumOffset = Math.max(
    ...blocks.map((block) => Math.abs(block.layoutOffsetMetres[0])),
  );
  trace.name = 'synthetic:offset-band-trace';
  trace.renderOrder = 10;

  layers.add({
    id: 'offset-band-trace',
    label: `${blocks.length}-block offset spine · ±${maximumOffset.toFixed(0)} m trace`,
    object: trace,
    visible: false,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
}

function blockCenter(
  bounds: Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>,
): readonly [x: number, z: number] {
  return [
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minZ + bounds.maxZ) / 2,
  ];
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
