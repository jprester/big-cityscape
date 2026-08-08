import { describe, expect, it } from 'vitest';
import type { SyntheticBounds2 } from '../model/proofDistrict';
import { generateSyntheticCity } from './generateSyntheticCity';
import { deriveSyntheticRoadMarkings } from './deriveSyntheticRoadMarkings';

describe('deriveSyntheticRoadMarkings', () => {
  it('marks six main arterials and nine intersections deterministically', () => {
    const city = generateSyntheticCity();
    const plan = city.roadMarkings;

    expect(plan.metadata).toEqual({
      centreLineDashCount: 600,
      crosswalkBarCount: 216,
      markedIntersectionCount: 9,
    });
    expect(plan.markings).toHaveLength(816);
    expect(new Set(plan.markings.map((marking) => marking.id)).size).toBe(816);
    expect(generateSyntheticCity().roadMarkings).toEqual(plan);
  });

  it('keeps every marking inside the city and a major arterial surface', () => {
    const city = generateSyntheticCity();
    const majorArterials = city.streetCorridors.filter(
      (street) =>
        street.hierarchyId === 'arterial' &&
        street.context === 'district-boundary',
    );

    expect(majorArterials).toHaveLength(6);

    for (const marking of city.roadMarkings.markings) {
      expect(contains(city.bounds, marking.bounds), marking.id).toBe(true);
      expect(
        majorArterials.some((street) =>
          contains(street.bounds, marking.bounds),
        ),
        marking.id,
      ).toBe(true);
    }
  });

  it('keeps centre-line dashes clear of the nine crossing areas', () => {
    const city = generateSyntheticCity();
    const verticalArterials = city.streetCorridors.filter(
      (street) =>
        street.context === 'district-boundary' &&
        street.axis === 'north-south',
    );
    const horizontalArterials = city.streetCorridors.filter(
      (street) =>
        street.context === 'district-boundary' &&
        street.axis === 'east-west',
    );
    const crossingAreas = verticalArterials.flatMap((vertical) =>
      horizontalArterials.map((horizontal) => ({
        minX: vertical.bounds.minX,
        maxX: vertical.bounds.maxX,
        minZ: horizontal.bounds.minZ,
        maxZ: horizontal.bounds.maxZ,
      })),
    );
    const dashes = city.roadMarkings.markings.filter(
      (marking) => marking.kind === 'centre-line-dash',
    );

    expect(crossingAreas).toHaveLength(9);
    expect(
      dashes.every((dash) =>
        crossingAreas.every((crossing) => !overlaps(dash.bounds, crossing)),
      ),
    ).toBe(true);
  });

  it('creates four six-bar crosswalks per marked intersection', () => {
    const city = generateSyntheticCity();
    const crosswalkBars = city.roadMarkings.markings.filter(
      (marking) => marking.kind === 'crosswalk-bar',
    );
    const intersectionIds = new Set(
      crosswalkBars.map((bar) => bar.id.split('/crosswalk-')[0]),
    );

    expect(intersectionIds.size).toBe(9);
    expect(crosswalkBars).toHaveLength(9 * 4 * 6);
  });

  it('rejects an empty city ID', () => {
    expect(() => deriveSyntheticRoadMarkings(' ', [])).toThrow(
      'requires a city ID',
    );
  });
});

function contains(outer: SyntheticBounds2, inner: SyntheticBounds2): boolean {
  return (
    inner.minX >= outer.minX &&
    inner.maxX <= outer.maxX &&
    inner.minZ >= outer.minZ &&
    inner.maxZ <= outer.maxZ
  );
}

function overlaps(first: SyntheticBounds2, second: SyntheticBounds2): boolean {
  return (
    first.minX < second.maxX &&
    first.maxX > second.minX &&
    first.minZ < second.maxZ &&
    first.maxZ > second.minZ
  );
}
