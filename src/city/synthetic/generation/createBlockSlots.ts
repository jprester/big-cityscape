import { createSeededRandom, deriveSeed } from '../../../core/random';
import type {
  BuildingAssetForm,
  BuildingAssetUse,
  BuildingHeightClass,
  BuildingPlacementRole,
} from '../../assets/buildingAssetCatalog';
import type { BuildingSlot } from '../model/buildingSlot';
import type {
  SyntheticBlockTemplateId,
  SyntheticBounds2,
} from '../model/proofDistrict';

type BlockSlotContext = Readonly<{
  districtId: string;
  blockId: string;
  blockSeed: number;
  buildableBounds: SyntheticBounds2;
  templateId: SyntheticBlockTemplateId;
}>;

type SlotRequest = Readonly<{
  name: string;
  bounds: SyntheticBounds2;
  targetHeightMetres: number;
  allowedUses: readonly BuildingAssetUse[];
  allowedForms: readonly BuildingAssetForm[];
  heightClass: BuildingHeightClass;
  role: BuildingPlacementRole;
}>;

type AxisBounds = readonly [minimum: number, maximum: number];

const SLOT_GAP_METRES = 6;

export function createBlockSlots(
  context: BlockSlotContext,
): readonly BuildingSlot[] {
  const requests = createTemplateRequests(context);

  return requests.map((request) => {
    const slotId = `${context.blockId}/${request.name}`;

    return {
      id: slotId,
      districtId: context.districtId,
      blockId: context.blockId,
      seed: deriveSeed(context.blockSeed, request.name),
      center: [
        (request.bounds.minX + request.bounds.maxX) / 2,
        (request.bounds.minZ + request.bounds.maxZ) / 2,
      ],
      widthMetres: request.bounds.maxX - request.bounds.minX,
      depthMetres: request.bounds.maxZ - request.bounds.minZ,
      targetHeightMetres: request.targetHeightMetres,
      rotationRadians: 0,
      allowedUses: request.allowedUses,
      allowedForms: request.allowedForms,
      heightClass: request.heightClass,
      role: request.role,
    } satisfies BuildingSlot;
  });
}

function createTemplateRequests(
  context: BlockSlotContext,
): readonly SlotRequest[] {
  const random = createSeededRandom(
    deriveSeed(context.blockSeed, context.templateId, 'template'),
  );

  switch (context.templateId) {
    case 'fabric-grid':
      return createFabricGrid(context.buildableBounds, random);
    case 'edge-slabs':
      return createEdgeSlabs(context.buildableBounds, random);
    case 'anchor-and-fill':
      return createAnchorAndFill(context.buildableBounds, random);
    case 'skyline-anchor':
      return createSkylineAnchor(context.buildableBounds, random);
    case 'landmark-plaza':
      return createLandmarkPlaza(context.buildableBounds, random);
    case 'open-space':
      return [];
  }
}

function createFabricGrid(
  bounds: SyntheticBounds2,
  random: ReturnType<typeof createSeededRandom>,
): readonly SlotRequest[] {
  const [west, east] = splitAxisInTwo(bounds.minX, bounds.maxX);
  const [north, south] = splitAxisInTwo(bounds.minZ, bounds.maxZ);
  const cells = [
    ['slot-nw', west, north],
    ['slot-ne', east, north],
    ['slot-sw', west, south],
    ['slot-se', east, south],
  ] as const;

  return cells.map(([name, xBounds, zBounds]) => ({
    name,
    bounds: fromAxes(xBounds, zBounds),
    targetHeightMetres: random.float(30, 39),
    allowedUses: ['residential', 'mixed-use', 'commercial'],
    allowedForms: [
      'compact',
      'slab',
      'complex',
      'tower',
      'podium-tower',
      'perimeter',
    ],
    heightClass: 'low-rise',
    role: 'fabric',
  }));
}

function createEdgeSlabs(
  bounds: SyntheticBounds2,
  random: ReturnType<typeof createSeededRandom>,
): readonly SlotRequest[] {
  const [north, south] = splitAxisInTwo(bounds.minZ, bounds.maxZ);

  return [
    {
      name: 'slot-north',
      bounds: fromAxes([bounds.minX, bounds.maxX], north),
      targetHeightMetres: random.float(58, 72),
    },
    {
      name: 'slot-south',
      bounds: fromAxes([bounds.minX, bounds.maxX], south),
      targetHeightMetres: random.float(58, 72),
    },
  ].map((request) => ({
    ...request,
    allowedUses: ['residential', 'mixed-use', 'office', 'commercial'],
    allowedForms: [
      'slab',
      'tower',
      'compact',
      'complex',
      'podium-tower',
      'perimeter',
      'spire',
    ],
    heightClass: 'mid-rise' as const,
    role: 'fabric' as const,
  }));
}

function createAnchorAndFill(
  bounds: SyntheticBounds2,
  random: ReturnType<typeof createSeededRandom>,
): readonly SlotRequest[] {
  const availableDepth = bounds.maxZ - bounds.minZ - SLOT_GAP_METRES;
  const anchorDepth = availableDepth * 0.62;
  const anchorZ: readonly [number, number] = [
    bounds.minZ,
    bounds.minZ + anchorDepth,
  ];
  const fabricZ: readonly [number, number] = [
    anchorZ[1] + SLOT_GAP_METRES,
    bounds.maxZ,
  ];
  const [west, east] = splitAxisInTwo(bounds.minX, bounds.maxX);

  return [
    {
      name: 'slot-anchor',
      bounds: fromAxes([bounds.minX, bounds.maxX], anchorZ),
      targetHeightMetres: random.float(132, 158),
      allowedUses: ['office'],
      allowedForms: [
        'tower',
        'podium-tower',
        'complex',
        'spire',
        'compact',
        'slab',
      ],
      heightClass: 'high-rise',
      role: 'anchor',
    },
    {
      name: 'slot-fill-west',
      bounds: fromAxes(west, fabricZ),
      targetHeightMetres: random.float(55, 66),
      allowedUses: ['residential', 'mixed-use', 'office'],
      allowedForms: ['tower', 'slab', 'compact', 'complex', 'podium-tower', 'spire'],
      heightClass: 'mid-rise',
      role: 'fabric',
    },
    {
      name: 'slot-fill-east',
      bounds: fromAxes(east, fabricZ),
      targetHeightMetres: random.float(55, 66),
      allowedUses: ['residential', 'mixed-use', 'office'],
      allowedForms: ['tower', 'slab', 'compact', 'complex', 'podium-tower', 'spire'],
      heightClass: 'mid-rise',
      role: 'fabric',
    },
  ];
}

function createSkylineAnchor(
  bounds: SyntheticBounds2,
  random: ReturnType<typeof createSeededRandom>,
): readonly SlotRequest[] {
  const requests = createAnchorAndFill(bounds, random);

  return requests.map((request) =>
    request.name === 'slot-anchor'
      ? {
          ...request,
          targetHeightMetres: random.float(205, 255),
          allowedForms: ['tower', 'podium-tower', 'complex', 'spire'],
          heightClass: 'skyscraper',
        }
      : request,
  );
}

function createLandmarkPlaza(
  bounds: SyntheticBounds2,
  random: ReturnType<typeof createSeededRandom>,
): readonly SlotRequest[] {
  const plazaInset = 4;

  return [
    {
      name: 'slot-landmark',
      bounds: insetBounds(bounds, plazaInset),
      targetHeightMetres: random.float(290, 325),
      allowedUses: ['office'],
      allowedForms: ['spire', 'complex', 'tower'],
      heightClass: 'skyscraper',
      role: 'landmark',
    },
  ];
}

function splitAxisInTwo(
  minimum: number,
  maximum: number,
): readonly [AxisBounds, AxisBounds] {
  const cellSize = (maximum - minimum - SLOT_GAP_METRES) / 2;

  if (cellSize <= 0) {
    throw new RangeError('A buildable block is too small for its template.');
  }

  const secondStart = minimum + cellSize + SLOT_GAP_METRES;
  return [
    [minimum, minimum + cellSize],
    [secondStart, secondStart + cellSize],
  ];
}

function fromAxes(
  xBounds: readonly [number, number],
  zBounds: readonly [number, number],
): SyntheticBounds2 {
  return {
    minX: xBounds[0],
    maxX: xBounds[1],
    minZ: zBounds[0],
    maxZ: zBounds[1],
  };
}

function insetBounds(
  bounds: SyntheticBounds2,
  insetMetres: number,
): SyntheticBounds2 {
  return {
    minX: bounds.minX + insetMetres,
    maxX: bounds.maxX - insetMetres,
    minZ: bounds.minZ + insetMetres,
    maxZ: bounds.maxZ - insetMetres,
  };
}
