import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { loadCityBlocks } from '../city/data/loadCityBlocks';
import { loadProcessedCity } from '../city/data/loadProcessedCity';
import { addBlockDebugLayers } from '../city/debug/addBlockDebugLayers';
import { addBuildingDebugLayers } from '../city/debug/addBuildingDebugLayers';
import { addChunkDebugLayer } from '../city/debug/addChunkDebugLayer';
import { addStructureDebugLayers } from '../city/debug/addStructureDebugLayers';
import { chunkCityMassing } from '../city/generation/chunkCityMassing';
import { generateCityMassing } from '../city/generation/generateCityMassing';
import {
  CITY_MASSING_CONFIG,
  DEFAULT_CITY_MASSING_SEED,
} from '../city/generation/massingConfig';
import type { BuildingDefinition } from '../city/model/cityMassing';
import { addCityMassingLayer } from '../city/rendering/addCityMassingLayer';
import { createDebugPanel } from '../debug/createDebugPanel';
import { DebugLayerManager } from '../debug/DebugLayerManager';
import { createInspectionCamera } from './createInspectionCamera';
import { createPerformancePanel } from './createPerformancePanel';

const MAX_PIXEL_RATIO = 2;

export type CityFieldApp = Readonly<{
  start: () => void;
  stop: () => void;
  dispose: () => void;
}>;

export async function createApp(host: HTMLElement): Promise<CityFieldApp> {
  const [city, cityBlocks] = await Promise.all([loadProcessedCity(), loadCityBlocks()]);

  if (cityBlocks.metadata.workingAreaId !== city.metadata.clip.id) {
    throw new Error('Processed city blocks do not match the loaded structural working area.');
  }

  const requestedSeed = readMassingSeed(window.location.search);
  const massing = generateCityMassing(cityBlocks, {
    ...CITY_MASSING_CONFIG,
    seed: requestedSeed,
  });
  const chunkedMassing = chunkCityMassing(massing);
  const landmark = massing.buildings.find(
    (building) => building.id === massing.metadata.landmarkBuildingId,
  );

  if (landmark === undefined) {
    throw new Error('Generated city massing is missing its landmark definition.');
  }

  const worldSizeMetres = Math.ceil(
    Math.max(city.metadata.clip.widthMetres, city.metadata.clip.depthMetres) / 500,
  ) * 500;
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

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = 'label-layer';
  labelRenderer.domElement.setAttribute('aria-hidden', 'true');

  const landmarkCenter = getFootprintCenter(landmark);
  const inspectionCamera = createInspectionCamera(renderer.domElement, worldSizeMetres, {
    xMetres: landmarkCenter[0],
    zMetres: landmarkCenter[1],
    heightMetres: landmark.heightMetres,
  });
  const debugLayers = createFoundationDebugLayers(scene, worldSizeMetres);
  addStructureDebugLayers(debugLayers, city);
  addBlockDebugLayers(debugLayers, cityBlocks);
  const massingRenderLayer = addCityMassingLayer(debugLayers, chunkedMassing);
  addBuildingDebugLayers(debugLayers, massing);
  addChunkDebugLayer(debugLayers, chunkedMassing);
  debugLayers.setVisible('districts', false);
  debugLayers.setVisible('blocks', false);
  debugLayers.setVisible('buildable-polygons', false);
  const ground = createGround(scene, worldSizeMetres);
  const performancePanel = createPerformancePanel(
    renderer,
    scene,
    massingRenderLayer.getFrameStats,
  );
  const debugPanel = createDebugPanel(
    debugLayers,
    [
      {
        id: 'aerial',
        label: 'Aerial',
        activate: () => inspectionCamera.setPreset('aerial'),
      },
      {
        id: 'rooftop',
        label: 'Rooftop',
        activate: () => inspectionCamera.setPreset('rooftop'),
      },
      {
        id: 'street',
        label: 'Street',
        activate: () => inspectionCamera.setPreset('street'),
      },
    ],
    `Milestone 4 · seed ${massing.seed}`,
  );

  host.replaceChildren(
    renderer.domElement,
    labelRenderer.domElement,
    debugPanel.element,
    performancePanel.element,
  );

  const resize = (): void => {
    const width = Math.max(1, Math.floor(host.clientWidth));
    const height = Math.max(1, Math.floor(host.clientHeight));

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    labelRenderer.setSize(width, height);
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
    massingRenderLayer.beginFrame();
    renderer.render(scene, inspectionCamera.camera);
    labelRenderer.render(scene, inspectionCamera.camera);
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
      labelRenderer.domElement.remove();
      scene.clear();
      isDisposed = true;
    },
  };
}

function readMassingSeed(search: string): number {
  const value = new URLSearchParams(search).get('seed');

  if (value === null) {
    return DEFAULT_CITY_MASSING_SEED;
  }

  const seed = Number(value);

  if (!Number.isSafeInteger(seed)) {
    throw new Error('The URL seed must be a safe integer.');
  }

  return seed;
}

function getFootprintCenter(building: BuildingDefinition): readonly [number, number] {
  const [totalX, totalZ] = building.footprint.reduce(
    (total, point) => [total[0] + point[0], total[1] + point[1]] as const,
    [0, 0] as const,
  );

  return [totalX / building.footprint.length, totalZ / building.footprint.length];
}

function createFoundationDebugLayers(
  scene: THREE.Scene,
  worldSizeMetres: number,
): DebugLayerManager {
  const layers = new DebugLayerManager();
  scene.add(layers.root);

  const grid = new THREE.GridHelper(
    worldSizeMetres,
    worldSizeMetres / 50,
    0x67a9ce,
    0x29404f,
  );
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

function createGround(
  scene: THREE.Scene,
  worldSizeMetres: number,
): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const geometry = new THREE.PlaneGeometry(worldSizeMetres, worldSizeMetres);
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
