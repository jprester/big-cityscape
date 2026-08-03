import { describe, expect, it } from 'vitest';
import { sampleCityHeightField } from './cityHeightField';
import { CITY_MASSING_CONFIG } from './massingConfig';

const PROFILE = CITY_MASSING_CONFIG.profiles['dense-central-core'];

describe('sampleCityHeightField', () => {
  it('forms a deterministic peak with a smooth distance falloff', () => {
    const center = sampleCityHeightField(
      [690, -225],
      PROFILE,
      CITY_MASSING_CONFIG.heightField,
    );
    const transition = sampleCityHeightField(
      [970, -225],
      PROFILE,
      CITY_MASSING_CONFIG.heightField,
    );
    const edge = sampleCityHeightField(
      [1_250, -225],
      PROFILE,
      CITY_MASSING_CONFIG.heightField,
    );

    expect(center).toBe(1);
    expect(transition).toBeGreaterThan(edge);
    expect(edge).toBe(0);
  });

  it('retains weaker secondary centres without making them primary peaks', () => {
    const secondary = sampleCityHeightField(
      [-770, -455],
      CITY_MASSING_CONFIG.profiles['dense-mixed'],
      CITY_MASSING_CONFIG.heightField,
    );

    expect(secondary).toBeGreaterThan(0.5);
    expect(secondary).toBeLessThan(1);
  });
});
