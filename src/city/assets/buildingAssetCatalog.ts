import generatedCatalog from './buildingAssetCatalog.generated.json';
import { BUILDING_ASSET_OVERRIDES } from './buildingAssetOverrides';

export const BUILDING_ASSET_SOURCE_CATEGORIES = [
  'residential',
  'high-rise',
  'skyscraper',
] as const;

export const BUILDING_ASSET_USES = [
  'residential',
  'mixed-use',
  'office',
  'commercial',
  'civic',
  'industrial',
  'landmark',
] as const;

export const BUILDING_ASSET_FORMS = [
  'compact',
  'slab',
  'perimeter',
  'podium-tower',
  'tower',
  'complex',
  'spire',
] as const;

export const BUILDING_HEIGHT_CLASSES = [
  'low-rise',
  'mid-rise',
  'high-rise',
  'skyscraper',
] as const;

export const BUILDING_PLACEMENT_ROLES = [
  'fabric',
  'anchor',
  'landmark',
] as const;

export type BuildingAssetSourceCategory =
  (typeof BUILDING_ASSET_SOURCE_CATEGORIES)[number];
export type BuildingAssetUse = (typeof BUILDING_ASSET_USES)[number];
export type BuildingAssetForm = (typeof BUILDING_ASSET_FORMS)[number];
export type BuildingHeightClass = (typeof BUILDING_HEIGHT_CLASSES)[number];
export type BuildingPlacementRole =
  (typeof BUILDING_PLACEMENT_ROLES)[number];

export type GeneratedBuildingAsset = Readonly<{
  id: string;
  sourceCategory: BuildingAssetSourceCategory;
  assetPath: string;
  sourceDimensions: Readonly<{
    width: number;
    height: number;
    depth: number;
  }>;
  sourceBounds: Readonly<{
    min: readonly [number, number, number];
    max: readonly [number, number, number];
  }>;
  proportions: Readonly<{
    footprintAspect: number;
    slenderness: number;
  }>;
  geometry: Readonly<{
    meshes: number;
    vertices: number;
    triangles: number;
    materials: number;
    indexedMeshes: number;
    meshesWithNormals: number;
    meshesWithUvs: number;
  }>;
  audit: Readonly<{
    horizontalCenterOffsetRatio: number;
    groundOffsetRatio: number;
    shapeFingerprint: string;
    duplicateShapeOf: string | null;
    warnings: readonly string[];
  }>;
}>;

export type BuildingAssetMetadata = Readonly<{
  use: BuildingAssetUse;
  form: BuildingAssetForm;
  heightClass: BuildingHeightClass;
  placementRoles: readonly BuildingPlacementRole[];
  nominalSizeMetres: Readonly<{
    width: number;
    height: number;
    depth: number;
  }>;
  allowedUniformScale: readonly [minimum: number, maximum: number];
  allowedHeightScale: readonly [minimum: number, maximum: number];
  maximumPerCity: number | null;
  selectionWeight: number;
  enabled: boolean;
  notes?: string;
}>;

export type BuildingAssetCatalogEntry = GeneratedBuildingAsset &
  BuildingAssetMetadata;

type GeneratedCatalogFile = Readonly<{
  schemaVersion: number;
  generatedFrom: string;
  assets: readonly GeneratedBuildingAsset[];
}>;

export const GENERATED_BUILDING_ASSET_CATALOG =
  generatedCatalog as unknown as GeneratedCatalogFile;

export const BUILDING_ASSET_CATALOG: readonly BuildingAssetCatalogEntry[] =
  createBuildingAssetCatalog();

function createBuildingAssetCatalog(): readonly BuildingAssetCatalogEntry[] {
  const generatedIds = new Set(
    GENERATED_BUILDING_ASSET_CATALOG.assets.map((asset) => asset.id),
  );

  for (const overrideId of Object.keys(BUILDING_ASSET_OVERRIDES)) {
    if (!generatedIds.has(overrideId)) {
      throw new Error(`Building asset override references unknown asset "${overrideId}".`);
    }
  }

  return GENERATED_BUILDING_ASSET_CATALOG.assets.map((asset) => ({
    ...asset,
    ...defaultMetadata(asset),
    ...BUILDING_ASSET_OVERRIDES[asset.id],
  }));
}

function defaultMetadata(asset: GeneratedBuildingAsset): BuildingAssetMetadata {
  const heightClass = classifyHeight(asset.sourceDimensions.height);
  const placementRoles = defaultPlacementRoles(heightClass);

  return {
    use: defaultUse(asset.sourceCategory),
    form: classifyForm(asset),
    heightClass,
    placementRoles,
    nominalSizeMetres: {
      width: Math.round(asset.sourceDimensions.width),
      height: Math.round(asset.sourceDimensions.height),
      depth: Math.round(asset.sourceDimensions.depth),
    },
    allowedUniformScale: allowedUniformScale(heightClass),
    allowedHeightScale:
      heightClass === 'skyscraper' ? [0.95, 1.05] : [0.9, 1.1],
    maximumPerCity: defaultMaximumPerCity(heightClass),
    selectionWeight:
      placementRoles.includes('landmark') ? 0.35 : placementRoles.includes('anchor') ? 0.7 : 1,
    enabled: asset.audit.duplicateShapeOf === null,
  };
}

function defaultUse(
  sourceCategory: BuildingAssetSourceCategory,
): BuildingAssetUse {
  return sourceCategory === 'residential' ? 'residential' : 'office';
}

function classifyHeight(heightMetres: number): BuildingHeightClass {
  if (heightMetres < 45) {
    return 'low-rise';
  }

  if (heightMetres < 100) {
    return 'mid-rise';
  }

  if (heightMetres < 200) {
    return 'high-rise';
  }

  return 'skyscraper';
}

function classifyForm(asset: GeneratedBuildingAsset): BuildingAssetForm {
  if (asset.proportions.slenderness >= 4.5) {
    return 'spire';
  }

  if (asset.proportions.slenderness >= 2.15) {
    return 'tower';
  }

  if (asset.proportions.footprintAspect >= 1.65) {
    return 'slab';
  }

  return 'compact';
}

function defaultPlacementRoles(
  heightClass: BuildingHeightClass,
): readonly BuildingPlacementRole[] {
  switch (heightClass) {
    case 'low-rise':
    case 'mid-rise':
      return ['fabric'];
    case 'high-rise':
    case 'skyscraper':
      return ['anchor'];
  }
}

function allowedUniformScale(
  heightClass: BuildingHeightClass,
): readonly [number, number] {
  switch (heightClass) {
    case 'low-rise':
      return [0.85, 1.2];
    case 'mid-rise':
      return [0.85, 1.15];
    case 'high-rise':
      return [0.9, 1.1];
    case 'skyscraper':
      return [0.9, 1.05];
  }
}

function defaultMaximumPerCity(heightClass: BuildingHeightClass): number | null {
  switch (heightClass) {
    case 'low-rise':
    case 'mid-rise':
      return null;
    case 'high-rise':
      return 8;
    case 'skyscraper':
      return 3;
  }
}
