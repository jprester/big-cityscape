import type { LonLat, Point2 } from '../../src/city/model/processedCity';

export const LOCAL_EARTH_RADIUS_METRES = 6_371_008.8;

const DEGREES_TO_RADIANS = Math.PI / 180;

export type LocalProjection = Readonly<{
  originLonLat: LonLat;
  project: (lonLat: LonLat) => Point2;
}>;

/**
 * Creates a local equirectangular approximation around a fixed origin.
 * X increases eastward and Z increases southward to suit Three.js ground space.
 */
export function createLocalProjection(originLonLat: LonLat): LocalProjection {
  const [originLongitude, originLatitude] = originLonLat;

  if (!Number.isFinite(originLongitude) || !Number.isFinite(originLatitude)) {
    throw new RangeError('Projection origin coordinates must be finite.');
  }

  const metresPerLongitudeDegree =
    LOCAL_EARTH_RADIUS_METRES *
    Math.cos(originLatitude * DEGREES_TO_RADIANS) *
    DEGREES_TO_RADIANS;
  const metresPerLatitudeDegree = LOCAL_EARTH_RADIUS_METRES * DEGREES_TO_RADIANS;

  return {
    originLonLat,
    project: ([longitude, latitude]) => [
      (longitude - originLongitude) * metresPerLongitudeDegree,
      -(latitude - originLatitude) * metresPerLatitudeDegree,
    ],
  };
}
