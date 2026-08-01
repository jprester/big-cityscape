import type { DebugLayerManager } from './DebugLayerManager';

export type DebugPanel = Readonly<{
  element: HTMLElement;
  dispose: () => void;
}>;

export function createDebugPanel(
  layers: DebugLayerManager,
  resetCamera: () => void,
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

  const resetButton = document.createElement('button');
  resetButton.className = 'debug-panel__button';
  resetButton.type = 'button';
  resetButton.textContent = 'Reset aerial camera';
  resetButton.addEventListener('click', resetCamera);
  disposers.push(() => resetButton.removeEventListener('click', resetCamera));

  const help = document.createElement('p');
  help.className = 'debug-panel__help';
  help.textContent = 'Left drag: pan · Right drag: orbit · Wheel: zoom';

  element.append(eyebrow, title, controls, resetButton, help);

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
