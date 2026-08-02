import type { Point2 } from './processedCity';

export type ResidualFabricDiscardReason =
  | 'bounds'
  | 'coverage'
  | 'roadClearance'
  | 'railClearance'
  | 'waterClearance'
  | 'existingBuilding';

export type ResidualFabricLot = Readonly<{
  id: string;
  districtId: string;
  center: Point2;
  widthMetres: number;
  depthMetres: number;
  rotationRadians: number;
  footprint: readonly Point2[];
}>;

export type ResidualFabricDefinition = Readonly<{
  seed: number;
  lots: readonly ResidualFabricLot[];
  metadata: Readonly<{
    gridSpacingMetres: number;
    candidates: number;
    lots: number;
    discardedCandidates: number;
    discardedByReason: Readonly<Record<ResidualFabricDiscardReason, number>>;
  }>;
}>;
