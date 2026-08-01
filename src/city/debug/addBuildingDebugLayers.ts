import * as THREE from 'three';
import type { DebugLayerManager } from '../../debug/DebugLayerManager';
import type { BuildingDefinition, CityMassingDefinition } from '../model/cityMassing';
import type { Point2 } from '../model/processedCity';

const FOOTPRINT_HEIGHT_METRES = 1.08;

export function addBuildingDebugLayers(
  layers: DebugLayerManager,
  massing: CityMassingDefinition,
): void {
  addFootprintLayer(layers, massing);
  addHeightLayer(layers, massing);
}

function addFootprintLayer(
  layers: DebugLayerManager,
  massing: CityMassingDefinition,
): void {
  const positions: number[] = [];

  for (const building of massing.buildings) {
    appendPolygonSegments(positions, building.footprint, FOOTPRINT_HEIGHT_METRES);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  const material = new THREE.LineBasicMaterial({
    color: 0x74ddf2,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'debug:building-footprints';
  lines.renderOrder = 10;

  layers.add({
    id: 'building-footprints',
    label: `${massing.metadata.buildings} building footprints`,
    object: lines,
    visible: false,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
}

function addHeightLayer(
  layers: DebugLayerManager,
  massing: CityMassingDefinition,
): void {
  const positions: number[] = [];
  const colors: number[] = [];
  const minimumHeight = massing.metadata.minimumHeightMetres;
  const heightRange = Math.max(
    1,
    massing.metadata.maximumHeightMetres - minimumHeight,
  );

  for (const building of massing.buildings) {
    const center = footprintCenter(building);
    const normalizedHeight = (building.heightMetres - minimumHeight) / heightRange;
    const color = new THREE.Color().setHSL(
      0.62 * (1 - normalizedHeight),
      0.78,
      0.58,
    );

    positions.push(
      center[0],
      FOOTPRINT_HEIGHT_METRES,
      center[1],
      center[0],
      building.heightMetres,
      center[1],
    );
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    depthTest: false,
    transparent: true,
    opacity: 0.92,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'debug:building-heights';
  lines.renderOrder = 11;

  layers.add({
    id: 'building-heights',
    label: `Height range ${minimumHeight.toFixed(0)}–${massing.metadata.maximumHeightMetres.toFixed(0)} m`,
    object: lines,
    visible: false,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
}

function appendPolygonSegments(
  positions: number[],
  polygon: readonly Point2[],
  heightMetres: number,
): void {
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];

    if (start !== undefined && end !== undefined) {
      positions.push(
        start[0],
        heightMetres,
        start[1],
        end[0],
        heightMetres,
        end[1],
      );
    }
  }
}

function footprintCenter(building: BuildingDefinition): Point2 {
  const total = building.footprint.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]] as Point2,
    [0, 0] as Point2,
  );

  return [total[0] / building.footprint.length, total[1] / building.footprint.length];
}
