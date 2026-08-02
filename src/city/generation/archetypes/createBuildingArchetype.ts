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
  heightMetres: number;
  parts: readonly BuildingMassPart[];
}>;

export type BuildingArchetypeOptions = Readonly<{
  preserveHeight?: boolean;
}>;

export function createBuildingArchetype(
  lot: OrientedRectangle,
  archetype: BuildingArchetype,
  totalHeightMetres: number,
  random: SeededRandom,
  options: BuildingArchetypeOptions = {},
): GeneratedBuildingArchetype {
  const footprint = createFootprintRectangle(lot, archetype, random);
  const heightMetres = options.preserveHeight
    ? totalHeightMetres
    : constrainHeight(footprint, archetype, totalHeightMetres);

  return {
    footprint: orientedRectangleCorners(footprint),
    heightMetres,
    parts: createParts(footprint, archetype, heightMetres, random),
  };
}

function createFootprintRectangle(
  lot: OrientedRectangle,
  archetype: BuildingArchetype,
  random: SeededRandom,
): OrientedRectangle {
  const compactLot = Math.min(lot.widthMetres, lot.depthMetres) < 12;

  switch (archetype) {
    case 'box-tower':
      return scaleOrientedRectangle(
        lot,
        random.float(compactLot ? 0.84 : 0.72, compactLot ? 0.95 : 0.88),
        random.float(compactLot ? 0.84 : 0.72, compactLot ? 0.95 : 0.88),
      );
    case 'slab':
      return lot.widthMetres >= lot.depthMetres
        ? scaleOrientedRectangle(
            lot,
            random.float(0.86, 0.96),
            random.float(compactLot ? 0.78 : 0.6, compactLot ? 0.9 : 0.74),
          )
        : scaleOrientedRectangle(
            lot,
            random.float(compactLot ? 0.78 : 0.6, compactLot ? 0.9 : 0.74),
            random.float(0.86, 0.96),
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
      if (totalHeightMetres >= 58) {
        return createSetbackTowerParts(footprint, totalHeightMetres, random);
      }

      return [createPart(footprint, 0, totalHeightMetres)];
    case 'slab':
      return [createPart(footprint, 0, totalHeightMetres)];
    case 'podium-tower': {
      if (totalHeightMetres < 34) {
        return [createPart(footprint, 0, totalHeightMetres)];
      }

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
      if (totalHeightMetres < 52) {
        return [createPart(footprint, 0, totalHeightMetres)];
      }

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

function constrainHeight(
  footprint: OrientedRectangle,
  archetype: BuildingArchetype,
  requestedHeightMetres: number,
): number {
  const minorDimension = Math.min(
    footprint.widthMetres,
    footprint.depthMetres,
  );
  const areaScale = Math.sqrt(
    footprint.widthMetres * footprint.depthMetres,
  );
  const [minorFactor, areaFactor] =
    archetype === 'slab'
      ? [3.5, 4.5]
      : archetype === 'box-tower'
        ? [4.5, 5.25]
        : archetype === 'podium-tower'
          ? [5.5, 6.5]
          : [7.5, 8];
  const maximumHeight = Math.min(
    minorDimension * minorFactor,
    areaScale * areaFactor,
  );

  return roundToTenth(Math.min(requestedHeightMetres, maximumHeight));
}

function createSetbackTowerParts(
  footprint: OrientedRectangle,
  totalHeightMetres: number,
  random: SeededRandom,
): readonly BuildingMassPart[] {
  const baseHeight = roundToTenth(clamp(totalHeightMetres * 0.1, 8, 14));
  const tower = scaleOrientedRectangle(
    footprint,
    random.float(0.78, 0.88),
    random.float(0.78, 0.88),
    random.float(-0.025, 0.025) * footprint.widthMetres,
    random.float(-0.025, 0.025) * footprint.depthMetres,
  );

  return [
    createPart(footprint, 0, baseHeight),
    createPart(tower, baseHeight, roundToTenth(totalHeightMetres - baseHeight)),
  ];
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
