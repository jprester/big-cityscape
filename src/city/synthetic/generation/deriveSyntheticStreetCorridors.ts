import type {
  SyntheticBlockDefinition,
  SyntheticBounds2,
} from '../model/proofDistrict';
import type {
  SyntheticStreetCorridor,
  SyntheticStreetHierarchyId,
} from '../model/streetCorridor';

const SECONDARY_STREET_MINIMUM_WIDTH_METRES = 22;

export type CityArterialConfig = Readonly<{
  cityId: string;
  cityBounds: SyntheticBounds2;
  districtsPerAxis: number;
  districtSizeMetres: number;
  outerMarginMetres: number;
}>;

export function deriveDistrictStreetCorridors(
  districtId: string,
  blocks: readonly SyntheticBlockDefinition[],
): readonly SyntheticStreetCorridor[] {
  if (districtId.trim().length === 0 || blocks.length === 0) {
    throw new Error('District street derivation requires an ID and blocks.');
  }

  const columns = Math.max(...blocks.map((block) => block.gridColumn)) + 1;
  const rows = Math.max(...blocks.map((block) => block.gridRow)) + 1;
  const byCell = new Map(
    blocks.map((block) => [cellKey(block.gridColumn, block.gridRow), block]),
  );
  const streets: SyntheticStreetCorridor[] = [];

  if (byCell.size !== columns * rows) {
    throw new Error('District street derivation requires a complete block grid.');
  }

  for (let row = 0; row < rows; row += 1) {
    for (let gap = 0; gap < columns - 1; gap += 1) {
      const left = requireBlock(byCell, gap, row);
      const right = requireBlock(byCell, gap + 1, row);
      const bounds = requirePositiveBounds({
        minX: left.bounds.maxX,
        maxX: right.bounds.minX,
        minZ: Math.max(left.bounds.minZ, right.bounds.minZ),
        maxZ: Math.min(left.bounds.maxZ, right.bounds.maxZ),
      });

      streets.push({
        id: `${districtId}/street-ns-r${row}-g${gap}`,
        districtId,
        hierarchyId: hierarchyForWidth(bounds.maxX - bounds.minX),
        axis: 'north-south',
        context: 'district-internal',
        bounds,
      });
    }
  }

  for (let column = 0; column < columns; column += 1) {
    for (let gap = 0; gap < rows - 1; gap += 1) {
      const lower = requireBlock(byCell, column, gap);
      const upper = requireBlock(byCell, column, gap + 1);
      const bounds = requirePositiveBounds({
        minX: Math.max(lower.bounds.minX, upper.bounds.minX),
        maxX: Math.min(lower.bounds.maxX, upper.bounds.maxX),
        minZ: lower.bounds.maxZ,
        maxZ: upper.bounds.minZ,
      });

      streets.push({
        id: `${districtId}/street-ew-c${column}-g${gap}`,
        districtId,
        hierarchyId: hierarchyForWidth(bounds.maxZ - bounds.minZ),
        axis: 'east-west',
        context: 'district-internal',
        bounds,
      });
    }
  }

  for (let rowGap = 0; rowGap < rows - 1; rowGap += 1) {
    for (let columnGap = 0; columnGap < columns - 1; columnGap += 1) {
      const lowerLeft = requireBlock(byCell, columnGap, rowGap);
      const lowerRight = requireBlock(byCell, columnGap + 1, rowGap);
      const upperLeft = requireBlock(byCell, columnGap, rowGap + 1);
      const upperRight = requireBlock(byCell, columnGap + 1, rowGap + 1);
      const bounds = requirePositiveBounds({
        minX: Math.max(lowerLeft.bounds.maxX, upperLeft.bounds.maxX),
        maxX: Math.min(lowerRight.bounds.minX, upperRight.bounds.minX),
        minZ: Math.max(lowerLeft.bounds.maxZ, lowerRight.bounds.maxZ),
        maxZ: Math.min(upperLeft.bounds.minZ, upperRight.bounds.minZ),
      });

      streets.push({
        id: `${districtId}/street-intersection-r${rowGap}-c${columnGap}`,
        districtId,
        hierarchyId: higherHierarchy(
          hierarchyForWidth(bounds.maxX - bounds.minX),
          hierarchyForWidth(bounds.maxZ - bounds.minZ),
        ),
        axis: 'intersection',
        context: 'district-internal',
        bounds,
      });
    }
  }

  return streets;
}

export function createCityArterialCorridors(
  config: CityArterialConfig,
): readonly SyntheticStreetCorridor[] {
  const streets: SyntheticStreetCorridor[] = [];
  const boundaryWidth = config.outerMarginMetres * 2;

  for (let boundary = 1; boundary < config.districtsPerAxis; boundary += 1) {
    const x = config.cityBounds.minX + boundary * config.districtSizeMetres;
    const z = config.cityBounds.minZ + boundary * config.districtSizeMetres;
    streets.push(
      arterial(
        `${config.cityId}/arterial-ns-${boundary}`,
        'north-south',
        'district-boundary',
        {
          minX: x - boundaryWidth / 2,
          maxX: x + boundaryWidth / 2,
          minZ: config.cityBounds.minZ,
          maxZ: config.cityBounds.maxZ,
        },
      ),
      arterial(
        `${config.cityId}/arterial-ew-${boundary}`,
        'east-west',
        'district-boundary',
        {
          minX: config.cityBounds.minX,
          maxX: config.cityBounds.maxX,
          minZ: z - boundaryWidth / 2,
          maxZ: z + boundaryWidth / 2,
        },
      ),
    );
  }

  const { cityBounds, outerMarginMetres } = config;
  streets.push(
    arterial(`${config.cityId}/arterial-west-edge`, 'north-south', 'city-edge', {
      ...cityBounds,
      maxX: cityBounds.minX + outerMarginMetres,
    }),
    arterial(`${config.cityId}/arterial-east-edge`, 'north-south', 'city-edge', {
      ...cityBounds,
      minX: cityBounds.maxX - outerMarginMetres,
    }),
    arterial(`${config.cityId}/arterial-south-edge`, 'east-west', 'city-edge', {
      ...cityBounds,
      maxZ: cityBounds.minZ + outerMarginMetres,
    }),
    arterial(`${config.cityId}/arterial-north-edge`, 'east-west', 'city-edge', {
      ...cityBounds,
      minZ: cityBounds.maxZ - outerMarginMetres,
    }),
  );

  return streets;
}

function arterial(
  id: string,
  axis: 'north-south' | 'east-west',
  context: 'district-boundary' | 'city-edge',
  bounds: SyntheticBounds2,
): SyntheticStreetCorridor {
  return {
    id,
    districtId: null,
    hierarchyId: 'arterial',
    axis,
    context,
    bounds: requirePositiveBounds(bounds),
  };
}

function hierarchyForWidth(widthMetres: number): SyntheticStreetHierarchyId {
  return widthMetres >= SECONDARY_STREET_MINIMUM_WIDTH_METRES
    ? 'secondary'
    : 'local';
}

function higherHierarchy(
  first: SyntheticStreetHierarchyId,
  second: SyntheticStreetHierarchyId,
): SyntheticStreetHierarchyId {
  return first === 'secondary' || second === 'secondary'
    ? 'secondary'
    : 'local';
}

function requireBlock(
  blocks: ReadonlyMap<string, SyntheticBlockDefinition>,
  column: number,
  row: number,
): SyntheticBlockDefinition {
  const block = blocks.get(cellKey(column, row));

  if (block === undefined) {
    throw new Error(`District street derivation is missing block r${row}-c${column}.`);
  }

  return block;
}

function requirePositiveBounds(bounds: SyntheticBounds2): SyntheticBounds2 {
  if (bounds.maxX <= bounds.minX || bounds.maxZ <= bounds.minZ) {
    throw new Error('A synthetic street corridor has non-positive bounds.');
  }

  return bounds;
}

function cellKey(column: number, row: number): string {
  return `r${row}-c${column}`;
}
