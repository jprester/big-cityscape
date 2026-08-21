export const SYNTHETIC_SIGN_KINDS = [
  'advertisement',
  'neon',
  'logo',
] as const;

export type SyntheticSignKind = (typeof SYNTHETIC_SIGN_KINDS)[number];

export const SYNTHETIC_SIGN_MOUNTING_ZONES = [
  'storefront',
  'facade',
  'crown',
] as const;

export type SyntheticSignMountingZone =
  (typeof SYNTHETIC_SIGN_MOUNTING_ZONES)[number];

export type SyntheticSignPlacement = Readonly<{
  id: string;
  seed: number;
  kind: SyntheticSignKind;
  mountingZone: SyntheticSignMountingZone;
  buildingId: string;
  districtId: string;
  blockId: string;
  assetId: string;
  facadeSlotId: string;
  center: readonly [xMetres: number, yMetres: number, zMetres: number];
  facing: readonly [x: number, z: number];
  rotationRadians: number;
  widthMetres: number;
  heightMetres: number;
}>;

export type SyntheticSignagePlan = Readonly<{
  id: string;
  seed: number;
  placements: readonly SyntheticSignPlacement[];
  metadata: Readonly<{
    buildingCount: number;
    eligibleBuildingCount: number;
    signCount: number;
    kindCounts: Readonly<Record<SyntheticSignKind, number>>;
    mountingZoneCounts: Readonly<Record<SyntheticSignMountingZone, number>>;
  }>;
}>;
