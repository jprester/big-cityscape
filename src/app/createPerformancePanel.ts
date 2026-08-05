import type * as THREE from 'three';
import type { CityMassingFrameStats } from '../city/rendering/addCityMassingLayer';

const UPDATE_INTERVAL_SECONDS = 0.5;

type MetricName =
  | 'fps'
  | 'frame'
  | 'calls'
  | 'triangles'
  | 'objects'
  | 'visible'
  | 'chunks'
  | 'batches'
  | 'instances';

export type PerformancePanel = Readonly<{
  element: HTMLElement;
  update: (deltaSeconds: number) => void;
  setIdle: () => void;
  dispose: () => void;
}>;

export function createPerformancePanel(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  getMassingStats?: () => CityMassingFrameStats,
): PerformancePanel {
  const element = document.createElement('aside');
  element.className = 'performance-panel';
  element.setAttribute('aria-label', 'Rendering performance');

  const outputs = new Map<MetricName, HTMLOutputElement>();

  addMetric(element, outputs, 'fps', 'FPS', '0');
  addMetric(element, outputs, 'frame', 'Frame', '0.0 ms');
  addMetric(element, outputs, 'calls', 'Draw calls', '0');
  addMetric(element, outputs, 'triangles', 'Triangles', '0');
  addMetric(element, outputs, 'objects', 'Objects', '0');
  addMetric(element, outputs, 'visible', 'Visible objects', '0');

  if (getMassingStats !== undefined) {
    addMetric(element, outputs, 'chunks', 'Rendered chunks', '0 / 0');
    addMetric(element, outputs, 'batches', 'Rendered batches', '0 / 0');
    addMetric(element, outputs, 'instances', 'Model instances', '0 / 0');
  }

  let elapsedSeconds = 0;
  let frameCount = 0;
  let hasReportedFrameRate = false;

  const updateSceneMetrics = (): void => {
    let objectCount = -1;
    let visibleObjectCount = -1;

    scene.traverse(() => {
      objectCount += 1;
    });
    scene.traverseVisible(() => {
      visibleObjectCount += 1;
    });

    setMetric(outputs, 'calls', formatCount(renderer.info.render.calls));
    setMetric(outputs, 'triangles', formatCount(renderer.info.render.triangles));
    setMetric(outputs, 'objects', formatCount(Math.max(0, objectCount)));
    setMetric(outputs, 'visible', formatCount(Math.max(0, visibleObjectCount)));

    if (getMassingStats !== undefined) {
      const massingStats = getMassingStats();
      setMetric(
        outputs,
        'chunks',
        `${massingStats.renderedChunks} / ${massingStats.totalChunks}`,
      );
      setMetric(
        outputs,
        'batches',
        `${massingStats.renderedBatches} / ${massingStats.totalBatches}`,
      );
      setMetric(
        outputs,
        'instances',
        `${massingStats.renderedInstances} / ${massingStats.totalInstances}`,
      );
    }
  };

  const update = (deltaSeconds: number): void => {
    elapsedSeconds += deltaSeconds;
    frameCount += 1;
    updateSceneMetrics();

    if (frameCount === 1 && !hasReportedFrameRate) {
      setMetric(outputs, 'fps', 'Active');
      setMetric(outputs, 'frame', 'Rendering');
    }

    if (elapsedSeconds < UPDATE_INTERVAL_SECONDS) {
      return;
    }

    const framesPerSecond = frameCount / elapsedSeconds;
    const millisecondsPerFrame = (elapsedSeconds * 1_000) / frameCount;

    setMetric(outputs, 'fps', framesPerSecond.toFixed(0));
    setMetric(outputs, 'frame', `${millisecondsPerFrame.toFixed(1)} ms`);
    hasReportedFrameRate = true;

    elapsedSeconds = 0;
    frameCount = 0;
  };

  return {
    element,
    update,
    setIdle: () => {
      updateSceneMetrics();
      setMetric(outputs, 'fps', 'Idle');
      setMetric(outputs, 'frame', 'On demand');
      elapsedSeconds = 0;
      frameCount = 0;
      hasReportedFrameRate = false;
    },
    dispose: () => {
      element.remove();
    },
  };
}

function addMetric(
  panel: HTMLElement,
  outputs: Map<MetricName, HTMLOutputElement>,
  name: MetricName,
  label: string,
  initialValue: string,
): void {
  const row = document.createElement('div');
  row.className = 'performance-panel__row';

  const labelElement = document.createElement('span');
  labelElement.className = 'performance-panel__label';
  labelElement.textContent = label;

  const output = document.createElement('output');
  output.className = 'performance-panel__value';
  output.value = initialValue;

  outputs.set(name, output);
  row.append(labelElement, output);
  panel.append(row);
}

function setMetric(
  outputs: ReadonlyMap<MetricName, HTMLOutputElement>,
  name: MetricName,
  value: string,
): void {
  const output = outputs.get(name);

  if (output === undefined) {
    throw new Error(`Performance metric "${name}" is not registered.`);
  }

  output.value = value;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}
