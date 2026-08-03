import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../../core/random';
import type { OrientedRectangle } from '../blockPlacement';
import { createBuildingArchetype } from './createBuildingArchetype';

const COMPACT_LOT: OrientedRectangle = {
  center: [12, -8],
  widthMetres: 10,
  depthMetres: 8,
  rotationRadians: 0.3,
};

describe('createBuildingArchetype', () => {
  it('fills most of a compact fabric lot with a viable slab floor plate', () => {
    const building = createBuildingArchetype(
      COMPACT_LOT,
      'slab',
      24,
      createSeededRandom(17),
    );
    const part = building.parts[0];

    expect(part).toBeDefined();
    expect(part?.widthMetres).toBeGreaterThanOrEqual(COMPACT_LOT.widthMetres * 0.78);
    expect(part?.depthMetres).toBeGreaterThanOrEqual(COMPACT_LOT.depthMetres * 0.78);
  });

  it('caps an implausibly tall narrow slab from its generated floor plate', () => {
    const building = createBuildingArchetype(
      COMPACT_LOT,
      'slab',
      180,
      createSeededRandom(23),
    );
    const part = building.parts[0];
    const minorDimension = Math.min(
      part?.widthMetres ?? 0,
      part?.depthMetres ?? 0,
    );

    expect(building.heightMetres).toBeLessThan(40);
    expect(building.heightMetres).toBeLessThanOrEqual(minorDimension * 3.5 + 0.1);
  });

  it('gives a tall box a simple broad base and setback tower', () => {
    const building = createBuildingArchetype(
      { ...COMPACT_LOT, widthMetres: 30, depthMetres: 28 },
      'box-tower',
      120,
      createSeededRandom(31),
    );

    expect(building.parts).toHaveLength(2);
    expect(building.parts[1]?.widthMetres).toBeLessThan(
      building.parts[0]?.widthMetres ?? 0,
    );
    expect(building.parts[1]?.depthMetres).toBeLessThan(
      building.parts[0]?.depthMetres ?? 0,
    );
  });

  it('preserves the explicit height of a manually selected landmark', () => {
    const building = createBuildingArchetype(
      COMPACT_LOT,
      'landmark-spire',
      340,
      createSeededRandom(47),
      { preserveHeight: true },
    );

    expect(building.heightMetres).toBe(340);
    expect(building.parts).toHaveLength(4);
  });

  it('composes a perimeter block around an open centre', () => {
    const building = createBuildingArchetype(
      { ...COMPACT_LOT, widthMetres: 72, depthMetres: 54 },
      'perimeter-block',
      38,
      createSeededRandom(53),
    );

    expect(building.parts).toHaveLength(4);
    expect(
      building.parts.every(
        (part) =>
          part.widthMetres < building.parts[0]!.widthMetres ||
          part.depthMetres < building.parts[2]!.depthMetres,
      ),
    ).toBe(true);
  });

  it('builds a shared podium with a dominant and secondary tower', () => {
    const building = createBuildingArchetype(
      { ...COMPACT_LOT, widthMetres: 80, depthMetres: 58 },
      'multi-tower-podium',
      180,
      createSeededRandom(59),
    );

    expect(building.parts).toHaveLength(4);
    expect(building.parts[0]?.baseHeightMetres).toBe(0);
    expect(building.parts[1]?.heightMetres).toBeGreaterThan(
      building.parts[3]?.heightMetres ?? 0,
    );
  });
});
