import { describe, expect, it } from 'vitest';
import { createLocalProjection } from './projection';

describe('createLocalProjection', () => {
  it('places the configured origin at local zero', () => {
    const projection = createLocalProjection([135.497, 34.6975]);

    expect(projection.project([135.497, 34.6975])).toEqual([0, -0]);
  });

  it('maps east to positive X and north to negative Z in metres', () => {
    const projection = createLocalProjection([135.497, 34.6975]);
    const east = projection.project([135.498, 34.6975]);
    const north = projection.project([135.497, 34.6985]);

    expect(east[0]).toBeCloseTo(91.41, 1);
    expect(east[1]).toBeCloseTo(0, 8);
    expect(north[0]).toBeCloseTo(0, 8);
    expect(north[1]).toBeCloseTo(-111.2, 1);
  });

  it('rejects a non-finite origin', () => {
    expect(() => createLocalProjection([Number.NaN, 34.6975])).toThrow(RangeError);
  });
});
