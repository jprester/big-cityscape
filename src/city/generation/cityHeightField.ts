import type { Point2 } from '../model/processedCity';
import type {
  CityHeightFieldConfig,
  DistrictMassingProfile,
} from './massingConfig';

/**
 * Samples the planned city structure at a point. A value of zero represents
 * ordinary low-rise fabric; one represents the primary skyline core.
 */
export function sampleCityHeightField(
  point: Point2,
  profile: DistrictMassingProfile,
  config: CityHeightFieldConfig,
): number {
  const cityInfluence = config.centres.reduce(
    (strongest, centre) =>
      Math.max(
        strongest,
        radialInfluence(point, centre.center, centre.radiusMetres) *
          centre.strength,
      ),
    0,
  );
  const districtInfluence = radialInfluence(
    point,
    profile.clusterCenter,
    profile.clusterRadiusMetres,
  );

  return clamp(
    cityInfluence +
      districtInfluence * config.districtClusterWeight * (1 - cityInfluence),
    0,
    1,
  );
}

function radialInfluence(
  point: Point2,
  center: Point2,
  radiusMetres: number,
): number {
  if (!Number.isFinite(radiusMetres) || radiusMetres <= 0) {
    return 0;
  }

  const normalizedDistance = clamp(
    Math.hypot(point[0] - center[0], point[1] - center[1]) / radiusMetres,
    0,
    1,
  );
  const linearInfluence = 1 - normalizedDistance;

  // Smoothstep keeps centre transitions legible without creating rings.
  return linearInfluence * linearInfluence * (3 - 2 * linearInfluence);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
