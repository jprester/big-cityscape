import { describe, expect, it } from 'vitest';
import {
  createSyntheticEnvironmentPreset,
  readSyntheticEnvironmentPreset,
  setSyntheticEnvironmentPresetInUrl,
  SYNTHETIC_ENVIRONMENT_PRESET_IDS,
} from './syntheticEnvironmentPresets';

describe('synthetic environment presets', () => {
  it('defines distinct deterministic day, dusk, and night environments', () => {
    expect(SYNTHETIC_ENVIRONMENT_PRESET_IDS).toEqual([
      'day',
      'dusk',
      'night',
    ]);
    const day = createSyntheticEnvironmentPreset('day', 2_000);
    const dusk = createSyntheticEnvironmentPreset('dusk', 2_000);
    const night = createSyntheticEnvironmentPreset('night', 2_000);

    expect(day.label).toBe('Day');
    expect(dusk.label).toBe('Dusk');
    expect(night.label).toBe('Night');
    expect(day.atmosphere.fogFarMetres).toBe(6_500);
    expect(dusk.atmosphere.fogFarMetres).toBe(5_000);
    expect(night.atmosphere.fogFarMetres).toBe(4_000);
    expect(day.atmosphere.skyZenithColor).not.toBe(
      dusk.atmosphere.skyZenithColor,
    );
    expect(night.lighting.keyIntensity).toBeLessThan(
      dusk.lighting.keyIntensity,
    );
    expect(day.lighting.hemisphereIntensity).toBeGreaterThan(
      dusk.lighting.hemisphereIntensity,
    );
    expect(day.streetLamps.realLightCount).toBe(0);
    expect(dusk.streetLamps.realLightCount).toBeGreaterThan(0);
    expect(night.streetLamps.realLightCount).toBeGreaterThan(
      dusk.streetLamps.realLightCount,
    );
    expect(night.streetLamps.poolOpacity).toBeGreaterThan(
      dusk.streetLamps.poolOpacity,
    );
  });

  it('reads dusk by default and validates the time query parameter', () => {
    expect(readSyntheticEnvironmentPreset('?seed=20260805')).toBe('dusk');
    expect(readSyntheticEnvironmentPreset('?time=day')).toBe('day');
    expect(readSyntheticEnvironmentPreset('?time=night')).toBe('night');
    expect(() => readSyntheticEnvironmentPreset('?time=noon')).toThrow(
      /day.*dusk.*night/,
    );
  });

  it('updates time without discarding the rest of the URL', () => {
    const updated = new URL(
      setSyntheticEnvironmentPresetInUrl(
        'http://localhost:5174/?view=synthetic&mode=city&seed=20260805',
        'night',
      ),
    );

    expect(updated.searchParams.get('view')).toBe('synthetic');
    expect(updated.searchParams.get('mode')).toBe('city');
    expect(updated.searchParams.get('seed')).toBe('20260805');
    expect(updated.searchParams.get('time')).toBe('night');
  });
});
