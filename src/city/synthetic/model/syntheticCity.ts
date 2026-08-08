import type { BuildingSlot } from './buildingSlot';
import type {
  SyntheticBlockDefinition,
  SyntheticBounds2,
  SyntheticDistrictCompositionProfileId,
  SyntheticDistrictGridVariantId,
  SyntheticProofDistrict,
} from './proofDistrict';
import type { SyntheticRoadMarkingPlan } from './roadMarking';
import type { SyntheticStreetCorridor } from './streetCorridor';

export type SyntheticCity = Readonly<{
  id: string;
  seed: number;
  layoutSeed: number;
  bounds: SyntheticBounds2;
  districts: readonly SyntheticProofDistrict[];
  blocks: readonly SyntheticBlockDefinition[];
  streetCorridors: readonly SyntheticStreetCorridor[];
  roadMarkings: SyntheticRoadMarkingPlan;
  slots: readonly BuildingSlot[];
  metadata: Readonly<{
    districtCount: number;
    blockCount: number;
    slotCount: number;
    landmarkDistrictId: string;
    secondarySkylineAnchorCount: number;
    profileCounts: Readonly<
      Record<SyntheticDistrictCompositionProfileId, number>
    >;
    gridVariantCounts: Readonly<Record<SyntheticDistrictGridVariantId, number>>;
  }>;
}>;
