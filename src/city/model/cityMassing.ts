import type { Point2 } from './processedCity';

export const BUILDING_ARCHETYPES = [
  'box-tower',
  'slab',
  'podium-tower',
  'stepped-tower',
] as const;

export const MASSING_MATERIAL_CATEGORIES = [
  'commercial',
  'mixed-use',
  'landmark',
] as const;

export type BuildingArchetype = (typeof BUILDING_ARCHETYPES)[number];
export type MassingMaterialCategory = (typeof MASSING_MATERIAL_CATEGORIES)[number];
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
  blockId: string;
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
    buildings: number;
    primitiveParts: number;
    landmarkBuildingId: string;
    minimumHeightMetres: number;
    maximumHeightMetres: number;
    countsByArchetype: Readonly<Record<BuildingArchetype, number>>;
    countsByMaterial: Readonly<Record<MassingMaterialCategory, number>>;
  }>;
}>;
