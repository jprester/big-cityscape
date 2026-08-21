import type { SyntheticStreetHierarchyId } from './streetCorridor';

export const SYNTHETIC_STREET_LAMP_POLE_WIDTH_METRES = 0.13;

export type SyntheticStreetLampDefinition = Readonly<{
  id: string;
  streetId: string;
  hierarchyId: Extract<SyntheticStreetHierarchyId, 'arterial' | 'secondary'>;
  position: readonly [xMetres: number, zMetres: number];
  facing: readonly [x: number, z: number];
  heightMetres: number;
}>;

export type SyntheticStreetLampPlan = Readonly<{
  id: string;
  seed: number;
  lamps: readonly SyntheticStreetLampDefinition[];
  metadata: Readonly<{
    lampCount: number;
    arterialLampCount: number;
    secondaryLampCount: number;
  }>;
}>;
