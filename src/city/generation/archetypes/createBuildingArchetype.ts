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
    case 'perimeter-block':
      return scaleOrientedRectangle(lot, 0.94, 0.92);
    case 'podium-tower':
    case 'multi-tower-podium':
    case 'commercial-block':
    case 'megastructure':
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
    case 'landmark-spire':
      return scaleOrientedRectangle(lot, 0.94, 0.92);
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
    case 'perimeter-block':
      return createPerimeterBlockParts(footprint, totalHeightMetres);
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

      const crownHeightMetres = roundToTenth(
        clamp(totalHeightMetres * 0.08, 4, 12),
      );
      const towerHeightMetres = roundToTenth(
        totalHeightMetres - podiumHeightMetres - crownHeightMetres,
      );
      const crown = scaleOrientedRectangle(tower, 0.82, 0.78);

      return [
        createPart(footprint, 0, podiumHeightMetres),
        createPart(tower, podiumHeightMetres, towerHeightMetres),
        createPart(
          crown,
          podiumHeightMetres + towerHeightMetres,
          crownHeightMetres,
        ),
      ];
    }
    case 'multi-tower-podium':
      return createMultiTowerPodiumParts(
        footprint,
        totalHeightMetres,
        random,
      );
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
    case 'commercial-block':
      return createCommercialBlockParts(footprint, totalHeightMetres, random);
    case 'megastructure':
      return createMegastructureParts(footprint, totalHeightMetres);
    case 'landmark-spire':
      return createLandmarkSpireParts(footprint, totalHeightMetres, random);
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
  const factors: Readonly<Record<BuildingArchetype, readonly [number, number]>> = {
    'box-tower': [4.5, 5.25],
    slab: [3.5, 4.5],
    'perimeter-block': [2.2, 3],
    'podium-tower': [5.5, 6.5],
    'multi-tower-podium': [6.25, 7],
    'stepped-tower': [7.5, 8],
    'commercial-block': [3.25, 4],
    megastructure: [4.25, 5],
    'landmark-spire': [9, 10],
  };
  const [minorFactor, areaFactor] = factors[archetype];
  const maximumHeight = Math.min(
    minorDimension * minorFactor,
    areaScale * areaFactor,
  );

  return roundToTenth(Math.min(requestedHeightMetres, maximumHeight));
}

function createPerimeterBlockParts(
  footprint: OrientedRectangle,
  totalHeightMetres: number,
): readonly BuildingMassPart[] {
  const depthBarScale = 0.22;
  const widthBarScale = 0.2;
  const depthOffset = footprint.depthMetres * (0.5 - depthBarScale / 2);
  const widthOffset = footprint.widthMetres * (0.5 - widthBarScale / 2);
  const secondaryHeight = roundToTenth(totalHeightMetres * 0.78);

  return [
    createPart(
      scaleOrientedRectangle(footprint, 1, depthBarScale, 0, -depthOffset),
      0,
      totalHeightMetres,
    ),
    createPart(
      scaleOrientedRectangle(footprint, 1, depthBarScale, 0, depthOffset),
      0,
      secondaryHeight,
    ),
    createPart(
      scaleOrientedRectangle(footprint, widthBarScale, 0.56, -widthOffset, 0),
      0,
      secondaryHeight,
    ),
    createPart(
      scaleOrientedRectangle(footprint, widthBarScale, 0.56, widthOffset, 0),
      0,
      roundToTenth(totalHeightMetres * 0.9),
    ),
  ];
}

function createMultiTowerPodiumParts(
  footprint: OrientedRectangle,
  totalHeightMetres: number,
  random: SeededRandom,
): readonly BuildingMassPart[] {
  if (totalHeightMetres < 54) {
    return createCommercialBlockParts(footprint, totalHeightMetres, random);
  }

  const podiumHeight = roundToTenth(clamp(totalHeightMetres * 0.075, 9, 18));
  const primary = scaleOrientedRectangle(
    footprint,
    0.34,
    0.52,
    -footprint.widthMetres * 0.22,
    footprint.depthMetres * 0.06,
  );
  const secondary = scaleOrientedRectangle(
    footprint,
    0.3,
    0.46,
    footprint.widthMetres * 0.24,
    -footprint.depthMetres * 0.08,
  );
  const crownHeight = roundToTenth(clamp(totalHeightMetres * 0.055, 4, 10));
  const primaryBodyHeight = roundToTenth(
    totalHeightMetres - podiumHeight - crownHeight,
  );
  const secondaryTop = roundToTenth(totalHeightMetres * random.float(0.62, 0.76));

  return [
    createPart(footprint, 0, podiumHeight),
    createPart(primary, podiumHeight, primaryBodyHeight),
    createPart(
      scaleOrientedRectangle(primary, 0.8, 0.78),
      podiumHeight + primaryBodyHeight,
      crownHeight,
    ),
    createPart(secondary, podiumHeight, secondaryTop - podiumHeight),
  ];
}

function createCommercialBlockParts(
  footprint: OrientedRectangle,
  totalHeightMetres: number,
  random: SeededRandom,
): readonly BuildingMassPart[] {
  if (totalHeightMetres < 22) {
    return [createPart(footprint, 0, totalHeightMetres)];
  }

  const baseHeight = roundToTenth(clamp(totalHeightMetres * 0.32, 8, 18));
  const upper = scaleOrientedRectangle(
    footprint,
    0.82,
    0.66,
    random.float(-0.04, 0.04) * footprint.widthMetres,
    random.float(-0.08, 0.08) * footprint.depthMetres,
  );
  const roof = scaleOrientedRectangle(upper, 0.72, 0.68);
  const roofHeight = roundToTenth(clamp(totalHeightMetres * 0.12, 3, 8));

  return [
    createPart(footprint, 0, baseHeight),
    createPart(upper, baseHeight, totalHeightMetres - baseHeight - roofHeight),
    createPart(roof, totalHeightMetres - roofHeight, roofHeight),
  ];
}

function createMegastructureParts(
  footprint: OrientedRectangle,
  totalHeightMetres: number,
): readonly BuildingMassPart[] {
  const baseHeight = roundToTenth(clamp(totalHeightMetres * 0.16, 12, 24));
  const spine = scaleOrientedRectangle(footprint, 0.88, 0.32);
  const left = scaleOrientedRectangle(
    footprint,
    0.3,
    0.58,
    -footprint.widthMetres * 0.25,
    0,
  );
  const right = scaleOrientedRectangle(
    footprint,
    0.3,
    0.58,
    footprint.widthMetres * 0.25,
    0,
  );

  return [
    createPart(footprint, 0, baseHeight),
    createPart(spine, baseHeight, roundToTenth(totalHeightMetres * 0.38)),
    createPart(left, baseHeight, roundToTenth(totalHeightMetres - baseHeight)),
    createPart(
      right,
      baseHeight,
      roundToTenth(totalHeightMetres * 0.78 - baseHeight),
    ),
  ];
}

function createLandmarkSpireParts(
  footprint: OrientedRectangle,
  totalHeightMetres: number,
  random: SeededRandom,
): readonly BuildingMassPart[] {
  const podiumHeight = roundToTenth(clamp(totalHeightMetres * 0.045, 12, 18));
  const lower = scaleOrientedRectangle(footprint, 0.88, 0.84);
  const middle = scaleOrientedRectangle(
    lower,
    0.82,
    0.8,
    footprint.widthMetres * 0.025,
    0,
  );
  const upper = scaleOrientedRectangle(
    middle,
    0.78,
    0.74,
    random.float(-0.02, 0.02) * footprint.widthMetres,
    0,
  );
  const lowerHeight = roundToTenth(totalHeightMetres * 0.48);
  const middleHeight = roundToTenth(totalHeightMetres * 0.27);
  const upperHeight = roundToTenth(
    totalHeightMetres - podiumHeight - lowerHeight - middleHeight,
  );

  return [
    createPart(footprint, 0, podiumHeight),
    createPart(lower, podiumHeight, lowerHeight),
    createPart(middle, podiumHeight + lowerHeight, middleHeight),
    createPart(upper, podiumHeight + lowerHeight + middleHeight, upperHeight),
  ];
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
