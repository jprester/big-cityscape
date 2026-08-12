import { describe, expect, it } from 'vitest';
import type { SyntheticBounds2 } from '../model/proofDistrict';
import type { SyntheticRoadMarking } from '../model/roadMarking';
import { generateSyntheticCity } from './generateSyntheticCity';
import { deriveSyntheticRoadMarkings } from './deriveSyntheticRoadMarkings';

describe('deriveSyntheticRoadMarkings', () => {
  it('marks six main arterials and nine intersections deterministically', () => {
    const city = generateSyntheticCity();
    const plan = city.roadMarkings;

    expect(plan.metadata).toEqual({
      centreLineDashCount: 588,
      crosswalkBarCount: 504,
      markedIntersectionCount: 9,
    });
    expect(plan.markings).toHaveLength(1_092);
    expect(new Set(plan.markings.map((marking) => marking.id)).size).toBe(
      1_092,
    );
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

  it('creates four curb-spanning fourteen-bar crosswalks per intersection', () => {
    const city = generateSyntheticCity();
    const crosswalkBars = city.roadMarkings.markings.filter(
      (marking) => marking.kind === 'crosswalk-bar',
    );
    const intersectionIds = new Set(
      crosswalkBars.map((bar) => bar.id.split('/crosswalk-')[0]),
    );

    expect(intersectionIds.size).toBe(9);
    expect(crosswalkBars).toHaveLength(9 * 4 * 14);

    for (const bar of crosswalkBars) {
      const width = bar.bounds.maxX - bar.bounds.minX;
      const depth = bar.bounds.maxZ - bar.bounds.minZ;
      const northSouthSide =
        bar.id.includes('/crosswalk-north-') ||
        bar.id.includes('/crosswalk-south-');

      expect(width, bar.id).toBeCloseTo(northSouthSide ? 1.5 : 10);
      expect(depth, bar.id).toBeCloseTo(northSouthSide ? 10 : 1.5);
    }

    const crosswalks = groupCrosswalkBars(crosswalkBars);

    expect(crosswalks.size).toBe(9 * 4);

    for (const [id, bars] of crosswalks) {
      const bounds = enclosingBounds(bars.map((bar) => bar.bounds));
      const width = bounds.maxX - bounds.minX;
      const depth = bounds.maxZ - bounds.minZ;
      const northSouthSide =
        id.includes('/crosswalk-north') || id.includes('/crosswalk-south');

      expect(bars, id).toHaveLength(14);
      expect(width, id).toBeCloseTo(northSouthSide ? 36.6 : 10);
      expect(depth, id).toBeCloseTo(northSouthSide ? 10 : 36.6);
    }
  });

  it('leaves a clean gap between centre-line dashes and crosswalk bars', () => {
    const markings = generateSyntheticCity().roadMarkings.markings;
    const dashes = markings.filter(
      (marking) => marking.kind === 'centre-line-dash',
    );
    const crosswalkBars = markings.filter(
      (marking) => marking.kind === 'crosswalk-bar',
    );

    expect(
      dashes.every((dash) =>
        crosswalkBars.every((bar) => !overlaps(dash.bounds, bar.bounds)),
      ),
    ).toBe(true);
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

function enclosingBounds(bounds: readonly SyntheticBounds2[]): SyntheticBounds2 {
  return {
    minX: Math.min(...bounds.map((candidate) => candidate.minX)),
    maxX: Math.max(...bounds.map((candidate) => candidate.maxX)),
    minZ: Math.min(...bounds.map((candidate) => candidate.minZ)),
    maxZ: Math.max(...bounds.map((candidate) => candidate.maxZ)),
  };
}

function groupCrosswalkBars(
  bars: readonly SyntheticRoadMarking[],
): ReadonlyMap<string, readonly SyntheticRoadMarking[]> {
  const groups = new Map<string, SyntheticRoadMarking[]>();

  for (const bar of bars) {
    const id = bar.id.replace(/-bar-\d+$/, '');
    const group = groups.get(id) ?? [];
    group.push(bar);
    groups.set(id, group);
  }

  return groups;
}
