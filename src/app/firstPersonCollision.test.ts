import { describe, expect, it } from 'vitest';
import {
  createFirstPersonCollisionIndex,
  isFirstPersonPositionBlocked,
  resolveFirstPersonHorizontalMovement,
  type FirstPersonCollisionBounds,
} from './firstPersonCollision';

const wall: FirstPersonCollisionBounds = {
  id: 'wall',
  minX: 2,
  maxX: 4,
  minZ: -10,
  maxZ: 10,
};

describe('first-person collision', () => {
  it('prevents fast movement from tunnelling through a building', () => {
    const index = createFirstPersonCollisionIndex([wall], 10);
    const result = resolveFirstPersonHorizontalMovement(
      [0, 0],
      [8, 0],
      index,
      0.4,
      0.2,
    );

    expect(result[0]).toBeCloseTo(1.6, 8);
    expect(result[1]).toBe(0);
    expect(isFirstPersonPositionBlocked(result, index, 0.4)).toBe(false);
  });

  it('prevents fast movement from tunnelling through a narrow lamp pole', () => {
    const poleHalfWidth = 0.13 / 2;
    const index = createFirstPersonCollisionIndex(
      [
        {
          id: 'street-lamp:test',
          minX: 2 - poleHalfWidth,
          maxX: 2 + poleHalfWidth,
          minZ: -poleHalfWidth,
          maxZ: poleHalfWidth,
        },
      ],
      10,
    );
    const result = resolveFirstPersonHorizontalMovement(
      [0, 0],
      [4, 0],
      index,
      0.38,
      0.1,
    );

    expect(result[0]).toBeGreaterThan(1.3);
    expect(result[0]).toBeLessThanOrEqual(2 - poleHalfWidth - 0.38);
    expect(isFirstPersonPositionBlocked(result, index, 0.38)).toBe(false);
  });

  it('slides along the open axis when diagonal movement meets a wall', () => {
    const index = createFirstPersonCollisionIndex([wall], 10);
    const result = resolveFirstPersonHorizontalMovement(
      [0, 0],
      [4, 3],
      index,
      0.4,
      0.2,
    );

    expect(result[0]).toBeLessThanOrEqual(1.6 + 1e-9);
    expect(result[1]).toBeCloseTo(3, 8);
  });

  it('is independent of incoming collider order and supports negative cells', () => {
    const colliders: readonly FirstPersonCollisionBounds[] = [
      wall,
      { id: 'negative', minX: -12, maxX: -8, minZ: -3, maxZ: 3 },
    ];
    const first = createFirstPersonCollisionIndex(colliders, 5);
    const reordered = createFirstPersonCollisionIndex(
      [...colliders].reverse(),
      5,
    );
    const movement = [[-5, 0], [-10, 0]] as const;

    expect(
      resolveFirstPersonHorizontalMovement(
        movement[0],
        movement[1],
        reordered,
        0.4,
        0.2,
      ),
    ).toEqual(
      resolveFirstPersonHorizontalMovement(
        movement[0],
        movement[1],
        first,
        0.4,
        0.2,
      ),
    );
  });

  it('passes through an empty collision index unchanged', () => {
    const index = createFirstPersonCollisionIndex([], 100);

    expect(
      resolveFirstPersonHorizontalMovement(
        [1, 2],
        [3, -4],
        index,
        0.4,
        0.2,
      ),
    ).toEqual([4, -2]);
  });

  it('rejects invalid bounds and duplicate IDs', () => {
    expect(() =>
      createFirstPersonCollisionIndex(
        [{ ...wall, maxX: wall.minX }],
        10,
      ),
    ).toThrow(/positive area/);
    expect(() => createFirstPersonCollisionIndex([wall, wall], 10)).toThrow(
      /Duplicate/,
    );
  });
});
