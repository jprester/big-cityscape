import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { DebugLayerManager } from '../debug/DebugLayerManager';
import type { SyntheticEnvironmentPresetId } from '../synthetic/syntheticEnvironmentPresets';

const INTENSITY = { day: 0.35, dusk: 0.25, night: 0.1 } as const;

/** Static studio lighting for specular response; independent of the visible sky. */
export function addReflectionEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  layers: DebugLayerManager,
  initialPreset: SyntheticEnvironmentPresetId,
) {
  const previous = scene.environment;
  const previousIntensity = scene.environmentIntensity;
  const previousRotation = scene.environmentRotation.clone();
  const studio = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  let target: THREE.WebGLRenderTarget;
  try {
    target = generator.fromScene(studio, 0.04);
  } finally {
    studio.dispose();
    generator.dispose();
  }
  let enabled = true;
  let preset = initialPreset;
  const apply = () => {
    scene.environment = enabled ? target.texture : previous;
    scene.environmentIntensity = enabled ? INTENSITY[preset] : previousIntensity;
    scene.environmentRotation.copy(previousRotation);
    if (enabled) scene.environmentRotation.y += 0.35;
  };
  apply();
  layers.add({
    id: 'reviewed-reflections',
    label: 'Glass reflections · studio environment',
    object: new THREE.Group(),
    onVisibilityChange: visible => { enabled = visible; apply(); },
    dispose: () => {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
      scene.environmentRotation.copy(previousRotation);
      target.dispose();
    },
  });
  return { setPreset: (id: SyntheticEnvironmentPresetId) => { preset = id; apply(); } };
}
