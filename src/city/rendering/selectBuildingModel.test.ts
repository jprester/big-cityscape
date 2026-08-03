import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BuildingDefinition } from '../model/cityMassing';
import {
  BUILDING_MODEL_CATALOG,
  type BuildingModelCategory,
} from './buildingModelCatalog';
import type { LoadedBuildingModel } from './loadBuildingModels';
import {
  selectBuildingModel,
  selectBuildingModelCategory,
} from './selectBuildingModel';

describe('selectBuildingModelCategory', () => {
  it('maps low, high, and landmark massing into semantic asset categories', () => {
    expect(selectBuildingModelCategory(createBuilding(40, 'background'))).toBe(
      'residential',
    );
    expect(selectBuildingModelCategory(createBuilding(100, 'background'))).toBe(
      'high-rise',
    );
    expect(selectBuildingModelCategory(createBuilding(220, 'background'))).toBe(
      'high-rise',
    );
    expect(selectBuildingModelCategory(createBuilding(410, 'landmark'))).toBe(
      'skyscraper',
    );
  });

  it('keeps every supplied asset in the explicit runtime catalogue', () => {
    expect(BUILDING_MODEL_CATALOG).toHaveLength(78);
    expect(
      countByCategory(BUILDING_MODEL_CATALOG.map((entry) => entry.category)),
    ).toEqual({
      residential: 25,
      'high-rise': 37,
      skyscraper: 16,
    });
    expect(new Set(BUILDING_MODEL_CATALOG.map((entry) => entry.id)).size).toBe(
      BUILDING_MODEL_CATALOG.length,
    );
  });
});

describe('selectBuildingModel', () => {
  it('is deterministic and prefers footprint-compatible models', () => {
    const building = createBuilding(90, 'background', 60, 18);
    const models = [
      createModel('square', 'high-rise', 30, 90, 30),
      createModel('slender', 'high-rise', 60, 90, 18),
    ];
    const first = selectBuildingModel(building, models);
    const repeated = selectBuildingModel(building, [...models].reverse());

    expect(repeated.model.id).toBe(first.model.id);
    expect(repeated.rotateModelQuarterTurn).toBe(
      first.rotateModelQuarterTurn,
    );
    expect(first.widthMetres).toBeCloseTo(60, 5);
    expect(first.depthMetres).toBeCloseTo(18, 5);
  });

  it('rotates an elongated model when that better matches the block footprint', () => {
    const building = createBuilding(80, 'background', 18, 60);
    const selected = selectBuildingModel(building, [
      createModel('wide', 'high-rise', 60, 80, 18),
    ]);

    expect(selected.rotateModelQuarterTurn).toBe(true);
  });

  it('replaces the retired high-rise 5 asset with high-rise 31', () => {
    const building = createBuilding(170, 'background', 60, 45);
    const models = [
      createModel('high-rise-5', 'high-rise', 55, 190, 45),
      createModel('high-rise-29', 'high-rise', 93, 99, 84),
      createModel('high-rise-31', 'high-rise', 70, 60, 70),
    ];
    const placement = selectBuildingModel(building, models, 'high-rise-5');

    expect(placement.model.id).toBe('high-rise-31');
  });
});

function createBuilding(
  heightMetres: number,
  role: BuildingDefinition['role'],
  widthMetres = 30,
  depthMetres = 24,
): BuildingDefinition {
  return {
    id: 'block-a/region-a/building-1',
    source: 'road-block',
    blockId: 'block-a',
    regionId: 'region-a',
    districtId: 'district-a',
    seed: 1234,
    role,
    archetype: role === 'landmark' ? 'landmark-spire' : 'box-tower',
    material: role === 'landmark' ? 'landmark' : 'commercial',
    footprint: [
      [-widthMetres / 2, -depthMetres / 2],
      [widthMetres / 2, -depthMetres / 2],
      [widthMetres / 2, depthMetres / 2],
      [-widthMetres / 2, depthMetres / 2],
    ],
    heightMetres,
    parts: [
      {
        center: [0, 0],
        widthMetres,
        depthMetres,
        baseHeightMetres: 0,
        heightMetres,
        rotationRadians: 0,
      },
    ],
  };
}

function createModel(
  id: string,
  category: BuildingModelCategory,
  widthMetres: number,
  heightMetres: number,
  depthMetres: number,
): LoadedBuildingModel {
  return {
    id,
    category,
    geometry: new THREE.BoxGeometry(1, 1, 1),
    widthMetres,
    heightMetres,
    depthMetres,
    triangles: 12,
  };
}

function countByCategory(
  categories: readonly BuildingModelCategory[],
): Record<BuildingModelCategory, number> {
  const counts: Record<BuildingModelCategory, number> = {
    residential: 0,
    'high-rise': 0,
    skyscraper: 0,
  };

  for (const category of categories) {
    counts[category] += 1;
  }

  return counts;
}
