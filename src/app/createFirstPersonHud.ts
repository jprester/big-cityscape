export type FirstPersonHud = Readonly<{
  element: HTMLElement;
  setActive: (active: boolean) => void;
  dispose: () => void;
}>;

export function createFirstPersonHud(): FirstPersonHud {
  const element = document.createElement('aside');
  element.className = 'first-person-hud';
  element.hidden = true;
  element.setAttribute('aria-label', 'First-person walking controls');
  const crosshair = document.createElement('span');
  crosshair.className = 'first-person-hud__crosshair';
  crosshair.setAttribute('aria-hidden', 'true');
  const help = document.createElement('p');
  help.className = 'first-person-hud__help';
  help.textContent = 'WASD / arrows: walk · Shift: faster · Mouse: look · Esc: exit';
  element.append(crosshair, help);

  return {
    element,
    setActive: (active) => {
      element.hidden = !active;
    },
    dispose: () => element.remove(),
  };
}
