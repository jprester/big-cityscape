import type { BuildingArchetype } from '../model/cityMassing';
import type { DistrictProfile } from '../model/cityBlocks';
import type { Point2 } from '../model/processedCity';

export type WeightedArchetype = Readonly<{
  archetype: BuildingArchetype;
  weight: number;
}>;

export type DistrictMassingProfile = Readonly<{
  fabricHeightRangeMetres: readonly [minimum: number, maximum: number];
  backgroundHeightRangeMetres: readonly [minimum: number, maximum: number];
  anchorHeightRangeMetres: readonly [minimum: number, maximum: number];
  clusterCenter: Point2;
  clusterRadiusMetres: number;
  targetLotAreaSquareMetres: number;
  maximumBuildingsPerRegion: number;
  fabricArchetypes: readonly WeightedArchetype[];
  backgroundArchetypes: readonly WeightedArchetype[];
  anchorArchetypes: readonly WeightedArchetype[];
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
      fabricHeightRangeMetres: [12, 42],
      backgroundHeightRangeMetres: [28, 82],
      anchorHeightRangeMetres: [95, 218],
      clusterCenter: [690, -225],
      clusterRadiusMetres: 390,
      targetLotAreaSquareMetres: 360,
      maximumBuildingsPerRegion: 7,
      fabricArchetypes: [
        { archetype: 'slab', weight: 0.72 },
        { archetype: 'box-tower', weight: 0.28 },
      ],
      backgroundArchetypes: [
        { archetype: 'slab', weight: 0.45 },
        { archetype: 'box-tower', weight: 0.3 },
        { archetype: 'podium-tower', weight: 0.2 },
        { archetype: 'stepped-tower', weight: 0.05 },
      ],
      anchorArchetypes: [
        { archetype: 'podium-tower', weight: 0.55 },
        { archetype: 'stepped-tower', weight: 0.35 },
        { archetype: 'box-tower', weight: 0.1 },
      ],
    },
    'commercial-transition': {
      fabricHeightRangeMetres: [10, 34],
      backgroundHeightRangeMetres: [24, 72],
      anchorHeightRangeMetres: [76, 148],
      clusterCenter: [570, 120],
      clusterRadiusMetres: 520,
      targetLotAreaSquareMetres: 450,
      maximumBuildingsPerRegion: 6,
      fabricArchetypes: [
        { archetype: 'slab', weight: 0.78 },
        { archetype: 'box-tower', weight: 0.22 },
      ],
      backgroundArchetypes: [
        { archetype: 'slab', weight: 0.55 },
        { archetype: 'box-tower', weight: 0.25 },
        { archetype: 'podium-tower', weight: 0.2 },
      ],
      anchorArchetypes: [
        { archetype: 'podium-tower', weight: 0.5 },
        { archetype: 'slab', weight: 0.3 },
        { archetype: 'stepped-tower', weight: 0.2 },
      ],
    },
    'dense-mixed': {
      fabricHeightRangeMetres: [8, 28],
      backgroundHeightRangeMetres: [18, 58],
      anchorHeightRangeMetres: [62, 108],
      clusterCenter: [-770, -455],
      clusterRadiusMetres: 310,
      targetLotAreaSquareMetres: 320,
      maximumBuildingsPerRegion: 7,
      fabricArchetypes: [
        { archetype: 'slab', weight: 0.82 },
        { archetype: 'box-tower', weight: 0.18 },
      ],
      backgroundArchetypes: [
        { archetype: 'slab', weight: 0.6 },
        { archetype: 'box-tower', weight: 0.35 },
        { archetype: 'podium-tower', weight: 0.05 },
      ],
      anchorArchetypes: [
        { archetype: 'slab', weight: 0.4 },
        { archetype: 'box-tower', weight: 0.3 },
        { archetype: 'podium-tower', weight: 0.3 },
      ],
    },
    'infrastructure-edge': {
      fabricHeightRangeMetres: [7, 20],
      backgroundHeightRangeMetres: [14, 38],
      anchorHeightRangeMetres: [40, 62],
      clusterCenter: [0, 0],
      clusterRadiusMetres: 500,
      targetLotAreaSquareMetres: 550,
      maximumBuildingsPerRegion: 4,
      fabricArchetypes: [{ archetype: 'slab', weight: 1 }],
      backgroundArchetypes: [{ archetype: 'slab', weight: 1 }],
      anchorArchetypes: [{ archetype: 'slab', weight: 1 }],
    },
  },
};
