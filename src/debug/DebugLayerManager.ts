import * as THREE from 'three';

export type DebugLayerDefinition = Readonly<{
  id: string;
  label: string;
  object: THREE.Object3D;
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  dispose?: () => void;
}>;

export type DebugLayerState = Readonly<{
  id: string;
  label: string;
  visible: boolean;
}>;

type DebugLayerRecord = Readonly<{
  label: string;
  object: THREE.Object3D;
  onVisibilityChange?: (visible: boolean) => void;
  dispose?: () => void;
}>;

/**
 * Owns render-only inspection layers. Domain and generation data must live
 * outside this manager and should only be visualized here by dedicated views.
 */
export class DebugLayerManager {
  readonly root = new THREE.Group();

  readonly #layers = new Map<string, DebugLayerRecord>();

  constructor() {
    this.root.name = 'debug-layers';
  }

  add(definition: DebugLayerDefinition): void {
    const id = definition.id.trim();

    if (id.length === 0) {
      throw new Error('A debug layer must have a non-empty ID.');
    }

    if (this.#layers.has(id)) {
      throw new Error(`A debug layer with the ID "${id}" already exists.`);
    }

    definition.object.name = definition.object.name || `debug:${id}`;
    definition.object.visible = definition.visible ?? true;
    this.root.add(definition.object);
    this.#layers.set(id, {
      label: definition.label,
      object: definition.object,
      ...(definition.onVisibilityChange === undefined
        ? {}
        : { onVisibilityChange: definition.onVisibilityChange }),
      ...(definition.dispose === undefined ? {} : { dispose: definition.dispose }),
    });
  }

  list(): readonly DebugLayerState[] {
    return Array.from(this.#layers, ([id, layer]) => ({
      id,
      label: layer.label,
      visible: layer.object.visible,
    }));
  }

  setVisible(id: string, visible: boolean): void {
    const layer = this.#getLayer(id);

    if (layer.object.visible === visible) {
      return;
    }

    layer.object.visible = visible;
    layer.onVisibilityChange?.(visible);
  }

  isVisible(id: string): boolean {
    return this.#getLayer(id).object.visible;
  }

  toggle(id: string): boolean {
    const layer = this.#getLayer(id);
    const visible = !layer.object.visible;
    this.setVisible(id, visible);
    return visible;
  }

  dispose(): void {
    for (const layer of this.#layers.values()) {
      this.root.remove(layer.object);
      layer.dispose?.();
    }

    this.#layers.clear();
    this.root.removeFromParent();
  }

  #getLayer(id: string): DebugLayerRecord {
    const layer = this.#layers.get(id);

    if (layer === undefined) {
      throw new Error(`Unknown debug layer: "${id}".`);
    }

    return layer;
  }
}
