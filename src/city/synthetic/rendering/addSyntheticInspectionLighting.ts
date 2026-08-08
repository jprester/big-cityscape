import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';

export type SyntheticInspectionLightingConfig = Readonly<{
  hemisphereSkyColor: number;
  hemisphereGroundColor: number;
  hemisphereIntensity: number;
  keyColor: number;
  keyIntensity: number;
  keyPositionScale: readonly [x: number, y: number, z: number];
}>;

export type SyntheticInspectionLightingLayer = Readonly<{
  setConfig: (config: SyntheticInspectionLightingConfig) => void;
}>;

export const DEFAULT_SYNTHETIC_INSPECTION_LIGHTING_CONFIG: SyntheticInspectionLightingConfig = {
  hemisphereSkyColor: 0xd7e3e8,
  hemisphereGroundColor: 0x202a30,
  hemisphereIntensity: 2.15,
  keyColor: 0xffe2c2,
  keyIntensity: 2.65,
  keyPositionScale: [-0.55, 0.9, 0.65],
};

export function addSyntheticInspectionLighting(
  layers: DebugLayerManager,
  worldSizeMetres: number,
  config: SyntheticInspectionLightingConfig =
    DEFAULT_SYNTHETIC_INSPECTION_LIGHTING_CONFIG,
): SyntheticInspectionLightingLayer {
  if (!Number.isFinite(worldSizeMetres) || worldSizeMetres <= 0) {
    throw new RangeError('Inspection-lighting world size must be positive and finite.');
  }

  validateConfig(config);
  const group = new THREE.Group();
  group.name = 'synthetic:inspection-lighting';
  const hemisphere = new THREE.HemisphereLight();
  const key = new THREE.DirectionalLight();
  group.add(hemisphere, key);

  const applyConfig = (nextConfig: SyntheticInspectionLightingConfig): void => {
    validateConfig(nextConfig);
    hemisphere.color.setHex(nextConfig.hemisphereSkyColor);
    hemisphere.groundColor.setHex(nextConfig.hemisphereGroundColor);
    hemisphere.intensity = nextConfig.hemisphereIntensity;
    key.color.setHex(nextConfig.keyColor);
    key.intensity = nextConfig.keyIntensity;
    key.position.set(
      worldSizeMetres * nextConfig.keyPositionScale[0],
      worldSizeMetres * nextConfig.keyPositionScale[1],
      worldSizeMetres * nextConfig.keyPositionScale[2],
    );
  };

  applyConfig(config);

  layers.add({
    id: 'synthetic-lighting',
    label: 'Atmospheric inspection lighting',
    object: group,
  });

  return { setConfig: applyConfig };
}

function validateConfig(config: SyntheticInspectionLightingConfig): void {
  for (const [label, color] of [
    ['hemisphere sky', config.hemisphereSkyColor],
    ['hemisphere ground', config.hemisphereGroundColor],
    ['key', config.keyColor],
  ] as const) {
    if (!Number.isInteger(color) || color < 0 || color > 0xffffff) {
      throw new RangeError(`Inspection-lighting ${label} color is invalid.`);
    }
  }

  for (const [label, value] of [
    ['hemisphere intensity', config.hemisphereIntensity],
    ['key intensity', config.keyIntensity],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`Inspection-lighting ${label} must be finite and non-negative.`);
    }
  }

  if (config.keyPositionScale.some((position) => !Number.isFinite(position))) {
    throw new RangeError('Inspection-lighting key position must be finite.');
  }
}
