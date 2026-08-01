import * as THREE from 'three';
import { createDebugPanel } from '../debug/createDebugPanel';
import { DebugLayerManager } from '../debug/DebugLayerManager';
import { createInspectionCamera } from './createInspectionCamera';
import { createPerformancePanel } from './createPerformancePanel';

const WORLD_SIZE_METRES = 2_000;
const MAX_PIXEL_RATIO = 2;

export type CityFieldApp = Readonly<{
  start: () => void;
  stop: () => void;
  dispose: () => void;
}>;

export function createApp(host: HTMLElement): CityFieldApp {
  const scene = new THREE.Scene();
  scene.name = 'city-field';
  scene.background = new THREE.Color(0x071019);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'city-canvas';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Interactive City Field 3D viewport');

  const inspectionCamera = createInspectionCamera(renderer.domElement);
  const debugLayers = createFoundationDebugLayers(scene);
  const ground = createGround(scene);
  const performancePanel = createPerformancePanel(renderer, scene);
  const debugPanel = createDebugPanel(debugLayers, inspectionCamera.reset);

  host.replaceChildren(renderer.domElement, debugPanel.element, performancePanel.element);

  const resize = (): void => {
    const width = Math.max(1, Math.floor(host.clientWidth));
    const height = Math.max(1, Math.floor(host.clientHeight));

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    inspectionCamera.resize(width, height);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  let isRunning = false;
  let isDisposed = false;
  let previousTimeMilliseconds: number | undefined;

  const renderFrame = (timeMilliseconds: number): void => {
    const deltaSeconds =
      previousTimeMilliseconds === undefined
        ? 0
        : Math.max(0, (timeMilliseconds - previousTimeMilliseconds) / 1_000);

    previousTimeMilliseconds = timeMilliseconds;
    inspectionCamera.update(Math.min(deltaSeconds, 0.1));
    renderer.render(scene, inspectionCamera.camera);
    performancePanel.update(deltaSeconds);
  };

  const stop = (): void => {
    if (!isRunning) {
      return;
    }

    renderer.setAnimationLoop(null);
    isRunning = false;
    previousTimeMilliseconds = undefined;
  };

  return {
    start: () => {
      if (isDisposed) {
        throw new Error('A disposed City Field app cannot be restarted.');
      }

      if (isRunning) {
        return;
      }

      renderer.setAnimationLoop(renderFrame);
      isRunning = true;
    },
    stop,
    dispose: () => {
      if (isDisposed) {
        return;
      }

      stop();
      resizeObserver.disconnect();
      debugPanel.dispose();
      performancePanel.dispose();
      inspectionCamera.dispose();
      debugLayers.dispose();
      scene.remove(ground);
      ground.geometry.dispose();
      ground.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.clear();
      isDisposed = true;
    },
  };
}

function createFoundationDebugLayers(scene: THREE.Scene): DebugLayerManager {
  const layers = new DebugLayerManager();
  scene.add(layers.root);

  const grid = new THREE.GridHelper(WORLD_SIZE_METRES, 40, 0x67a9ce, 0x29404f);
  grid.position.y = 0.1;
  setMaterialOpacity(grid.material, 0.65);
  layers.add({
    id: 'metric-grid',
    label: '50 m metric grid',
    object: grid,
    dispose: () => {
      grid.geometry.dispose();
      disposeMaterial(grid.material);
    },
  });

  const axes = new THREE.AxesHelper(100);
  axes.position.y = 0.2;
  layers.add({
    id: 'world-axes',
    label: '100 m world axes',
    object: axes,
    dispose: () => {
      axes.geometry.dispose();
      disposeMaterial(axes.material);
    },
  });

  return layers;
}

function createGround(scene: THREE.Scene): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE_METRES, WORLD_SIZE_METRES);
  const material = new THREE.MeshBasicMaterial({
    color: 0x0b151d,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.name = 'foundation-ground';
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  return ground;
}

function setMaterialOpacity(material: THREE.Material | readonly THREE.Material[], opacity: number): void {
  for (const item of Array.isArray(material) ? material : [material]) {
    item.transparent = true;
    item.opacity = opacity;
    item.depthWrite = false;
  }
}

function disposeMaterial(material: THREE.Material | readonly THREE.Material[]): void {
  for (const item of Array.isArray(material) ? material : [material]) {
    item.dispose();
  }
}
