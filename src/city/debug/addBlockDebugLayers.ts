import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { DebugLayerManager } from '../../debug/DebugLayerManager';
import type {
  DistrictProfile,
  ProcessedCityBlocks,
} from '../model/cityBlocks';
import type { Point2 } from '../model/processedCity';

const DISTRICT_HEIGHT_METRES = 0.16;
const BLOCK_HEIGHT_METRES = 0.78;
const BUILDABLE_HEIGHT_METRES = 0.96;
const LABEL_HEIGHT_METRES = 4;

const DISTRICT_COLORS: Readonly<Record<DistrictProfile, number>> = {
  'dense-central-core': 0x826de8,
  'commercial-transition': 0x3b9fc1,
  'dense-mixed': 0x64a574,
  'infrastructure-edge': 0xd58a50,
};

export function addBlockDebugLayers(
  layers: DebugLayerManager,
  cityBlocks: ProcessedCityBlocks,
): void {
  addDistrictLayer(layers, cityBlocks);
  addPolygonOutlineLayer(
    layers,
    'blocks',
    `${cityBlocks.blocks.length} city blocks`,
    cityBlocks.blocks.map((block) => block.polygon),
    BLOCK_HEIGHT_METRES,
    0xe6ecf0,
  );
  addPolygonOutlineLayer(
    layers,
    'buildable-polygons',
    'Buildable polygons',
    cityBlocks.blocks.map((block) => block.buildablePolygon),
    BUILDABLE_HEIGHT_METRES,
    0x8ce6a0,
  );
  addBlockLabelLayer(layers, cityBlocks);
}

function addDistrictLayer(
  layers: DebugLayerManager,
  cityBlocks: ProcessedCityBlocks,
): void {
  const group = new THREE.Group();
  group.name = 'debug:districts';
  const resources: Array<THREE.BufferGeometry | THREE.Material> = [];

  for (const district of cityBlocks.districts) {
    const shapes = cityBlocks.blocks
      .filter((block) => block.districtId === district.id)
      .map((block) => createShape(block.polygon));

    if (shapes.length === 0) {
      continue;
    }

    const geometry = new THREE.ShapeGeometry(shapes);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: DISTRICT_COLORS[district.profile],
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `district:${district.id}`;
    mesh.position.y = DISTRICT_HEIGHT_METRES;
    group.add(mesh);
    resources.push(geometry, material);
  }

  layers.add({
    id: 'districts',
    label: `${cityBlocks.districts.length} district profiles`,
    object: group,
    dispose: () => disposeResources(resources),
  });
}

function addPolygonOutlineLayer(
  layers: DebugLayerManager,
  id: string,
  label: string,
  polygons: readonly (readonly Point2[])[],
  heightMetres: number,
  color: number,
): void {
  const positions: number[] = [];

  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];

      if (start !== undefined && end !== undefined) {
        positions.push(start[0], heightMetres, start[1], end[0], heightMetres, end[1]);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = `debug:${id}`;

  layers.add({
    id,
    label,
    object: lines,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
}

function addBlockLabelLayer(
  layers: DebugLayerManager,
  cityBlocks: ProcessedCityBlocks,
): void {
  const group = new THREE.Group();
  group.name = 'debug:block-ids';

  for (const block of cityBlocks.blocks) {
    const element = document.createElement('span');
    element.className = 'block-label';
    element.textContent = block.id;
    const label = new CSS2DObject(element);
    label.name = `block-label:${block.id}`;
    label.position.set(block.centroid[0], LABEL_HEIGHT_METRES, block.centroid[1]);
    group.add(label);
  }

  layers.add({
    id: 'block-ids',
    label: 'Stable block IDs',
    object: group,
    visible: false,
    dispose: () => {
      group.traverse((object) => {
        if (object instanceof CSS2DObject) {
          object.element.remove();
        }
      });
    },
  });
}

function createShape(polygon: readonly Point2[]): THREE.Shape {
  const shape = new THREE.Shape();
  const first = polygon[0];

  if (first === undefined) {
    return shape;
  }

  shape.moveTo(first[0], -first[1]);

  for (const [x, z] of polygon.slice(1)) {
    shape.lineTo(x, -z);
  }

  shape.closePath();
  return shape;
}

function disposeResources(resources: readonly (THREE.BufferGeometry | THREE.Material)[]): void {
  for (const resource of resources) {
    resource.dispose();
  }
}
