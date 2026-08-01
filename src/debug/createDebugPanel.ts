import type { DebugLayerManager } from './DebugLayerManager';

export type DebugPanel = Readonly<{
  element: HTMLElement;
  dispose: () => void;
}>;

export type CameraPresetAction = Readonly<{
  id: string;
  label: string;
  activate: () => void;
}>;

export function createDebugPanel(
  layers: DebugLayerManager,
  cameraPresets: readonly CameraPresetAction[],
  milestoneLabel = 'Milestone 0',
): DebugPanel {
  const element = document.createElement('aside');
  element.className = 'debug-panel';
  element.setAttribute('aria-label', 'City Field inspection controls');

  const eyebrow = document.createElement('p');
  eyebrow.className = 'debug-panel__eyebrow';
  eyebrow.textContent = milestoneLabel;

  const title = document.createElement('h1');
  title.className = 'debug-panel__title';
  title.textContent = 'City Field';

  const controls = document.createElement('div');
  controls.className = 'debug-panel__controls';

  const disposers: Array<() => void> = [];

  for (const layer of layers.list()) {
    const label = document.createElement('label');
    label.className = 'debug-panel__toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = layer.visible;

    const onChange = (): void => {
      layers.setVisible(layer.id, input.checked);
    };

    input.addEventListener('change', onChange);
    disposers.push(() => input.removeEventListener('change', onChange));
    label.append(input, document.createTextNode(layer.label));
    controls.append(label);
  }

  const cameraControls = document.createElement('div');
  cameraControls.className = 'debug-panel__camera-controls';

  for (const preset of cameraPresets) {
    const button = document.createElement('button');
    button.className = 'debug-panel__button';
    button.type = 'button';
    button.dataset.cameraPreset = preset.id;
    button.textContent = preset.label;
    button.addEventListener('click', preset.activate);
    disposers.push(() => button.removeEventListener('click', preset.activate));
    cameraControls.append(button);
  }

  const help = document.createElement('p');
  help.className = 'debug-panel__help';
  help.textContent = 'Left drag: pan · Right drag: orbit · Wheel: zoom';

  element.append(eyebrow, title, controls, cameraControls, help);

  return {
    element,
    dispose: () => {
      for (const dispose of disposers) {
        dispose();
      }

      element.remove();
    },
  };
}
