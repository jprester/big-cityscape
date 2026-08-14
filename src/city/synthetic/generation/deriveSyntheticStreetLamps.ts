import { createSeededRandom, deriveSeed } from '../../../core/random';
import type { SyntheticBounds2 } from '../model/proofDistrict';
import type {
  SyntheticStreetLampDefinition,
  SyntheticStreetLampPlan,
} from '../model/streetLamp';
import type { SyntheticStreetCorridor } from '../model/streetCorridor';

const LAMP_SPACING_METRES = {
  arterial: 42,
  secondary: 52,
} as const;
const LAMP_HEIGHT_METRES = {
  arterial: 7.2,
  secondary: 5.8,
} as const;
const STREET_EDGE_INSET_METRES = 1.4;
const END_CLEARANCE_METRES = 10;

export function deriveSyntheticStreetLamps(
  id: string,
  seed: number,
  bounds: SyntheticBounds2,
  streets: readonly SyntheticStreetCorridor[],
): SyntheticStreetLampPlan {
  if (id.trim().length === 0 || !Number.isSafeInteger(seed)) {
    throw new Error('Street-lamp derivation requires a non-empty ID and safe seed.');
  }

  if (bounds.maxX <= bounds.minX || bounds.maxZ <= bounds.minZ) {
    throw new Error('Street-lamp derivation requires positive city bounds.');
  }

  const lamps = streets
    .filter(isLampStreet)
    .toSorted((first, second) => first.id.localeCompare(second.id))
    .flatMap((street) => lampsForStreet(seed, bounds, street, streets));
  const arterialLampCount = lamps.filter(
    (lamp) => lamp.hierarchyId === 'arterial',
  ).length;

  return {
    id,
    seed,
    lamps,
    metadata: {
      lampCount: lamps.length,
      arterialLampCount,
      secondaryLampCount: lamps.length - arterialLampCount,
    },
  };
}

function isLampStreet(
  street: SyntheticStreetCorridor,
): street is SyntheticStreetCorridor & Readonly<{
  axis: 'north-south' | 'east-west';
  hierarchyId: 'arterial' | 'secondary';
}> {
  return (
    street.axis !== 'intersection' &&
    (street.hierarchyId === 'arterial' || street.hierarchyId === 'secondary')
  );
}

function lampsForStreet(
  seed: number,
  cityBounds: SyntheticBounds2,
  street: SyntheticStreetCorridor & Readonly<{
    axis: 'north-south' | 'east-west';
    hierarchyId: 'arterial' | 'secondary';
  }>,
  streets: readonly SyntheticStreetCorridor[],
): readonly SyntheticStreetLampDefinition[] {
  const alongMinimum =
    street.axis === 'north-south' ? street.bounds.minZ : street.bounds.minX;
  const alongMaximum =
    street.axis === 'north-south' ? street.bounds.maxZ : street.bounds.maxX;
  const lengthMetres = alongMaximum - alongMinimum;
  const endClearance = Math.min(END_CLEARANCE_METRES, lengthMetres * 0.2);
  const usableLengthMetres = Math.max(0, lengthMetres - endClearance * 2);
  const spacingMetres = LAMP_SPACING_METRES[street.hierarchyId];
  const sampleCount = Math.max(1, Math.floor(usableLengthMetres / spacingMetres));
  const sampleStepMetres =
    usableLengthMetres > 0 ? usableLengthMetres / sampleCount : lengthMetres;
  const random = createSeededRandom(deriveSeed(seed, street.id, 'street-lamps'));
  const lamps: SyntheticStreetLampDefinition[] = [];

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const baseAlong =
      usableLengthMetres > 0
        ? alongMinimum + endClearance + (sample + 0.5) * sampleStepMetres
        : (alongMinimum + alongMaximum) / 2;
    const jitterLimit = Math.min(3.5, sampleStepMetres * 0.08);
    const along = clamp(
      baseAlong + random.float(-jitterLimit, jitterLimit),
      alongMinimum + endClearance,
      alongMaximum - endClearance,
    );

    if (isNearIntersection(street, along, streets)) {
      continue;
    }

    for (const side of ['minimum', 'maximum'] as const) {
      const placement = lampPlacement(street, along, side);

      if (!contains(cityBounds, placement.position)) {
        continue;
      }

      lamps.push({
        id: `${street.id}/lamp-${sample}-${side}`,
        streetId: street.id,
        hierarchyId: street.hierarchyId,
        position: placement.position,
        facing: placement.facing,
        heightMetres: LAMP_HEIGHT_METRES[street.hierarchyId],
      });
    }
  }

  return lamps;
}

function isNearIntersection(
  street: SyntheticStreetCorridor & Readonly<{
    axis: 'north-south' | 'east-west';
  }>,
  along: number,
  streets: readonly SyntheticStreetCorridor[],
): boolean {
  const clearanceMetres = 7;
  const crossCoordinate =
    street.axis === 'north-south'
      ? (street.bounds.minX + street.bounds.maxX) / 2
      : (street.bounds.minZ + street.bounds.maxZ) / 2;

  return streets.some((candidate) => {
    if (candidate.id === street.id) {
      return false;
    }

    if (candidate.axis === 'intersection') {
      return street.axis === 'north-south'
        ? crossCoordinate >= candidate.bounds.minX &&
            crossCoordinate <= candidate.bounds.maxX &&
            along >= candidate.bounds.minZ - clearanceMetres &&
            along <= candidate.bounds.maxZ + clearanceMetres
        : crossCoordinate >= candidate.bounds.minZ &&
            crossCoordinate <= candidate.bounds.maxZ &&
            along >= candidate.bounds.minX - clearanceMetres &&
            along <= candidate.bounds.maxX + clearanceMetres;
    }

    if (candidate.axis === street.axis) {
      return false;
    }

    return street.axis === 'north-south'
      ? crossCoordinate >= candidate.bounds.minX &&
          crossCoordinate <= candidate.bounds.maxX &&
          along >= candidate.bounds.minZ - clearanceMetres &&
          along <= candidate.bounds.maxZ + clearanceMetres
      : crossCoordinate >= candidate.bounds.minZ &&
          crossCoordinate <= candidate.bounds.maxZ &&
          along >= candidate.bounds.minX - clearanceMetres &&
          along <= candidate.bounds.maxX + clearanceMetres;
  });
}

function lampPlacement(
  street: SyntheticStreetCorridor & Readonly<{
    axis: 'north-south' | 'east-west';
  }>,
  along: number,
  side: 'minimum' | 'maximum',
): Readonly<{
  position: readonly [number, number];
  facing: readonly [number, number];
}> {
  if (street.axis === 'north-south') {
    return side === 'minimum'
      ? {
          position: [street.bounds.minX + STREET_EDGE_INSET_METRES, along],
          facing: [1, 0],
        }
      : {
          position: [street.bounds.maxX - STREET_EDGE_INSET_METRES, along],
          facing: [-1, 0],
        };
  }

  return side === 'minimum'
    ? {
        position: [along, street.bounds.minZ + STREET_EDGE_INSET_METRES],
        facing: [0, 1],
      }
    : {
        position: [along, street.bounds.maxZ - STREET_EDGE_INSET_METRES],
        facing: [0, -1],
      };
}

function contains(
  bounds: SyntheticBounds2,
  position: readonly [number, number],
): boolean {
  return (
    position[0] >= bounds.minX &&
    position[0] <= bounds.maxX &&
    position[1] >= bounds.minZ &&
    position[1] <= bounds.maxZ
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
