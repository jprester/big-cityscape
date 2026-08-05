import type { BuildingSlot } from './buildingSlot';

export type SyntheticBounds2 = Readonly<{
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}>;

export const SYNTHETIC_DISTRICT_PROFILE_IDS = ['core', 'transition'] as const;

export type SyntheticDistrictProfileId =
  (typeof SYNTHETIC_DISTRICT_PROFILE_IDS)[number];

export const SYNTHETIC_BLOCK_TEMPLATE_IDS = [
  'fabric-grid',
  'edge-slabs',
  'anchor-and-fill',
  'landmark-plaza',
] as const;

export type SyntheticBlockTemplateId =
  (typeof SYNTHETIC_BLOCK_TEMPLATE_IDS)[number];

export type SyntheticBlockDefinition = Readonly<{
  id: string;
  districtId: string;
  seed: number;
  gridColumn: number;
  gridRow: number;
  profileId: SyntheticDistrictProfileId;
  templateId: SyntheticBlockTemplateId;
  bounds: SyntheticBounds2;
  buildableBounds: SyntheticBounds2;
  slots: readonly BuildingSlot[];
}>;

export type SyntheticProofDistrict = Readonly<{
  id: string;
  seed: number;
  bounds: SyntheticBounds2;
  blocks: readonly SyntheticBlockDefinition[];
  slots: readonly BuildingSlot[];
  metadata: Readonly<{
    blockCount: number;
    slotCount: number;
    profileCounts: Readonly<Record<SyntheticDistrictProfileId, number>>;
    templateCounts: Readonly<Record<SyntheticBlockTemplateId, number>>;
  }>;
}>;
