import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';
import type { BuildingHeightClass } from '../../assets/buildingAssetCatalog';
import type {
  SyntheticBlockTemplateId,
  SyntheticBlockDefinition,
  SyntheticBounds2,
  SyntheticDistrictProfileId,
} from '../model/proofDistrict';
import { SYNTHETIC_BLOCK_TEMPLATE_IDS } from '../model/proofDistrict';
import type { BuildingSlot } from '../model/buildingSlot';
import type { SyntheticStreetCorridor } from '../model/streetCorridor';
import { addSyntheticStreetLayers } from './addSyntheticStreetLayers';

export type SyntheticDebugSpatialDefinition = Readonly<{
  bounds: SyntheticBounds2;
  blocks: readonly SyntheticBlockDefinition[];
  streetCorridors: readonly SyntheticStreetCorridor[];
  slots: readonly BuildingSlot[];
}>;

const BLOCK_SURFACE_HEIGHT_METRES = 0.15;

const TEMPLATE_COLORS: Readonly<Record<SyntheticBlockTemplateId, number>> = {
  'fabric-grid': 0x34594d,
  'edge-slabs': 0x3b5268,
  'anchor-and-fill': 0x66563c,
  'skyline-anchor': 0x5f496c,
  'landmark-plaza': 0x684457,
  'open-space': 0x386844,
};

const PROFILE_COLORS: Readonly<Record<SyntheticDistrictProfileId, number>> = {
  core: 0xf1bc73,
  transition: 0x75a9c4,
};

const SLOT_COLORS: Readonly<Record<BuildingHeightClass, number>> = {
  'low-rise': 0x75b58f,
  'mid-rise': 0x6faacb,
  'high-rise': 0xd2a45e,
  skyscraper: 0xdb7eaa,
};

export function addSyntheticDistrictDebugLayers(
  layers: DebugLayerManager,
  spatial: SyntheticDebugSpatialDefinition,
): void {
  addStreetGroundLayer(layers, spatial);
  addSyntheticStreetLayers(layers, spatial);
  addMetricGridLayer(layers, spatial);
  addBlockTemplateLayer(layers, spatial);
  addOpenSpaceLayer(layers, spatial);
  addProfileOutlineLayer(layers, spatial);
  addSlotLayer(layers, spatial);
}

function addStreetGroundLayer(
  layers: DebugLayerManager,
  spatial: SyntheticDebugSpatialDefinition,
): void {
  const width = spatial.bounds.maxX - spatial.bounds.minX;
  const depth = spatial.bounds.maxZ - spatial.bounds.minZ;
  const geometry = new THREE.PlaneGeometry(width, depth);
  const material = new THREE.MeshBasicMaterial({
    color: 0x10171d,
    side: THREE.DoubleSide,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.name = 'synthetic:street-negative-space';
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(
    (spatial.bounds.minX + spatial.bounds.maxX) / 2,
    -0.05,
    (spatial.bounds.minZ + spatial.bounds.maxZ) / 2,
  );

  layers.add({
    id: 'street-negative-space',
    label: 'Street base · dark negative space',
    object: ground,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
}

function addMetricGridLayer(
  layers: DebugLayerManager,
  spatial: SyntheticDebugSpatialDefinition,
): void {
  const size = Math.max(
    spatial.bounds.maxX - spatial.bounds.minX,
    spatial.bounds.maxZ - spatial.bounds.minZ,
  );
  const grid = new THREE.GridHelper(size, size / 25, 0x6e9bb5, 0x283a46);
  grid.position.y = 0.7;
  setMaterialOpacity(grid.material, 0.34);

  layers.add({
    id: 'synthetic-metric-grid',
    label: '25 m metric grid',
    object: grid,
    visible: false,
    dispose: () => {
      grid.geometry.dispose();
      disposeMaterial(grid.material);
    },
  });
}

function addBlockTemplateLayer(
  layers: DebugLayerManager,
  spatial: SyntheticDebugSpatialDefinition,
): void {
  const group = new THREE.Group();
  group.name = 'synthetic:block-templates';
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials: THREE.MeshLambertMaterial[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();

  for (const templateId of SYNTHETIC_BLOCK_TEMPLATE_IDS) {
    const blocks = spatial.blocks.filter(
      (block) => block.templateId === templateId,
    );

    if (blocks.length === 0) {
      continue;
    }

    const material = new THREE.MeshLambertMaterial({
      color: TEMPLATE_COLORS[templateId],
      emissive: 0x101416,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, blocks.length);
    mesh.name = `synthetic:block-template:${templateId}`;

    blocks.forEach((block, index) => {
      position.set(
        (block.bounds.minX + block.bounds.maxX) / 2,
        BLOCK_SURFACE_HEIGHT_METRES / 2,
        (block.bounds.minZ + block.bounds.maxZ) / 2,
      );
      scale.set(
        block.bounds.maxX - block.bounds.minX,
        BLOCK_SURFACE_HEIGHT_METRES,
        block.bounds.maxZ - block.bounds.minZ,
      );
      transform.compose(position, rotation, scale);
      mesh.setMatrixAt(index, transform);
    });

    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
    meshes.push(mesh);
    materials.push(material);
  }

  layers.add({
    id: 'block-templates',
    label: 'Block templates · green fabric/parks · blue slabs · amber anchors · violet skyline · rose landmark',
    object: group,
    dispose: () => {
      meshes.forEach((mesh) => mesh.dispose());
      geometry.dispose();
      materials.forEach((material) => material.dispose());
    },
  });
}

function addOpenSpaceLayer(
  layers: DebugLayerManager,
  spatial: SyntheticDebugSpatialDefinition,
): void {
  const parks = spatial.blocks.filter(
    (block) => block.templateId === 'open-space',
  );

  if (parks.length === 0) {
    return;
  }

  const group = new THREE.Group();
  group.name = 'synthetic:open-spaces';
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const lawnMaterial = new THREE.MeshLambertMaterial({
    color: 0x4d8c59,
    emissive: 0x101b12,
  });
  const pathMaterial = new THREE.MeshLambertMaterial({
    color: 0xb0a88d,
    emissive: 0x1c1a15,
  });
  const lawns = new THREE.InstancedMesh(
    geometry,
    lawnMaterial,
    parks.length,
  );
  const paths = new THREE.InstancedMesh(
    geometry,
    pathMaterial,
    parks.length * 2,
  );
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();

  lawns.name = 'synthetic:open-space-lawns';
  paths.name = 'synthetic:open-space-paths';

  parks.forEach((park, index) => {
    const width = park.buildableBounds.maxX - park.buildableBounds.minX;
    const depth = park.buildableBounds.maxZ - park.buildableBounds.minZ;
    const centerX =
      (park.buildableBounds.minX + park.buildableBounds.maxX) / 2;
    const centerZ =
      (park.buildableBounds.minZ + park.buildableBounds.maxZ) / 2;
    const pathWidth = Math.min(5, Math.min(width, depth) * 0.08);

    position.set(centerX, 0.19, centerZ);
    scale.set(width, 0.08, depth);
    transform.compose(position, rotation, scale);
    lawns.setMatrixAt(index, transform);

    position.y = 0.25;
    scale.set(width * 0.82, 0.04, pathWidth);
    transform.compose(position, rotation, scale);
    paths.setMatrixAt(index * 2, transform);
    scale.set(pathWidth, 0.04, depth * 0.82);
    transform.compose(position, rotation, scale);
    paths.setMatrixAt(index * 2 + 1, transform);
  });

  lawns.computeBoundingBox();
  lawns.computeBoundingSphere();
  paths.computeBoundingBox();
  paths.computeBoundingSphere();
  group.add(lawns, paths);

  layers.add({
    id: 'open-spaces',
    label: `${parks.length} open-space blocks · lawns + paths`,
    object: group,
    dispose: () => {
      lawns.dispose();
      paths.dispose();
      geometry.dispose();
      lawnMaterial.dispose();
      pathMaterial.dispose();
    },
  });
}

function addProfileOutlineLayer(
  layers: DebugLayerManager,
  spatial: SyntheticDebugSpatialDefinition,
): void {
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();

  for (const block of spatial.blocks) {
    const { minX, maxX, minZ, maxZ } = block.buildableBounds;
    color.setHex(PROFILE_COLORS[block.profileId]);
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
  outlines.name = 'synthetic:buildable-profile-outlines';

  layers.add({
    id: 'profile-outlines',
    label: 'Buildable bounds · amber core · blue transition',
    object: outlines,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
}

function addSlotLayer(
  layers: DebugLayerManager,
  spatial: SyntheticDebugSpatialDefinition,
): void {
  const group = new THREE.Group();
  group.name = 'synthetic:building-slots';
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials: THREE.MeshBasicMaterial[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);

  for (const heightClass of [
    'low-rise',
    'mid-rise',
    'high-rise',
    'skyscraper',
  ] as const) {
    const slots = spatial.slots.filter(
      (slot) => slot.heightClass === heightClass,
    );

    if (slots.length === 0) {
      continue;
    }

    const material = new THREE.MeshBasicMaterial({
      color: SLOT_COLORS[heightClass],
      transparent: true,
      opacity: 0.58,
      wireframe: true,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, slots.length);
    mesh.name = `synthetic:slots:${heightClass}`;

    slots.forEach((slot, index) => {
      position.set(slot.center[0], 0.28, slot.center[1]);
      rotation.setFromAxisAngle(yAxis, slot.rotationRadians);
      scale.set(slot.widthMetres, 0.08, slot.depthMetres);
      transform.compose(position, rotation, scale);
      mesh.setMatrixAt(index, transform);
    });

    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
    meshes.push(mesh);
    materials.push(material);
  }

  layers.add({
    id: 'building-slots',
    label: 'Building placement slots by height class',
    object: group,
    visible: false,
    dispose: () => {
      meshes.forEach((mesh) => mesh.dispose());
      geometry.dispose();
      materials.forEach((material) => material.dispose());
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
  positions.push(startX, 0.3, startZ, endX, 0.3, endZ);
  colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
}

function setMaterialOpacity(
  material: THREE.Material | readonly THREE.Material[],
  opacity: number,
): void {
  for (const item of Array.isArray(material) ? material : [material]) {
    item.transparent = true;
    item.opacity = opacity;
    item.depthWrite = false;
  }
}

function disposeMaterial(
  material: THREE.Material | readonly THREE.Material[],
): void {
  for (const item of Array.isArray(material) ? material : [material]) {
    item.dispose();
  }
}
