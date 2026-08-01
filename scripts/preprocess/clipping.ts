import type { LocalBounds, Point2 } from '../../src/city/model/processedCity';

const COORDINATE_EPSILON = 1e-9;

export function clipLineString(
  points: readonly Point2[],
  bounds: LocalBounds,
): readonly (readonly Point2[])[] {
  const paths: Point2[][] = [];
  let activePath: Point2[] | undefined;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];

    if (start === undefined || end === undefined) {
      continue;
    }

    const clippedSegment = clipSegment(start, end, bounds);

    if (clippedSegment === undefined) {
      if (activePath !== undefined) {
        paths.push(activePath);
        activePath = undefined;
      }

      continue;
    }

    const [clippedStart, clippedEnd] = clippedSegment;

    if (activePath === undefined || !pointsEqual(activePath.at(-1), clippedStart)) {
      if (activePath !== undefined) {
        paths.push(activePath);
      }

      activePath = [clippedStart, clippedEnd];
    } else if (!pointsEqual(activePath.at(-1), clippedEnd)) {
      activePath.push(clippedEnd);
    }
  }

  if (activePath !== undefined) {
    paths.push(activePath);
  }

  return paths.filter((path) => path.length >= 2 && !pointsEqual(path[0], path.at(-1)));
}

export function clipPolygonRings(
  rings: readonly (readonly Point2[])[],
  bounds: LocalBounds,
): readonly (readonly Point2[])[] {
  const clippedRings: Point2[][] = [];

  for (const ring of rings) {
    let output = removeClosingPoint(ring);

    output = clipAgainstBoundary(
      output,
      ([x]) => x >= bounds.minX,
      (start, end) => intersectVertical(start, end, bounds.minX),
    );
    output = clipAgainstBoundary(
      output,
      ([x]) => x <= bounds.maxX,
      (start, end) => intersectVertical(start, end, bounds.maxX),
    );
    output = clipAgainstBoundary(
      output,
      ([, z]) => z >= bounds.minZ,
      (start, end) => intersectHorizontal(start, end, bounds.minZ),
    );
    output = clipAgainstBoundary(
      output,
      ([, z]) => z <= bounds.maxZ,
      (start, end) => intersectHorizontal(start, end, bounds.maxZ),
    );

    const normalized = removeConsecutiveDuplicates(output);

    if (normalized.length >= 3) {
      clippedRings.push(normalized);
    }
  }

  return clippedRings;
}

function clipSegment(
  [startX, startZ]: Point2,
  [endX, endZ]: Point2,
  bounds: LocalBounds,
): readonly [Point2, Point2] | undefined {
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;
  const p = [-deltaX, deltaX, -deltaZ, deltaZ];
  const q = [
    startX - bounds.minX,
    bounds.maxX - startX,
    startZ - bounds.minZ,
    bounds.maxZ - startZ,
  ];
  let minimum = 0;
  let maximum = 1;

  for (let index = 0; index < p.length; index += 1) {
    const direction = p[index];
    const distance = q[index];

    if (direction === undefined || distance === undefined) {
      continue;
    }

    if (Math.abs(direction) <= COORDINATE_EPSILON) {
      if (distance < 0) {
        return undefined;
      }

      continue;
    }

    const ratio = distance / direction;

    if (direction < 0) {
      minimum = Math.max(minimum, ratio);
    } else {
      maximum = Math.min(maximum, ratio);
    }

    if (minimum > maximum) {
      return undefined;
    }
  }

  return [
    [startX + minimum * deltaX, startZ + minimum * deltaZ],
    [startX + maximum * deltaX, startZ + maximum * deltaZ],
  ];
}

function clipAgainstBoundary(
  input: readonly Point2[],
  isInside: (point: Point2) => boolean,
  intersect: (start: Point2, end: Point2) => Point2,
): Point2[] {
  if (input.length === 0) {
    return [];
  }

  const output: Point2[] = [];
  let start = input.at(-1);

  if (start === undefined) {
    return output;
  }

  for (const end of input) {
    const startInside = isInside(start);
    const endInside = isInside(end);

    if (endInside) {
      if (!startInside) {
        output.push(intersect(start, end));
      }

      output.push(end);
    } else if (startInside) {
      output.push(intersect(start, end));
    }

    start = end;
  }

  return output;
}

function intersectVertical([startX, startZ]: Point2, [endX, endZ]: Point2, x: number): Point2 {
  const ratio = (x - startX) / (endX - startX);
  return [x, startZ + ratio * (endZ - startZ)];
}

function intersectHorizontal(
  [startX, startZ]: Point2,
  [endX, endZ]: Point2,
  z: number,
): Point2 {
  const ratio = (z - startZ) / (endZ - startZ);
  return [startX + ratio * (endX - startX), z];
}

function removeClosingPoint(points: readonly Point2[]): Point2[] {
  if (points.length > 1 && pointsEqual(points[0], points.at(-1))) {
    return points.slice(0, -1);
  }

  return [...points];
}

function removeConsecutiveDuplicates(points: readonly Point2[]): Point2[] {
  const result: Point2[] = [];

  for (const point of points) {
    if (!pointsEqual(result.at(-1), point)) {
      result.push(point);
    }
  }

  if (result.length > 1 && pointsEqual(result[0], result.at(-1))) {
    result.pop();
  }

  return result;
}

function pointsEqual(first: Point2 | undefined, second: Point2 | undefined): boolean {
  return (
    first !== undefined &&
    second !== undefined &&
    Math.abs(first[0] - second[0]) <= COORDINATE_EPSILON &&
    Math.abs(first[1] - second[1]) <= COORDINATE_EPSILON
  );
}
