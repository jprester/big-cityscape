import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DebugLayerManager } from '../../../debug/DebugLayerManager';
import { addSyntheticInspectionLighting } from './addSyntheticInspectionLighting';

describe('addSyntheticInspectionLighting', () => {
  it('creates one scale-aware shared light rig', () => {
    const layers = new DebugLayerManager();

    addSyntheticInspectionLighting(layers, 2_000);

    const group = layers.root.getObjectByName('synthetic:inspection-lighting');
    const hemisphere = group?.children.find(
      (child): child is THREE.HemisphereLight =>
        child instanceof THREE.HemisphereLight,
    );
    const key = group?.children.find(
      (child): child is THREE.DirectionalLight =>
        child instanceof THREE.DirectionalLight,
    );

    expect(hemisphere?.intensity).toBe(2.15);
    expect(key?.intensity).toBe(2.65);
    expect(key?.position.toArray()).toEqual([-1_100, 1_800, 1_300]);
    expect(layers.list()).toEqual([
      {
        id: 'synthetic-lighting',
        label: 'Atmospheric inspection lighting',
        visible: true,
      },
    ]);

    layers.dispose();
  });

  it('rejects invalid world sizes', () => {
    expect(() =>
      addSyntheticInspectionLighting(new DebugLayerManager(), Number.NaN),
    ).toThrow(/positive and finite/);
  });
});
