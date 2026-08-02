import type { ChunkedCityMassing, CityMassingChunk } from '../model/cityChunks';
import type { BuildingDefinition, CityMassingDefinition } from '../model/cityMassing';
import type { Point2 } from '../model/processedCity';

export const DEFAULT_CITY_CHUNK_SIZE_METRES = 250;

export function chunkCityMassing(
  massing: CityMassingDefinition,
  chunkSizeMetres = DEFAULT_CITY_CHUNK_SIZE_METRES,
): ChunkedCityMassing {
  if (!Number.isFinite(chunkSizeMetres) || chunkSizeMetres <= 0) {
    throw new RangeError('The city chunk size must be a positive finite distance.');
  }

  const chunkBuildings = new Map<string, BuildingDefinition[]>();

  for (const building of [...massing.buildings].sort((first, second) =>
    first.id.localeCompare(second.id),
  )) {
    const center = footprintCenter(building);
    const gridX = Math.floor(center[0] / chunkSizeMetres);
    const gridZ = Math.floor(center[1] / chunkSizeMetres);
    const key = `${gridX},${gridZ}`;
    const buildings = chunkBuildings.get(key);

    if (buildings === undefined) {
      chunkBuildings.set(key, [building]);
    } else {
      buildings.push(building);
    }
  }

  const chunks: CityMassingChunk[] = Array.from(chunkBuildings, ([key, buildings]) => {
    const [gridXText, gridZText] = key.split(',');
    const gridX = Number(gridXText);
    const gridZ = Number(gridZText);

    if (!Number.isSafeInteger(gridX) || !Number.isSafeInteger(gridZ)) {
      throw new Error('A city chunk key could not be resolved to safe grid indices.');
    }

    return {
      id: createChunkId(chunkSizeMetres, gridX, gridZ),
      gridX,
      gridZ,
      bounds: {
        minX: gridX * chunkSizeMetres,
        minZ: gridZ * chunkSizeMetres,
        maxX: (gridX + 1) * chunkSizeMetres,
        maxZ: (gridZ + 1) * chunkSizeMetres,
      },
      buildings,
    };
  }).sort(
    (first, second) =>
      first.gridZ - second.gridZ ||
      first.gridX - second.gridX ||
      first.id.localeCompare(second.id),
  );

  const assignedBuildings = chunks.reduce(
    (total, chunk) => total + chunk.buildings.length,
    0,
  );

  if (assignedBuildings !== massing.buildings.length) {
    throw new Error('Chunk assignment did not retain every building exactly once.');
  }

  return {
    chunkSizeMetres,
    chunks,
    metadata: {
      chunks: chunks.length,
      buildings: assignedBuildings,
      primitiveParts: chunks.reduce(
        (total, chunk) =>
          total +
          chunk.buildings.reduce(
            (chunkTotal, building) => chunkTotal + building.parts.length,
            0,
          ),
        0,
      ),
      maximumBuildingsPerChunk: Math.max(
        0,
        ...chunks.map((chunk) => chunk.buildings.length),
      ),
      maximumPartsPerChunk: Math.max(
        0,
        ...chunks.map((chunk) =>
          chunk.buildings.reduce(
            (total, building) => total + building.parts.length,
            0,
          ),
        ),
      ),
    },
  };
}

function footprintCenter(building: BuildingDefinition): Point2 {
  const total = building.footprint.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]] as Point2,
    [0, 0] as Point2,
  );

  if (building.footprint.length === 0) {
    throw new Error(`Building "${building.id}" has no footprint points.`);
  }

  return [total[0] / building.footprint.length, total[1] / building.footprint.length];
}

function createChunkId(chunkSizeMetres: number, gridX: number, gridZ: number): string {
  const encodedSize = String(chunkSizeMetres).replace('.', 'p');
  return `chunk-${encodedSize}m-x${encodeGridIndex(gridX)}-z${encodeGridIndex(gridZ)}`;
}

function encodeGridIndex(index: number): string {
  if (index === 0) {
    return '0';
  }

  return index > 0 ? `p${index}` : `n${Math.abs(index)}`;
}
