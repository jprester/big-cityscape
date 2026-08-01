import type { Point2 } from '../../src/city/model/processedCity';

const EPSILON = 1e-8;

export function polygonArea(polygon: readonly Point2[]): number {
  return Math.abs(signedPolygonArea(polygon));
}

export function polygonCentroid(polygon: readonly Point2[]): Point2 {
  const signedArea = signedPolygonArea(polygon);

  if (Math.abs(signedArea) <= EPSILON) {
    throw new Error('Cannot calculate the centroid of a degenerate polygon.');
  }

  let weightedX = 0;
  let weightedZ = 0;

  forEachEdge(polygon, (start, end) => {
    const cross = start[0] * end[1] - end[0] * start[1];
    weightedX += (start[0] + end[0]) * cross;
    weightedZ += (start[1] + end[1]) * cross;
  });

  const factor = 1 / (6 * signedArea);
  return [weightedX * factor, weightedZ * factor];
}

export function isConvexPolygon(polygon: readonly Point2[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let direction = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];

    if (previous === undefined || current === undefined || next === undefined) {
      return false;
    }

    const cross = crossProduct(previous, current, next);

    if (Math.abs(cross) <= EPSILON) {
      continue;
    }

    const nextDirection = Math.sign(cross);

    if (direction !== 0 && direction !== nextDirection) {
      return false;
    }

    direction = nextDirection;
  }

  return direction !== 0;
}

export function insetConvexPolygon(
  polygon: readonly Point2[],
  distanceMetres: number,
): readonly Point2[] {
  if (!isConvexPolygon(polygon)) {
    throw new Error('Buildable insets currently require a convex block polygon.');
  }

  if (!Number.isFinite(distanceMetres) || distanceMetres <= 0) {
    throw new RangeError('A buildable inset must be a positive finite distance.');
  }

  const orientation = Math.sign(signedPolygonArea(polygon));
  const offsetEdges = polygon.map((start, index) => {
    const end = polygon[(index + 1) % polygon.length];

    if (end === undefined) {
      throw new Error('Block polygon contains an invalid edge.');
    }

    const deltaX = end[0] - start[0];
    const deltaZ = end[1] - start[1];
    const length = Math.hypot(deltaX, deltaZ);

    if (length <= EPSILON) {
      throw new Error('Block polygon contains a zero-length edge.');
    }

    const normalX = (-deltaZ / length) * orientation;
    const normalZ = (deltaX / length) * orientation;

    return {
      point: [
        start[0] + normalX * distanceMetres,
        start[1] + normalZ * distanceMetres,
      ] as Point2,
      direction: [deltaX, deltaZ] as Point2,
    };
  });

  const inset = offsetEdges.map((current, index) => {
    const previous = offsetEdges[(index + offsetEdges.length - 1) % offsetEdges.length];

    if (previous === undefined) {
      throw new Error('Block inset could not resolve its previous edge.');
    }

    const intersection = intersectInfiniteLines(
      previous.point,
      previous.direction,
      current.point,
      current.direction,
    );

    if (intersection === undefined) {
      throw new Error('Block inset produced parallel adjacent edges.');
    }

    return intersection;
  });

  if (!isConvexPolygon(inset) || polygonArea(inset) <= EPSILON) {
    throw new Error('Buildable inset collapsed the block polygon.');
  }

  return inset;
}

export function polygonsIntersect(
  first: readonly Point2[],
  second: readonly Point2[],
): boolean {
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const firstStart = first[firstIndex];
    const firstEnd = first[(firstIndex + 1) % first.length];

    if (firstStart === undefined || firstEnd === undefined) {
      continue;
    }

    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const secondStart = second[secondIndex];
      const secondEnd = second[(secondIndex + 1) % second.length];

      if (
        secondStart !== undefined &&
        secondEnd !== undefined &&
        segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)
      ) {
        return true;
      }
    }
  }

  return pointInPolygon(first[0], second) || pointInPolygon(second[0], first);
}

export function minimumPolygonDistance(
  first: readonly Point2[],
  second: readonly Point2[],
): number {
  if (polygonsIntersect(first, second)) {
    return 0;
  }

  let minimum = Number.POSITIVE_INFINITY;

  forEachEdge(first, (firstStart, firstEnd) => {
    forEachEdge(second, (secondStart, secondEnd) => {
      minimum = Math.min(
        minimum,
        segmentDistance(firstStart, firstEnd, secondStart, secondEnd),
      );
    });
  });

  return minimum;
}

export function minimumPolygonPathDistance(
  polygon: readonly Point2[],
  paths: readonly (readonly Point2[])[],
): number {
  let minimum = Number.POSITIVE_INFINITY;

  for (const path of paths) {
    for (let index = 1; index < path.length; index += 1) {
      const pathStart = path[index - 1];
      const pathEnd = path[index];

      if (pathStart === undefined || pathEnd === undefined) {
        continue;
      }

      if (pointInPolygon(pathStart, polygon) || pointInPolygon(pathEnd, polygon)) {
        return 0;
      }

      forEachEdge(polygon, (polygonStart, polygonEnd) => {
        minimum = Math.min(
          minimum,
          segmentDistance(polygonStart, polygonEnd, pathStart, pathEnd),
        );
      });
    }
  }

  return minimum;
}

function signedPolygonArea(polygon: readonly Point2[]): number {
  let twiceArea = 0;

  forEachEdge(polygon, (start, end) => {
    twiceArea += start[0] * end[1] - end[0] * start[1];
  });

  return twiceArea / 2;
}

function pointInPolygon(point: Point2 | undefined, polygon: readonly Point2[]): boolean {
  if (point === undefined || polygon.length < 3) {
    return false;
  }

  let inside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];

    if (current === undefined || previous === undefined) {
      continue;
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

function segmentDistance(
  firstStart: Point2,
  firstEnd: Point2,
  secondStart: Point2,
  secondEnd: Point2,
): number {
  if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
    return 0;
  }

  return Math.min(
    pointSegmentDistance(firstStart, secondStart, secondEnd),
    pointSegmentDistance(firstEnd, secondStart, secondEnd),
    pointSegmentDistance(secondStart, firstStart, firstEnd),
    pointSegmentDistance(secondEnd, firstStart, firstEnd),
  );
}

function pointSegmentDistance(point: Point2, start: Point2, end: Point2): number {
  const deltaX = end[0] - start[0];
  const deltaZ = end[1] - start[1];
  const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;

  if (lengthSquared <= EPSILON) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }

  const ratio = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaZ) /
        lengthSquared,
    ),
  );
  const nearestX = start[0] + ratio * deltaX;
  const nearestZ = start[1] + ratio * deltaZ;
  return Math.hypot(point[0] - nearestX, point[1] - nearestZ);
}

function segmentsIntersect(
  firstStart: Point2,
  firstEnd: Point2,
  secondStart: Point2,
  secondEnd: Point2,
): boolean {
  const firstA = crossProduct(firstStart, firstEnd, secondStart);
  const firstB = crossProduct(firstStart, firstEnd, secondEnd);
  const secondA = crossProduct(secondStart, secondEnd, firstStart);
  const secondB = crossProduct(secondStart, secondEnd, firstEnd);

  if (firstA * firstB < -EPSILON && secondA * secondB < -EPSILON) {
    return true;
  }

  return (
    (Math.abs(firstA) <= EPSILON && pointOnSegment(secondStart, firstStart, firstEnd)) ||
    (Math.abs(firstB) <= EPSILON && pointOnSegment(secondEnd, firstStart, firstEnd)) ||
    (Math.abs(secondA) <= EPSILON && pointOnSegment(firstStart, secondStart, secondEnd)) ||
    (Math.abs(secondB) <= EPSILON && pointOnSegment(firstEnd, secondStart, secondEnd))
  );
}

function pointOnSegment(point: Point2, start: Point2, end: Point2): boolean {
  return (
    point[0] >= Math.min(start[0], end[0]) - EPSILON &&
    point[0] <= Math.max(start[0], end[0]) + EPSILON &&
    point[1] >= Math.min(start[1], end[1]) - EPSILON &&
    point[1] <= Math.max(start[1], end[1]) + EPSILON
  );
}

function crossProduct(origin: Point2, first: Point2, second: Point2): number {
  return (
    (first[0] - origin[0]) * (second[1] - origin[1]) -
    (first[1] - origin[1]) * (second[0] - origin[0])
  );
}

function intersectInfiniteLines(
  firstPoint: Point2,
  firstDirection: Point2,
  secondPoint: Point2,
  secondDirection: Point2,
): Point2 | undefined {
  const denominator =
    firstDirection[0] * secondDirection[1] - firstDirection[1] * secondDirection[0];

  if (Math.abs(denominator) <= EPSILON) {
    return undefined;
  }

  const deltaX = secondPoint[0] - firstPoint[0];
  const deltaZ = secondPoint[1] - firstPoint[1];
  const ratio =
    (deltaX * secondDirection[1] - deltaZ * secondDirection[0]) / denominator;

  return [
    firstPoint[0] + ratio * firstDirection[0],
    firstPoint[1] + ratio * firstDirection[1],
  ];
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
