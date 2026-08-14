import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DebugLayerManager } from '../../../debug/DebugLayerManager';
import type { SyntheticStreetLampDefinition } from '../model/streetLamp';
import {
  addSyntheticStreetLampLayer,
  DEFAULT_SYNTHETIC_STREET_LAMP_CONFIG,
} from './addSyntheticStreetLampLayer';

const lamps: readonly SyntheticStreetLampDefinition[] = [
  {
    id: 'lamp-a',
    streetId: 'street',
    hierarchyId: 'arterial',
    position: [0, 0],
    facing: [1, 0],
    heightMetres: 7.2,
  },
  {
    id: 'lamp-b',
    streetId: 'street',
    hierarchyId: 'secondary',
    position: [20, 0],
    facing: [-1, 0],
    heightMetres: 5.8,
  },
];

describe('addSyntheticStreetLampLayer', () => {
  it('batches fixtures, bulbs, and pools into three draws', () => {
    const layers = new DebugLayerManager();
    const layer = addSyntheticStreetLampLayer(layers, lamps);

    expect(layer.stats).toMatchObject({
      lamps: 2,
      drawCalls: 3,
      maximumRealLights: 8,
    });
    expect(layer.stats.triangles).toBeGreaterThan(0);
    expect(layers.list()).toEqual([
      {
        id: 'street-lamps',
        label: '2 street lamps · 8 nearby real lights max',
        visible: true,
      },
    ]);

    layers.dispose();
  });

  it('activates only the configured nearest real lights', () => {
    const layers = new DebugLayerManager();
    const layer = addSyntheticStreetLampLayer(layers, lamps, {
      ...DEFAULT_SYNTHETIC_STREET_LAMP_CONFIG,
      realLightCount: 1,
      realLightDistanceMetres: 30,
    });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(2, 1.8, 0);
    layer.update(camera);
    const group = layers.root.getObjectByName('synthetic:street-lamps');
    const activeLights = group?.children.filter(
      (child) => child instanceof THREE.PointLight && child.visible,
    );

    expect(activeLights).toHaveLength(1);
    expect(activeLights?.[0]?.position.x).toBeCloseTo(1.35);

    layer.setConfig({
      ...DEFAULT_SYNTHETIC_STREET_LAMP_CONFIG,
      realLightCount: 0,
    });
    layer.update(camera);
    expect(
      group?.children.filter(
        (child) => child instanceof THREE.PointLight && child.visible,
      ),
    ).toHaveLength(0);
    layers.dispose();
  });

  it('rejects an excessive real-light count', () => {
    const layers = new DebugLayerManager();

    expect(() =>
      addSyntheticStreetLampLayer(layers, lamps, {
        ...DEFAULT_SYNTHETIC_STREET_LAMP_CONFIG,
        realLightCount: 9,
      }),
    ).toThrow(/configuration is invalid/);
  });
});
