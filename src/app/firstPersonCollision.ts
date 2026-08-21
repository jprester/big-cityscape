export type FirstPersonCollisionBounds = Readonly<{
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}>;

export type FirstPersonCollisionIndex = Readonly<{
  cellSizeMetres: number;
  colliders: readonly FirstPersonCollisionBounds[];
  cells: ReadonlyMap<string, readonly number[]>;
}>;

export type FirstPersonHorizontalPoint = readonly [
  xMetres: number,
  zMetres: number,
];

const COLLISION_EPSILON = 1e-12;

export function createFirstPersonCollisionIndex(
  colliders: readonly FirstPersonCollisionBounds[],
  cellSizeMetres: number,
): FirstPersonCollisionIndex {
  if (!Number.isFinite(cellSizeMetres) || cellSizeMetres <= 0) {
    throw new RangeError('First-person collision cell size must be positive and finite.');
  }

  const sortedColliders = [...colliders].sort((first, second) =>
    first.id.localeCompare(second.id),
  );
  const ids = new Set<string>();
  const mutableCells = new Map<string, number[]>();

  sortedColliders.forEach((collider, index) => {
    validateCollider(collider);

    if (ids.has(collider.id)) {
      throw new Error(`Duplicate first-person collider ID: ${collider.id}.`);
    }

    ids.add(collider.id);
    const minimumCellX = cellCoordinate(collider.minX, cellSizeMetres);
    const maximumCellX = cellCoordinate(collider.maxX, cellSizeMetres);
    const minimumCellZ = cellCoordinate(collider.minZ, cellSizeMetres);
    const maximumCellZ = cellCoordinate(collider.maxZ, cellSizeMetres);

    for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
      for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ += 1) {
        const key = cellKey(cellX, cellZ);
        const entries = mutableCells.get(key) ?? [];
        entries.push(index);
        mutableCells.set(key, entries);
      }
    }
  });

  return {
    cellSizeMetres,
    colliders: sortedColliders,
    cells: mutableCells,
  };
}

/**
 * Moves a circular player footprint through axis-aligned building bounds.
 * Short substeps prevent fast movement from tunnelling through a footprint;
 * resolving axes independently lets the player slide along a blocked wall.
 */
export function resolveFirstPersonHorizontalMovement(
  start: FirstPersonHorizontalPoint,
  displacement: FirstPersonHorizontalPoint,
  collisionIndex: FirstPersonCollisionIndex,
  playerRadiusMetres: number,
  maximumSubstepMetres: number,
): FirstPersonHorizontalPoint {
  validatePoint(start, 'start');
  validatePoint(displacement, 'displacement');

  if (!Number.isFinite(playerRadiusMetres) || playerRadiusMetres <= 0) {
    throw new RangeError('First-person collision radius must be positive and finite.');
  }

  if (!Number.isFinite(maximumSubstepMetres) || maximumSubstepMetres <= 0) {
    throw new RangeError('First-person collision substep must be positive and finite.');
  }

  const distanceMetres = Math.hypot(displacement[0], displacement[1]);

  if (distanceMetres === 0) {
    return start;
  }

  if (collisionIndex.colliders.length === 0) {
    return [start[0] + displacement[0], start[1] + displacement[1]];
  }

  const steps = Math.max(1, Math.ceil(distanceMetres / maximumSubstepMetres));
  const stepX = displacement[0] / steps;
  const stepZ = displacement[1] / steps;
  let x = start[0];
  let z = start[1];

  for (let step = 0; step < steps; step += 1) {
    const nextX = x + stepX;

    if (
      !isFirstPersonPositionBlocked(
        [nextX, z],
        collisionIndex,
        playerRadiusMetres,
      )
    ) {
      x = nextX;
    }

    const nextZ = z + stepZ;

    if (
      !isFirstPersonPositionBlocked(
        [x, nextZ],
        collisionIndex,
        playerRadiusMetres,
      )
    ) {
      z = nextZ;
    }
  }

  return [x, z];
}

export function isFirstPersonPositionBlocked(
  position: FirstPersonHorizontalPoint,
  collisionIndex: FirstPersonCollisionIndex,
  playerRadiusMetres: number,
): boolean {
  validatePoint(position, 'position');

  if (!Number.isFinite(playerRadiusMetres) || playerRadiusMetres <= 0) {
    throw new RangeError('First-person collision radius must be positive and finite.');
  }

  const minimumCellX = cellCoordinate(
    position[0] - playerRadiusMetres,
    collisionIndex.cellSizeMetres,
  );
  const maximumCellX = cellCoordinate(
    position[0] + playerRadiusMetres,
    collisionIndex.cellSizeMetres,
  );
  const minimumCellZ = cellCoordinate(
    position[1] - playerRadiusMetres,
    collisionIndex.cellSizeMetres,
  );
  const maximumCellZ = cellCoordinate(
    position[1] + playerRadiusMetres,
    collisionIndex.cellSizeMetres,
  );
  const candidateIndices = new Set<number>();

  for (let cellX = minimumCellX; cellX <= maximumCellX; cellX += 1) {
    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ += 1) {
      for (const colliderIndex of
        collisionIndex.cells.get(cellKey(cellX, cellZ)) ?? []) {
        candidateIndices.add(colliderIndex);
      }
    }
  }

  for (const colliderIndex of candidateIndices) {
    const collider = collisionIndex.colliders[colliderIndex];

    if (
      collider !== undefined &&
      circleIntersectsBounds(position, playerRadiusMetres, collider)
    ) {
      return true;
    }
  }

  return false;
}

function circleIntersectsBounds(
  position: FirstPersonHorizontalPoint,
  radiusMetres: number,
  bounds: FirstPersonCollisionBounds,
): boolean {
  const closestX = clamp(position[0], bounds.minX, bounds.maxX);
  const closestZ = clamp(position[1], bounds.minZ, bounds.maxZ);
  const distanceX = position[0] - closestX;
  const distanceZ = position[1] - closestZ;
  return (
    distanceX * distanceX + distanceZ * distanceZ <
    radiusMetres * radiusMetres - COLLISION_EPSILON
  );
}

function validateCollider(collider: FirstPersonCollisionBounds): void {
  if (collider.id.trim().length === 0) {
    throw new Error('First-person colliders require non-empty IDs.');
  }

  for (const value of [
    collider.minX,
    collider.maxX,
    collider.minZ,
    collider.maxZ,
  ]) {
    if (!Number.isFinite(value)) {
      throw new RangeError('First-person collider bounds must be finite.');
    }
  }

  if (collider.maxX <= collider.minX || collider.maxZ <= collider.minZ) {
    throw new RangeError('First-person collider bounds must have positive area.');
  }
}

function validatePoint(point: FirstPersonHorizontalPoint, label: string): void {
  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    throw new RangeError(`First-person collision ${label} must be finite.`);
  }
}

function cellCoordinate(value: number, cellSizeMetres: number): number {
  return Math.floor(value / cellSizeMetres);
}

function cellKey(cellX: number, cellZ: number): string {
  return `${cellX}:${cellZ}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
