import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DebugLayerManager } from '../../../debug/DebugLayerManager';
import {
  addSyntheticAtmosphereLayer,
  createSyntheticAtmosphereConfig,
} from './addSyntheticAtmosphereLayer';

describe('synthetic atmosphere', () => {
  it('scales a restrained linear fog range from the city extent', () => {
    expect(createSyntheticAtmosphereConfig(2_000)).toEqual({
      backgroundColor: 0x1b2b34,
      fogNearMetres: 1_000,
      fogFarMetres: 5_000,
    });
    expect(createSyntheticAtmosphereConfig(500)).toEqual({
      backgroundColor: 0x1b2b34,
      fogNearMetres: 250,
      fogFarMetres: 1_250,
    });
    expect(() => createSyntheticAtmosphereConfig(0)).toThrow(
      /positive and finite/,
    );
  });

  it('toggles fog and background without losing the inspection state', () => {
    const scene = new THREE.Scene();
    const inspectionBackground = new THREE.Color(0x0a1016);
    scene.background = inspectionBackground;
    const layers = new DebugLayerManager();
    const config = createSyntheticAtmosphereConfig(2_000);

    addSyntheticAtmosphereLayer(layers, scene, config);

    expect(scene.background).toBeInstanceOf(THREE.Color);
    expect((scene.background as THREE.Color).getHex()).toBe(
      config.backgroundColor,
    );
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    expect((scene.fog as THREE.Fog).near).toBe(config.fogNearMetres);
    expect((scene.fog as THREE.Fog).far).toBe(config.fogFarMetres);
    expect(layers.list()).toEqual([
      {
        id: 'synthetic-atmosphere',
        label: 'Atmosphere · fog 1.0 km–5.0 km',
        visible: true,
      },
    ]);

    layers.setVisible('synthetic-atmosphere', false);
    expect(scene.background).toBe(inspectionBackground);
    expect(scene.fog).toBeNull();

    layers.setVisible('synthetic-atmosphere', true);
    expect(scene.fog).toBeInstanceOf(THREE.Fog);

    layers.dispose();
    expect(scene.background).toBe(inspectionBackground);
    expect(scene.fog).toBeNull();
  });
});
