import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';

export type SyntheticAtmosphereConfig = Readonly<{
  backgroundColor: number;
  fogNearMetres: number;
  fogFarMetres: number;
}>;

const ATMOSPHERE_BACKGROUND_COLOR = 0x1b2b34;

export function createSyntheticAtmosphereConfig(
  worldSizeMetres: number,
): SyntheticAtmosphereConfig {
  if (!Number.isFinite(worldSizeMetres) || worldSizeMetres <= 0) {
    throw new RangeError('Atmosphere world size must be positive and finite.');
  }

  return {
    backgroundColor: ATMOSPHERE_BACKGROUND_COLOR,
    fogNearMetres: worldSizeMetres * 0.5,
    fogFarMetres: worldSizeMetres * 2.5,
  };
}

export function addSyntheticAtmosphereLayer(
  layers: DebugLayerManager,
  scene: THREE.Scene,
  config: SyntheticAtmosphereConfig,
): void {
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

  const applyVisibility = (visible: boolean): void => {
    scene.background = visible ? atmosphericBackground : previousBackground;
    scene.fog = visible ? atmosphericFog : previousFog;
  };

  applyVisibility(true);
  layers.add({
    id: 'synthetic-atmosphere',
    label: `Atmosphere · fog ${formatDistance(config.fogNearMetres)}–${formatDistance(config.fogFarMetres)}`,
    object: layerObject,
    onVisibilityChange: applyVisibility,
    dispose: () => {
      scene.background = previousBackground;
      scene.fog = previousFog;
    },
  });
}

function formatDistance(distanceMetres: number): string {
  return distanceMetres >= 1_000
    ? `${(distanceMetres / 1_000).toFixed(1)} km`
    : `${Math.round(distanceMetres)} m`;
}

function validateConfig(config: SyntheticAtmosphereConfig): void {
  if (
    !Number.isInteger(config.backgroundColor) ||
    config.backgroundColor < 0 ||
    config.backgroundColor > 0xffffff
  ) {
    throw new RangeError('Atmosphere background color must be a valid RGB integer.');
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
