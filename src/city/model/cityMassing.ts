import type { Point2 } from './processedCity';

export const BUILDING_ARCHETYPES = [
  'box-tower',
  'slab',
  'perimeter-block',
  'podium-tower',
  'multi-tower-podium',
  'stepped-tower',
  'commercial-block',
  'megastructure',
  'landmark-spire',
] as const;

export const MASSING_MATERIAL_CATEGORIES = [
  'commercial',
  'mixed-use',
  'landmark',
] as const;

export const BUILDING_SOURCES = ['road-block', 'residual-fabric'] as const;
export const BUILDING_HEIGHT_BANDS = [
  'low-rise',
  'mid-rise',
  'high-rise',
  'landmark',
] as const;

export type BuildingArchetype = (typeof BUILDING_ARCHETYPES)[number];
export type MassingMaterialCategory = (typeof MASSING_MATERIAL_CATEGORIES)[number];
export type BuildingSource = (typeof BUILDING_SOURCES)[number];
export type BuildingHeightBand = (typeof BUILDING_HEIGHT_BANDS)[number];
export type BuildingRole = 'background' | 'anchor' | 'landmark';

export type BuildingMassPart = Readonly<{
  center: Point2;
  widthMetres: number;
  depthMetres: number;
  baseHeightMetres: number;
  heightMetres: number;
  rotationRadians: number;
}>;

export type BuildingDefinition = Readonly<{
  id: string;
  source: BuildingSource;
  blockId: string;
  regionId: string;
  districtId: string;
  seed: number;
  role: BuildingRole;
  archetype: BuildingArchetype;
  material: MassingMaterialCategory;
  footprint: readonly Point2[];
  heightMetres: number;
  parts: readonly BuildingMassPart[];
}>;

export type CityMassingDefinition = Readonly<{
  seed: number;
  buildings: readonly BuildingDefinition[];
  metadata: Readonly<{
    sourceBlocks: number;
    sourceRegions: number;
    sourceFabricLots: number;
    populatedRegions: number;
    skippedRegions: number;
    buildings: number;
    primitiveParts: number;
    landmarkBuildingId: string;
    minimumHeightMetres: number;
    maximumHeightMetres: number;
    countsByArchetype: Readonly<Record<BuildingArchetype, number>>;
    countsByHeightBand: Readonly<Record<BuildingHeightBand, number>>;
    countsByMaterial: Readonly<Record<MassingMaterialCategory, number>>;
    countsBySource: Readonly<Record<BuildingSource, number>>;
  }>;
}>;
