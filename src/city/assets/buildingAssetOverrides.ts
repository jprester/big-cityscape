import type { BuildingAssetMetadata } from './buildingAssetCatalog';

type BuildingAssetOverride = Readonly<Partial<BuildingAssetMetadata>>;

export const BUILDING_ASSET_OVERRIDES: Readonly<
  Record<string, BuildingAssetOverride>
> = {
  'residential-1': { form: 'complex' },
  'residential-2': { form: 'complex' },
  'residential-4': { form: 'complex' },
  'residential-5': { use: 'mixed-use', form: 'compact' },
  'residential-9': { form: 'complex' },
  'residential-10': { use: 'commercial', form: 'compact' },
  'residential-11': { form: 'tower' },
  'residential-13': { form: 'slab' },
  'residential-20': {
    enabled: false,
    notes: 'Exact shape duplicate of high-rise-18 at a different source scale.',
  },
  'residential-21': { form: 'tower' },
  'residential-24': { use: 'mixed-use', form: 'podium-tower' },
  'residential-26': { use: 'commercial', form: 'perimeter' },
  'residential-27': { use: 'mixed-use', form: 'podium-tower' },
  'residential-29': { use: 'mixed-use', form: 'podium-tower' },
  'residential-30': { form: 'complex' },
  'residential-32': { form: 'podium-tower' },

  'high-rise-1': { form: 'complex' },
  'high-rise-5': {
    enabled: false,
    notes: 'Retired after visual review; proportions fit the city poorly.',
  },
  'high-rise-7': { form: 'podium-tower' },
  'high-rise-8': { form: 'podium-tower' },
  'high-rise-15': { form: 'slab' },
  'high-rise-16': {
    form: 'spire',
    placementRoles: ['anchor', 'landmark'],
    maximumPerCity: 1,
    selectionWeight: 0.35,
  },
  'high-rise-17': {
    use: 'commercial',
    form: 'complex',
    selectionWeight: 0.7,
  },
  'high-rise-18': { form: 'slab' },
  'high-rise-20': { form: 'podium-tower' },
  'high-rise-21': { form: 'slab' },
  'high-rise-22': { form: 'slab' },
  'high-rise-24': { form: 'slab' },
  'high-rise-26': { form: 'complex' },
  'high-rise-28': { use: 'commercial', form: 'compact' },
  'high-rise-29': { use: 'commercial', form: 'perimeter' },
  'high-rise-30': {
    form: 'spire',
    placementRoles: ['anchor', 'landmark'],
    maximumPerCity: 1,
    selectionWeight: 0.35,
  },
  'high-rise-31': { use: 'commercial', form: 'perimeter' },
  'high-rise-32': {
    form: 'spire',
    placementRoles: ['anchor', 'landmark'],
    maximumPerCity: 1,
    selectionWeight: 0.35,
  },
  'high-rise-33': { form: 'tower' },
  'high-rise-34': { form: 'complex' },
  'high-rise-36': { form: 'tower' },
  'high-rise-37': { form: 'slab' },
  'high-rise-38': { form: 'tower' },
  'high-rise-39': { form: 'slab' },
  'high-rise-40': {
    use: 'commercial',
    form: 'podium-tower',
    heightClass: 'low-rise',
    allowedUniformScale: [0.6, 1],
    notes:
      'Reviewed as a broad commercial campus; uniform down-scaling fits large fabric cells without footprint distortion.',
  },

  'skyscraper-2': {
    placementRoles: ['anchor', 'landmark'],
    maximumPerCity: 1,
    selectionWeight: 0.3,
  },
  'skyscraper-3': {
    form: 'complex',
    placementRoles: ['anchor', 'landmark'],
    maximumPerCity: 1,
  },
  'skyscraper-5': {
    form: 'spire',
    placementRoles: ['anchor', 'landmark'],
    maximumPerCity: 1,
  },
  'skyscraper-6': {
    enabled: false,
    notes: 'Exact shape duplicate of skyscraper-4.',
  },
  'skyscraper-7': { form: 'podium-tower' },
  'skyscraper-8': { form: 'podium-tower' },
  'skyscraper-9': { form: 'podium-tower' },
  'skyscraper-10': {
    placementRoles: ['anchor', 'landmark'],
    maximumPerCity: 1,
  },
  'skyscraper-11': { form: 'spire' },
  'skyscraper-12': { form: 'spire' },
  'skyscraper-13': { form: 'slab' },
  'skyscraper-14': { form: 'slab' },
  'skyscraper-15': { form: 'spire' },
  'skyscraper-16': {
    form: 'spire',
  },
  'skyscraper-17': {
    form: 'complex',
    placementRoles: ['anchor', 'landmark'],
    maximumPerCity: 1,
  },
  'skyscraper-18': {
    form: 'spire',
    placementRoles: ['anchor', 'landmark'],
    maximumPerCity: 1,
  },
  'skyscraper-19': {
    form: 'complex',
    placementRoles: ['anchor', 'landmark'],
    maximumPerCity: 1,
  },
  'skyscraper-21': { form: 'complex' },
};
