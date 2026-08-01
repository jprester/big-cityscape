import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';

const INITIAL_TARGET_METRES = new THREE.Vector3(0, 0, 0);

export type InspectionCamera = Readonly<{
  camera: THREE.PerspectiveCamera;
  controls: MapControls;
  resize: (width: number, height: number) => void;
  reset: () => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}>;

export function createInspectionCamera(
  canvas: HTMLCanvasElement,
  viewExtentMetres: number,
): InspectionCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 20_000);
  camera.name = 'inspection-camera';
  camera.up.set(0, 1, 0);

  const controls = new MapControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.minDistance = 5;
  controls.maxDistance = Math.max(6_000, viewExtentMetres * 4);
  controls.maxPolarAngle = Math.PI * 0.495;

  const reset = (): void => {
    camera.position.set(
      viewExtentMetres * 0.62,
      viewExtentMetres * 0.54,
      viewExtentMetres * 0.62,
    );
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
