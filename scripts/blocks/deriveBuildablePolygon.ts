import type { BuildableDerivation } from '../../src/city/model/cityBlocks';
import type { Point2 } from '../../src/city/model/processedCity';
import { insetConvexPolygon, isConvexPolygon, polygonArea } from './polygon';
import { triangulateSimplePolygon } from './triangulation';

export type DerivedBuildablePolygon = Readonly<{
  derivation: BuildableDerivation;
  polygon: readonly Point2[];
}>;

export function deriveBuildablePolygon(
  blockPolygon: readonly Point2[],
  insetMetres: number,
): DerivedBuildablePolygon {
  if (isConvexPolygon(blockPolygon)) {
    return {
      derivation: 'convex-inset',
      polygon: insetConvexPolygon(blockPolygon, insetMetres),
    };
  }

  const candidates = triangulateSimplePolygon(blockPolygon).flatMap((triangle) => {
    try {
      const polygon = insetConvexPolygon(triangle, insetMetres);
      return [{ polygon, areaSquareMetres: polygonArea(polygon) }];
    } catch {
      return [];
    }
  });

  candidates.sort(
    (first, second) =>
      second.areaSquareMetres - first.areaSquareMetres ||
      JSON.stringify(first.polygon).localeCompare(JSON.stringify(second.polygon)),
  );

  const selected = candidates[0];

  if (selected === undefined) {
    throw new Error('No concave block triangle can support the configured inset.');
  }

  return {
    derivation: 'triangulated-inset',
    polygon: selected.polygon,
  };
}
