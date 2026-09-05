import { describe, expect, it } from 'vitest';
import { selectTexturedBuildingModel } from './texturedResidentialModelSelection';

const MODELS = [
  { id: 'compact', widthMetres: 20, heightMetres: 35, depthMetres: 18 },
  { id: 'slab', widthMetres: 45, heightMetres: 35, depthMetres: 14 },
  { id: 'tower', widthMetres: 18, heightMetres: 90, depthMetres: 18 },
  { id: 'wide', widthMetres: 50, heightMetres: 25, depthMetres: 40 },
] as const;

describe('selectTexturedBuildingModel', () => {
  it('is repeatable for the same semantic placement', () => {
    const target = { width: 30, height: 50, depth: 18 };
    expect(selectTexturedBuildingModel('building-42', target, MODELS)).toEqual(
      selectTexturedBuildingModel('building-42', target, MODELS),
    );
  });

  it('rejects an empty model pack', () => {
    expect(() =>
      selectTexturedBuildingModel(
        'building-42',
        { width: 30, height: 50, depth: 18 },
        [],
      ),
    ).toThrow(/at least one model/);
  });
});
