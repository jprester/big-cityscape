# Building asset catalogue

## Purpose

The simplified synthetic-city branch treats building assets as a curated input
library rather than choosing models from their source folder alone. The
catalogue separates reproducible technical measurements from reviewed semantic
decisions so that new GLB exports can be audited without losing curation.

This is the asset-foundation slice for the simplified successor to Milestone 3.
It does not change the existing GIS-derived city generator.

## Source assets

The source Blender file is local and intentionally ignored by Git:

```text
references/raw/2026-low-poly-building-kit.blend
```

The runtime catalogue describes the exported GLBs under:

```text
public/assets/models/buildings/lowpoly-buildings-pack/
```

The current export contains 88 assets:

| Source collection | Assets |
| --- | ---: |
| Residential | 29 |
| High-rise | 37 |
| Skyscraper | 22 |

Source collection names are retained for traceability but are not treated as
the semantic building classification.

## Files

| File | Responsibility |
| --- | --- |
| `scripts/catalog-building-assets.ts` | Loads every GLB and measures bounds, proportions, geometry cost, transforms, and duplicate shapes. |
| `src/city/assets/buildingAssetCatalog.generated.json` | Reproducible generated measurements. Do not edit manually. |
| `src/city/assets/buildingAssetOverrides.ts` | Reviewed use, form, placement role, limits, and exceptions. |
| `src/city/assets/buildingAssetCatalog.ts` | Typed catalogue API and conservative default classification rules. |
| `src/catalog/createBuildingAssetCatalogApp.ts` | Browser-based visual audit gallery. |

## Regeneration

```sh
npm run catalog:build
npm test
npm run build
```

Run the catalogue command whenever a GLB is added, removed, or re-exported.
Review any changed dimensions, fingerprints, warnings, and duplicate links
before accepting the generated JSON.

Start the development server and open the inspection gallery:

```text
http://localhost:5173/?view=assets
```

The gallery renders normalized geometry using the same shared-material approach
as the city, so it reviews the shape that the runtime will actually use rather
than Blender-only materials or modifiers.

## Classification fields

- `use`: residential, mixed-use, office, commercial, civic, industrial, or
  landmark.
- `form`: compact, slab, perimeter, podium-tower, tower, complex, or spire.
- `heightClass`: low-rise, mid-rise, high-rise, or skyscraper, derived from
  nominal height unless explicitly overridden.
- `placementRoles`: fabric, anchor, and/or landmark.
- `nominalSizeMetres`: rounded reviewed dimensions used for slot matching.
- `allowedUniformScale`: permitted whole-model scale range.
- `allowedHeightScale`: small additional vertical adjustment range.
- `maximumPerCity`: repetition cap for visually prominent assets.
- `selectionWeight`: relative deterministic selection weight among compatible
  candidates.
- `enabled`: whether procedural selection may use the asset by default.

Placement should filter by use, form, height class, placement role, footprint,
and scale limits before applying the selection weight. It should never select
from the original folder name alone.

## Scale policy

The exported dimensions already form a coherent metre-scale family: residential
assets are generally tens of metres tall, high-rises span roughly 60–190 m, and
skyscrapers span roughly 200–380 m. The catalogue therefore preserves source
proportions and rounds them to nominal whole metres rather than rewriting the
GLBs.

Recommended placement behavior:

1. rotate a candidate by 90 degrees when that better matches a rectangular slot;
2. apply uniform scale within the catalogue range;
3. apply only the permitted small height adjustment when necessary;
4. reject the candidate if the slot still requires a stronger non-uniform fit.

This avoids the visibly distorted buildings produced by unrestricted independent
width, depth, and height fitting.

## Current audit findings

- All 88 GLBs load successfully.
- `residential-20` is an exact shape duplicate of `high-rise-18` at a different
  source scale and is disabled.
- `skyscraper-6` is an exact shape duplicate of `skyscraper-4` and is disabled.
- `high-rise-5` remains retired after the earlier city visual review.
- `skyscraper-16` has a horizontally offset source origin. Runtime geometry
  normalization recentres it, so it remains usable with a catalogue note.
- No source GLB is modified by the catalogue workflow.

Semantic use is necessarily interpretive because the Blender collection names
are broad and the low-poly geometry does not encode occupancy. The reviewed
overrides are intended as practical procedural-generation roles, not claims
about the original artist's intended function.
