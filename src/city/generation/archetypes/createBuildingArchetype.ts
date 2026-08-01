import type { SeededRandom } from '../../../core/random';
import type {
  BuildingArchetype,
  BuildingMassPart,
} from '../../model/cityMassing';
import type { Point2 } from '../../model/processedCity';
import {
  orientedRectangleCorners,
  scaleOrientedRectangle,
  type OrientedRectangle,
} from '../blockPlacement';

export type GeneratedBuildingArchetype = Readonly<{
  footprint: readonly Point2[];
  parts: readonly BuildingMassPart[];
}>;

export function createBuildingArchetype(
  lot: OrientedRectangle,
  archetype: BuildingArchetype,
  totalHeightMetres: number,
  random: SeededRandom,
): GeneratedBuildingArchetype {
  const footprint = createFootprintRectangle(lot, archetype, random);

  return {
    footprint: orientedRectangleCorners(footprint),
    parts: createParts(footprint, archetype, totalHeightMetres, random),
  };
}

function createFootprintRectangle(
  lot: OrientedRectangle,
  archetype: BuildingArchetype,
  random: SeededRandom,
): OrientedRectangle {
  switch (archetype) {
    case 'box-tower':
      return scaleOrientedRectangle(
        lot,
        random.float(0.68, 0.82),
        random.float(0.68, 0.82),
      );
    case 'slab':
      return lot.widthMetres >= lot.depthMetres
        ? scaleOrientedRectangle(
            lot,
            random.float(0.82, 0.92),
            random.float(0.52, 0.64),
          )
        : scaleOrientedRectangle(
            lot,
            random.float(0.52, 0.64),
            random.float(0.82, 0.92),
          );
    case 'podium-tower':
      return scaleOrientedRectangle(
        lot,
        random.float(0.88, 0.96),
        random.float(0.8, 0.9),
      );
    case 'stepped-tower':
      return scaleOrientedRectangle(
        lot,
        random.float(0.68, 0.8),
        random.float(0.66, 0.78),
      );
  }
}

function createParts(
  footprint: OrientedRectangle,
  archetype: BuildingArchetype,
  totalHeightMetres: number,
  random: SeededRandom,
): readonly BuildingMassPart[] {
  switch (archetype) {
    case 'box-tower':
    case 'slab':
      return [createPart(footprint, 0, totalHeightMetres)];
    case 'podium-tower': {
      const podiumHeightMetres = roundToTenth(
        clamp(totalHeightMetres * 0.085, 8, 16),
      );
      const tower = scaleOrientedRectangle(
        footprint,
        random.float(0.68, 0.78),
        random.float(0.66, 0.76),
        random.float(-0.04, 0.04) * footprint.widthMetres,
        random.float(-0.035, 0.035) * footprint.depthMetres,
      );

      return [
        createPart(footprint, 0, podiumHeightMetres),
        createPart(
          tower,
          podiumHeightMetres,
          roundToTenth(totalHeightMetres - podiumHeightMetres),
        ),
      ];
    }
    case 'stepped-tower': {
      const lowerHeight = roundToTenth(totalHeightMetres * 0.42);
      const middleHeight = roundToTenth(totalHeightMetres * 0.33);
      const upperHeight = roundToTenth(totalHeightMetres - lowerHeight - middleHeight);
      const middle = scaleOrientedRectangle(
        footprint,
        0.82,
        0.78,
        footprint.widthMetres * 0.035,
        0,
      );
      const upper = scaleOrientedRectangle(
        footprint,
        0.64,
        0.6,
        footprint.widthMetres * 0.085,
        footprint.depthMetres * 0.025,
      );

      return [
        createPart(footprint, 0, lowerHeight),
        createPart(middle, lowerHeight, middleHeight),
        createPart(upper, lowerHeight + middleHeight, upperHeight),
      ];
    }
  }
}

function createPart(
  rectangle: OrientedRectangle,
  baseHeightMetres: number,
  heightMetres: number,
): BuildingMassPart {
  return {
    center: rectangle.center,
    widthMetres: rectangle.widthMetres,
    depthMetres: rectangle.depthMetres,
    baseHeightMetres: roundToTenth(baseHeightMetres),
    heightMetres: roundToTenth(heightMetres),
    rotationRadians: rectangle.rotationRadians,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}
