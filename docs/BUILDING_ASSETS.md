> Current Blender authoring workflow: [BLENDER_AUTHORING.md](BLENDER_AUTHORING.md).
> Earlier export-scene instructions below are historical.

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

The catalogue discovers the current asset count and per-collection counts at
generation time. No runtime logic or test depends on an exact number of GLBs.

Source collection names are retained for traceability but are not treated as
the semantic building classification.

## Files

| File | Responsibility |
| --- | --- |
| `scripts/catalog-building-assets.ts` | Loads every GLB and measures bounds, proportions, geometry cost, transforms, duplicate shapes, and façade sign slots. |
| `scripts/lib/extract-building-facade-slots.ts` | Offline geometry scanner that derives reusable rectangular sign surfaces from the four cardinal façades. |
| `src/city/assets/buildingAssetCatalog.generated.json` | Reproducible generated measurements. Do not edit manually. |
| `src/city/assets/buildingAssetOverrides.ts` | Reviewed use, form, placement role, limits, and exceptions. |
| `src/city/assets/buildingAssetCatalog.ts` | Typed catalogue API and conservative default classification rules. |
| `src/catalog/createBuildingAssetCatalogApp.ts` | Browser-based visual audit gallery. |

Texture and UV normalization is documented separately in
[`BUILDING_TEXTURE_PIPELINE.md`](./BUILDING_TEXTURE_PIPELINE.md). Its read-only
audit covers both the combined Blender source and the exported GLBs.

## Regeneration

```sh
npm run catalog:build
npm run catalog:watch # optional authoring-time watcher
npm run textures:audit # source material, image dependency, and GLB UV audit
npm test
npm run build
```

Run the catalogue command whenever a GLB is added, removed, or re-exported.
Review any changed dimensions, fingerprints, warnings, and duplicate links
before accepting the generated JSON.

Catalogue schema version 2 also stores up to three large rectangular
`facadeSlots` per cardinal side. Slot coordinates are expressed in the same
centred, grounded local metre space used by the runtime model loader. This scan
runs once per unique GLB during catalogue generation; the browser does not
inspect triangles for each placed building. The current 92-asset catalogue has
637 slots and no asset is missing a usable façade surface.

The watch command performs the same initial regeneration and then rebuilds the
generated JSON after GLB filesystem changes. The gallery includes the geometry
fingerprint in each preview URL, preventing a same-path replacement from being
served from the browser cache.

Removing an asset is also supported. A semantic override whose GLB no longer
exists is ignored and reported as stale rather than preventing the catalogue
from loading. Removing the obsolete override is still recommended as routine
cleanup, but it is not required to keep working.

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

- All GLBs discovered during the last validation loaded successfully.
- `residential-20` is an exact shape duplicate of `high-rise-18` at a different
  source scale and is disabled.
- `skyscraper-6` is an exact shape duplicate of `skyscraper-4` and is disabled.
- `high-rise-5` remains retired after the earlier city visual review.
- The replacement `skyscraper-16` has a correct centred origin and is distinct
  from the current `skyscraper-12` export.
- The latest five-asset intake (`high-rise-38` through `high-rise-40` and
  `residential-31` through `residential-32`) is centred, grounded, unique, and
  free of technical audit warnings.
- Visual review classifies `high-rise-38` as an office tower, `high-rise-39` as
  an office slab, `high-rise-40` as a broad low-rise commercial podium/tower,
  `residential-31` as a residential tower, and `residential-32` as a
  residential podium/tower.
- `high-rise-40` permits uniform scale down to `0.6` so its 47 × 68 m campus
  footprint can use the largest current fabric cells. It is not independently
  stretched along its axes.
- No source GLB is modified by the catalogue workflow.

Semantic use is necessarily interpretive because the Blender collection names
are broad and the low-poly geometry does not encode occupancy. The reviewed
overrides are intended as practical procedural-generation roles, not claims
about the original artist's intended function.

## Consolidated Blender master (2026-09-07)

`2026-city-lookdev.blend` is now the authoritative source for all four textured
runtime packs (76 models: 25 residential, 31 commercial, 10 skyscrapers, 10 approved).
Set `CITY_LOOKDEV_BLEND_FILE` in `.env.local`; `BUILDING_BLEND_FILE` is a legacy
fallback and should point at the same master. `textures:audit` also uses the master.
The old `2026-export-low-poly-textured-buildings.blend` is preserved as an archive;
the master has zero linked Blender libraries. Existing packed images remain packed,
and external texture folders remain dependencies.

Scenes:

- `Asset Library`: the 76 canonical objects grouped under `ASSET_LIBRARY`.
- `EXPORT / Approved buildings`: the same 76 objects, ready for pack export.
- `Workshop`: existing `LOOKDEV_EXPERIMENTS` objects.
- `Scene`: preserved city preview, including manual review placements.
- Existing `EXP…` scenes: preserved day/night lighting comparisons.

Edit canonical library objects to change future exports. Other old local copies
are preserved for comparison and are not canonical export sources. Objects carry
`runtime_asset_id`, `runtime_asset_group`, and `original_export_source` properties;
Blender name suffixes are not runtime identity. The old and newly approved
high-rise-38 runtime assets remain distinct. Two skyscrapers retain their prior
runtime metre scale using `runtime_export_scale` metadata, without changing the
editable source geometry. The city importer applies the exported dimensions.

Rebuild all packs:

```sh
npm run textures:export-building-packs
```

This includes `textures:export-approved-pack`. Exports use isolated temporary
scenes and never save the master. `lookdev:export-layout` plans from these packs;
`lookdev:update` reads sources from the local `ASSET_LIBRARY`. The earlier caveat
about manual `CITY_REVIEW_ADDITIONS` and replaced objects still applies before
regenerating the Blender city: those manual review placements were preserved,
not rebuilt during consolidation. Three.js remains authoritative for generated
city layout; Blender edits to city placements are not synchronized back.

Migration script: `scripts/blender/consolidate-city-library.py`. A full safety
copy exists beside the master as `2026-city-lookdev.blend.pre-consolidation.bak`.
The old source library was not changed. The in-file `START HERE / City workflow`
text also describes the scene roles. If Blender was open during consolidation,
reopen the saved master to load the new data before continuing edits.

Validation: all four pack exports succeeded; all 76 stable IDs, catalogue IDs,
and triangle counts match the previous manifests, and dimensions differ by less
than 1 mm. A read-only reopen verified no external Blender libraries, no missing
unpacked textures, all 76 city-import meshes and grounding, and preservation of
all 1,343 original city-scene objects. Seed 20260805 still produces 1,169 buildings
and 19 unfilled slots. Build and 179 tests passed; existing large JS chunk and
legacy Blender tangent/sampler warnings remain. This is source organization,
not a claimed rendering-performance improvement. Texture compression remains
separate work.
