import { describe, expect, it } from 'vitest';
import { isSyntheticDistrictWithinVisibilityRange } from './syntheticDistrictVisibility';

const DISTRICT_BOUNDS = {
  minX: 500,
  maxX: 1_000,
  minZ: 500,
  maxZ: 1_000,
} as const;

describe('isSyntheticDistrictWithinVisibilityRange', () => {
  it('keeps a district visible when the camera is inside it', () => {
    expect(
      isSyntheticDistrictWithinVisibilityRange(DISTRICT_BOUNDS, {
        x: 750,
        y: 12,
        z: 750,
      }),
    ).toBe(true);
  });

  it('hides a far district from a low camera', () => {
    expect(
      isSyntheticDistrictWithinVisibilityRange(DISTRICT_BOUNDS, {
        x: -1_000,
        y: 12,
        z: -1_000,
      }),
    ).toBe(false);
  });

  it('expands visibility with altitude for the complete overview', () => {
    expect(
      isSyntheticDistrictWithinVisibilityRange(DISTRICT_BOUNDS, {
        x: -1_000,
        y: 1_200,
        z: -1_000,
      }),
    ).toBe(true);
  });
});
