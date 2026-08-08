import type { SyntheticBounds2 } from './proofDistrict';

export const SYNTHETIC_ROAD_MARKING_KINDS = [
  'centre-line-dash',
  'crosswalk-bar',
] as const;

export type SyntheticRoadMarkingKind =
  (typeof SYNTHETIC_ROAD_MARKING_KINDS)[number];

export type SyntheticRoadMarking = Readonly<{
  id: string;
  kind: SyntheticRoadMarkingKind;
  bounds: SyntheticBounds2;
}>;

export type SyntheticRoadMarkingPlan = Readonly<{
  markings: readonly SyntheticRoadMarking[];
  metadata: Readonly<{
    centreLineDashCount: number;
    crosswalkBarCount: number;
    markedIntersectionCount: number;
  }>;
}>;
