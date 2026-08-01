import * as THREE from 'three';
import type { DebugLayerManager } from '../../debug/DebugLayerManager';
import type {
  LocalBounds,
  Point2,
  ProcessedCityStructure,
  RoadClass,
  TransportPath,
} from '../model/processedCity';

const ROAD_HEIGHT_METRES = 0.45;
const WATER_HEIGHT_METRES = 0.25;
const RAIL_HEIGHT_METRES = 0.65;
const BOUNDS_HEIGHT_METRES = 0.85;

const ROAD_CLASSES: readonly RoadClass[] = [
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'local',
  'pedestrian',
];

const ROAD_STYLES: Readonly<Record<RoadClass, Readonly<{ color: number; opacity: number }>>> = {
  motorway: { color: 0xe4bd69, opacity: 1 },
  trunk: { color: 0xd4b77d, opacity: 1 },
  primary: { color: 0xd8dde1, opacity: 0.95 },
  secondary: { color: 0xaebfcb, opacity: 0.9 },
  tertiary: { color: 0x8198a9, opacity: 0.82 },
  local: { color: 0x405969, opacity: 0.72 },
  pedestrian: { color: 0x547568, opacity: 0.7 },
};

export function addStructureDebugLayers(
  layers: DebugLayerManager,
  city: ProcessedCityStructure,
): void {
  addRoadLayer(layers, city);
  addRailLayer(layers, city);
  addWaterLayer(layers, city);
  addBoundsLayer(layers, city.metadata.clip.bounds);
}

function addRoadLayer(layers: DebugLayerManager, city: ProcessedCityStructure): void {
  const group = new THREE.Group();
  group.name = 'debug:roads';
  const resources: Array<THREE.BufferGeometry | THREE.Material> = [];

  for (const roadClass of ROAD_CLASSES) {
    const roads = city.roads.filter((road) => road.class === roadClass);
    const geometry = createLineGeometry(roads, ROAD_HEIGHT_METRES);

    if (geometry === undefined) {
      continue;
    }

    const style = ROAD_STYLES[roadClass];
    const material = new THREE.LineBasicMaterial({
      color: style.color,
      transparent: style.opacity < 1,
      opacity: style.opacity,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.name = `roads:${roadClass}`;
    group.add(lines);
    resources.push(geometry, material);
  }

  layers.add({
    id: 'roads',
    label: `${city.roads.length} clipped roads`,
    object: group,
    dispose: () => disposeResources(resources),
  });
}

function addRailLayer(layers: DebugLayerManager, city: ProcessedCityStructure): void {
  const geometry = createLineGeometry(city.railways, RAIL_HEIGHT_METRES);
  const material = new THREE.LineBasicMaterial({
    color: 0xff7d66,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry ?? new THREE.BufferGeometry(), material);
  lines.name = 'debug:railways';

  layers.add({
    id: 'railways',
    label: `${city.railways.length} clipped rail lines`,
    object: lines,
    dispose: () => {
      lines.geometry.dispose();
      material.dispose();
    },
  });
}

function addWaterLayer(layers: DebugLayerManager, city: ProcessedCityStructure): void {
  const group = new THREE.Group();
  group.name = 'debug:water';
  const resources: Array<THREE.BufferGeometry | THREE.Material> = [];
  const shapes = city.waterRegions.flatMap((region) => createWaterShapes(region.rings));

  if (shapes.length > 0) {
    const geometry = new THREE.ShapeGeometry(shapes);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0x277ca8,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'water-regions';
    mesh.position.y = WATER_HEIGHT_METRES;
    mesh.renderOrder = 1;
    group.add(mesh);
    resources.push(geometry, material);
  }

  const centerlineGeometry = createLineGeometry(city.waterways, WATER_HEIGHT_METRES + 0.05);

  if (centerlineGeometry !== undefined) {
    const centerlineMaterial = new THREE.LineBasicMaterial({
      color: 0x58b9db,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const centerlines = new THREE.LineSegments(centerlineGeometry, centerlineMaterial);
    centerlines.name = 'water-centerlines';
    centerlines.renderOrder = 2;
    group.add(centerlines);
    resources.push(centerlineGeometry, centerlineMaterial);
  }

  layers.add({
    id: 'water',
    label: `${city.waterRegions.length} water regions`,
    object: group,
    dispose: () => disposeResources(resources),
  });
}

function addBoundsLayer(layers: DebugLayerManager, bounds: LocalBounds): void {
  const positions = [
    bounds.minX,
    BOUNDS_HEIGHT_METRES,
    bounds.minZ,
    bounds.maxX,
    BOUNDS_HEIGHT_METRES,
    bounds.minZ,
    bounds.maxX,
    BOUNDS_HEIGHT_METRES,
    bounds.minZ,
    bounds.maxX,
    BOUNDS_HEIGHT_METRES,
    bounds.maxZ,
    bounds.maxX,
    BOUNDS_HEIGHT_METRES,
    bounds.maxZ,
    bounds.minX,
    BOUNDS_HEIGHT_METRES,
    bounds.maxZ,
    bounds.minX,
    BOUNDS_HEIGHT_METRES,
    bounds.maxZ,
    bounds.minX,
    BOUNDS_HEIGHT_METRES,
    bounds.minZ,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x80d6ff,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'debug:working-bounds';

  layers.add({
    id: 'working-bounds',
    label: '1.98 km² working bounds',
    object: lines,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
}

function createLineGeometry(
  features: readonly TransportPath[],
  heightMetres: number,
): THREE.BufferGeometry | undefined {
  const positions: number[] = [];

  for (const feature of features) {
    for (const path of feature.paths) {
      for (let index = 1; index < path.length; index += 1) {
        const start = path[index - 1];
        const end = path[index];

        if (start !== undefined && end !== undefined) {
          positions.push(
            start[0],
            heightMetres,
            start[1],
            end[0],
            heightMetres,
            end[1],
          );
        }
      }
    }
  }

  if (positions.length === 0) {
    return undefined;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function createWaterShapes(rings: readonly (readonly Point2[])[]): readonly THREE.Shape[] {
  const outerRing = rings[0];

  if (outerRing === undefined) {
    return [];
  }

  const shape = new THREE.Shape();
  appendRing(shape, outerRing);

  for (const holeRing of rings.slice(1)) {
    const hole = new THREE.Path();
    appendRing(hole, holeRing);
    shape.holes.push(hole);
  }

  return [shape];
}

function appendRing(path: THREE.Path, ring: readonly Point2[]): void {
  const first = ring[0];

  if (first === undefined) {
    return;
  }

  path.moveTo(first[0], -first[1]);

  for (const [x, z] of ring.slice(1)) {
    path.lineTo(x, -z);
  }

  path.closePath();
}

function disposeResources(resources: readonly (THREE.BufferGeometry | THREE.Material)[]): void {
  for (const resource of resources) {
    resource.dispose();
  }
}
