import type { SyntheticBounds2 } from '../model/proofDistrict';
import type {
  SyntheticRoadMarking,
  SyntheticRoadMarkingPlan,
} from '../model/roadMarking';
import type { SyntheticStreetCorridor } from '../model/streetCorridor';

const CENTRE_LINE_WIDTH_METRES = 0.45;
const CENTRE_LINE_DASH_LENGTH_METRES = 9;
const CENTRE_LINE_REPEAT_METRES = 18;
const CROSSWALK_BAR_THICKNESS_METRES = 1.5;
const CROSSWALK_BAR_GAP_METRES = 1.2;
const CROSSWALK_LENGTH_ALONG_ROAD_METRES = 10;
const CROSSWALK_INTERSECTION_GAP_METRES = 1.5;
const CROSSWALK_SIDE_INSET_METRES = 1.5;
const CENTRE_LINE_CROSSWALK_GAP_METRES = 1.5;

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
  const crossingClearances = intersections
    .filter((intersection) =>
      northSouth
        ? intersection.vertical.id === road.id
        : intersection.horizontal.id === road.id,
    )
    .map((intersection) => ({
      coordinate: northSouth
        ? intersection.center[1]
        : intersection.center[0],
      radius:
        (northSouth
          ? intersection.horizontal.bounds.maxZ -
            intersection.horizontal.bounds.minZ
          : intersection.vertical.bounds.maxX -
            intersection.vertical.bounds.minX) /
          2 +
        CROSSWALK_INTERSECTION_GAP_METRES +
        CROSSWALK_LENGTH_ALONG_ROAD_METRES +
        CENTRE_LINE_DASH_LENGTH_METRES / 2 +
        CENTRE_LINE_CROSSWALK_GAP_METRES,
    }));
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
      crossingClearances.some(
        (crossing) =>
          Math.abs(center - crossing.coordinate) < crossing.radius,
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
  const northSouthCrossingSpan =
    verticalRoadWidth - CROSSWALK_SIDE_INSET_METRES * 2;
  const eastWestCrossingSpan =
    horizontalRoadWidth - CROSSWALK_SIDE_INSET_METRES * 2;
  const northSouthOffset =
    horizontalRoadWidth / 2 +
    CROSSWALK_INTERSECTION_GAP_METRES +
    CROSSWALK_LENGTH_ALONG_ROAD_METRES / 2;
  const eastWestOffset =
    verticalRoadWidth / 2 +
    CROSSWALK_INTERSECTION_GAP_METRES +
    CROSSWALK_LENGTH_ALONG_ROAD_METRES / 2;
  const bars: SyntheticRoadMarking[] = [];

  for (const [side, direction] of [
    ['north', 1],
    ['south', -1],
  ] as const) {
    // The crossing spans X, while each individual stripe runs along the
    // north-south road (Z), parallel to vehicle travel.
    const offsets = createCrosswalkBarOffsets(northSouthCrossingSpan);

    offsets.forEach((offset, index) => {
      bars.push({
        id: `${intersection.id}/crosswalk-${side}-bar-${index}`,
        kind: 'crosswalk-bar',
        bounds: boundsFromCenter(
          centerXMetres + offset,
          centerZMetres + direction * northSouthOffset,
          CROSSWALK_BAR_THICKNESS_METRES,
          CROSSWALK_LENGTH_ALONG_ROAD_METRES,
        ),
      });
    });
  }

  for (const [side, direction] of [
    ['east', 1],
    ['west', -1],
  ] as const) {
    // East-west crossings use the same convention rotated by ninety degrees.
    const offsets = createCrosswalkBarOffsets(eastWestCrossingSpan);

    offsets.forEach((offset, index) => {
      bars.push({
        id: `${intersection.id}/crosswalk-${side}-bar-${index}`,
        kind: 'crosswalk-bar',
        bounds: boundsFromCenter(
          centerXMetres + direction * eastWestOffset,
          centerZMetres + offset,
          CROSSWALK_LENGTH_ALONG_ROAD_METRES,
          CROSSWALK_BAR_THICKNESS_METRES,
        ),
      });
    });
  }

  return bars;
}

function createCrosswalkBarOffsets(
  availableSpanMetres: number,
): readonly number[] {
  const repeatMetres =
    CROSSWALK_BAR_THICKNESS_METRES + CROSSWALK_BAR_GAP_METRES;
  const count = Math.floor(
    (availableSpanMetres + CROSSWALK_BAR_GAP_METRES) / repeatMetres,
  );

  if (count < 1) {
    throw new Error('A synthetic crosswalk is too narrow for one bar.');
  }

  return Array.from(
    { length: count },
    (_, index) => (index - (count - 1) / 2) * repeatMetres,
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
