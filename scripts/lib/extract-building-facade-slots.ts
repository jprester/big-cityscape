import * as THREE from 'three';
import type {
  BuildingFacadeId,
  BuildingFacadeSlot,
} from '../../src/city/assets/buildingFacadeSlot';

type FaceAxes = Readonly<{
  facade: BuildingFacadeId;
  normalX: number;
  normalZ: number;
  tangentX: number;
  tangentZ: number;
}>;

type WorldGeometry = Readonly<{
  positions: Float64Array;
  indices: Uint32Array;
}>;

const FACE_AXES: readonly FaceAxes[] = [
  {
    facade: 'north',
    normalX: 0,
    normalZ: 1,
    tangentX: 1,
    tangentZ: 0,
  },
  {
    facade: 'east',
    normalX: 1,
    normalZ: 0,
    tangentX: 0,
    tangentZ: -1,
  },
  {
    facade: 'south',
    normalX: 0,
    normalZ: -1,
    tangentX: -1,
    tangentZ: 0,
  },
  {
    facade: 'west',
    normalX: -1,
    normalZ: 0,
    tangentX: 0,
    tangentZ: 1,
  },
];

const BASE_CELL_SIZE_METRES = 2;
const DEPTH_TOLERANCE_METRES = 0.9;
const MINIMUM_SLOT_SIZE_METRES = 6;
const MAXIMUM_SLOTS_PER_FACADE = 3;
const MAXIMUM_GRID_CELLS = 90_000;

export function extractBuildingFacadeSlots(
  scene: THREE.Object3D,
  sourceBounds: THREE.Box3,
): readonly BuildingFacadeSlot[] {
  if (sourceBounds.isEmpty()) {
    return [];
  }

  const geometries = collectNormalizedWorldGeometry(scene, sourceBounds);

  if (geometries.length === 0) {
    return [];
  }

  const size = sourceBounds.getSize(new THREE.Vector3());
  const normalizedBounds = new THREE.Box3(
    new THREE.Vector3(-size.x / 2, 0, -size.z / 2),
    new THREE.Vector3(size.x / 2, size.y, size.z / 2),
  );
  const slots: BuildingFacadeSlot[] = [];

  for (const axes of FACE_AXES) {
    const faceSlots = extractFaceSlots(geometries, normalizedBounds, axes)
      .sort(
        (first, second) =>
          second.widthMetres * second.heightMetres -
            first.widthMetres * first.heightMetres ||
          second.center[1] - first.center[1],
      )
      .slice(0, MAXIMUM_SLOTS_PER_FACADE)
      .map((slot, index) => ({
        ...slot,
        id: `${axes.facade}-${index + 1}`,
      }));
    slots.push(...faceSlots);
  }

  return slots;
}

function collectNormalizedWorldGeometry(
  scene: THREE.Object3D,
  sourceBounds: THREE.Box3,
): readonly WorldGeometry[] {
  const geometries: WorldGeometry[] = [];
  const center = sourceBounds.getCenter(new THREE.Vector3());
  const sourcePosition = new THREE.Vector3();

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const source = object.geometry.getAttribute('position');

    if (source === undefined || source.count === 0) {
      return;
    }

    const positions = new Float64Array(source.count * 3);

    for (let index = 0; index < source.count; index += 1) {
      sourcePosition
        .fromBufferAttribute(source, index)
        .applyMatrix4(object.matrixWorld);
      positions[index * 3] = sourcePosition.x - center.x;
      positions[index * 3 + 1] = sourcePosition.y - sourceBounds.min.y;
      positions[index * 3 + 2] = sourcePosition.z - center.z;
    }

    const sourceIndex = object.geometry.index;
    const indices = new Uint32Array(sourceIndex?.count ?? source.count);

    for (let index = 0; index < indices.length; index += 1) {
      indices[index] = sourceIndex?.getX(index) ?? index;
    }

    geometries.push({ positions, indices });
  });

  return geometries;
}

function extractFaceSlots(
  geometries: readonly WorldGeometry[],
  bounds: THREE.Box3,
  axes: FaceAxes,
): BuildingFacadeSlot[] {
  const sideCorners = [
    axes.tangentX * bounds.min.x + axes.tangentZ * bounds.min.z,
    axes.tangentX * bounds.min.x + axes.tangentZ * bounds.max.z,
    axes.tangentX * bounds.max.x + axes.tangentZ * bounds.min.z,
    axes.tangentX * bounds.max.x + axes.tangentZ * bounds.max.z,
  ];
  const sideMinimum = Math.min(...sideCorners);
  const sideMaximum = Math.max(...sideCorners);
  let cellSize = BASE_CELL_SIZE_METRES;
  let columns = Math.max(1, Math.ceil((sideMaximum - sideMinimum) / cellSize));
  let rows = Math.max(1, Math.ceil((bounds.max.y - bounds.min.y) / cellSize));

  while (columns * rows > MAXIMUM_GRID_CELLS) {
    cellSize *= 2;
    columns = Math.max(1, Math.ceil((sideMaximum - sideMinimum) / cellSize));
    rows = Math.max(1, Math.ceil((bounds.max.y - bounds.min.y) / cellSize));
  }

  const depths = new Float64Array(columns * rows);
  depths.fill(Number.NEGATIVE_INFINITY);

  for (const geometry of geometries) {
    rasterizeGeometry(
      geometry,
      axes,
      sideMinimum,
      bounds.min.y,
      cellSize,
      columns,
      rows,
      depths,
    );
  }

  return rectanglesFromDepthGrid(
    axes,
    sideMinimum,
    bounds.min.y,
    cellSize,
    columns,
    rows,
    depths,
  );
}

function rasterizeGeometry(
  geometry: WorldGeometry,
  axes: FaceAxes,
  sideMinimum: number,
  heightMinimum: number,
  cellSize: number,
  columns: number,
  rows: number,
  depths: Float64Array,
): void {
  const { positions, indices } = geometry;

  for (let triangle = 0; triangle < indices.length / 3; triangle += 1) {
    const first = triangleCoordinate(positions, indices[triangle * 3] ?? 0, axes);
    const second = triangleCoordinate(
      positions,
      indices[triangle * 3 + 1] ?? 0,
      axes,
    );
    const third = triangleCoordinate(
      positions,
      indices[triangle * 3 + 2] ?? 0,
      axes,
    );
    const area =
      (second.side - first.side) * (third.height - first.height) -
      (third.side - first.side) * (second.height - first.height);

    if (Math.abs(area) < 1e-8) {
      continue;
    }

    const inverseArea = 1 / area;
    const minimumColumn = Math.max(
      0,
      Math.floor(
        (Math.min(first.side, second.side, third.side) - sideMinimum) /
          cellSize,
      ),
    );
    const maximumColumn = Math.min(
      columns - 1,
      Math.floor(
        (Math.max(first.side, second.side, third.side) - sideMinimum) /
          cellSize,
      ),
    );
    const minimumRow = Math.max(
      0,
      Math.floor(
        (Math.min(first.height, second.height, third.height) - heightMinimum) /
          cellSize,
      ),
    );
    const maximumRow = Math.min(
      rows - 1,
      Math.floor(
        (Math.max(first.height, second.height, third.height) - heightMinimum) /
          cellSize,
      ),
    );

    for (let row = minimumRow; row <= maximumRow; row += 1) {
      const height = heightMinimum + (row + 0.5) * cellSize;

      for (let column = minimumColumn; column <= maximumColumn; column += 1) {
        const side = sideMinimum + (column + 0.5) * cellSize;
        const firstWeight =
          ((second.side - side) * (third.height - height) -
            (third.side - side) * (second.height - height)) *
          inverseArea;
        const secondWeight =
          ((third.side - side) * (first.height - height) -
            (first.side - side) * (third.height - height)) *
          inverseArea;
        const thirdWeight = 1 - firstWeight - secondWeight;

        if (
          firstWeight < -1e-4 ||
          secondWeight < -1e-4 ||
          thirdWeight < -1e-4
        ) {
          continue;
        }

        const depth =
          firstWeight * first.depth +
          secondWeight * second.depth +
          thirdWeight * third.depth;
        const index = row * columns + column;

        if (depth > (depths[index] ?? Number.NEGATIVE_INFINITY)) {
          depths[index] = depth;
        }
      }
    }
  }
}

function rectanglesFromDepthGrid(
  axes: FaceAxes,
  sideMinimum: number,
  heightMinimum: number,
  cellSize: number,
  columns: number,
  rows: number,
  depths: Float64Array,
): BuildingFacadeSlot[] {
  const visited = new Uint8Array(columns * rows);
  const slots: BuildingFacadeSlot[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const startIndex = row * columns + column;
      const referenceDepth = depths[startIndex] ?? Number.NEGATIVE_INFINITY;

      if (visited[startIndex] === 1 || !Number.isFinite(referenceDepth)) {
        continue;
      }

      let widthInCells = 1;

      while (column + widthInCells < columns) {
        const candidateIndex = row * columns + column + widthInCells;
        const candidateDepth = depths[candidateIndex] ?? Number.NEGATIVE_INFINITY;

        if (
          visited[candidateIndex] === 1 ||
          Math.abs(candidateDepth - referenceDepth) > DEPTH_TOLERANCE_METRES
        ) {
          break;
        }

        widthInCells += 1;
      }

      let heightInCells = 1;

      rowGrowth: while (row + heightInCells < rows) {
        const candidateRow = row + heightInCells;

        for (
          let candidateColumn = column;
          candidateColumn < column + widthInCells;
          candidateColumn += 1
        ) {
          const candidateIndex = candidateRow * columns + candidateColumn;
          const candidateDepth = depths[candidateIndex] ?? Number.NEGATIVE_INFINITY;

          if (
            visited[candidateIndex] === 1 ||
            Math.abs(candidateDepth - referenceDepth) > DEPTH_TOLERANCE_METRES
          ) {
            break rowGrowth;
          }
        }

        heightInCells += 1;
      }

      let frontDepth = Number.NEGATIVE_INFINITY;

      for (let consumedRow = row; consumedRow < row + heightInCells; consumedRow += 1) {
        for (
          let consumedColumn = column;
          consumedColumn < column + widthInCells;
          consumedColumn += 1
        ) {
          const consumedIndex = consumedRow * columns + consumedColumn;
          visited[consumedIndex] = 1;
          frontDepth = Math.max(
            frontDepth,
            depths[consumedIndex] ?? Number.NEGATIVE_INFINITY,
          );
        }
      }

      const widthMetres = widthInCells * cellSize - cellSize;
      const heightMetres = heightInCells * cellSize - cellSize;

      if (
        widthMetres < MINIMUM_SLOT_SIZE_METRES ||
        heightMetres < MINIMUM_SLOT_SIZE_METRES
      ) {
        continue;
      }

      const side = sideMinimum + (column + widthInCells / 2) * cellSize;
      const height = heightMinimum + (row + heightInCells / 2) * cellSize;
      slots.push({
        id: '',
        facade: axes.facade,
        center: [
          rounded(axes.tangentX * side + axes.normalX * frontDepth),
          rounded(height),
          rounded(axes.tangentZ * side + axes.normalZ * frontDepth),
        ],
        widthMetres: rounded(widthMetres),
        heightMetres: rounded(heightMetres),
      });
    }
  }

  return slots;
}

function triangleCoordinate(
  positions: Float64Array,
  index: number,
  axes: FaceAxes,
): Readonly<{ side: number; height: number; depth: number }> {
  const x = positions[index * 3] ?? 0;
  const height = positions[index * 3 + 1] ?? 0;
  const z = positions[index * 3 + 2] ?? 0;
  return {
    side: axes.tangentX * x + axes.tangentZ * z,
    height,
    depth: axes.normalX * x + axes.normalZ * z,
  };
}

function rounded(value: number): number {
  return Number(value.toFixed(4));
}
