import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BuildingDefinition } from '../model/cityMassing';
import type { LoadedBuildingModel } from './loadBuildingModels';
import {
  planHighRiseModelCoverage,
  planSkylineModelCoverage,
} from './planSkylineModelCoverage';

describe('planSkylineModelCoverage', () => {
  it('reserves eleven representative skyscrapers regardless of input order', () => {
    const buildings = Array.from({ length: 17 }, (_, index) =>
      createBuilding(
        index === 0 ? 'landmark' : `tower-${index}`,
        300 - index * 5,
        index === 0 ? 'landmark' : 'anchor',
      ),
    );
    const models = Array.from({ length: 17 }, (_, index) =>
      createModel(`skyscraper-${index + 1}`, 400 - index * 10, 'skyscraper'),
    );
    const first = planSkylineModelCoverage(buildings, models);
    const reordered = planSkylineModelCoverage(
      [...buildings].reverse(),
      [...models].reverse(),
    );

    expect(first).toEqual(reordered);
    expect(first.size).toBe(11);
    expect(new Set(first.values()).size).toBe(11);
    expect(first.get('landmark')).toBe('skyscraper-1');
  });

  it('uses the naturally broad high-rise 31 model on an oversized skyline parcel', () => {
    const buildings = Array.from({ length: 12 }, (_, index) =>
      createBuilding(
        index === 0 ? 'landmark' : index === 4 ? 'wide-tower' : `tower-${index}`,
        300 - index * 5,
        index === 0 ? 'landmark' : 'anchor',
        index === 4 ? 60 : 30,
        index === 4 ? 40 : 30,
      ),
    );
    const models = [
      ...Array.from({ length: 16 }, (_, index) =>
        createModel(`skyscraper-${index + 1}`, 400 - index * 10, 'skyscraper'),
      ),
      createModel('high-rise-31', 60, 'high-rise'),
    ];
    const coverage = planSkylineModelCoverage(buildings, models);

    expect(coverage.size).toBe(11);
    expect(coverage.get('wide-tower')).toBe('high-rise-31');
    expect(
      [...coverage.values()].filter((modelId) => modelId.startsWith('skyscraper-')),
    ).toHaveLength(10);
  });

  it('reserves every high-rise variant outside skyscraper sites', () => {
    const buildings = Array.from({ length: 40 }, (_, index) =>
      createBuilding(`building-${index}`, 150 - index, 'background'),
    );
    const models = Array.from({ length: 37 }, (_, index) =>
      createModel(`high-rise-${index + 1}`, 160 - index, 'high-rise'),
    );
    const excluded = new Set(['building-0', 'building-1']);
    const coverage = planHighRiseModelCoverage(buildings, models, excluded);

    expect(coverage.size).toBe(37);
    expect(new Set(coverage.values())).toEqual(
      new Set(models.map((model) => model.id)),
    );
    expect(coverage.has('building-0')).toBe(false);
    expect(coverage.has('building-1')).toBe(false);
  });
});

function createBuilding(
  id: string,
  heightMetres: number,
  role: BuildingDefinition['role'],
  widthMetres = 30,
  depthMetres = 30,
): BuildingDefinition {
  const halfWidth = widthMetres / 2;
  const halfDepth = depthMetres / 2;

  return {
    id,
    source: 'road-block',
    blockId: `block-${id}`,
    regionId: `region-${id}`,
    districtId: 'east-core',
    seed: heightMetres,
    role,
    archetype: role === 'landmark' ? 'landmark-spire' : 'podium-tower',
    material: role === 'landmark' ? 'landmark' : 'commercial',
    footprint: [
      [-halfWidth, -halfDepth],
      [halfWidth, -halfDepth],
      [halfWidth, halfDepth],
      [-halfWidth, halfDepth],
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
  heightMetres: number,
  category: LoadedBuildingModel['category'],
): LoadedBuildingModel {
  return {
    id,
    category,
    geometry: new THREE.BoxGeometry(1, 1, 1),
    widthMetres: 40,
    heightMetres,
    depthMetres: 40,
    triangles: 12,
  };
}
