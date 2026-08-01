export type SeededRandom = Readonly<{
  seed: number;
  next: () => number;
  float: (minInclusive?: number, maxExclusive?: number) => number;
  integer: (minInclusive: number, maxExclusive: number) => number;
}>;

/**
 * Creates a small deterministic 32-bit PRNG based on Mulberry32.
 *
 * The returned sequence is stable for the same numeric seed. Generation code
 * should receive one of these explicitly rather than reading global randomness.
 */
export function createSeededRandom(seed: number): SeededRandom {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError('A random seed must be a safe integer.');
  }

  const normalizedSeed = seed >>> 0;
  let state = normalizedSeed;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };

  const float = (minInclusive = 0, maxExclusive = 1): number => {
    assertFiniteRange(minInclusive, maxExclusive);
    return minInclusive + next() * (maxExclusive - minInclusive);
  };

  const integer = (minInclusive: number, maxExclusive: number): number => {
    if (!Number.isSafeInteger(minInclusive) || !Number.isSafeInteger(maxExclusive)) {
      throw new RangeError('Random integer bounds must be safe integers.');
    }

    assertFiniteRange(minInclusive, maxExclusive);
    return Math.floor(float(minInclusive, maxExclusive));
  };

  return Object.freeze({
    seed: normalizedSeed,
    next,
    float,
    integer,
  });
}

function assertFiniteRange(minInclusive: number, maxExclusive: number): void {
  if (!Number.isFinite(minInclusive) || !Number.isFinite(maxExclusive)) {
    throw new RangeError('Random bounds must be finite numbers.');
  }

  if (maxExclusive <= minInclusive) {
    throw new RangeError('The maximum random bound must be greater than the minimum.');
  }
}
