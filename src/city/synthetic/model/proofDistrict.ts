import type { BuildingSlot } from './buildingSlot';
import type { SyntheticStreetCorridor } from './streetCorridor';

export type SyntheticBounds2 = Readonly<{
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}>;

export const SYNTHETIC_DISTRICT_PROFILE_IDS = ['core', 'transition'] as const;

export type SyntheticDistrictProfileId =
  (typeof SYNTHETIC_DISTRICT_PROFILE_IDS)[number];

export const SYNTHETIC_DISTRICT_COMPOSITION_PROFILE_IDS = [
  'centre',
  'urban',
  'edge',
] as const;

export type SyntheticDistrictCompositionProfileId =
  (typeof SYNTHETIC_DISTRICT_COMPOSITION_PROFILE_IDS)[number];

export const SYNTHETIC_DISTRICT_GRID_VARIANT_IDS = [
  'balanced',
  'fine-grain',
  'large-block',
] as const;

export type SyntheticDistrictGridVariantId =
  (typeof SYNTHETIC_DISTRICT_GRID_VARIANT_IDS)[number];

export const SYNTHETIC_DISTRICT_GRID_ORIENTATION_IDS = [
  'identity',
  'mirror-x',
  'mirror-z',
  'mirror-both',
] as const;

export type SyntheticDistrictGridOrientationId =
  (typeof SYNTHETIC_DISTRICT_GRID_ORIENTATION_IDS)[number];

export const SYNTHETIC_BLOCK_TEMPLATE_IDS = [
  'fabric-grid',
  'edge-slabs',
  'anchor-and-fill',
  'skyline-anchor',
  'landmark-plaza',
  'open-space',
] as const;

export type SyntheticBlockTemplateId =
  (typeof SYNTHETIC_BLOCK_TEMPLATE_IDS)[number];

export const SYNTHETIC_BLOCK_LAYOUT_VARIATION_IDS = [
  'standard',
  'offset-band',
] as const;

export type SyntheticBlockLayoutVariationId =
  (typeof SYNTHETIC_BLOCK_LAYOUT_VARIATION_IDS)[number];

export type SyntheticBlockDefinition = Readonly<{
  id: string;
  districtId: string;
  seed: number;
  gridColumn: number;
  gridRow: number;
  profileId: SyntheticDistrictProfileId;
  templateId: SyntheticBlockTemplateId;
  layoutVariationId: SyntheticBlockLayoutVariationId;
  layoutOffsetMetres: readonly [xMetres: number, zMetres: number];
  bounds: SyntheticBounds2;
  buildableBounds: SyntheticBounds2;
  slots: readonly BuildingSlot[];
}>;

export type SyntheticProofDistrict = Readonly<{
  id: string;
  seed: number;
  center: readonly [xMetres: number, zMetres: number];
  compositionProfileId: SyntheticDistrictCompositionProfileId;
  gridVariantId: SyntheticDistrictGridVariantId;
  gridOrientationId: SyntheticDistrictGridOrientationId;
  hasLandmark: boolean;
  bounds: SyntheticBounds2;
  blocks: readonly SyntheticBlockDefinition[];
  streetCorridors: readonly SyntheticStreetCorridor[];
  slots: readonly BuildingSlot[];
  metadata: Readonly<{
    blockCount: number;
    slotCount: number;
    profileCounts: Readonly<Record<SyntheticDistrictProfileId, number>>;
    templateCounts: Readonly<Record<SyntheticBlockTemplateId, number>>;
  }>;
}>;
