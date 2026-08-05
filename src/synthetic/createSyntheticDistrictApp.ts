import * as THREE from 'three';
import { createInspectionCamera } from '../app/createInspectionCamera';
import { createPerformancePanel } from '../app/createPerformancePanel';
import { DEFAULT_PROOF_DISTRICT_CONFIG, generateProofDistrict } from '../city/synthetic/generation/generateProofDistrict';
import { populateSyntheticDistrict } from '../city/synthetic/generation/populateSyntheticDistrict';
import { addSyntheticBuildingLayer, type SyntheticBuildingRenderStats } from '../city/synthetic/rendering/addSyntheticBuildingLayer';
import { addSyntheticDistrictDebugLayers } from '../city/synthetic/rendering/addSyntheticDistrictDebugLayers';
import { createDebugPanel } from '../debug/createDebugPanel';
import { DebugLayerManager } from '../debug/DebugLayerManager';

const MAX_PIXEL_RATIO = 1.5;
const MAX_ACTIVE_FRAMES_PER_SECOND = 60;
const MIN_FRAME_INTERVAL_MILLISECONDS =
  1_000 / MAX_ACTIVE_FRAMES_PER_SECOND - 0.5;

export type SyntheticDistrictApp = Readonly<{
  start: () => void;
  stop: () => void;
  dispose: () => void;
}>;

export async function createSyntheticDistrictApp(
  host: HTMLElement,
): Promise<SyntheticDistrictApp> {
  const seed = readSyntheticSeed(window.location.search);
  const district = generateProofDistrict({
    ...DEFAULT_PROOF_DISTRICT_CONFIG,
    seed,
  });
  const population = populateSyntheticDistrict(district);
  const scene = new THREE.Scene();
  scene.name = 'synthetic-proof-district';
  scene.background = new THREE.Color(0x0a1016);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'city-canvas';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute(
    'aria-label',
    'Interactive synthetic City Field district viewport',
  );

  const worldSizeMetres = district.bounds.maxX - district.bounds.minX;
  const tallestPlacement = population.placements.reduce((tallest, placement) =>
    placement.dimensionsMetres.height > tallest.dimensionsMetres.height
      ? placement
      : tallest,
  );
  const inspectionCamera = createInspectionCamera(
    renderer.domElement,
    worldSizeMetres * 1.4,
    {
      xMetres: tallestPlacement.center[0],
      zMetres: tallestPlacement.center[1],
      heightMetres: tallestPlacement.dimensionsMetres.height,
    },
  );
  const debugLayers = new DebugLayerManager();
  scene.add(debugLayers.root);
  addSyntheticDistrictDebugLayers(debugLayers, district);
  const buildingRenderStats = await addSyntheticBuildingLayer(
    debugLayers,
    population,
  );
  const performancePanel = createPerformancePanel(renderer, scene);
  const statisticsPanel = createStatisticsPanel(
    district.metadata,
    population.metadata,
    buildingRenderStats,
  );
  let isRunning = false;
  let isDisposed = false;
  let cameraInteractionActive = false;
  let animationFrameId: number | undefined;
  let previousTimeMilliseconds: number | undefined;

  const requestRender = (): void => {
    if (
      !isRunning ||
      isDisposed ||
      document.hidden ||
      animationFrameId !== undefined
    ) {
      return;
    }

    animationFrameId = window.requestAnimationFrame(renderFrame);
  };

  const renderFrame = (timeMilliseconds: number): void => {
    animationFrameId = undefined;

    if (!isRunning || isDisposed || document.hidden) {
      return;
    }

    if (
      previousTimeMilliseconds !== undefined &&
      timeMilliseconds - previousTimeMilliseconds <
        MIN_FRAME_INTERVAL_MILLISECONDS
    ) {
      requestRender();
      return;
    }

    const deltaSeconds =
      previousTimeMilliseconds === undefined
        ? 0
        : Math.max(0, (timeMilliseconds - previousTimeMilliseconds) / 1_000);

    previousTimeMilliseconds = timeMilliseconds;
    const cameraChanged = inspectionCamera.update(Math.min(deltaSeconds, 0.1));
    renderer.render(scene, inspectionCamera.camera);
    performancePanel.update(deltaSeconds);

    if (cameraInteractionActive || cameraChanged) {
      requestRender();
    } else {
      previousTimeMilliseconds = undefined;
      performancePanel.setIdle();
    }
  };

  const onCameraInteractionStart = (): void => {
    cameraInteractionActive = true;
    requestRender();
  };
  const onCameraInteractionEnd = (): void => {
    cameraInteractionActive = false;
    requestRender();
  };
  const onCameraChange = (): void => requestRender();
  const onVisibilityChange = (): void => {
    if (document.hidden) {
      if (animationFrameId !== undefined) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = undefined;
      }

      cameraInteractionActive = false;
      previousTimeMilliseconds = undefined;
      performancePanel.setIdle();
      return;
    }

    requestRender();
  };

  inspectionCamera.controls.addEventListener('start', onCameraInteractionStart);
  inspectionCamera.controls.addEventListener('end', onCameraInteractionEnd);
  inspectionCamera.controls.addEventListener('change', onCameraChange);
  document.addEventListener('visibilitychange', onVisibilityChange);

  const debugPanel = createDebugPanel(
    debugLayers,
    [
      {
        id: 'aerial',
        label: 'Overview',
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
        activate: () => setStreetPreset(district, inspectionCamera),
      },
    ],
    `Synthetic proof district · seed ${seed}`,
    requestRender,
  );

  host.replaceChildren(
    renderer.domElement,
    debugPanel.element,
    statisticsPanel,
    performancePanel.element,
  );
  document.title = 'Synthetic proof district · City Field';

  const resize = (): void => {
    const width = Math.max(1, Math.floor(host.clientWidth));
    const height = Math.max(1, Math.floor(host.clientHeight));

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    inspectionCamera.resize(width, height);
    requestRender();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  const stop = (): void => {
    if (!isRunning) {
      return;
    }

    if (animationFrameId !== undefined) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = undefined;
    }

    isRunning = false;
    previousTimeMilliseconds = undefined;
    performancePanel.setIdle();
  };

  return {
    start: () => {
      if (isDisposed) {
        throw new Error('A disposed synthetic district app cannot be restarted.');
      }

      if (isRunning) {
        return;
      }

      isRunning = true;
      requestRender();
    },
    stop,
    dispose: () => {
      if (isDisposed) {
        return;
      }

      stop();
      resizeObserver.disconnect();
      inspectionCamera.controls.removeEventListener(
        'start',
        onCameraInteractionStart,
      );
      inspectionCamera.controls.removeEventListener(
        'end',
        onCameraInteractionEnd,
      );
      inspectionCamera.controls.removeEventListener('change', onCameraChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      debugPanel.dispose();
      statisticsPanel.remove();
      performancePanel.dispose();
      inspectionCamera.dispose();
      debugLayers.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.clear();
      isDisposed = true;
    },
  };
}

function setStreetPreset(
  district: ReturnType<typeof generateProofDistrict>,
  inspectionCamera: ReturnType<typeof createInspectionCamera>,
): void {
  const rowBeforeStreet = district.blocks.find(
    (block) => block.gridRow === 1,
  );
  const rowAfterStreet = district.blocks.find(
    (block) => block.gridRow === 2,
  );

  if (rowBeforeStreet === undefined || rowAfterStreet === undefined) {
    throw new Error('The proof district is missing its central street gap.');
  }

  const streetCenterZ =
    (rowBeforeStreet.bounds.maxZ + rowAfterStreet.bounds.minZ) / 2;
  inspectionCamera.camera.position.set(
    district.bounds.minX + 28,
    12,
    streetCenterZ,
  );
  inspectionCamera.controls.target.set(
    district.bounds.maxX - 28,
    30,
    streetCenterZ,
  );
  inspectionCamera.controls.update();
}

function readSyntheticSeed(search: string): number {
  const value = new URLSearchParams(search).get('seed');

  if (value === null) {
    return DEFAULT_PROOF_DISTRICT_CONFIG.seed;
  }

  const seed = Number(value);

  if (!Number.isSafeInteger(seed)) {
    throw new Error('The URL seed must be a safe integer.');
  }

  return seed;
}

function createStatisticsPanel(
  district: ReturnType<typeof generateProofDistrict>['metadata'],
  population: ReturnType<typeof populateSyntheticDistrict>['metadata'],
  rendering: SyntheticBuildingRenderStats,
): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'synthetic-statistics';
  panel.setAttribute('aria-label', 'Synthetic district statistics');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'synthetic-statistics__eyebrow';
  eyebrow.textContent = 'Declarative population';
  const title = document.createElement('h2');
  title.className = 'synthetic-statistics__title';
  title.textContent = `${district.blockCount} blocks · ${population.placedCount} buildings`;
  const metrics = document.createElement('dl');
  metrics.className = 'synthetic-statistics__metrics';
  addStatistic(metrics, 'Profiles', `${district.profileCounts.core} core · ${district.profileCounts.transition} transition`);
  addStatistic(metrics, 'Templates', `${district.templateCounts['fabric-grid']} fabric · ${district.templateCounts['edge-slabs']} slabs · ${district.templateCounts['anchor-and-fill']} anchors · ${district.templateCounts['landmark-plaza']} landmark`);
  addStatistic(metrics, 'Asset variants', population.distinctAssetCount.toString());
  addStatistic(metrics, 'Instanced batches', rendering.batches.toString());
  addStatistic(metrics, 'Model triangles', rendering.triangles.toLocaleString('en-US'));
  addStatistic(metrics, 'Load failures', rendering.failedModels.toString());
  const legend = document.createElement('p');
  legend.className = 'synthetic-statistics__legend';
  legend.textContent = 'Buildings: green low-rise · blue mid-rise · amber high-rise · rose skyscraper';
  const assetLink = document.createElement('a');
  assetLink.className = 'synthetic-statistics__link';
  assetLink.href = '?view=assets';
  assetLink.textContent = 'Open asset catalogue';
  panel.append(eyebrow, title, metrics, legend, assetLink);
  return panel;
}

function addStatistic(
  list: HTMLDListElement,
  label: string,
  value: string,
): void {
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = value;
  list.append(term, description);
}
