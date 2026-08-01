import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';

const INITIAL_POSITION_METRES = new THREE.Vector3(850, 650, 850);
const INITIAL_TARGET_METRES = new THREE.Vector3(0, 0, 0);

export type InspectionCamera = Readonly<{
  camera: THREE.PerspectiveCamera;
  controls: MapControls;
  resize: (width: number, height: number) => void;
  reset: () => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}>;

export function createInspectionCamera(canvas: HTMLCanvasElement): InspectionCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 20_000);
  camera.name = 'inspection-camera';
  camera.up.set(0, 1, 0);

  const controls = new MapControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.minDistance = 5;
  controls.maxDistance = 6_000;
  controls.maxPolarAngle = Math.PI * 0.495;

  const reset = (): void => {
    camera.position.copy(INITIAL_POSITION_METRES);
    controls.target.copy(INITIAL_TARGET_METRES);
    controls.update();
  };

  reset();

  return {
    camera,
    controls,
    resize: (width, height) => {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    reset,
    update: (deltaSeconds) => {
      controls.update(deltaSeconds);
    },
    dispose: () => {
      controls.dispose();
    },
  };
}
