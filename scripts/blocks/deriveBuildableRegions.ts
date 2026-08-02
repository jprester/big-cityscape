import type { BuildableDerivation } from '../../src/city/model/cityBlocks';
import type { Point2 } from '../../src/city/model/processedCity';
import { insetConvexPolygon, isConvexPolygon, polygonArea } from './polygon';
import { triangulateSimplePolygon } from './triangulation';

export type DerivedBuildableRegion = Readonly<{
  derivation: BuildableDerivation;
  polygon: readonly Point2[];
}>;

export function deriveBuildableRegions(
  blockPolygon: readonly Point2[],
  insetMetres: number,
): readonly DerivedBuildableRegion[] {
  if (isConvexPolygon(blockPolygon)) {
    return [
      {
        derivation: 'convex-inset',
        polygon: insetConvexPolygon(blockPolygon, insetMetres),
      },
    ];
  }

  const regions = triangulateSimplePolygon(blockPolygon).flatMap((triangle) => {
    try {
      return [
        {
          derivation: 'triangulated-inset' as const,
          polygon: insetConvexPolygon(triangle, insetMetres),
        },
      ];
    } catch {
      return [];
    }
  });

  regions.sort(
    (first, second) =>
      polygonArea(second.polygon) - polygonArea(first.polygon) ||
      JSON.stringify(first.polygon).localeCompare(JSON.stringify(second.polygon)),
  );

  if (regions.length === 0) {
    throw new Error('No concave block triangle can support the configured inset.');
  }

  return regions;
}
