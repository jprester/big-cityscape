import { describe, expect, it } from 'vitest';
import {
  calculateFirstPersonLook,
  calculateFirstPersonTravel,
  clampFirstPersonPosition,
} from './firstPersonMovement';

describe('first-person movement', () => {
  it('turns from pointer deltas and clamps vertical look', () => {
    expect(calculateFirstPersonLook(0.5, 0.2, 100, -1_000, 0.002, 1.5)).toEqual({
      yawRadians: 0.3,
      pitchRadians: 1.5,
    });
  });

  it('normalizes diagonal travel to the configured speed', () => {
    const travel = calculateFirstPersonTravel(1, 1, 8, 0.5);

    expect(Math.hypot(travel.forwardMetres, travel.rightMetres)).toBeCloseTo(4);
    expect(travel.forwardMetres).toBeCloseTo(travel.rightMetres);
  });

  it('preserves partial analogue input below unit length', () => {
    expect(calculateFirstPersonTravel(0.5, 0, 10, 0.2)).toEqual({
      forwardMetres: 1,
      rightMetres: 0,
    });
  });

  it('clamps horizontal movement and restores eye height', () => {
    expect(
      clampFirstPersonPosition(
        [-20, 80, 25],
        { minX: -10, maxX: 10, minZ: -12, maxZ: 12 },
        1.8,
        2,
      ),
    ).toEqual([-8, 1.8, 10]);
  });

  it('rejects an inset that consumes the walkable bounds', () => {
    expect(() =>
      clampFirstPersonPosition(
        [0, 0, 0],
        { minX: -1, maxX: 1, minZ: -1, maxZ: 1 },
        1.8,
        2,
      ),
    ).toThrow('consumes the view bounds');
  });
});
