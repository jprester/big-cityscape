import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DebugLayerManager } from '../../../debug/DebugLayerManager';
import { addSyntheticInspectionLighting } from './addSyntheticInspectionLighting';

describe('addSyntheticInspectionLighting', () => {
  it('creates one scale-aware shared light rig', () => {
    const layers = new DebugLayerManager();

    const lighting = addSyntheticInspectionLighting(layers, 2_000);

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

    lighting.setConfig({
      hemisphereSkyColor: 0x5d7892,
      hemisphereGroundColor: 0x080b10,
      hemisphereIntensity: 0.72,
      keyColor: 0x9abce5,
      keyIntensity: 0.92,
      keyPositionScale: [0.45, 0.82, -0.35],
    });
    expect(hemisphere?.color.getHex()).toBe(0x5d7892);
    expect(hemisphere?.groundColor.getHex()).toBe(0x080b10);
    expect(hemisphere?.intensity).toBe(0.72);
    expect(key?.color.getHex()).toBe(0x9abce5);
    expect(key?.intensity).toBe(0.92);
    expect(key?.position.toArray()).toEqual([900, 1_640, -700]);

    layers.dispose();
  });

  it('rejects invalid world sizes', () => {
    expect(() =>
      addSyntheticInspectionLighting(new DebugLayerManager(), Number.NaN),
    ).toThrow(/positive and finite/);
  });
});
