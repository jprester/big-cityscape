import { expect, it } from 'vitest';
import { reviewedWalkSpawn } from './reviewedWalkSpawn';

it('finds a repeatable clear spawn when the map centre contains a building', () => {
  const bounds = {minX:-100,maxX:100,minZ:-100,maxZ:100};
  const colliders = [{id:'tower',minX:-15,maxX:15,minZ:-15,maxZ:15}];
  const spawn = reviewedWalkSpawn(bounds, colliders);
  expect(spawn).toEqual(reviewedWalkSpawn(bounds, colliders));
  expect(Math.abs(spawn[0]) >= 16 || Math.abs(spawn[2]) >= 16).toBe(true);
  expect(spawn[1]).toBe(1.8);
});

it('reports a completely obstructed map rather than spawning inside a building', () => {
  const bounds = {minX:-10,maxX:10,minZ:-10,maxZ:10};
  expect(() => reviewedWalkSpawn(bounds, [{id:'solid',...bounds}])).toThrow('no clear walking spawn');
});
