import type {
  BuildingAssetForm,
  BuildingAssetUse,
  BuildingHeightClass,
  BuildingPlacementRole,
} from '../../assets/buildingAssetCatalog';

export type SyntheticPoint2 = readonly [xMetres: number, zMetres: number];

export type BuildingSlot = Readonly<{
  id: string;
  districtId: string;
  blockId: string;
  seed: number;
  center: SyntheticPoint2;
  widthMetres: number;
  depthMetres: number;
  targetHeightMetres: number;
  rotationRadians: number;
  allowedUses: readonly BuildingAssetUse[];
  allowedForms: readonly BuildingAssetForm[];
  heightClass: BuildingHeightClass;
  role: BuildingPlacementRole;
}>;
