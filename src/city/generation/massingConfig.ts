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

export type HeightFieldCentre = Readonly<{
  center: Point2;
  radiusMetres: number;
  strength: number;
}>;

export type CityHeightFieldConfig = Readonly<{
  centres: readonly HeightFieldCentre[];
  districtClusterWeight: number;
}>;

export type CityMassingConfig = Readonly<{
  seed: number;
  heightField: CityHeightFieldConfig;
  skyline: Readonly<{
    promotedTowerCount: number;
    minimumParcelDimensionMetres: number;
    heightRangeMetres: readonly [minimum: number, maximum: number];
  }>;
  highRise: Readonly<{
    promotedBuildingCount: number;
    minimumParcelDimensionMetres: number;
    heightRangeMetres: readonly [minimum: number, maximum: number];
    maximumHeightToParcelRatio: number;
  }>;
  landmark: Readonly<{
    districtId: string;
    heightMetres: number;
  }>;
  profiles: Readonly<Record<DistrictProfile, DistrictMassingProfile>>;
}>;

export const DEFAULT_CITY_MASSING_SEED = 20_260_801;

export const CITY_MASSING_CONFIG: CityMassingConfig = {
  seed: DEFAULT_CITY_MASSING_SEED,
  heightField: {
    centres: [
      { center: [690, -225], radiusMetres: 560, strength: 1 },
      { center: [545, 135], radiusMetres: 390, strength: 0.68 },
      { center: [-770, -455], radiusMetres: 330, strength: 0.52 },
    ],
    districtClusterWeight: 0.3,
  },
  skyline: {
    promotedTowerCount: 10,
    minimumParcelDimensionMetres: 24,
    heightRangeMetres: [130, 224],
  },
  highRise: {
    promotedBuildingCount: 120,
    minimumParcelDimensionMetres: 8,
    heightRangeMetres: [55, 145],
    maximumHeightToParcelRatio: 9.5,
  },
  landmark: {
    districtId: 'east-core',
    heightMetres: 287,
  },
  profiles: {
    'dense-central-core': {
      fabricHeightRangeMetres: [12, 42],
      backgroundHeightRangeMetres: [36, 132],
      anchorHeightRangeMetres: [125, 285],
      clusterCenter: [690, -225],
      clusterRadiusMetres: 390,
      targetLotAreaSquareMetres: 360,
      maximumBuildingsPerRegion: 7,
      fabricArchetypes: [
        { archetype: 'slab', weight: 0.72 },
        { archetype: 'box-tower', weight: 0.28 },
      ],
      backgroundArchetypes: [
        { archetype: 'slab', weight: 0.34 },
        { archetype: 'box-tower', weight: 0.2 },
        { archetype: 'perimeter-block', weight: 0.18 },
        { archetype: 'podium-tower', weight: 0.18 },
        { archetype: 'commercial-block', weight: 0.1 },
      ],
      anchorArchetypes: [
        { archetype: 'podium-tower', weight: 0.34 },
        { archetype: 'multi-tower-podium', weight: 0.28 },
        { archetype: 'stepped-tower', weight: 0.23 },
        { archetype: 'commercial-block', weight: 0.1 },
        { archetype: 'megastructure', weight: 0.05 },
      ],
    },
    'commercial-transition': {
      fabricHeightRangeMetres: [10, 34],
      backgroundHeightRangeMetres: [28, 102],
      anchorHeightRangeMetres: [92, 205],
      clusterCenter: [570, 120],
      clusterRadiusMetres: 520,
      targetLotAreaSquareMetres: 450,
      maximumBuildingsPerRegion: 6,
      fabricArchetypes: [
        { archetype: 'slab', weight: 0.78 },
        { archetype: 'box-tower', weight: 0.22 },
      ],
      backgroundArchetypes: [
        { archetype: 'slab', weight: 0.42 },
        { archetype: 'box-tower', weight: 0.18 },
        { archetype: 'perimeter-block', weight: 0.18 },
        { archetype: 'podium-tower', weight: 0.14 },
        { archetype: 'commercial-block', weight: 0.08 },
      ],
      anchorArchetypes: [
        { archetype: 'podium-tower', weight: 0.36 },
        { archetype: 'multi-tower-podium', weight: 0.24 },
        { archetype: 'slab', weight: 0.16 },
        { archetype: 'stepped-tower', weight: 0.14 },
        { archetype: 'commercial-block', weight: 0.1 },
      ],
    },
    'dense-mixed': {
      fabricHeightRangeMetres: [8, 28],
      backgroundHeightRangeMetres: [18, 58],
      anchorHeightRangeMetres: [72, 142],
      clusterCenter: [-770, -455],
      clusterRadiusMetres: 310,
      targetLotAreaSquareMetres: 320,
      maximumBuildingsPerRegion: 7,
      fabricArchetypes: [
        { archetype: 'slab', weight: 0.82 },
        { archetype: 'box-tower', weight: 0.18 },
      ],
      backgroundArchetypes: [
        { archetype: 'slab', weight: 0.52 },
        { archetype: 'box-tower', weight: 0.22 },
        { archetype: 'perimeter-block', weight: 0.16 },
        { archetype: 'podium-tower', weight: 0.1 },
      ],
      anchorArchetypes: [
        { archetype: 'slab', weight: 0.28 },
        { archetype: 'box-tower', weight: 0.2 },
        { archetype: 'podium-tower', weight: 0.28 },
        { archetype: 'multi-tower-podium', weight: 0.14 },
        { archetype: 'commercial-block', weight: 0.1 },
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
