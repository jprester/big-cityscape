import type { SyntheticBounds2 } from '../model/proofDistrict';
import type {
  SyntheticRoadMarking,
  SyntheticRoadMarkingPlan,
} from '../model/roadMarking';
import type { SyntheticStreetCorridor } from '../model/streetCorridor';

const CENTRE_LINE_WIDTH_METRES = 0.45;
const CENTRE_LINE_DASH_LENGTH_METRES = 9;
const CENTRE_LINE_REPEAT_METRES = 18;
const INTERSECTION_CLEARANCE_METRES = 34;
const CROSSWALK_BAR_COUNT = 6;
const CROSSWALK_BAR_THICKNESS_METRES = 0.8;
const CROSSWALK_BAR_SPACING_METRES = 1.8;
const CROSSWALK_EDGE_OFFSET_METRES = 6;
const CROSSWALK_SIDE_INSET_METRES = 4;

type ArterialIntersection = Readonly<{
  id: string;
  vertical: SyntheticStreetCorridor;
  horizontal: SyntheticStreetCorridor;
  center: readonly [xMetres: number, zMetres: number];
}>;

export function deriveSyntheticRoadMarkings(
  cityId: string,
  streets: readonly SyntheticStreetCorridor[],
): SyntheticRoadMarkingPlan {
  if (cityId.trim().length === 0) {
    throw new Error('Road-marking derivation requires a city ID.');
  }

  const verticalArterials = majorArterials(streets, 'north-south');
  const horizontalArterials = majorArterials(streets, 'east-west');
  const intersections = createIntersections(
    cityId,
    verticalArterials,
    horizontalArterials,
  );
  const centreLineDashes = [
    ...verticalArterials.flatMap((road) =>
      createCentreLineDashes(road, intersections),
    ),
    ...horizontalArterials.flatMap((road) =>
      createCentreLineDashes(road, intersections),
    ),
  ];
  const crosswalkBars = intersections.flatMap(createCrosswalkBars);

  return {
    markings: [...centreLineDashes, ...crosswalkBars],
    metadata: {
      centreLineDashCount: centreLineDashes.length,
      crosswalkBarCount: crosswalkBars.length,
      markedIntersectionCount: intersections.length,
    },
  };
}

function majorArterials(
  streets: readonly SyntheticStreetCorridor[],
  axis: 'north-south' | 'east-west',
): readonly SyntheticStreetCorridor[] {
  return streets
    .filter(
      (street) =>
        street.hierarchyId === 'arterial' &&
        street.context === 'district-boundary' &&
        street.axis === axis,
    )
    .toSorted((first, second) =>
      axis === 'north-south'
        ? centerX(first.bounds) - centerX(second.bounds)
        : centerZ(first.bounds) - centerZ(second.bounds),
    );
}

function createIntersections(
  cityId: string,
  verticalArterials: readonly SyntheticStreetCorridor[],
  horizontalArterials: readonly SyntheticStreetCorridor[],
): readonly ArterialIntersection[] {
  return horizontalArterials.flatMap((horizontal, row) =>
    verticalArterials.map((vertical, column) => ({
      id: `${cityId}/arterial-intersection-r${row}-c${column}`,
      vertical,
      horizontal,
      center: [centerX(vertical.bounds), centerZ(horizontal.bounds)],
    })),
  );
}

function createCentreLineDashes(
  road: SyntheticStreetCorridor,
  intersections: readonly ArterialIntersection[],
): readonly SyntheticRoadMarking[] {
  const northSouth = road.axis === 'north-south';
  const minimum = northSouth ? road.bounds.minZ : road.bounds.minX;
  const maximum = northSouth ? road.bounds.maxZ : road.bounds.maxX;
  const fixedCenter = northSouth
    ? centerX(road.bounds)
    : centerZ(road.bounds);
  const crossingCoordinates = intersections
    .filter((intersection) =>
      northSouth
        ? intersection.vertical.id === road.id
        : intersection.horizontal.id === road.id,
    )
    .map((intersection) =>
      northSouth ? intersection.center[1] : intersection.center[0],
    );
  const markings: SyntheticRoadMarking[] = [];
  let sourceIndex = 0;

  for (
    let center = minimum + CENTRE_LINE_REPEAT_METRES / 2;
    center <= maximum - CENTRE_LINE_REPEAT_METRES / 2;
    center += CENTRE_LINE_REPEAT_METRES
  ) {
    const markingIndex = sourceIndex;
    sourceIndex += 1;

    if (
      crossingCoordinates.some(
        (crossing) =>
          Math.abs(center - crossing) < INTERSECTION_CLEARANCE_METRES,
      )
    ) {
      continue;
    }

    markings.push({
      id: `${road.id}/marking-centre-line-${markingIndex}`,
      kind: 'centre-line-dash',
      bounds: northSouth
        ? boundsFromCenter(
            fixedCenter,
            center,
            CENTRE_LINE_WIDTH_METRES,
            CENTRE_LINE_DASH_LENGTH_METRES,
          )
        : boundsFromCenter(
            center,
            fixedCenter,
            CENTRE_LINE_DASH_LENGTH_METRES,
            CENTRE_LINE_WIDTH_METRES,
          ),
    });
  }

  return markings;
}

function createCrosswalkBars(
  intersection: ArterialIntersection,
): readonly SyntheticRoadMarking[] {
  const [centerXMetres, centerZMetres] = intersection.center;
  const verticalRoadWidth =
    intersection.vertical.bounds.maxX - intersection.vertical.bounds.minX;
  const horizontalRoadWidth =
    intersection.horizontal.bounds.maxZ - intersection.horizontal.bounds.minZ;
  const horizontalBarLength =
    verticalRoadWidth - CROSSWALK_SIDE_INSET_METRES * 2;
  const verticalBarLength =
    horizontalRoadWidth - CROSSWALK_SIDE_INSET_METRES * 2;
  const northSouthOffset =
    horizontalRoadWidth / 2 + CROSSWALK_EDGE_OFFSET_METRES;
  const eastWestOffset =
    verticalRoadWidth / 2 + CROSSWALK_EDGE_OFFSET_METRES;
  const bars: SyntheticRoadMarking[] = [];

  for (const [side, direction] of [
    ['north', 1],
    ['south', -1],
  ] as const) {
    for (let index = 0; index < CROSSWALK_BAR_COUNT; index += 1) {
      const repeatOffset = centeredRepeatOffset(index);
      const z = centerZMetres + direction * northSouthOffset + repeatOffset;
      bars.push({
        id: `${intersection.id}/crosswalk-${side}-bar-${index}`,
        kind: 'crosswalk-bar',
        bounds: boundsFromCenter(
          centerXMetres,
          z,
          horizontalBarLength,
          CROSSWALK_BAR_THICKNESS_METRES,
        ),
      });
    }
  }

  for (const [side, direction] of [
    ['east', 1],
    ['west', -1],
  ] as const) {
    for (let index = 0; index < CROSSWALK_BAR_COUNT; index += 1) {
      const repeatOffset = centeredRepeatOffset(index);
      const x = centerXMetres + direction * eastWestOffset + repeatOffset;
      bars.push({
        id: `${intersection.id}/crosswalk-${side}-bar-${index}`,
        kind: 'crosswalk-bar',
        bounds: boundsFromCenter(
          x,
          centerZMetres,
          CROSSWALK_BAR_THICKNESS_METRES,
          verticalBarLength,
        ),
      });
    }
  }

  return bars;
}

function centeredRepeatOffset(index: number): number {
  return (
    (index - (CROSSWALK_BAR_COUNT - 1) / 2) *
    CROSSWALK_BAR_SPACING_METRES
  );
}

function boundsFromCenter(
  x: number,
  z: number,
  width: number,
  depth: number,
): SyntheticBounds2 {
  if (width <= 0 || depth <= 0) {
    throw new Error('A synthetic road marking has non-positive dimensions.');
  }

  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  };
}

function centerX(bounds: SyntheticBounds2): number {
  return (bounds.minX + bounds.maxX) / 2;
}

function centerZ(bounds: SyntheticBounds2): number {
  return (bounds.minZ + bounds.maxZ) / 2;
}
