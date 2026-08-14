import {
  createSyntheticAtmosphereConfig,
  type SyntheticAtmosphereConfig,
} from '../city/synthetic/rendering/addSyntheticAtmosphereLayer';
import type { SyntheticInspectionLightingConfig } from '../city/synthetic/rendering/addSyntheticInspectionLighting';
import type { SyntheticStreetLampConfig } from '../city/synthetic/rendering/addSyntheticStreetLampLayer';

export const SYNTHETIC_ENVIRONMENT_PRESET_IDS = [
  'day',
  'dusk',
  'night',
] as const;

export type SyntheticEnvironmentPresetId =
  (typeof SYNTHETIC_ENVIRONMENT_PRESET_IDS)[number];

export type SyntheticEnvironmentPreset = Readonly<{
  id: SyntheticEnvironmentPresetId;
  label: string;
  atmosphere: SyntheticAtmosphereConfig;
  lighting: SyntheticInspectionLightingConfig;
  streetLamps: SyntheticStreetLampConfig;
}>;

export function createSyntheticEnvironmentPreset(
  id: SyntheticEnvironmentPresetId,
  worldSizeMetres: number,
): SyntheticEnvironmentPreset {
  const atmosphere = createSyntheticAtmosphereConfig(worldSizeMetres);

  switch (id) {
    case 'day':
      return {
        id,
        label: 'Day',
        atmosphere: {
          ...atmosphere,
          backgroundColor: 0xa9c3cf,
          skyHorizonGlowColor: 0xd9d9c8,
          skyZenithColor: 0x4f91bd,
          fogNearMetres: worldSizeMetres * 0.75,
          fogFarMetres: worldSizeMetres * 3.25,
        },
        lighting: {
          hemisphereSkyColor: 0xe5f2f5,
          hemisphereGroundColor: 0x667068,
          hemisphereIntensity: 2.45,
          keyColor: 0xffedc9,
          keyIntensity: 2.95,
          keyPositionScale: [-0.55, 0.9, 0.65],
        },
        streetLamps: {
          bulbColor: 0xaeb9bd,
          bulbOpacity: 0.2,
          poolColor: 0xffc476,
          poolOpacity: 0,
          realLightColor: 0xffd39a,
          realLightIntensity: 0,
          realLightDistanceMetres: 48,
          realLightCount: 0,
        },
      };
    case 'dusk':
      return {
        id,
        label: 'Dusk',
        atmosphere,
        lighting: {
          hemisphereSkyColor: 0xd7e3e8,
          hemisphereGroundColor: 0x202a30,
          hemisphereIntensity: 2.15,
          keyColor: 0xffe2c2,
          keyIntensity: 2.65,
          keyPositionScale: [-0.55, 0.9, 0.65],
        },
        streetLamps: {
          bulbColor: 0xffd4a0,
          bulbOpacity: 0.72,
          poolColor: 0xffae55,
          poolOpacity: 0.15,
          realLightColor: 0xffbf73,
          realLightIntensity: 58,
          realLightDistanceMetres: 46,
          realLightCount: 4,
        },
      };
    case 'night':
      return {
        id,
        label: 'Night',
        atmosphere: {
          ...atmosphere,
          backgroundColor: 0x050b13,
          skyHorizonGlowColor: 0x102b3c,
          skyZenithColor: 0x010208,
          fogNearMetres: worldSizeMetres * 0.4,
          fogFarMetres: worldSizeMetres * 2,
        },
        lighting: {
          hemisphereSkyColor: 0x5d7892,
          hemisphereGroundColor: 0x080b10,
          hemisphereIntensity: 0.98,
          keyColor: 0x9abce5,
          keyIntensity: 1.18,
          keyPositionScale: [0.45, 0.82, -0.35],
        },
        streetLamps: {
          bulbColor: 0xffe0ad,
          bulbOpacity: 1,
          poolColor: 0xffa84d,
          poolOpacity: 0.32,
          realLightColor: 0xffbd6f,
          realLightIntensity: 110,
          realLightDistanceMetres: 52,
          realLightCount: 8,
        },
      };
  }
}

export function readSyntheticEnvironmentPreset(
  search: string,
): SyntheticEnvironmentPresetId {
  const value = new URLSearchParams(search).get('time');

  if (value === null) {
    return 'dusk';
  }

  if (
    SYNTHETIC_ENVIRONMENT_PRESET_IDS.includes(
      value as SyntheticEnvironmentPresetId,
    )
  ) {
    return value as SyntheticEnvironmentPresetId;
  }

  throw new Error('The synthetic environment time must be "day", "dusk", or "night".');
}

export function setSyntheticEnvironmentPresetInUrl(
  url: string,
  id: SyntheticEnvironmentPresetId,
): string {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set('time', id);
  return nextUrl.toString();
}
