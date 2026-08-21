export const BUILDING_FACADE_IDS = [
  'north',
  'east',
  'south',
  'west',
] as const;

export type BuildingFacadeId = (typeof BUILDING_FACADE_IDS)[number];

/**
 * A flat, unobstructed rectangle measured in normalized building-local metres.
 * Models are centred horizontally and grounded before these coordinates are
 * transformed by a synthetic building placement.
 */
export type BuildingFacadeSlot = Readonly<{
  id: string;
  facade: BuildingFacadeId;
  center: readonly [xMetres: number, yMetres: number, zMetres: number];
  widthMetres: number;
  heightMetres: number;
}>;
