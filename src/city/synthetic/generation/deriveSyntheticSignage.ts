import {
  BUILDING_ASSET_CATALOG,
  type BuildingAssetCatalogEntry,
  type BuildingAssetUse,
} from '../../assets/buildingAssetCatalog';
import type {
  BuildingFacadeId,
  BuildingFacadeSlot,
} from '../../assets/buildingFacadeSlot';
import { createSeededRandom, deriveSeed } from '../../../core/random';
import type { SyntheticBuildingPlacement } from '../model/buildingPlacement';
import type {
  SyntheticBlockDefinition,
  SyntheticDistrictCompositionProfileId,
  SyntheticProofDistrict,
} from '../model/proofDistrict';
import type {
  SyntheticSignKind,
  SyntheticSignMountingZone,
  SyntheticSignagePlan,
  SyntheticSignPlacement,
} from '../model/signage';

export type SyntheticSignageDistrict = Pick<
  SyntheticProofDistrict,
  'id' | 'compositionProfileId'
>;

export type SyntheticSignageConfig = Readonly<{
  facadeSpawnChanceByProfile: Readonly<
    Record<SyntheticDistrictCompositionProfileId, number>
  >;
  storefrontSpawnChanceByProfile: Readonly<
    Record<SyntheticDistrictCompositionProfileId, number>
  >;
  crownSpawnChanceByProfile: Readonly<
    Record<SyntheticDistrictCompositionProfileId, number>
  >;
  spawnMultiplierByUse: Readonly<Record<BuildingAssetUse, number>>;
  facadeInsetMetres: number;
}>;

export const DEFAULT_SYNTHETIC_SIGNAGE_CONFIG: SyntheticSignageConfig = {
  facadeSpawnChanceByProfile: {
    centre: 0.62,
    urban: 0.36,
    edge: 0.17,
  },
  storefrontSpawnChanceByProfile: {
    centre: 0.62,
    urban: 0.42,
    edge: 0.22,
  },
  crownSpawnChanceByProfile: {
    centre: 0.46,
    urban: 0.24,
    edge: 0.08,
  },
  spawnMultiplierByUse: {
    residential: 0.38,
    'mixed-use': 1.15,
    office: 0.8,
    commercial: 1.4,
    civic: 0.45,
    industrial: 0.32,
    landmark: 1.05,
  },
  facadeInsetMetres: 0.16,
};

type WorldFacadeSlot = Readonly<{
  source: BuildingFacadeSlot;
  center: readonly [number, number, number];
  facing: readonly [number, number];
  tangent: readonly [number, number];
  widthMetres: number;
  heightMetres: number;
  streetDistanceMetres: number;
}>;

const STOREFRONT_USE_MULTIPLIERS: Readonly<Record<BuildingAssetUse, number>> = {
  residential: 0.08,
  'mixed-use': 1,
  office: 0.28,
  commercial: 1.25,
  civic: 0.22,
  industrial: 0.12,
  landmark: 0.15,
};

const CROWN_USE_MULTIPLIERS: Readonly<Record<BuildingAssetUse, number>> = {
  residential: 0.18,
  'mixed-use': 0.62,
  office: 1,
  commercial: 0.48,
  civic: 0.35,
  industrial: 0.12,
  landmark: 1.2,
};

const STOREFRONT_BOTTOM_METRES = 2.4;
const STOREFRONT_TOP_METRES = 7;
const CROWN_MINIMUM_BUILDING_HEIGHT_METRES = 70;

const FACE_NORMALS: Readonly<
  Record<BuildingFacadeId, readonly [x: number, z: number]>
> = {
  north: [0, 1],
  east: [1, 0],
  south: [0, -1],
  west: [-1, 0],
};

export function deriveSyntheticSignage(
  id: string,
  seed: number,
  placements: readonly SyntheticBuildingPlacement[],
  blocks: readonly SyntheticBlockDefinition[],
  districts: readonly SyntheticSignageDistrict[],
  catalog: readonly BuildingAssetCatalogEntry[] = BUILDING_ASSET_CATALOG,
  config: SyntheticSignageConfig = DEFAULT_SYNTHETIC_SIGNAGE_CONFIG,
): SyntheticSignagePlan {
  const assetsById = new Map(catalog.map((asset) => [asset.id, asset]));
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const profilesByDistrictId = new Map(
    districts.map((district) => [district.id, district.compositionProfileId]),
  );
  const signs: SyntheticSignPlacement[] = [];
  let eligibleBuildingCount = 0;

  for (const building of [...placements].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const asset = assetsById.get(building.assetId);
    const block = blocksById.get(building.blockId);
    const profile = profilesByDistrictId.get(building.districtId);

    if (
      asset === undefined ||
      block === undefined ||
      profile === undefined ||
      asset.facadeSlots.length === 0
    ) {
      continue;
    }

    eligibleBuildingCount += 1;
    const worldFacades = asset.facadeSlots.map((slot) =>
      transformFacadeSlot(slot, building, asset, block),
    );
    const facadeSign = deriveFacadeSign(
      id,
      seed,
      building,
      asset,
      profile,
      worldFacades,
      config,
    );
    const storefrontSign = deriveStorefrontSign(
      id,
      seed,
      building,
      asset,
      profile,
      worldFacades,
      config,
    );
    const crownSign = deriveCrownSign(
      id,
      seed,
      building,
      asset,
      profile,
      worldFacades,
      config,
    );

    if (facadeSign !== undefined) {
      signs.push(facadeSign);
    }

    if (storefrontSign !== undefined) {
      signs.push(storefrontSign);
    }

    if (crownSign !== undefined) {
      signs.push(crownSign);
    }
  }

  return {
    id,
    seed,
    placements: signs,
    metadata: {
      buildingCount: placements.length,
      eligibleBuildingCount,
      signCount: signs.length,
      kindCounts: countKinds(signs),
      mountingZoneCounts: countMountingZones(signs),
    },
  };
}

function deriveFacadeSign(
  planId: string,
  seed: number,
  building: SyntheticBuildingPlacement,
  asset: BuildingAssetCatalogEntry,
  profile: SyntheticDistrictCompositionProfileId,
  facades: readonly WorldFacadeSlot[],
  config: SyntheticSignageConfig,
): SyntheticSignPlacement | undefined {
  const signSeed = deriveSeed(seed, building.id, 'facade-sign');
  const random = createSeededRandom(signSeed);
  const spawnChance = Math.min(
    1,
    config.facadeSpawnChanceByProfile[profile] *
      config.spawnMultiplierByUse[asset.use],
  );

  if (random.next() >= spawnChance) {
    return undefined;
  }

  const facade = chooseStreetFacingFacade(facades, random.next());

  if (facade === undefined) {
    return undefined;
  }

  const kind = chooseSignKind(asset, random.next());
  const dimensions = fitSignDimensions(facade, kind, random.next());
  const verticalBias = kind === 'neon' ? -0.18 : 0;

  return createSignPlacement(
    planId,
    building,
    signSeed,
    'facade',
    kind,
    facade,
    dimensions,
    random.float(-0.2, 0.2),
    verticalBias,
    config.facadeInsetMetres,
  );
}

function deriveStorefrontSign(
  planId: string,
  seed: number,
  building: SyntheticBuildingPlacement,
  asset: BuildingAssetCatalogEntry,
  profile: SyntheticDistrictCompositionProfileId,
  facades: readonly WorldFacadeSlot[],
  config: SyntheticSignageConfig,
): SyntheticSignPlacement | undefined {
  const signSeed = deriveSeed(seed, building.id, 'storefront-sign');
  const random = createSeededRandom(signSeed);
  const spawnChance = Math.min(
    1,
    config.storefrontSpawnChanceByProfile[profile] *
      STOREFRONT_USE_MULTIPLIERS[asset.use],
  );

  if (random.next() >= spawnChance) {
    return undefined;
  }

  const storefrontFacades = facades
    .map((facade) =>
      cropFacadeVertically(
        facade,
        STOREFRONT_BOTTOM_METRES,
        STOREFRONT_TOP_METRES,
      ),
    )
    .filter((facade): facade is WorldFacadeSlot => facade !== undefined);
  const facade = chooseStreetFacingFacade(storefrontFacades, random.next());

  if (facade === undefined) {
    return undefined;
  }

  const kind: SyntheticSignKind =
    random.next() < 0.54 ? 'neon' : 'advertisement';
  const dimensions = fitStorefrontDimensions(facade, random.next());

  return createSignPlacement(
    planId,
    building,
    signSeed,
    'storefront',
    kind,
    facade,
    dimensions,
    random.float(-0.34, 0.34),
    0,
    config.facadeInsetMetres + 0.02,
  );
}

function deriveCrownSign(
  planId: string,
  seed: number,
  building: SyntheticBuildingPlacement,
  asset: BuildingAssetCatalogEntry,
  profile: SyntheticDistrictCompositionProfileId,
  facades: readonly WorldFacadeSlot[],
  config: SyntheticSignageConfig,
): SyntheticSignPlacement | undefined {
  if (building.dimensionsMetres.height < CROWN_MINIMUM_BUILDING_HEIGHT_METRES) {
    return undefined;
  }

  const signSeed = deriveSeed(seed, building.id, 'crown-sign');
  const random = createSeededRandom(signSeed);
  const spawnChance = Math.min(
    1,
    config.crownSpawnChanceByProfile[profile] *
      CROWN_USE_MULTIPLIERS[asset.use],
  );

  if (random.next() >= spawnChance) {
    return undefined;
  }

  const buildingTop = 0.5 + building.dimensionsMetres.height;
  const crownBandHeight = Math.min(22, building.dimensionsMetres.height * 0.22);
  const crownFacades = facades
    .map((facade) =>
      cropFacadeVertically(
        facade,
        buildingTop - crownBandHeight,
        buildingTop - 1.5,
      ),
    )
    .filter((facade): facade is WorldFacadeSlot => facade !== undefined);
  const facade = chooseStreetFacingFacade(crownFacades, random.next());

  if (facade === undefined) {
    return undefined;
  }

  const kind: SyntheticSignKind = random.next() < 0.82 ? 'logo' : 'neon';
  const dimensions = fitCrownDimensions(facade, random.next());

  return createSignPlacement(
    planId,
    building,
    signSeed,
    'crown',
    kind,
    facade,
    dimensions,
    random.float(-0.18, 0.18),
    0.18,
    config.facadeInsetMetres + 0.03,
  );
}

function createSignPlacement(
  planId: string,
  building: SyntheticBuildingPlacement,
  signSeed: number,
  mountingZone: SyntheticSignMountingZone,
  kind: SyntheticSignKind,
  facade: WorldFacadeSlot,
  dimensions: Readonly<{ widthMetres: number; heightMetres: number }>,
  horizontalBias: number,
  verticalBias: number,
  facadeInsetMetres: number,
): SyntheticSignPlacement {
  const maximumHorizontalOffset = Math.max(
    0,
    (facade.widthMetres - dimensions.widthMetres) / 2,
  );
  const maximumVerticalOffset = Math.max(
    0,
    (facade.heightMetres - dimensions.heightMetres) / 2,
  );
  const horizontalOffset = maximumHorizontalOffset * horizontalBias;
  const verticalOffset = maximumVerticalOffset * verticalBias;

  return {
    id: `${planId}/${building.id}/${mountingZone}`,
    seed: signSeed,
    kind,
    mountingZone,
    buildingId: building.id,
    districtId: building.districtId,
    blockId: building.blockId,
    assetId: building.assetId,
    facadeSlotId: facade.source.id,
    center: [
      rounded(
        facade.center[0] +
          facade.tangent[0] * horizontalOffset +
          facade.facing[0] * facadeInsetMetres,
      ),
      rounded(facade.center[1] + verticalOffset),
      rounded(
        facade.center[2] +
          facade.tangent[1] * horizontalOffset +
          facade.facing[1] * facadeInsetMetres,
      ),
    ],
    facing: facade.facing,
    rotationRadians: rounded(
      Math.atan2(facade.facing[0], facade.facing[1]),
    ),
    widthMetres: dimensions.widthMetres,
    heightMetres: dimensions.heightMetres,
  };
}

function cropFacadeVertically(
  facade: WorldFacadeSlot,
  targetBottomMetres: number,
  targetTopMetres: number,
): WorldFacadeSlot | undefined {
  const facadeBottom = facade.center[1] - facade.heightMetres / 2;
  const facadeTop = facade.center[1] + facade.heightMetres / 2;
  const bottom = Math.max(facadeBottom, targetBottomMetres);
  const top = Math.min(facadeTop, targetTopMetres);

  if (top - bottom < 2) {
    return undefined;
  }

  return {
    ...facade,
    center: [facade.center[0], (bottom + top) / 2, facade.center[2]],
    heightMetres: top - bottom,
  };
}

function transformFacadeSlot(
  slot: BuildingFacadeSlot,
  building: SyntheticBuildingPlacement,
  asset: BuildingAssetCatalogEntry,
  block: SyntheticBlockDefinition,
): WorldFacadeSlot {
  const scaleX = building.rotateAssetQuarterTurn
    ? building.dimensionsMetres.depth / asset.sourceDimensions.width
    : building.dimensionsMetres.width / asset.sourceDimensions.width;
  const scaleY =
    building.dimensionsMetres.height / asset.sourceDimensions.height;
  const scaleZ = building.rotateAssetQuarterTurn
    ? building.dimensionsMetres.width / asset.sourceDimensions.depth
    : building.dimensionsMetres.depth / asset.sourceDimensions.depth;
  const cosine = Math.cos(building.rotationRadians);
  const sine = Math.sin(building.rotationRadians);
  const localX = slot.center[0] * scaleX;
  const localZ = slot.center[2] * scaleZ;
  const [normalX, normalZ] = FACE_NORMALS[slot.facade];
  const facingX = rounded(cosine * normalX + sine * normalZ);
  const facingZ = rounded(-sine * normalX + cosine * normalZ);
  const centerX = building.center[0] + cosine * localX + sine * localZ;
  const centerZ = building.center[1] - sine * localX + cosine * localZ;
  const tangent: readonly [number, number] = [facingZ, -facingX];
  const widthScale =
    slot.facade === 'north' || slot.facade === 'south' ? scaleX : scaleZ;

  return {
    source: slot,
    center: [centerX, 0.5 + slot.center[1] * scaleY, centerZ],
    facing: [facingX, facingZ],
    tangent,
    widthMetres: slot.widthMetres * widthScale,
    heightMetres: slot.heightMetres * scaleY,
    streetDistanceMetres: distanceToBlockEdge(
      building.center,
      [facingX, facingZ],
      block,
    ),
  };
}

function distanceToBlockEdge(
  center: readonly [number, number],
  facing: readonly [number, number],
  block: SyntheticBlockDefinition,
): number {
  if (Math.abs(facing[0]) > Math.abs(facing[1])) {
    return facing[0] > 0
      ? block.bounds.maxX - center[0]
      : center[0] - block.bounds.minX;
  }

  return facing[1] > 0
    ? block.bounds.maxZ - center[1]
    : center[1] - block.bounds.minZ;
}

function chooseStreetFacingFacade(
  facades: readonly WorldFacadeSlot[],
  randomValue: number,
): WorldFacadeSlot | undefined {
  const minimumDistance = Math.min(
    ...facades.map((facade) => facade.streetDistanceMetres),
  );
  const candidates = facades
    .filter(
      (facade) =>
        facade.streetDistanceMetres <= minimumDistance + 1 &&
        facade.widthMetres >= 3 &&
        facade.heightMetres >= 3,
    )
    .sort(
      (first, second) =>
        second.widthMetres * second.heightMetres -
          first.widthMetres * first.heightMetres ||
        first.source.id.localeCompare(second.source.id),
    )
    .slice(0, 2);

  return candidates[Math.floor(randomValue * candidates.length)];
}

function chooseSignKind(
  asset: BuildingAssetCatalogEntry,
  randomValue: number,
): SyntheticSignKind {
  if (
    asset.use === 'landmark' ||
    asset.heightClass === 'skyscraper' ||
    (asset.use === 'office' && asset.heightClass === 'high-rise')
  ) {
    return randomValue < 0.72 ? 'logo' : 'neon';
  }

  if (asset.use === 'commercial' || asset.use === 'mixed-use') {
    return randomValue < 0.58 ? 'advertisement' : 'neon';
  }

  return randomValue < 0.48
    ? 'logo'
    : randomValue < 0.76
      ? 'neon'
      : 'advertisement';
}

function fitSignDimensions(
  facade: WorldFacadeSlot,
  kind: SyntheticSignKind,
  randomValue: number,
): Readonly<{ widthMetres: number; heightMetres: number }> {
  const targetAspect =
    kind === 'logo'
      ? 2.8
      : kind === 'neon'
        ? randomValue < 0.22
          ? 0.38
          : 3.4
        : randomValue < 0.3
          ? 0.72
          : 1.55;
  const maximumWidth = facade.widthMetres * (kind === 'advertisement' ? 0.72 : 0.64);
  const maximumHeight = Math.min(
    facade.heightMetres * (kind === 'advertisement' ? 0.5 : 0.34),
    kind === 'advertisement' ? 22 : kind === 'neon' ? 13 : 10,
  );
  const heightMetres = Math.min(maximumHeight, maximumWidth / targetAspect);
  const widthMetres = Math.min(maximumWidth, heightMetres * targetAspect);

  return {
    widthMetres: rounded(Math.max(1.5, widthMetres)),
    heightMetres: rounded(Math.max(1.5, heightMetres)),
  };
}

function fitStorefrontDimensions(
  facade: WorldFacadeSlot,
  randomValue: number,
): Readonly<{ widthMetres: number; heightMetres: number }> {
  const targetAspect = randomValue < 0.2 ? 1.4 : 3.6;
  const maximumWidth = facade.widthMetres * 0.72;
  const maximumHeight = Math.min(facade.heightMetres * 0.58, 2.4);
  const heightMetres = Math.min(maximumHeight, maximumWidth / targetAspect);
  const widthMetres = Math.min(maximumWidth, heightMetres * targetAspect);

  return {
    widthMetres: rounded(Math.max(1.25, widthMetres)),
    heightMetres: rounded(Math.max(1.25, heightMetres)),
  };
}

function fitCrownDimensions(
  facade: WorldFacadeSlot,
  randomValue: number,
): Readonly<{ widthMetres: number; heightMetres: number }> {
  const targetAspect = randomValue < 0.16 ? 1.2 : 3.2;
  const maximumWidth = facade.widthMetres * 0.68;
  const maximumHeight = Math.min(facade.heightMetres * 0.48, 8);
  const heightMetres = Math.min(maximumHeight, maximumWidth / targetAspect);
  const widthMetres = Math.min(maximumWidth, heightMetres * targetAspect);

  return {
    widthMetres: rounded(Math.max(1.5, widthMetres)),
    heightMetres: rounded(Math.max(1.5, heightMetres)),
  };
}

function countKinds(
  placements: readonly SyntheticSignPlacement[],
): Record<SyntheticSignKind, number> {
  const counts: Record<SyntheticSignKind, number> = {
    advertisement: 0,
    neon: 0,
    logo: 0,
  };

  for (const placement of placements) {
    counts[placement.kind] += 1;
  }

  return counts;
}

function countMountingZones(
  placements: readonly SyntheticSignPlacement[],
): Record<SyntheticSignMountingZone, number> {
  const counts: Record<SyntheticSignMountingZone, number> = {
    storefront: 0,
    facade: 0,
    crown: 0,
  };

  for (const placement of placements) {
    counts[placement.mountingZone] += 1;
  }

  return counts;
}

function rounded(value: number): number {
  return Number(value.toFixed(4));
}
