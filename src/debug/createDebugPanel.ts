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

export type DisplayPresetAction = Readonly<{
  id: string;
  label: string;
  selected: boolean;
  activate: () => void;
}>;

export function createDebugPanel(
  layers: DebugLayerManager,
  cameraPresets: readonly CameraPresetAction[],
  milestoneLabel = 'Milestone 0',
  invalidate: () => void = () => {},
  displayPresets: readonly DisplayPresetAction[] = [],
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

    const handleChange = (): void => {
      layers.setVisible(layer.id, input.checked);
      invalidate();
    };

    input.addEventListener('change', handleChange);
    disposers.push(() => input.removeEventListener('change', handleChange));
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
    const activatePreset = (): void => {
      preset.activate();
      invalidate();
    };

    button.addEventListener('click', activatePreset);
    disposers.push(() => button.removeEventListener('click', activatePreset));
    cameraControls.append(button);
  }

  const displayControls = document.createElement('div');
  displayControls.className = 'debug-panel__display-presets';
  displayControls.setAttribute('role', 'group');
  displayControls.setAttribute('aria-label', 'Environment time');
  const displayLabel = document.createElement('span');
  displayLabel.className = 'debug-panel__display-label';
  displayLabel.textContent = 'Environment';
  const displayButtons = document.createElement('div');
  displayButtons.className = 'debug-panel__display-buttons';
  const presetButtons = new Map<string, HTMLButtonElement>();

  for (const preset of displayPresets) {
    const button = document.createElement('button');
    button.className = 'debug-panel__button';
    button.type = 'button';
    button.dataset.displayPreset = preset.id;
    button.textContent = preset.label;
    button.setAttribute('aria-pressed', preset.selected.toString());
    const activatePreset = (): void => {
      preset.activate();

      for (const [id, presetButton] of presetButtons) {
        presetButton.setAttribute('aria-pressed', (id === preset.id).toString());
      }

      invalidate();
    };

    button.addEventListener('click', activatePreset);
    disposers.push(() => button.removeEventListener('click', activatePreset));
    presetButtons.set(preset.id, button);
    displayButtons.append(button);
  }

  displayControls.append(displayLabel, displayButtons);

  const help = document.createElement('p');
  help.className = 'debug-panel__help';
  help.textContent = 'Left drag: orbit · Right drag: pan · Wheel: zoom';

  element.append(eyebrow, title);

  if (displayPresets.length > 0) {
    element.append(displayControls);
  }

  element.append(controls, cameraControls, help);

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
