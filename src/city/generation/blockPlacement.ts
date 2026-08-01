import type { Point2 } from '../model/processedCity';

const EPSILON = 1e-7;
const FIT_SCALE = 0.9;
const FIT_SHRINK_FACTOR = 0.92;
const MAXIMUM_FIT_ATTEMPTS = 40;

export type OrientedRectangle = Readonly<{
  center: Point2;
  widthMetres: number;
  depthMetres: number;
  rotationRadians: number;
}>;

export function fitStreetAlignedRectangle(
  polygon: readonly Point2[],
): OrientedRectangle {
  if (polygon.length < 3) {
    throw new Error('A placement polygon requires at least three points.');
  }

  const center = polygonCentroid(polygon);
  const rotationRadians = longestEdgeRotation(polygon);
  const axisWidth: Point2 = [Math.cos(rotationRadians), Math.sin(rotationRadians)];
  const axisDepth: Point2 = [-axisWidth[1], axisWidth[0]];
  const widthRange = projectionRange(polygon, center, axisWidth);
  const depthRange = projectionRange(polygon, center, axisDepth);
  let widthMetres = (widthRange.maximum - widthRange.minimum) * FIT_SCALE;
  let depthMetres = (depthRange.maximum - depthRange.minimum) * FIT_SCALE;

  for (let attempt = 0; attempt < MAXIMUM_FIT_ATTEMPTS; attempt += 1) {
    const rectangle = { center, widthMetres, depthMetres, rotationRadians };

    if (orientedRectangleCorners(rectangle).every((point) => pointInPolygon(point, polygon))) {
      if (widthMetres < 8 || depthMetres < 8) {
        break;
      }

      return rectangle;
    }

    widthMetres *= FIT_SHRINK_FACTOR;
    depthMetres *= FIT_SHRINK_FACTOR;
  }

  throw new Error('A usable street-aligned placement rectangle could not be fitted.');
}

export function splitOrientedRectangle(
  rectangle: OrientedRectangle,
  count: number,
  requestedGapMetres: number,
): readonly OrientedRectangle[] {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError('A placement zone split count must be a positive integer.');
  }

  if (!Number.isFinite(requestedGapMetres) || requestedGapMetres < 0) {
    throw new RangeError('A placement zone gap must be a finite non-negative distance.');
  }

  if (count === 1) {
    return [rectangle];
  }

  const splitWidth = rectangle.widthMetres >= rectangle.depthMetres;
  const totalLength = splitWidth ? rectangle.widthMetres : rectangle.depthMetres;
  const gapMetres = Math.min(requestedGapMetres, totalLength / (count * 4));
  const segmentLength = (totalLength - gapMetres * (count - 1)) / count;
  const axis: Point2 = splitWidth
    ? [Math.cos(rectangle.rotationRadians), Math.sin(rectangle.rotationRadians)]
    : [-Math.sin(rectangle.rotationRadians), Math.cos(rectangle.rotationRadians)];

  return Array.from({ length: count }, (_, index) => {
    const offsetMetres =
      -totalLength / 2 + segmentLength / 2 + index * (segmentLength + gapMetres);

    return {
      center: [
        rectangle.center[0] + axis[0] * offsetMetres,
        rectangle.center[1] + axis[1] * offsetMetres,
      ],
      widthMetres: splitWidth ? segmentLength : rectangle.widthMetres,
      depthMetres: splitWidth ? rectangle.depthMetres : segmentLength,
      rotationRadians: rectangle.rotationRadians,
    };
  });
}

export function scaleOrientedRectangle(
  rectangle: OrientedRectangle,
  widthScale: number,
  depthScale: number,
  widthOffsetMetres = 0,
  depthOffsetMetres = 0,
): OrientedRectangle {
  const widthAxis: Point2 = [
    Math.cos(rectangle.rotationRadians),
    Math.sin(rectangle.rotationRadians),
  ];
  const depthAxis: Point2 = [-widthAxis[1], widthAxis[0]];

  return {
    center: [
      rectangle.center[0] +
        widthAxis[0] * widthOffsetMetres +
        depthAxis[0] * depthOffsetMetres,
      rectangle.center[1] +
        widthAxis[1] * widthOffsetMetres +
        depthAxis[1] * depthOffsetMetres,
    ],
    widthMetres: rectangle.widthMetres * widthScale,
    depthMetres: rectangle.depthMetres * depthScale,
    rotationRadians: rectangle.rotationRadians,
  };
}

export function orientedRectangleCorners(
  rectangle: OrientedRectangle,
): readonly Point2[] {
  const widthAxis: Point2 = [
    Math.cos(rectangle.rotationRadians),
    Math.sin(rectangle.rotationRadians),
  ];
  const depthAxis: Point2 = [-widthAxis[1], widthAxis[0]];
  const halfWidth = rectangle.widthMetres / 2;
  const halfDepth = rectangle.depthMetres / 2;

  return [
    addAxes(rectangle.center, widthAxis, -halfWidth, depthAxis, -halfDepth),
    addAxes(rectangle.center, widthAxis, halfWidth, depthAxis, -halfDepth),
    addAxes(rectangle.center, widthAxis, halfWidth, depthAxis, halfDepth),
    addAxes(rectangle.center, widthAxis, -halfWidth, depthAxis, halfDepth),
  ];
}

export function pointInPolygon(point: Point2, polygon: readonly Point2[]): boolean {
  let inside = false;

  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index];
    const previous = polygon[previousIndex];

    if (current === undefined || previous === undefined) {
      continue;
    }

    if (pointOnSegment(point, previous, current)) {
      return true;
    }

    const crosses =
      current[1] > point[1] !== previous[1] > point[1] &&
      point[0] <
        ((previous[0] - current[0]) * (point[1] - current[1])) /
          (previous[1] - current[1]) +
          current[0];

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
}

function polygonCentroid(polygon: readonly Point2[]): Point2 {
  let twiceArea = 0;
  let weightedX = 0;
  let weightedZ = 0;

  forEachEdge(polygon, (start, end) => {
    const cross = start[0] * end[1] - end[0] * start[1];
    twiceArea += cross;
    weightedX += (start[0] + end[0]) * cross;
    weightedZ += (start[1] + end[1]) * cross;
  });

  if (Math.abs(twiceArea) <= EPSILON) {
    throw new Error('A placement polygon cannot be degenerate.');
  }

  return [weightedX / (3 * twiceArea), weightedZ / (3 * twiceArea)];
}

function longestEdgeRotation(polygon: readonly Point2[]): number {
  let longestLengthSquared = 0;
  let rotationRadians = 0;

  forEachEdge(polygon, (start, end) => {
    const deltaX = end[0] - start[0];
    const deltaZ = end[1] - start[1];
    const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;

    if (lengthSquared > longestLengthSquared) {
      longestLengthSquared = lengthSquared;
      rotationRadians = Math.atan2(deltaZ, deltaX);
    }
  });

  if (longestLengthSquared <= EPSILON) {
    throw new Error('A placement polygon has no usable street edge.');
  }

  return rotationRadians;
}

function projectionRange(
  polygon: readonly Point2[],
  origin: Point2,
  axis: Point2,
): Readonly<{ minimum: number; maximum: number }> {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;

  for (const point of polygon) {
    const projection =
      (point[0] - origin[0]) * axis[0] + (point[1] - origin[1]) * axis[1];
    minimum = Math.min(minimum, projection);
    maximum = Math.max(maximum, projection);
  }

  return { minimum, maximum };
}

function addAxes(
  center: Point2,
  widthAxis: Point2,
  widthDistance: number,
  depthAxis: Point2,
  depthDistance: number,
): Point2 {
  return [
    center[0] + widthAxis[0] * widthDistance + depthAxis[0] * depthDistance,
    center[1] + widthAxis[1] * widthDistance + depthAxis[1] * depthDistance,
  ];
}

function pointOnSegment(point: Point2, start: Point2, end: Point2): boolean {
  const cross =
    (end[0] - start[0]) * (point[1] - start[1]) -
    (end[1] - start[1]) * (point[0] - start[0]);

  if (Math.abs(cross) > EPSILON) {
    return false;
  }

  return (
    point[0] >= Math.min(start[0], end[0]) - EPSILON &&
    point[0] <= Math.max(start[0], end[0]) + EPSILON &&
    point[1] >= Math.min(start[1], end[1]) - EPSILON &&
    point[1] <= Math.max(start[1], end[1]) + EPSILON
  );
}

function forEachEdge(
  polygon: readonly Point2[],
  callback: (start: Point2, end: Point2) => void,
): void {
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];

    if (start !== undefined && end !== undefined) {
      callback(start, end);
    }
  }
}
