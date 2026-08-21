import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { extractBuildingFacadeSlots } from './extract-building-facade-slots';

describe('extractBuildingFacadeSlots', () => {
  it('finds deterministic usable surfaces on all four sides of a box', () => {
    const scene = new THREE.Group();
    const geometry = new THREE.BoxGeometry(24, 40, 18);
    geometry.translate(0, 20, 0);
    scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);

    const first = extractBuildingFacadeSlots(scene, bounds);
    const second = extractBuildingFacadeSlots(scene, bounds);

    expect(second).toEqual(first);
    expect(new Set(first.map((slot) => slot.facade))).toEqual(
      new Set(['north', 'east', 'south', 'west']),
    );
    expect(first.every((slot) => slot.widthMetres >= 6)).toBe(true);
    expect(first.every((slot) => slot.heightMetres >= 6)).toBe(true);

    geometry.dispose();
  });

  it('returns no slots for an empty object', () => {
    expect(
      extractBuildingFacadeSlots(new THREE.Group(), new THREE.Box3()),
    ).toEqual([]);
  });
});
