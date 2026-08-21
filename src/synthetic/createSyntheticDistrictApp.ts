import * as THREE from 'three';
import {
  createFirstPersonController,
  type FirstPersonController,
} from '../app/createFirstPersonController';
import {
  createFirstPersonCollisionIndex,
  type FirstPersonCollisionBounds,
} from '../app/firstPersonCollision';
import { createFirstPersonHud } from '../app/createFirstPersonHud';
import { createInspectionCamera } from '../app/createInspectionCamera';
import { createPerformancePanel } from '../app/createPerformancePanel';
import {
  DEFAULT_PROOF_DISTRICT_CONFIG,
  generateProofDistrict,
} from '../city/synthetic/generation/generateProofDistrict';
import {
  DEFAULT_SYNTHETIC_CITY_CONFIG,
  generateSyntheticCity,
} from '../city/synthetic/generation/generateSyntheticCity';
import { deriveSyntheticStreetLamps } from '../city/synthetic/generation/deriveSyntheticStreetLamps';
import { deriveSyntheticSignage } from '../city/synthetic/generation/deriveSyntheticSignage';
import { populateSyntheticCity } from '../city/synthetic/generation/populateSyntheticCity';
import { populateSyntheticDistrict } from '../city/synthetic/generation/populateSyntheticDistrict';
import type { SyntheticBuildingPlacement } from '../city/synthetic/model/buildingPlacement';
import type { SyntheticCityPopulation } from '../city/synthetic/model/cityPopulation';
import type { SyntheticDistrictPopulation } from '../city/synthetic/model/districtPopulation';
import type { SyntheticProofDistrict } from '../city/synthetic/model/proofDistrict';
import {
  SYNTHETIC_STREET_LAMP_POLE_WIDTH_METRES,
  type SyntheticStreetLampDefinition,
} from '../city/synthetic/model/streetLamp';
import type { SyntheticCity } from '../city/synthetic/model/syntheticCity';
import { countStreetHierarchies } from '../city/synthetic/model/streetCorridor';
import {
  addSyntheticBuildingLayer,
  type SyntheticBuildingRenderStats,
} from '../city/synthetic/rendering/addSyntheticBuildingLayer';
import {
  addSyntheticCityBuildingLayer,
  type SyntheticCityBuildingRenderLayer,
} from '../city/synthetic/rendering/addSyntheticCityBuildingLayer';
import {
  addSyntheticAtmosphereLayer,
} from '../city/synthetic/rendering/addSyntheticAtmosphereLayer';
import { addSyntheticInspectionLighting } from '../city/synthetic/rendering/addSyntheticInspectionLighting';
import { addSyntheticCityDebugLayer } from '../city/synthetic/rendering/addSyntheticCityDebugLayer';
import { addSyntheticRoadMarkingLayer } from '../city/synthetic/rendering/addSyntheticRoadMarkingLayer';
import { addSyntheticStreetLampLayer } from '../city/synthetic/rendering/addSyntheticStreetLampLayer';
import { addSyntheticSignageDebugLayer } from '../city/synthetic/rendering/addSyntheticSignageDebugLayer';
import {
  addSyntheticDistrictDebugLayers,
} from '../city/synthetic/rendering/addSyntheticDistrictDebugLayers';
import {
  createDebugPanel,
  type CameraPresetAction,
} from '../debug/createDebugPanel';
import { DebugLayerManager } from '../debug/DebugLayerManager';
import {
  createSyntheticEnvironmentPreset,
  readSyntheticEnvironmentPreset,
  setSyntheticEnvironmentPresetInUrl,
  SYNTHETIC_ENVIRONMENT_PRESET_IDS,
  type SyntheticEnvironmentPresetId,
} from './syntheticEnvironmentPresets';

const MAX_PIXEL_RATIO = 1.5;
const MAX_ACTIVE_FRAMES_PER_SECOND = 60;
const MIN_FRAME_INTERVAL_MILLISECONDS =
  1_000 / MAX_ACTIVE_FRAMES_PER_SECOND - 0.5;
const FIRST_PERSON_EYE_HEIGHT_METRES = 1.8;
const FIRST_PERSON_WALK_SPEED_METRES_PER_SECOND = 7;
const FIRST_PERSON_FAST_MULTIPLIER = 3.5;
const FIRST_PERSON_BOUNDARY_INSET_METRES = 2;
const FIRST_PERSON_COLLISION_RADIUS_METRES = 0.38;
const FIRST_PERSON_COLLISION_SUBSTEP_METRES = 0.2;
const FIRST_PERSON_COLLISION_CELL_SIZE_METRES = 100;
const FIRST_PERSON_NEAR_PLANE_METRES = 0.1;

type SyntheticViewMode = 'city' | 'proof';

type SyntheticViewData =
  | Readonly<{
      mode: 'city';
      spatial: SyntheticCity;
      population: SyntheticCityPopulation;
    }>
  | Readonly<{
      mode: 'proof';
      spatial: SyntheticProofDistrict;
      population: SyntheticDistrictPopulation;
    }>;

export type SyntheticDistrictApp = Readonly<{
  start: () => void;
  stop: () => void;
  dispose: () => void;
}>;

export async function createSyntheticDistrictApp(
  host: HTMLElement,
): Promise<SyntheticDistrictApp> {
  const search = window.location.search;
  const seed = readSyntheticSeed(search);
  let activeEnvironmentPresetId = readSyntheticEnvironmentPreset(search);
  const viewData = createViewData(readSyntheticViewMode(search), seed);
  const scene = new THREE.Scene();
  scene.name = `synthetic-${viewData.mode}`;
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
    `Interactive synthetic City Field ${viewData.mode} viewport`,
  );

  const worldSizeMetres =
    viewData.spatial.bounds.maxX - viewData.spatial.bounds.minX;
  const initialEnvironment = createSyntheticEnvironmentPreset(
    activeEnvironmentPresetId,
    worldSizeMetres,
  );
  const tallestPlacement = findTallestPlacement(viewData.population.placements);
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
  const atmosphereLayer = addSyntheticAtmosphereLayer(
    debugLayers,
    scene,
    initialEnvironment.atmosphere,
  );
  atmosphereLayer.update(inspectionCamera.camera);
  addSyntheticDistrictDebugLayers(debugLayers, viewData.spatial);
  const streetLampPlan = deriveSyntheticStreetLamps(
    `${viewData.spatial.id}/street-lamps`,
    viewData.spatial.seed,
    viewData.spatial.bounds,
    viewData.spatial.streetCorridors,
  );
  const streetLampLayer = addSyntheticStreetLampLayer(
    debugLayers,
    streetLampPlan.lamps,
    initialEnvironment.streetLamps,
  );
  const signagePlan = deriveSyntheticSignage(
    `${viewData.spatial.id}/signage`,
    viewData.spatial.seed,
    viewData.population.placements,
    viewData.spatial.blocks,
    viewData.mode === 'city'
      ? viewData.spatial.districts
      : [viewData.spatial],
  );
  const signageRenderStats = addSyntheticSignageDebugLayer(
    debugLayers,
    signagePlan,
  );

  let cityRenderLayer: SyntheticCityBuildingRenderLayer | undefined;
  let buildingRenderStats: SyntheticBuildingRenderStats;

  if (viewData.mode === 'city') {
    addSyntheticCityDebugLayer(debugLayers, viewData.spatial);
    addSyntheticRoadMarkingLayer(
      debugLayers,
      viewData.spatial.roadMarkings,
    );
    cityRenderLayer = await addSyntheticCityBuildingLayer(
      debugLayers,
      viewData.spatial,
      viewData.population,
    );
    buildingRenderStats = cityRenderLayer.stats;
  } else {
    buildingRenderStats = await addSyntheticBuildingLayer(
      debugLayers,
      viewData.population,
    );
  }

  const lightingLayer = addSyntheticInspectionLighting(
    debugLayers,
    worldSizeMetres,
    initialEnvironment.lighting,
  );

  const performancePanel = createPerformancePanel(
    renderer,
    scene,
    cityRenderLayer?.getFrameStats,
  );
  const statisticsPanel = createStatisticsPanel(
    viewData,
    buildingRenderStats,
    seed,
    activeEnvironmentPresetId,
    streetLampPlan.metadata.lampCount,
    signageRenderStats.instanceCount,
  );
  let isRunning = false;
  let isDisposed = false;
  let cameraInteractionActive = false;
  let animationFrameId: number | undefined;
  let previousTimeMilliseconds: number | undefined;
  let firstPersonController: FirstPersonController | undefined;

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
    const limitedDeltaSeconds = Math.min(deltaSeconds, 0.1);
    const firstPersonActive = firstPersonController?.isActive() ?? false;
    // OrbitControls.update() writes the camera transform even when input is
    // disabled, so it must not run while first-person look owns the camera.
    const cameraChanged = firstPersonActive
      ? false
      : inspectionCamera.update(limitedDeltaSeconds);
    const firstPersonChanged =
      firstPersonController?.update(limitedDeltaSeconds) ?? false;
    cityRenderLayer?.beginFrame();
    cityRenderLayer?.updateVisibility(inspectionCamera.camera);
    atmosphereLayer.update(inspectionCamera.camera);
    streetLampLayer.update(inspectionCamera.camera);
    renderer.render(scene, inspectionCamera.camera);
    performancePanel.update(deltaSeconds);

    if (cameraInteractionActive || cameraChanged || firstPersonChanged) {
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
      firstPersonController?.exit();

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

  const firstPersonHud = createFirstPersonHud();
  const firstPersonSpawn = createFirstPersonSpawn(viewData);
  const firstPersonCollisionIndex = createFirstPersonCollisionIndex(
    [
      ...viewData.population.placements.map(toBuildingCollisionBounds),
      ...streetLampPlan.lamps.map(toStreetLampCollisionBounds),
    ],
    FIRST_PERSON_COLLISION_CELL_SIZE_METRES,
  );
  firstPersonController = createFirstPersonController({
    camera: inspectionCamera.camera,
    canvas: renderer.domElement,
    orbitControls: inspectionCamera.controls,
    bounds: viewData.spatial.bounds,
    spawnPosition: firstPersonSpawn.position,
    spawnTarget: firstPersonSpawn.target,
    eyeHeightMetres: FIRST_PERSON_EYE_HEIGHT_METRES,
    walkSpeedMetresPerSecond: FIRST_PERSON_WALK_SPEED_METRES_PER_SECOND,
    fastMultiplier: FIRST_PERSON_FAST_MULTIPLIER,
    boundaryInsetMetres: FIRST_PERSON_BOUNDARY_INSET_METRES,
    collisionIndex: firstPersonCollisionIndex,
    collisionRadiusMetres: FIRST_PERSON_COLLISION_RADIUS_METRES,
    collisionSubstepMetres: FIRST_PERSON_COLLISION_SUBSTEP_METRES,
    nearPlaneMetres: FIRST_PERSON_NEAR_PLANE_METRES,
    onActiveChange: (active) => {
      cameraInteractionActive = active;
      firstPersonHud.setActive(active);
      host.classList.toggle('first-person-active', active);
      requestRender();
    },
    onChange: requestRender,
  });

  const debugPanel = createDebugPanel(
    debugLayers,
    createCameraPresets(
      viewData,
      inspectionCamera,
      () => firstPersonController?.enter(),
    ),
    `Synthetic ${viewData.mode} · seed ${seed}`,
    requestRender,
    SYNTHETIC_ENVIRONMENT_PRESET_IDS.map((id) => {
      const environment = createSyntheticEnvironmentPreset(id, worldSizeMetres);

      return {
        id,
        label: environment.label,
        selected: id === activeEnvironmentPresetId,
        activate: () => {
          activeEnvironmentPresetId = id;
          atmosphereLayer.setConfig(environment.atmosphere);
          lightingLayer.setConfig(environment.lighting);
          streetLampLayer.setConfig(environment.streetLamps);
          window.history.replaceState(
            window.history.state,
            '',
            setSyntheticEnvironmentPresetInUrl(window.location.href, id),
          );
          updateModeNavigationEnvironment(statisticsPanel, id);
        },
      } satisfies Readonly<{
        id: SyntheticEnvironmentPresetId;
        label: string;
        selected: boolean;
        activate: () => void;
      }>;
    }),
  );

  host.replaceChildren(
    renderer.domElement,
    debugPanel.element,
    statisticsPanel,
    performancePanel.element,
    firstPersonHud.element,
  );
  document.title = `${viewData.mode === 'city' ? 'Synthetic city' : 'Synthetic proof district'} · City Field`;

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

    firstPersonController?.exit();

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
      firstPersonController?.dispose();
      firstPersonController = undefined;
      firstPersonHud.dispose();
      host.classList.remove('first-person-active');
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

function createCameraPresets(
  viewData: SyntheticViewData,
  inspectionCamera: ReturnType<typeof createInspectionCamera>,
  enterFirstPerson: () => void,
): readonly CameraPresetAction[] {
  const presets: CameraPresetAction[] = [
    {
      id: 'aerial',
      label: 'Overview',
      activate: () => inspectionCamera.setPreset('aerial'),
    },
    {
      id: 'rooftop',
      label: 'Rooftop',
      activate: () =>
        viewData.mode === 'city'
          ? setCityRooftopPreset(viewData, inspectionCamera)
          : inspectionCamera.setPreset('rooftop'),
    },
    {
      id: 'street',
      label: 'Street',
      activate: () => setStreetPreset(viewData, inspectionCamera),
    },
  ];

  if (viewData.mode === 'city') {
    presets.push(
      {
        id: 'marked-crossing',
        label: 'Crossing',
        activate: () => setMarkedCrossingPreset(viewData, inspectionCamera),
      },
      {
        id: 'offset-spine',
        label: 'Spine',
        activate: () => setOffsetSpinePreset(viewData, inspectionCamera),
      },
    );
  }

  presets.push({
    id: 'first-person',
    label: 'Walk',
    activate: enterFirstPerson,
  });

  return presets;
}

function setCityRooftopPreset(
  viewData: Extract<SyntheticViewData, Readonly<{ mode: 'city' }>>,
  inspectionCamera: ReturnType<typeof createInspectionCamera>,
): void {
  const landmark = viewData.spatial.slots.find(
    (slot) => slot.role === 'landmark',
  );

  if (landmark === undefined) {
    throw new Error('The synthetic city has no landmark for its rooftop view.');
  }

  const bounds = viewData.spatial.bounds;
  const viewpointX =
    (bounds.minX + bounds.maxX) / 2 + (bounds.maxX - bounds.minX) * 0.25;
  const viewpointZ =
    (bounds.minZ + bounds.maxZ) / 2 + (bounds.maxZ - bounds.minZ) * 0.25;
  const height = Math.max(170, landmark.targetHeightMetres * 0.58);
  inspectionCamera.camera.position.set(viewpointX, height, viewpointZ);
  inspectionCamera.controls.target.set(
    landmark.center[0],
    Math.min(125, landmark.targetHeightMetres * 0.38),
    landmark.center[1],
  );
  inspectionCamera.controls.update();
}

function setMarkedCrossingPreset(
  viewData: Extract<SyntheticViewData, Readonly<{ mode: 'city' }>>,
  inspectionCamera: ReturnType<typeof createInspectionCamera>,
): void {
  const verticalArterials = viewData.spatial.streetCorridors
    .filter(
      (street) =>
        street.context === 'district-boundary' &&
        street.axis === 'north-south',
    )
    .toSorted(
      (first, second) =>
        streetCenterX(first.bounds) - streetCenterX(second.bounds),
    );
  const horizontalArterials = viewData.spatial.streetCorridors
    .filter(
      (street) =>
        street.context === 'district-boundary' &&
        street.axis === 'east-west',
    )
    .toSorted(
      (first, second) =>
        streetCenterZ(first.bounds) - streetCenterZ(second.bounds),
    );
  const vertical = verticalArterials[Math.floor(verticalArterials.length / 2)];
  const horizontal =
    horizontalArterials[Math.floor(horizontalArterials.length / 2)];

  if (vertical === undefined || horizontal === undefined) {
    throw new Error('The synthetic city has no marked arterial crossing.');
  }

  const x = streetCenterX(vertical.bounds);
  const z = streetCenterZ(horizontal.bounds);
  inspectionCamera.camera.position.set(x, 7, z - 58);
  inspectionCamera.controls.target.set(x, 0.35, z);
  inspectionCamera.controls.update();
}

function streetCenterX(
  bounds: Readonly<{ minX: number; maxX: number }>,
): number {
  return (bounds.minX + bounds.maxX) / 2;
}

function streetCenterZ(
  bounds: Readonly<{ minZ: number; maxZ: number }>,
): number {
  return (bounds.minZ + bounds.maxZ) / 2;
}

function createFirstPersonSpawn(
  viewData: SyntheticViewData,
): Readonly<{
  position: readonly [xMetres: number, yMetres: number, zMetres: number];
  target: readonly [xMetres: number, yMetres: number, zMetres: number];
}> {
  const streetCenterZ =
    viewData.mode === 'city' ? 0 : centralProofStreetZ(viewData.spatial);

  return {
    position: [
      viewData.spatial.bounds.minX + 28,
      FIRST_PERSON_EYE_HEIGHT_METRES,
      streetCenterZ,
    ],
    target: [
      viewData.spatial.bounds.maxX - 28,
      FIRST_PERSON_EYE_HEIGHT_METRES,
      streetCenterZ,
    ],
  };
}

function createViewData(mode: SyntheticViewMode, seed: number): SyntheticViewData {
  if (mode === 'city') {
    const city = generateSyntheticCity({
      ...DEFAULT_SYNTHETIC_CITY_CONFIG,
      seed,
    });
    return {
      mode,
      spatial: city,
      population: populateSyntheticCity(city),
    };
  }

  const district = generateProofDistrict({
    ...DEFAULT_PROOF_DISTRICT_CONFIG,
    seed,
  });
  return {
    mode,
    spatial: district,
    population: populateSyntheticDistrict(district),
  };
}

function findTallestPlacement(
  placements: readonly SyntheticBuildingPlacement[],
): SyntheticBuildingPlacement {
  const first = placements[0];

  if (first === undefined) {
    throw new Error('The synthetic view cannot frame an empty population.');
  }

  return placements.slice(1).reduce(
    (tallest, placement) =>
      placement.dimensionsMetres.height > tallest.dimensionsMetres.height
        ? placement
        : tallest,
    first,
  );
}

function toBuildingCollisionBounds(
  placement: SyntheticBuildingPlacement,
): FirstPersonCollisionBounds {
  // Selection records the fitted world-X/world-Z extents after an optional
  // quarter turn, so collision must not rotate these dimensions a second time.
  const halfWidth = placement.dimensionsMetres.width / 2;
  const halfDepth = placement.dimensionsMetres.depth / 2;

  return {
    id: `building:${placement.id}`,
    minX: placement.center[0] - halfWidth,
    maxX: placement.center[0] + halfWidth,
    minZ: placement.center[1] - halfDepth,
    maxZ: placement.center[1] + halfDepth,
  };
}

function toStreetLampCollisionBounds(
  lamp: SyntheticStreetLampDefinition,
): FirstPersonCollisionBounds {
  const halfWidth = SYNTHETIC_STREET_LAMP_POLE_WIDTH_METRES / 2;

  return {
    id: `street-lamp:${lamp.id}`,
    minX: lamp.position[0] - halfWidth,
    maxX: lamp.position[0] + halfWidth,
    minZ: lamp.position[1] - halfWidth,
    maxZ: lamp.position[1] + halfWidth,
  };
}

function setStreetPreset(
  viewData: SyntheticViewData,
  inspectionCamera: ReturnType<typeof createInspectionCamera>,
): void {
  const streetCenterZ =
    viewData.mode === 'city'
      ? 0
      : centralProofStreetZ(viewData.spatial);
  inspectionCamera.camera.position.set(
    viewData.spatial.bounds.minX + 28,
    12,
    streetCenterZ,
  );
  inspectionCamera.controls.target.set(
    viewData.spatial.bounds.maxX - 28,
    30,
    streetCenterZ,
  );
  inspectionCamera.controls.update();
}

function setOffsetSpinePreset(
  viewData: Extract<SyntheticViewData, Readonly<{ mode: 'city' }>>,
  inspectionCamera: ReturnType<typeof createInspectionCamera>,
): void {
  const nearestBandBlock = viewData.spatial.blocks
    .filter((block) => block.layoutVariationId === 'offset-band')
    .reduce((nearest, block) =>
      nearest === undefined || block.bounds.minX < nearest.bounds.minX
        ? block
        : nearest,
    undefined as SyntheticCity['blocks'][number] | undefined);

  if (nearestBandBlock === undefined) {
    throw new Error('The synthetic city has no offset spine to inspect.');
  }

  const leftNeighbor = viewData.spatial.blocks.find(
    (block) =>
      block.districtId === nearestBandBlock.districtId &&
      block.gridRow === nearestBandBlock.gridRow &&
      block.gridColumn === nearestBandBlock.gridColumn - 1,
  );

  if (leftNeighbor === undefined) {
    throw new Error('The offset spine has no left-hand street edge.');
  }

  const streetX =
    (leftNeighbor.bounds.maxX + nearestBandBlock.bounds.minX) / 2;
  inspectionCamera.camera.position.set(
    streetX,
    12,
    viewData.spatial.bounds.minZ + 28,
  );
  inspectionCamera.controls.target.set(
    streetX,
    28,
    viewData.spatial.bounds.maxZ - 28,
  );
  inspectionCamera.controls.update();
}

function centralProofStreetZ(district: SyntheticProofDistrict): number {
  const rowBeforeStreet = district.blocks.find(
    (block) => block.gridRow === 1,
  );
  const rowAfterStreet = district.blocks.find(
    (block) => block.gridRow === 2,
  );

  if (rowBeforeStreet === undefined || rowAfterStreet === undefined) {
    throw new Error('The proof district is missing its central street gap.');
  }

  return (rowBeforeStreet.bounds.maxZ + rowAfterStreet.bounds.minZ) / 2;
}

function readSyntheticViewMode(search: string): SyntheticViewMode {
  const mode = new URLSearchParams(search).get('mode');

  if (mode === null || mode === 'city') {
    return 'city';
  }

  if (mode === 'proof') {
    return mode;
  }

  throw new Error('The synthetic view mode must be "city" or "proof".');
}

function readSyntheticSeed(search: string): number {
  const value = new URLSearchParams(search).get('seed');

  if (value === null) {
    return DEFAULT_SYNTHETIC_CITY_CONFIG.seed;
  }

  const seed = Number(value);

  if (!Number.isSafeInteger(seed)) {
    throw new Error('The URL seed must be a safe integer.');
  }

  return seed;
}

function createStatisticsPanel(
  viewData: SyntheticViewData,
  rendering: SyntheticBuildingRenderStats,
  seed: number,
  environmentPresetId: SyntheticEnvironmentPresetId,
  streetLampCount: number,
  signAnchorCount: number,
): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'synthetic-statistics';
  panel.setAttribute('aria-label', 'Synthetic city statistics');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'synthetic-statistics__eyebrow';
  eyebrow.textContent =
    viewData.mode === 'city' ? '2 × 2 km composition' : '500 m proof district';
  const title = document.createElement('h2');
  title.className = 'synthetic-statistics__title';
  title.textContent = statisticsTitle(viewData);
  const modeNavigation = createModeNavigation(
    viewData.mode,
    seed,
    environmentPresetId,
  );
  const metrics = document.createElement('dl');
  metrics.className = 'synthetic-statistics__metrics';
  addCompositionStatistics(metrics, viewData);
  addStatistic(
    metrics,
    'Street lamps',
    streetLampCount.toLocaleString('en-US'),
  );
  addStatistic(
    metrics,
    'Sign anchors',
    signAnchorCount.toLocaleString('en-US'),
  );
  addStatistic(
    metrics,
    'Asset variants',
    viewData.population.metadata.distinctAssetCount.toString(),
  );
  const mostRepeated = mostRepeatedAsset(viewData.population.assetUsage);
  addStatistic(
    metrics,
    'Most repeated',
    `${mostRepeated.assetId} · ${mostRepeated.count}×`,
  );
  addStatistic(metrics, 'Building batches', rendering.batches.toString());
  addStatistic(
    metrics,
    'Model triangles',
    rendering.triangles.toLocaleString('en-US'),
  );
  addStatistic(metrics, 'Load failures', rendering.failedModels.toString());
  const legend = document.createElement('p');
  legend.className = 'synthetic-statistics__legend';
  legend.textContent =
    'Buildings: green low-rise · blue mid-rise · amber high-rise · rose skyscraper';
  const assetLink = document.createElement('a');
  assetLink.className = 'synthetic-statistics__link';
  assetLink.href = '?view=assets';
  assetLink.textContent = 'Open asset catalogue';
  panel.append(
    eyebrow,
    title,
    modeNavigation,
    metrics,
    legend,
    assetLink,
  );
  return panel;
}

function mostRepeatedAsset(
  usage: readonly Readonly<{ assetId: string; count: number }>[],
): Readonly<{ assetId: string; count: number }> {
  const first = usage[0];

  if (first === undefined) {
    throw new Error('Synthetic statistics require at least one used asset.');
  }

  return usage.slice(1).reduce(
    (mostRepeated, candidate) =>
      candidate.count > mostRepeated.count ? candidate : mostRepeated,
    first,
  );
}

function statisticsTitle(viewData: SyntheticViewData): string {
  if (viewData.mode === 'city') {
    return `${viewData.spatial.metadata.districtCount} districts · ${viewData.population.metadata.placedCount.toLocaleString('en-US')} buildings`;
  }

  return `${viewData.spatial.metadata.blockCount} blocks · ${viewData.population.metadata.placedCount} buildings`;
}

function addCompositionStatistics(
  metrics: HTMLDListElement,
  viewData: SyntheticViewData,
): void {
  const streetCounts = countStreetHierarchies(
    viewData.spatial.streetCorridors,
  );
  addStatistic(
    metrics,
    'Street hierarchy',
    `${streetCounts.arterial} arterial · ${streetCounts.secondary} secondary · ${streetCounts.local} local`,
  );

  if (viewData.mode === 'city') {
    const { metadata } = viewData.spatial;
    addStatistic(
      metrics,
      'Road markings',
      `${viewData.spatial.roadMarkings.metadata.centreLineDashCount} dashes · ${viewData.spatial.roadMarkings.metadata.markedIntersectionCount} crossings`,
    );
    addStatistic(
      metrics,
      'Skyline anchors',
      `1 primary · ${metadata.secondarySkylineAnchorCount} secondary`,
    );
    addStatistic(metrics, 'Blocks', metadata.blockCount.toLocaleString('en-US'));
    addStatistic(
      metrics,
      'District profiles',
      `${metadata.profileCounts.centre} centre · ${metadata.profileCounts.urban} urban · ${metadata.profileCounts.edge} edge`,
    );
    addStatistic(
      metrics,
      'Grid rhythms',
      `${metadata.gridVariantCounts.balanced} balanced · ${metadata.gridVariantCounts['fine-grain']} fine · ${metadata.gridVariantCounts['large-block']} large`,
    );
    addStatistic(
      metrics,
      'Open-space blocks',
      viewData.spatial.blocks
        .filter((block) => block.templateId === 'open-space')
        .length.toString(),
    );
    const offsetBlocks = viewData.spatial.blocks.filter(
      (block) => block.layoutVariationId === 'offset-band',
    );

    if (offsetBlocks.length > 0) {
      const maximumOffset = Math.max(
        ...offsetBlocks.map((block) => Math.abs(block.layoutOffsetMetres[0])),
      );
      addStatistic(
        metrics,
        'Offset spine',
        `${offsetBlocks.length} blocks · ±${maximumOffset.toFixed(0)} m`,
      );
    }
    return;
  }

  const { metadata } = viewData.spatial;
  addStatistic(
    metrics,
    'Profiles',
    `${metadata.profileCounts.core} core · ${metadata.profileCounts.transition} transition`,
  );
  addStatistic(
    metrics,
    'Templates',
    `${metadata.templateCounts['fabric-grid']} fabric · ${metadata.templateCounts['edge-slabs']} slabs · ${metadata.templateCounts['anchor-and-fill']} anchors · ${metadata.templateCounts['skyline-anchor']} skyline · ${metadata.templateCounts['landmark-plaza']} landmark · ${metadata.templateCounts['open-space']} parks`,
  );
}

function createModeNavigation(
  currentMode: SyntheticViewMode,
  seed: number,
  environmentPresetId: SyntheticEnvironmentPresetId,
): HTMLElement {
  const navigation = document.createElement('nav');
  navigation.className = 'synthetic-statistics__modes';
  navigation.setAttribute('aria-label', 'Synthetic view mode');

  for (const [mode, label] of [
    ['city', 'Full city'],
    ['proof', 'Proof district'],
  ] as const) {
    const link = document.createElement('a');
    link.href = `?view=synthetic&mode=${mode}&seed=${seed}&time=${environmentPresetId}`;
    link.dataset.syntheticMode = mode;
    link.textContent = label;

    if (mode === currentMode) {
      link.setAttribute('aria-current', 'page');
    }

    navigation.append(link);
  }

  return navigation;
}

function updateModeNavigationEnvironment(
  panel: HTMLElement,
  environmentPresetId: SyntheticEnvironmentPresetId,
): void {
  for (const link of panel.querySelectorAll<HTMLAnchorElement>(
    'a[data-synthetic-mode]',
  )) {
    const url = new URL(link.href);
    url.searchParams.set('time', environmentPresetId);
    link.href = url.toString();
  }
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
