import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DebugLayerManager } from './DebugLayerManager';

describe('DebugLayerManager', () => {
  it('notifies lazy layers only when visibility changes', () => {
    const manager = new DebugLayerManager();
    const onVisibilityChange = vi.fn();
    const dispose = vi.fn();

    manager.add({
      id: 'lazy',
      label: 'Lazy layer',
      object: new THREE.Group(),
      visible: false,
      onVisibilityChange,
      dispose,
    });

    manager.setVisible('lazy', false);
    manager.setVisible('lazy', true);
    manager.setVisible('lazy', true);
    expect(manager.toggle('lazy')).toBe(false);
    expect(onVisibilityChange.mock.calls).toEqual([[true], [false]]);

    manager.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
