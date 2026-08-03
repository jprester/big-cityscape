import { describe, expect, it } from 'vitest';
import type { BuildingDefinition } from '../model/cityMassing';
import type { Point2 } from '../model/processedCity';
import {
  enforceTallBuildingClearance,
  type TallBuildingClearanceConfig,
} from './enforceTallBuildingClearance';

const CONFIG: TallBuildingClearanceConfig = {
  minimumHeightMetres: 60,
  minimumSetbackMetres: 8,
  maximumSetbackMetres: 24,
  heightToSetbackRatio: 0.1,
};

describe('enforceTallBuildingClearance', () => {
  it('removes lower neighbors inside a tall building setback', () => {
    const tower = createBuilding('tower', [0, 0], 100);
    const near = createBuilding('near', [13, 0], 25);
    const far = createBuilding('far', [21, 0], 25);

    expect(
      enforceTallBuildingClearance([tower, near, far], CONFIG).map(
        (building) => building.id,
      ),
    ).toEqual(['tower', 'far']);
  });

  it('keeps the taller building when tower setbacks compete', () => {
    const taller = createBuilding('taller', [0, 0], 140);
    const shorter = createBuilding('shorter', [16, 0], 90);
    const first = enforceTallBuildingClearance([shorter, taller], CONFIG);
    const repeated = enforceTallBuildingClearance([taller, shorter], CONFIG);

    expect(first.map((building) => building.id)).toEqual(['taller']);
    expect(repeated.map((building) => building.id)).toEqual(['taller']);
  });

  it('does not create setbacks around low and mid-rise buildings', () => {
    const buildings = [
      createBuilding('first', [0, 0], 45),
      createBuilding('second', [7, 0], 25),
    ];

    expect(enforceTallBuildingClearance(buildings, CONFIG)).toEqual(buildings);
  });
});

function createBuilding(
  id: string,
  center: Point2,
  heightMetres: number,
): BuildingDefinition {
  const footprint = createRectangle(center, 8, 8);

  return {
    id,
    source: 'residual-fabric',
    blockId: 'test-block',
    regionId: `region:${id}`,
    districtId: 'test-district',
    seed: 1,
    role: 'background',
    archetype: 'slab',
    material: 'mixed-use',
    footprint,
    heightMetres,
    parts: [
      {
        center,
        widthMetres: 8,
        depthMetres: 8,
        baseHeightMetres: 0,
        heightMetres,
        rotationRadians: 0,
      },
    ],
  };
}

function createRectangle(
  [centerX, centerZ]: Point2,
  widthMetres: number,
  depthMetres: number,
): readonly Point2[] {
  const halfWidth = widthMetres / 2;
  const halfDepth = depthMetres / 2;
  return [
    [centerX - halfWidth, centerZ - halfDepth],
    [centerX + halfWidth, centerZ - halfDepth],
    [centerX + halfWidth, centerZ + halfDepth],
    [centerX - halfWidth, centerZ + halfDepth],
  ];
}
