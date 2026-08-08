import type { SyntheticBounds2 } from './proofDistrict';

export const SYNTHETIC_STREET_HIERARCHY_IDS = [
  'arterial',
  'secondary',
  'local',
] as const;

export type SyntheticStreetHierarchyId =
  (typeof SYNTHETIC_STREET_HIERARCHY_IDS)[number];

export type SyntheticStreetAxis =
  | 'north-south'
  | 'east-west'
  | 'intersection';

export type SyntheticStreetContext =
  | 'district-internal'
  | 'district-boundary'
  | 'city-edge';

export type SyntheticStreetCorridor = Readonly<{
  id: string;
  districtId: string | null;
  hierarchyId: SyntheticStreetHierarchyId;
  axis: SyntheticStreetAxis;
  context: SyntheticStreetContext;
  bounds: SyntheticBounds2;
}>;

export function countStreetHierarchies(
  streets: readonly SyntheticStreetCorridor[],
): Readonly<Record<SyntheticStreetHierarchyId, number>> {
  return {
    arterial: streets.filter((street) => street.hierarchyId === 'arterial')
      .length,
    secondary: streets.filter((street) => street.hierarchyId === 'secondary')
      .length,
    local: streets.filter((street) => street.hierarchyId === 'local').length,
  };
}
