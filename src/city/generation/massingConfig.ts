import type { BuildingArchetype } from '../model/cityMassing';
import type { DistrictProfile } from '../model/cityBlocks';
import type { Point2 } from '../model/processedCity';

export type WeightedArchetype = Readonly<{
  archetype: BuildingArchetype;
  weight: number;
}>;

export type DistrictMassingProfile = Readonly<{
  heightRangeMetres: readonly [minimum: number, maximum: number];
  clusterCenter: Point2;
  clusterRadiusMetres: number;
  targetLotAreaSquareMetres: number;
  maximumBuildingsPerBlock: number;
  archetypes: readonly WeightedArchetype[];
}>;

export type CityMassingConfig = Readonly<{
  seed: number;
  landmark: Readonly<{
    districtId: string;
    heightMetres: number;
  }>;
  profiles: Readonly<Record<DistrictProfile, DistrictMassingProfile>>;
}>;

export const DEFAULT_CITY_MASSING_SEED = 20_260_801;

export const CITY_MASSING_CONFIG: CityMassingConfig = {
  seed: DEFAULT_CITY_MASSING_SEED,
  landmark: {
    districtId: 'east-core',
    heightMetres: 286,
  },
  profiles: {
    'dense-central-core': {
      heightRangeMetres: [72, 218],
      clusterCenter: [690, -225],
      clusterRadiusMetres: 390,
      targetLotAreaSquareMetres: 1_550,
      maximumBuildingsPerBlock: 3,
      archetypes: [
        { archetype: 'podium-tower', weight: 0.46 },
        { archetype: 'stepped-tower', weight: 0.3 },
        { archetype: 'box-tower', weight: 0.24 },
      ],
    },
    'commercial-transition': {
      heightRangeMetres: [42, 148],
      clusterCenter: [570, 120],
      clusterRadiusMetres: 520,
      targetLotAreaSquareMetres: 2_200,
      maximumBuildingsPerBlock: 3,
      archetypes: [
        { archetype: 'slab', weight: 0.45 },
        { archetype: 'podium-tower', weight: 0.38 },
        { archetype: 'stepped-tower', weight: 0.17 },
      ],
    },
    'dense-mixed': {
      heightRangeMetres: [30, 108],
      clusterCenter: [-770, -455],
      clusterRadiusMetres: 310,
      targetLotAreaSquareMetres: 1_600,
      maximumBuildingsPerBlock: 2,
      archetypes: [
        { archetype: 'slab', weight: 0.54 },
        { archetype: 'box-tower', weight: 0.36 },
        { archetype: 'podium-tower', weight: 0.1 },
      ],
    },
    'infrastructure-edge': {
      heightRangeMetres: [18, 62],
      clusterCenter: [0, 0],
      clusterRadiusMetres: 500,
      targetLotAreaSquareMetres: 2_400,
      maximumBuildingsPerBlock: 1,
      archetypes: [{ archetype: 'slab', weight: 1 }],
    },
  },
};
