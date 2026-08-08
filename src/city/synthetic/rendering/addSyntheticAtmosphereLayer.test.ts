import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DebugLayerManager } from '../../../debug/DebugLayerManager';
import {
  addSyntheticAtmosphereLayer,
  createSyntheticAtmosphereConfig,
} from './addSyntheticAtmosphereLayer';

describe('synthetic atmosphere', () => {
  it('scales a restrained linear fog range from the city extent', () => {
    expect(createSyntheticAtmosphereConfig(2_000)).toEqual({
      backgroundColor: 0x1b2b34,
      skyHorizonGlowColor: 0x2e4a57,
      skyZenithColor: 0x030810,
      skyRadiusMetres: 4_600,
      fogNearMetres: 1_000,
      fogFarMetres: 5_000,
    });
    expect(createSyntheticAtmosphereConfig(500)).toEqual({
      backgroundColor: 0x1b2b34,
      skyHorizonGlowColor: 0x2e4a57,
      skyZenithColor: 0x030810,
      skyRadiusMetres: 1_150,
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

    const atmosphere = addSyntheticAtmosphereLayer(layers, scene, config);
    const sky = layers.root.getObjectByName('synthetic:gradient-sky-dome');

    expect(sky).toBeInstanceOf(THREE.Mesh);
    const skyMesh = sky as THREE.Mesh;
    const disposeGeometry = vi.spyOn(skyMesh.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(
      skyMesh.material as THREE.Material,
      'dispose',
    );
    expect(skyMesh.geometry.getAttribute('color')).toBeDefined();
    expect(skyMesh.geometry.getIndex()?.count).toBe(736 * 3);
    expect(skyMesh.frustumCulled).toBe(false);

    const camera = new THREE.PerspectiveCamera();
    camera.position.set(120, 340, -560);
    atmosphere.update(camera);
    expect(sky?.parent?.position.toArray()).toEqual([120, 340, -560]);

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
        label: 'Atmosphere · gradient sky + distance fog',
        visible: true,
      },
    ]);

    const initialColors = Array.from(
      skyMesh.geometry.getAttribute('color').array,
    );
    const dayConfig = {
      ...config,
      backgroundColor: 0xa9c3cf,
      skyHorizonGlowColor: 0xd9d9c8,
      skyZenithColor: 0x4f91bd,
      skyRadiusMetres: config.skyRadiusMetres * 1.1,
      fogNearMetres: 1_500,
      fogFarMetres: 6_500,
    };
    atmosphere.setConfig(dayConfig);
    expect((scene.background as THREE.Color).getHex()).toBe(
      dayConfig.backgroundColor,
    );
    expect((scene.fog as THREE.Fog).near).toBe(dayConfig.fogNearMetres);
    expect((scene.fog as THREE.Fog).far).toBe(dayConfig.fogFarMetres);
    expect(skyMesh.scale.toArray()).toEqual([1.1, 1.1, 1.1]);
    expect(Array.from(skyMesh.geometry.getAttribute('color').array)).not.toEqual(
      initialColors,
    );

    layers.setVisible('synthetic-atmosphere', false);
    expect(scene.background).toBe(inspectionBackground);
    expect(scene.fog).toBeNull();

    layers.setVisible('synthetic-atmosphere', true);
    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    expect((scene.background as THREE.Color).getHex()).toBe(
      dayConfig.backgroundColor,
    );

    layers.dispose();
    expect(scene.background).toBe(inspectionBackground);
    expect(scene.fog).toBeNull();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });

  it('rejects invalid sky configuration', () => {
    const scene = new THREE.Scene();
    const layers = new DebugLayerManager();
    const config = createSyntheticAtmosphereConfig(2_000);

    expect(() =>
      addSyntheticAtmosphereLayer(layers, scene, {
        ...config,
        skyRadiusMetres: 0,
      }),
    ).toThrow(/sky radius/);
    expect(() =>
      addSyntheticAtmosphereLayer(layers, scene, {
        ...config,
        skyHorizonGlowColor: 0x1000000,
      }),
    ).toThrow(/horizon glow color/);
  });
});
