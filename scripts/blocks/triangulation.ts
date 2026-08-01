import type { Point2 } from '../../src/city/model/processedCity';

const EPSILON = 1e-8;

/** Deterministic ear clipping for a simple single-ring polygon without holes. */
export function triangulateSimplePolygon(
  polygon: readonly Point2[],
): readonly (readonly [Point2, Point2, Point2])[] {
  const points = removeCollinearVertices(polygon);

  if (points.length < 3) {
    throw new Error('A polygon requires at least three non-collinear points.');
  }

  const orientation = Math.sign(signedArea(points));

  if (orientation === 0) {
    throw new Error('A degenerate polygon cannot be triangulated.');
  }

  const remaining = points.map((_, index) => index);
  const triangles: Array<readonly [Point2, Point2, Point2]> = [];
  const maximumIterations = points.length * points.length;
  let iterations = 0;

  while (remaining.length > 3) {
    let clippedEar = false;

    for (let index = 0; index < remaining.length; index += 1) {
      iterations += 1;

      if (iterations > maximumIterations) {
        throw new Error('Polygon triangulation exceeded its deterministic guard.');
      }

      const previousIndex = remaining[(index + remaining.length - 1) % remaining.length];
      const currentIndex = remaining[index];
      const nextIndex = remaining[(index + 1) % remaining.length];
      const previous = previousIndex === undefined ? undefined : points[previousIndex];
      const current = currentIndex === undefined ? undefined : points[currentIndex];
      const next = nextIndex === undefined ? undefined : points[nextIndex];

      if (
        previous === undefined ||
        current === undefined ||
        next === undefined ||
        crossProduct(previous, current, next) * orientation <= EPSILON
      ) {
        continue;
      }

      const containsOtherVertex = remaining.some((pointIndex) => {
        if (
          pointIndex === previousIndex ||
          pointIndex === currentIndex ||
          pointIndex === nextIndex
        ) {
          return false;
        }

        const point = points[pointIndex];
        return point !== undefined && pointInTriangle(point, previous, current, next);
      });

      if (containsOtherVertex) {
        continue;
      }

      triangles.push([previous, current, next]);
      remaining.splice(index, 1);
      clippedEar = true;
      break;
    }

    if (!clippedEar) {
      throw new Error('Polygon triangulation could not find a valid ear.');
    }
  }

  const first = remaining[0] === undefined ? undefined : points[remaining[0]];
  const second = remaining[1] === undefined ? undefined : points[remaining[1]];
  const third = remaining[2] === undefined ? undefined : points[remaining[2]];

  if (first === undefined || second === undefined || third === undefined) {
    throw new Error('Polygon triangulation produced an incomplete final triangle.');
  }

  triangles.push([first, second, third]);
  return triangles;
}

function removeCollinearVertices(polygon: readonly Point2[]): readonly Point2[] {
  let points = [...polygon];
  let changed = true;

  while (changed && points.length >= 3) {
    changed = false;
    const retained = points.filter((current, index) => {
      const previous = points[(index + points.length - 1) % points.length];
      const next = points[(index + 1) % points.length];

      if (previous === undefined || next === undefined) {
        return false;
      }

      if (Math.abs(crossProduct(previous, current, next)) <= EPSILON) {
        changed = true;
        return false;
      }

      return true;
    });

    points = retained;
  }

  return points;
}

function pointInTriangle(
  point: Point2,
  first: Point2,
  second: Point2,
  third: Point2,
): boolean {
  const firstCross = crossProduct(first, second, point);
  const secondCross = crossProduct(second, third, point);
  const thirdCross = crossProduct(third, first, point);
  const hasNegative = firstCross < -EPSILON || secondCross < -EPSILON || thirdCross < -EPSILON;
  const hasPositive = firstCross > EPSILON || secondCross > EPSILON || thirdCross > EPSILON;
  return !(hasNegative && hasPositive);
}

function signedArea(polygon: readonly Point2[]): number {
  let twiceArea = 0;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];

    if (start !== undefined && end !== undefined) {
      twiceArea += start[0] * end[1] - end[0] * start[1];
    }
  }

  return twiceArea / 2;
}

function crossProduct(origin: Point2, first: Point2, second: Point2): number {
  return (
    (first[0] - origin[0]) * (second[1] - origin[1]) -
    (first[1] - origin[1]) * (second[0] - origin[0])
  );
}
