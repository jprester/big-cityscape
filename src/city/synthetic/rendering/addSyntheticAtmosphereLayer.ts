import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';

export type SyntheticAtmosphereConfig = Readonly<{
  backgroundColor: number;
  skyHorizonGlowColor: number;
  skyZenithColor: number;
  skyRadiusMetres: number;
  fogNearMetres: number;
  fogFarMetres: number;
}>;

export type SyntheticAtmosphereLayer = Readonly<{
  setConfig: (config: SyntheticAtmosphereConfig) => void;
  update: (camera: THREE.Camera) => void;
}>;

const ATMOSPHERE_BACKGROUND_COLOR = 0x1b2b34;
const ATMOSPHERE_HORIZON_GLOW_COLOR = 0x2e4a57;
const ATMOSPHERE_ZENITH_COLOR = 0x030810;

export function createSyntheticAtmosphereConfig(
  worldSizeMetres: number,
): SyntheticAtmosphereConfig {
  if (!Number.isFinite(worldSizeMetres) || worldSizeMetres <= 0) {
    throw new RangeError('Atmosphere world size must be positive and finite.');
  }

  return {
    backgroundColor: ATMOSPHERE_BACKGROUND_COLOR,
    skyHorizonGlowColor: ATMOSPHERE_HORIZON_GLOW_COLOR,
    skyZenithColor: ATMOSPHERE_ZENITH_COLOR,
    skyRadiusMetres: worldSizeMetres * 2.3,
    fogNearMetres: worldSizeMetres * 0.5,
    fogFarMetres: worldSizeMetres * 2.5,
  };
}

export function addSyntheticAtmosphereLayer(
  layers: DebugLayerManager,
  scene: THREE.Scene,
  config: SyntheticAtmosphereConfig,
): SyntheticAtmosphereLayer {
  validateConfig(config);
  const previousBackground = scene.background;
  const previousFog = scene.fog;
  const atmosphericBackground = new THREE.Color(config.backgroundColor);
  const atmosphericFog = new THREE.Fog(
    config.backgroundColor,
    config.fogNearMetres,
    config.fogFarMetres,
  );
  const layerObject = new THREE.Group();
  layerObject.name = 'synthetic:atmosphere';
  const sky = createSkyDome(config);
  layerObject.add(sky.mesh);
  let atmosphereVisible = true;

  const applyVisibility = (visible: boolean): void => {
    atmosphereVisible = visible;
    scene.background = visible ? atmosphericBackground : previousBackground;
    scene.fog = visible ? atmosphericFog : previousFog;
  };

  applyVisibility(true);
  layers.add({
    id: 'synthetic-atmosphere',
    label: 'Atmosphere · gradient sky + distance fog',
    object: layerObject,
    onVisibilityChange: applyVisibility,
    dispose: () => {
      scene.background = previousBackground;
      scene.fog = previousFog;
      sky.geometry.dispose();
      sky.material.dispose();
    },
  });

  return {
    setConfig: (nextConfig) => {
      validateConfig(nextConfig);
      atmosphericBackground.setHex(nextConfig.backgroundColor);
      atmosphericFog.color.setHex(nextConfig.backgroundColor);
      atmosphericFog.near = nextConfig.fogNearMetres;
      atmosphericFog.far = nextConfig.fogFarMetres;
      sky.mesh.scale.setScalar(
        nextConfig.skyRadiusMetres / config.skyRadiusMetres,
      );
      updateSkyColors(sky.geometry, config.skyRadiusMetres, nextConfig);

      if (atmosphereVisible) {
        scene.background = atmosphericBackground;
        scene.fog = atmosphericFog;
      }
    },
    update: (camera) => {
      layerObject.position.copy(camera.position);
    },
  };
}

function createSkyDome(config: SyntheticAtmosphereConfig): Readonly<{
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  geometry: THREE.SphereGeometry;
  material: THREE.MeshBasicMaterial;
}> {
  const geometry = new THREE.SphereGeometry(
    config.skyRadiusMetres,
    32,
    12,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  updateSkyColors(geometry, config.skyRadiusMetres, config);
  const material = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    vertexColors: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'synthetic:gradient-sky-dome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1_000;

  return { mesh, geometry, material };
}

function updateSkyColors(
  geometry: THREE.SphereGeometry,
  geometryRadiusMetres: number,
  config: SyntheticAtmosphereConfig,
): void {
  const positions = geometry.getAttribute('position');
  const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
  const horizonColor = new THREE.Color(config.backgroundColor);
  const horizonGlowColor = new THREE.Color(config.skyHorizonGlowColor);
  const zenithColor = new THREE.Color(config.skyZenithColor);
  const color = new THREE.Color();

  for (let index = 0; index < positions.count; index += 1) {
    const normalizedHeight = THREE.MathUtils.clamp(
      positions.getY(index) / geometryRadiusMetres,
      0,
      1,
    );

    if (normalizedHeight <= 0.18) {
      color.lerpColors(
        horizonColor,
        horizonGlowColor,
        THREE.MathUtils.smoothstep(normalizedHeight, 0, 0.18),
      );
    } else {
      color.lerpColors(
        horizonGlowColor,
        zenithColor,
        Math.pow((normalizedHeight - 0.18) / 0.82, 0.7),
      );
    }
    colors.setXYZ(index, color.r, color.g, color.b);
  }

  colors.needsUpdate = true;
}

function validateConfig(config: SyntheticAtmosphereConfig): void {
  validateColor('background', config.backgroundColor);
  validateColor('horizon glow', config.skyHorizonGlowColor);
  validateColor('zenith', config.skyZenithColor);

  if (!Number.isFinite(config.skyRadiusMetres) || config.skyRadiusMetres <= 0) {
    throw new RangeError('Atmosphere sky radius must be positive and finite.');
  }

  if (
    !Number.isFinite(config.fogNearMetres) ||
    !Number.isFinite(config.fogFarMetres) ||
    config.fogNearMetres < 0 ||
    config.fogFarMetres <= config.fogNearMetres
  ) {
    throw new RangeError('Atmosphere fog distances must define a finite increasing range.');
  }
}

function validateColor(label: string, color: number): void {
  if (!Number.isInteger(color) || color < 0 || color > 0xffffff) {
    throw new RangeError(`Atmosphere ${label} color must be a valid RGB integer.`);
  }
}
