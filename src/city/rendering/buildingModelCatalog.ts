export const BUILDING_MODEL_CATEGORIES = [
  'residential',
  'high-rise',
  'skyscraper',
] as const;

export type BuildingModelCategory =
  (typeof BUILDING_MODEL_CATEGORIES)[number];

export type BuildingModelCatalogEntry = Readonly<{
  id: string;
  category: BuildingModelCategory;
  assetPath: string;
}>;

export const SKYSCRAPER_MODEL_TARGET_COUNT = 11;

const MODEL_ROOT =
  'assets/models/buildings/lowpoly-buildings-pack';

const RESIDENTIAL_MODEL_NUMBERS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20,
  21, 22, 23, 24, 25, 26,
] as const;

const HIGH_RISE_MODEL_NUMBERS = createIntegerRange(1, 37);
const SKYSCRAPER_MODEL_NUMBERS = createIntegerRange(1, 16);

export const BUILDING_MODEL_CATALOG: readonly BuildingModelCatalogEntry[] = [
  ...createCatalogEntries('residential', RESIDENTIAL_MODEL_NUMBERS),
  ...createCatalogEntries('high-rise', HIGH_RISE_MODEL_NUMBERS),
  ...createCatalogEntries('skyscraper', SKYSCRAPER_MODEL_NUMBERS),
];

function createCatalogEntries(
  category: BuildingModelCategory,
  modelNumbers: readonly number[],
): readonly BuildingModelCatalogEntry[] {
  const filePrefix = category === 'high-rise' ? 'high-rise' : category;

  return modelNumbers.map((modelNumber) => ({
    id: `${category}-${modelNumber}`,
    category,
    assetPath: `${MODEL_ROOT}/${category}/${filePrefix}-lp-${modelNumber}.glb`,
  }));
}

function createIntegerRange(
  minimumInclusive: number,
  maximumInclusive: number,
): readonly number[] {
  return Array.from(
    { length: maximumInclusive - minimumInclusive + 1 },
    (_, index) => minimumInclusive + index,
  );
}
