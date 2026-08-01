import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';

const INITIAL_TARGET_METRES = new THREE.Vector3(0, 0, 0);

export type InspectionCameraPresetId = 'aerial' | 'rooftop' | 'street';

export type InspectionCameraFocus = Readonly<{
  xMetres: number;
  zMetres: number;
  heightMetres: number;
}>;

export type InspectionCamera = Readonly<{
  camera: THREE.PerspectiveCamera;
  controls: MapControls;
  resize: (width: number, height: number) => void;
  reset: () => void;
  setPreset: (preset: InspectionCameraPresetId) => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
}>;

export function createInspectionCamera(
  canvas: HTMLCanvasElement,
  viewExtentMetres: number,
  focus: InspectionCameraFocus = {
    xMetres: 0,
    zMetres: 0,
    heightMetres: 0,
  },
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

  const setPreset = (preset: InspectionCameraPresetId): void => {
    switch (preset) {
      case 'aerial':
        camera.position.set(
          viewExtentMetres * 0.62,
          viewExtentMetres * 0.54,
          viewExtentMetres * 0.62,
        );
        controls.target.copy(INITIAL_TARGET_METRES);
        break;
      case 'rooftop':
        camera.position.set(
          focus.xMetres + viewExtentMetres * 0.16,
          Math.max(145, focus.heightMetres * 0.5),
          focus.zMetres + viewExtentMetres * 0.23,
        );
        controls.target.set(
          focus.xMetres,
          Math.min(140, focus.heightMetres * 0.48),
          focus.zMetres,
        );
        break;
      case 'street':
        camera.position.set(
          focus.xMetres - viewExtentMetres * 0.17,
          11,
          focus.zMetres + viewExtentMetres * 0.2,
        );
        controls.target.set(
          focus.xMetres,
          Math.min(68, focus.heightMetres * 0.22),
          focus.zMetres,
        );
        break;
    }

    controls.update();
  };

  const reset = (): void => setPreset('aerial');

  reset();

  return {
    camera,
    controls,
    resize: (width, height) => {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    reset,
    setPreset,
    update: (deltaSeconds) => {
      controls.update(deltaSeconds);
    },
    dispose: () => {
      controls.dispose();
    },
  };
}
