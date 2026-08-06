export type FirstPersonHorizontalBounds = Readonly<{
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}>;

export type FirstPersonTravel = Readonly<{
  forwardMetres: number;
  rightMetres: number;
}>;

export type FirstPersonLook = Readonly<{
  yawRadians: number;
  pitchRadians: number;
}>;

export function calculateFirstPersonLook(
  yawRadians: number,
  pitchRadians: number,
  movementX: number,
  movementY: number,
  sensitivity: number,
  maximumPitchRadians: number,
): FirstPersonLook {
  for (const value of [
    yawRadians,
    pitchRadians,
    movementX,
    movementY,
    sensitivity,
    maximumPitchRadians,
  ]) {
    if (!Number.isFinite(value)) {
      throw new RangeError('First-person look values must be finite.');
    }
  }

  if (sensitivity < 0 || maximumPitchRadians <= 0) {
    throw new RangeError('First-person look limits are invalid.');
  }

  return {
    yawRadians: yawRadians - movementX * sensitivity,
    pitchRadians: Math.max(
      -maximumPitchRadians,
      Math.min(
        maximumPitchRadians,
        pitchRadians - movementY * sensitivity,
      ),
    ),
  };
}

export function calculateFirstPersonTravel(
  forwardAxis: number,
  rightAxis: number,
  speedMetresPerSecond: number,
  deltaSeconds: number,
): FirstPersonTravel {
  for (const value of [
    forwardAxis,
    rightAxis,
    speedMetresPerSecond,
    deltaSeconds,
  ]) {
    if (!Number.isFinite(value)) {
      throw new RangeError('First-person movement values must be finite.');
    }
  }

  if (speedMetresPerSecond < 0 || deltaSeconds < 0) {
    throw new RangeError('First-person speed and elapsed time must not be negative.');
  }

  const axisLength = Math.hypot(forwardAxis, rightAxis);
  const normalization = axisLength > 1 ? 1 / axisLength : 1;
  const distanceMetres = speedMetresPerSecond * deltaSeconds;

  return {
    forwardMetres: forwardAxis * normalization * distanceMetres,
    rightMetres: rightAxis * normalization * distanceMetres,
  };
}

export function clampFirstPersonPosition(
  position: readonly [xMetres: number, yMetres: number, zMetres: number],
  bounds: FirstPersonHorizontalBounds,
  eyeHeightMetres: number,
  boundaryInsetMetres: number,
): readonly [xMetres: number, yMetres: number, zMetres: number] {
  if (
    !Number.isFinite(eyeHeightMetres) ||
    eyeHeightMetres <= 0 ||
    !Number.isFinite(boundaryInsetMetres) ||
    boundaryInsetMetres < 0
  ) {
    throw new RangeError('First-person height and boundary inset are invalid.');
  }

  const minimumX = bounds.minX + boundaryInsetMetres;
  const maximumX = bounds.maxX - boundaryInsetMetres;
  const minimumZ = bounds.minZ + boundaryInsetMetres;
  const maximumZ = bounds.maxZ - boundaryInsetMetres;

  if (minimumX > maximumX || minimumZ > maximumZ) {
    throw new RangeError('The first-person boundary inset consumes the view bounds.');
  }

  return [
    Math.min(maximumX, Math.max(minimumX, position[0])),
    eyeHeightMetres,
    Math.min(maximumZ, Math.max(minimumZ, position[2])),
  ];
}
