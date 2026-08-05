import type { BuildingSlot } from './buildingSlot';
import type {
  SyntheticBlockDefinition,
  SyntheticBounds2,
  SyntheticDistrictCompositionProfileId,
  SyntheticProofDistrict,
} from './proofDistrict';

export type SyntheticCity = Readonly<{
  id: string;
  seed: number;
  bounds: SyntheticBounds2;
  districts: readonly SyntheticProofDistrict[];
  blocks: readonly SyntheticBlockDefinition[];
  slots: readonly BuildingSlot[];
  metadata: Readonly<{
    districtCount: number;
    blockCount: number;
    slotCount: number;
    landmarkDistrictId: string;
    profileCounts: Readonly<
      Record<SyntheticDistrictCompositionProfileId, number>
    >;
  }>;
}>;
