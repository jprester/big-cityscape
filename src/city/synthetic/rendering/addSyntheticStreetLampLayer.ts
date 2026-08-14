import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';
import type { SyntheticStreetLampDefinition } from '../model/streetLamp';

export type SyntheticStreetLampConfig = Readonly<{
  bulbColor: number;
  bulbOpacity: number;
  poolColor: number;
  poolOpacity: number;
  realLightColor: number;
  realLightIntensity: number;
  realLightDistanceMetres: number;
  realLightCount: number;
}>;

export type SyntheticStreetLampLayer = Readonly<{
  stats: Readonly<{
    lamps: number;
    drawCalls: number;
    triangles: number;
    maximumRealLights: number;
  }>;
  setConfig: (config: SyntheticStreetLampConfig) => void;
  update: (camera: THREE.Camera) => void;
}>;

export const MAXIMUM_REAL_STREET_LIGHTS = 8;

export const DEFAULT_SYNTHETIC_STREET_LAMP_CONFIG: SyntheticStreetLampConfig = {
  bulbColor: 0xffd9a3,
  bulbOpacity: 0.72,
  poolColor: 0xffb45c,
  poolOpacity: 0.2,
  realLightColor: 0xffc37a,
  realLightIntensity: 70,
  realLightDistanceMetres: 48,
  realLightCount: 4,
};

const FIXTURE_BOXES_PER_LAMP = 3;
const ARM_REACH_METRES = 1.35;
const LIGHT_HEIGHT_OFFSET_METRES = 0.52;

export function addSyntheticStreetLampLayer(
  layers: DebugLayerManager,
  lamps: readonly SyntheticStreetLampDefinition[],
  config: SyntheticStreetLampConfig = DEFAULT_SYNTHETIC_STREET_LAMP_CONFIG,
): SyntheticStreetLampLayer {
  validateConfig(config);
  validateLamps(lamps);

  const group = new THREE.Group();
  group.name = 'synthetic:street-lamps';
  const fixtureGeometry = new THREE.BoxGeometry(1, 1, 1);
  const bulbGeometry = new THREE.OctahedronGeometry(0.16, 0);
  const poolGeometry = new THREE.CircleGeometry(1, 12);
  poolGeometry.rotateX(-Math.PI / 2);
  addRadialFalloffColors(poolGeometry);
  const fixtureMaterial = new THREE.MeshLambertMaterial({
    color: 0x252b2f,
    emissive: 0x080a0b,
  });
  const bulbMaterial = new THREE.MeshBasicMaterial({
    color: config.bulbColor,
    transparent: true,
    opacity: config.bulbOpacity,
    depthWrite: false,
  });
  const poolMaterial = new THREE.MeshBasicMaterial({
    color: config.poolColor,
    transparent: true,
    opacity: config.poolOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });
  const fixtureMesh = new THREE.InstancedMesh(
    fixtureGeometry,
    fixtureMaterial,
    lamps.length * FIXTURE_BOXES_PER_LAMP,
  );
  const bulbMesh = new THREE.InstancedMesh(
    bulbGeometry,
    bulbMaterial,
    lamps.length,
  );
  const poolMesh = new THREE.InstancedMesh(
    poolGeometry,
    poolMaterial,
    lamps.length,
  );
  fixtureMesh.name = 'synthetic:street-lamp-fixtures';
  bulbMesh.name = 'synthetic:street-lamp-bulbs';
  poolMesh.name = 'synthetic:street-lamp-pools';
  poolMesh.renderOrder = 3;

  populateInstances(lamps, fixtureMesh, bulbMesh, poolMesh);
  fixtureMesh.computeBoundingBox();
  fixtureMesh.computeBoundingSphere();
  bulbMesh.computeBoundingBox();
  bulbMesh.computeBoundingSphere();
  poolMesh.computeBoundingBox();
  poolMesh.computeBoundingSphere();

  const realLights = Array.from(
    { length: MAXIMUM_REAL_STREET_LIGHTS },
    (_, index) => {
      const light = new THREE.PointLight();
      light.name = `synthetic:street-lamp-real-light-${index}`;
      light.castShadow = false;
      light.visible = false;
      return light;
    },
  );
  group.add(fixtureMesh, bulbMesh, poolMesh, ...realLights);

  let activeConfig = config;
  const setConfig = (nextConfig: SyntheticStreetLampConfig): void => {
    validateConfig(nextConfig);
    activeConfig = nextConfig;
    bulbMaterial.color.setHex(nextConfig.bulbColor);
    bulbMaterial.opacity = nextConfig.bulbOpacity;
    bulbMesh.visible = nextConfig.bulbOpacity > 0;
    poolMaterial.color.setHex(nextConfig.poolColor);
    poolMaterial.opacity = nextConfig.poolOpacity;
    poolMesh.visible = nextConfig.poolOpacity > 0;

    realLights.forEach((light, index) => {
      light.color.setHex(nextConfig.realLightColor);
      light.intensity = nextConfig.realLightIntensity;
      light.distance = nextConfig.realLightDistanceMetres;
      light.decay = 2;

      if (index >= nextConfig.realLightCount) {
        light.visible = false;
      }
    });
  };

  setConfig(config);
  const stats = {
    lamps: lamps.length,
    drawCalls: 3,
    triangles:
      triangleCount(fixtureGeometry) * fixtureMesh.count +
      triangleCount(bulbGeometry) * bulbMesh.count +
      triangleCount(poolGeometry) * poolMesh.count,
    maximumRealLights: MAXIMUM_REAL_STREET_LIGHTS,
  } as const;

  layers.add({
    id: 'street-lamps',
    label: `${lamps.length.toLocaleString('en-US')} street lamps · ${MAXIMUM_REAL_STREET_LIGHTS} nearby real lights max`,
    object: group,
    dispose: () => {
      fixtureMesh.dispose();
      bulbMesh.dispose();
      poolMesh.dispose();
      fixtureGeometry.dispose();
      bulbGeometry.dispose();
      poolGeometry.dispose();
      fixtureMaterial.dispose();
      bulbMaterial.dispose();
      poolMaterial.dispose();
    },
  });

  return {
    stats,
    setConfig,
    update: (camera) => updateRealLights(camera, lamps, realLights, activeConfig),
  };
}

function populateInstances(
  lamps: readonly SyntheticStreetLampDefinition[],
  fixtureMesh: THREE.InstancedMesh,
  bulbMesh: THREE.InstancedMesh,
  poolMesh: THREE.InstancedMesh,
): void {
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const verticalRotation = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);

  lamps.forEach((lamp, index) => {
    const [x, z] = lamp.position;
    const [facingX, facingZ] = lamp.facing;
    const yaw = Math.atan2(-facingZ, facingX);
    rotation.setFromAxisAngle(yAxis, yaw);

    position.set(x, lamp.heightMetres / 2, z);
    scale.set(0.13, lamp.heightMetres, 0.13);
    transform.compose(position, verticalRotation, scale);
    fixtureMesh.setMatrixAt(index * FIXTURE_BOXES_PER_LAMP, transform);

    position.set(
      x + facingX * 0.64,
      lamp.heightMetres - 0.34,
      z + facingZ * 0.64,
    );
    scale.set(1.28, 0.1, 0.1);
    transform.compose(position, rotation, scale);
    fixtureMesh.setMatrixAt(index * FIXTURE_BOXES_PER_LAMP + 1, transform);

    position.set(
      x + facingX * ARM_REACH_METRES,
      lamp.heightMetres - 0.48,
      z + facingZ * ARM_REACH_METRES,
    );
    scale.set(0.5, 0.16, 0.3);
    transform.compose(position, rotation, scale);
    fixtureMesh.setMatrixAt(index * FIXTURE_BOXES_PER_LAMP + 2, transform);

    position.set(
      x + facingX * ARM_REACH_METRES,
      lamp.heightMetres - LIGHT_HEIGHT_OFFSET_METRES,
      z + facingZ * ARM_REACH_METRES,
    );
    scale.set(1, 1, 1);
    transform.compose(position, verticalRotation, scale);
    bulbMesh.setMatrixAt(index, transform);

    position.set(
      x + facingX * (ARM_REACH_METRES + 0.7),
      0.07,
      z + facingZ * (ARM_REACH_METRES + 0.7),
    );
    const poolRadius = lamp.hierarchyId === 'arterial' ? 6.2 : 5.1;
    scale.set(poolRadius, 1, poolRadius);
    transform.compose(position, verticalRotation, scale);
    poolMesh.setMatrixAt(index, transform);
  });

  fixtureMesh.instanceMatrix.needsUpdate = true;
  bulbMesh.instanceMatrix.needsUpdate = true;
  poolMesh.instanceMatrix.needsUpdate = true;
}

function updateRealLights(
  camera: THREE.Camera,
  lamps: readonly SyntheticStreetLampDefinition[],
  lights: readonly THREE.PointLight[],
  config: SyntheticStreetLampConfig,
): void {
  if (config.realLightCount === 0 || lamps.length === 0) {
    lights.forEach((light) => {
      light.visible = false;
    });
    return;
  }

  const distanceLimitSquared = config.realLightDistanceMetres ** 2;
  const nearest: Array<Readonly<{ lamp: SyntheticStreetLampDefinition; distance: number }>> = [];

  for (const lamp of lamps) {
    const dx = lamp.position[0] - camera.position.x;
    const dz = lamp.position[1] - camera.position.z;
    const distance = dx * dx + dz * dz;

    if (distance > distanceLimitSquared) {
      continue;
    }

    const insertionIndex = nearest.findIndex(
      (candidate) => distance < candidate.distance,
    );

    if (insertionIndex === -1) {
      nearest.push({ lamp, distance });
    } else {
      nearest.splice(insertionIndex, 0, { lamp, distance });
    }

    if (nearest.length > config.realLightCount) {
      nearest.pop();
    }
  }

  lights.forEach((light, index) => {
    const candidate = index < config.realLightCount ? nearest[index] : undefined;

    if (candidate === undefined) {
      light.visible = false;
      return;
    }

    const { lamp } = candidate;
    light.position.set(
      lamp.position[0] + lamp.facing[0] * ARM_REACH_METRES,
      lamp.heightMetres - LIGHT_HEIGHT_OFFSET_METRES,
      lamp.position[1] + lamp.facing[1] * ARM_REACH_METRES,
    );
    light.visible = true;
  });
}

function validateLamps(lamps: readonly SyntheticStreetLampDefinition[]): void {
  for (const lamp of lamps) {
    if (
      lamp.id.length === 0 ||
      !Number.isFinite(lamp.position[0]) ||
      !Number.isFinite(lamp.position[1]) ||
      !Number.isFinite(lamp.heightMetres) ||
      lamp.heightMetres <= 0
    ) {
      throw new Error('Street-lamp definitions must have valid IDs and dimensions.');
    }
  }
}

function validateConfig(config: SyntheticStreetLampConfig): void {
  for (const color of [config.bulbColor, config.poolColor, config.realLightColor]) {
    if (!Number.isInteger(color) || color < 0 || color > 0xffffff) {
      throw new RangeError('Street-lamp colors must be valid hexadecimal integers.');
    }
  }

  for (const opacity of [config.bulbOpacity, config.poolOpacity]) {
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      throw new RangeError('Street-lamp opacity must be between zero and one.');
    }
  }

  if (
    !Number.isFinite(config.realLightIntensity) ||
    config.realLightIntensity < 0 ||
    !Number.isFinite(config.realLightDistanceMetres) ||
    config.realLightDistanceMetres <= 0 ||
    !Number.isInteger(config.realLightCount) ||
    config.realLightCount < 0 ||
    config.realLightCount > MAXIMUM_REAL_STREET_LIGHTS
  ) {
    throw new RangeError('Street-lamp real-light configuration is invalid.');
  }
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  return geometry.index === null ? position.count / 3 : geometry.index.count / 3;
}

function addRadialFalloffColors(geometry: THREE.BufferGeometry): void {
  const positions = geometry.getAttribute('position');
  const colors: number[] = [];

  for (let index = 0; index < positions.count; index += 1) {
    const radius = Math.hypot(positions.getX(index), positions.getZ(index));
    const intensity = Math.max(0, 1 - radius);
    colors.push(intensity, intensity, intensity);
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}
