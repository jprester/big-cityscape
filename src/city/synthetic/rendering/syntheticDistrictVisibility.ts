import type { SyntheticBounds2 } from '../model/proofDistrict';

const MINIMUM_DISTRICT_VISIBILITY_METRES = 1_300;
const ALTITUDE_VISIBILITY_MULTIPLIER = 2.5;

export type SyntheticCameraPosition = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export function isSyntheticDistrictWithinVisibilityRange(
  bounds: SyntheticBounds2,
  cameraPosition: SyntheticCameraPosition,
): boolean {
  const visibilityDistance = Math.max(
    MINIMUM_DISTRICT_VISIBILITY_METRES,
    Math.max(0, cameraPosition.y) * ALTITUDE_VISIBILITY_MULTIPLIER,
  );
  const distanceX = distanceToInterval(
    cameraPosition.x,
    bounds.minX,
    bounds.maxX,
  );
  const distanceZ = distanceToInterval(
    cameraPosition.z,
    bounds.minZ,
    bounds.maxZ,
  );
  return Math.hypot(distanceX, distanceZ) <= visibilityDistance;
}

function distanceToInterval(
  value: number,
  minimum: number,
  maximum: number,
): number {
  if (value < minimum) {
    return minimum - value;
  }

  if (value > maximum) {
    return value - maximum;
  }

  return 0;
}
