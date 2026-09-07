# Residential lookdev studies

## Additional examples: EXP04 and EXP05

EXP05 was subsequently retextured by the user to Atlas 3's lower glass panel.
`scripts/blender/align-exp05-facade-uv.py` aligns its facade U coordinates using
the user's base-tier scale and offset for each wall direction. All tiers use the
same local X/Y reference, so vertical mullions align across setbacks. The script
preserves all V coordinates, roof UVs, geometry and materials; it does not rerun
the original model generator. Twenty-four facade faces were checked, with maximum
projection error below 3e-8 UV units. The result was saved in place and rendered
to `references/visual/atlas-shape-study/exp05-aligned.png`. Horizontal floor-band
spacing in V remains as edited by the user; this correction targets vertical ridges.

Both live in the same `2026-city-lookdev.blend`, under
`LOOKDEV_EXPERIMENTS / EXP04-05 / Atlas shape examples`. Review together in
`EXP04-05 / Day` and `EXP04-05 / Night`. The file defaults to the full `Scene`.

- EXP04: offset glass slabs, 144.4 m, unequal wings on a common podium.
- EXP05: terraced dark office, 126.4 m, setbacks on two axes.
- Each: 96 triangles, one mesh, one material. Both reuse EXP03's material
  and its existing Atlas 3 images; zero additional images or materials for buildings.
- Roofs and caps use plain concrete; no rooftop equipment was added.

`scripts/blender/create-atlas-shape-examples.py` builds these examples. Facades
use constant panel scale (35.14 × 90 m per chosen atlas panel), with splits at
atlas bounds and height-based vertical UV phase. Unlike EXP03's matching panel,
these other atlas panels have different window rhythms; their floor spacing is
a lookdev choice, not a measurement of the reference slab. The source occupancy
patterns repeat, and baked window depth has no parallax. Hidden internal faces
remain to keep the separate box masses easy to edit.

Run with the same Blender background pattern as EXP03; `-- --save` saves in place,
and `--skip-render` optionally omits renders. Existing examples are never replaced.
The normal `.blend1` backup is retained. All 1,333 pre-existing object datablocks
were retained. Assertions check finite coordinates, nonzero faces, UV bounds and
the triangle budget. Day/night renders are in
`references/visual/atlas-shape-study/exp04-05-{day,night}.png`.

Validation: Blender generated and saved both examples; `npm run build` passed
with the existing chunk-size warning; all 179 tests passed. Geometry cost is
measured; browser draw calls/FPS remain unmeasured. The smallest next step is to
review these shapes and their facade scale before promoting any to export assets.

## Current revision: EXP03 — existing atlas and shape study

Work now stays in `/Users/jankoprester/Projects/3d-modeling/blender/2026-city-lookdev.blend`,
inside `LOOKDEV_EXPERIMENTS / EXP03 / Atlas shape study`. No new texture was
generated. The existing city objects and source materials are retained.

The new chamfered shoulder tower uses High-Rise Atlas 3 diffuse, roughness and
emissive maps. Its UV density was measured from `high-rise-lp-2.002` in the city:
17.5698 × 39.632 metres corresponds to 0.113061 × 0.204366 UV units. Wall UVs
stay within the top-right facade panel; roof and cap faces use separate atlas
regions. This matches the reference's scale rather than assuming a floor height.

Rooftop policy: use plain wall/roof swatches, never the baked equipment region.
The user will place individual rooftop elements manually. EXP03's previously
equipment-mapped horizontal faces were remapped to the plain concrete patch;
geometry and facade UVs are unchanged (152 triangles, one material). The change
was saved in the same lookdev file and checked with a daylight render saved as
`references/visual/atlas-shape-study/exp03-plain-roofs.png`.

The newest saved export library and modeling kit were inspected. Atlas 3's slab
(116 triangles), Atlas 2's braced tower `high-rise-lp-32.002` (264 triangles),
and stepped glass `high-rise-lp-34.002` (526 triangles) were rendered for comparison.
Atlas 4 was inspected but was not used by the inspected saved models. Some existing
materials reference a residential normal map unrelated to their facade atlas;
those materials were preserved. The study uses no mismatched normal map and sets
its independent roughness image datablock to Non-Color.

- New tower: 129 m, 152 triangles, one mesh and one material.
- Review scenes in the same file: `EXP03 / Day`, `EXP03 / Night`, `EXP03 / Comparison`.
- Comparison: existing Atlas 3 slab on the left, new tower in the middle,
  existing Atlas 2 braced tower on the right, at authored metre scale.
- Review copies live in `LOOKDEV_EXPERIMENTS / EXP03 / Existing comparisons`.
- The original 1,317 object datablocks remain present. The study sits at X=1250 m.
- Blender's usual adjacent `.blend1` is retained when saving in place.

Script: `scripts/blender/create-atlas-shape-study.py`. Run with Blender's
`--background <2026-city-lookdev.blend> --python-exit-code 1 --python <script>`
to preview without saving. Add `-- --save --skip-render` to save after review.
It refuses to replace an existing EXP03 model, protecting manual edits. It also
checks the input file's modification time before saving. Background Blender cannot
see unsaved edits in another running Blender session; reload the saved file before
continuing work there. Images remain external at their original atlas paths.

Validation: all three Blender renders completed and were visually inspected;
UV bounds, finite coordinates, geometry budget, one material, and original object
retention assertions passed. `npm run build` passed with its existing chunk-size
warning; `npm test` passed all 179 tests; `git diff --check` passed.

This is a shape/UV study: occupied-window patterns repeat, windows have no parallax,
and source-map alignment is inherited. No Three.js performance improvement is
claimed. One material keeps the eventual per-mesh draw overhead low; three shared
atlas images still carry texture memory cost. Next, review this silhouette beside
the existing models before developing another shape with the same atlas library.

## Previous revision: texture-first RES02

The user rejected the first study's detailed geometry, rail crown, and flat
emissive panes. RES02 keeps this Milestone 5 work to one building, using a
simple stepped shell with a plain capped roof and textured facades.

Open the separate local working copy:
`references/visual/residential-textured-study/2026-city-lookdev-textured-study.blend`.
The original city lookdev and production library are unchanged. Select
`RES02 • Day`, `RES02 • Night`, or `RES02 • Facade detail`. The file opens on
the night scene; the city is preserved in its original scene.

- 96 triangles versus RES01's 41,256; one mesh, three material slots.
- 111.5 m height. Facade bays and floors use a 3.2 m module.
- One 1254 × 1254 sRGB facade image, packed into the blend file.
- Curtains, blinds, frames, stone seams, and interiors are in the texture.
- A red-minus-blue mask isolates warm interior pixels for emission,
  retaining the image's shadows and partial curtains. This is a Blender
  lookdev shader, not yet a baked export material.

Texture generation used the built-in Imagegen tool. The source is copied to
`references/visual/residential-textured-study/facade.png`. Prompt direction:
orthographic seamless facade, exactly eight bays by eight floors, neutral
charcoal stone, recessed rectangular apartment windows, thin metal mullions,
mostly dark glazing, approximately one-quarter warm occupied interiors with
partial curtains, blinds, bookshelves and soft uneven lighting; no flat yellow
panes, perspective, surrounding scene, bloom, railings, crown, or logos.
The generated image is the fixed input for deterministic model rebuilds;
regenerating an image is not deterministic.

Reproduce from the original city file:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background /Users/jankoprester/Projects/3d-modeling/blender/2026-city-lookdev.blend \
  --python-exit-code 1 \
  --python scripts/blender/create-textured-residential-lookdev.py -- \
  --output references/visual/residential-textured-study/2026-city-lookdev-textured-study.blend \
  --renders references/visual/residential-textured-study \
  --texture references/visual/residential-textured-study/facade.png
```

This overwrites its generated output: preserve manual edits in another copy.
The script reuses presentation and mesh helpers from the original study script.
Large generated assets remain local under ignored `references/visual/`.

Validation: Blender 5.2 saved and rendered all three views at 960 × 1200,
40 Cycles samples with denoising; all were visually inspected. Assertions check
the triangle budget, finite coordinates, and UV loop coverage. Build passed
with the existing large-chunk warning; all 179 tests passed; diff check passed.

The geometry reduction is measured, but browser draw calls and FPS have not
been measured because this revision is not integrated into Three.js. Three
material slots would normally require multiple draws without batching.
Texture memory replaces geometry cost. The single RGBA8 texture would occupy
about 8 MiB including mipmaps before GPU compression.

Known limits: visible eight-floor occupancy repetition, no true window depth
or parallax, baked interior lighting also visible by day, and no independent
roughness/normal/emission maps. Image-generated seams are approximate. The
smallest next step is to review this facade treatment, then break up occupancy
repetition on this same model before making building variants.

## Previous revision: RES01 — Meridian House

This Milestone 5 study deliberately develops one building in Blender before
variants, asset registration, texture baking, or Three.js integration.

## Review file

Open `/Users/jankoprester/Projects/3d-modeling/blender/2026-city-lookdev-residential-study.blend`.

This is a working copy of `2026-city-lookdev.blend`, preserving its city and
linked production library. The original lookdev file and production assets
were not saved or changed. The local `LOOKDEV_EXPERIMENTS` collection contains
four editable prototype meshes at X=1250 m, outside the generated city bounds.
It is also linked into two dedicated review scenes:

- `RES01 • Day`
- `RES01 • Night`

Choose these in Blender's scene selector. Both use the same building and
materials, with separate lighting, cameras and presentation grounds. The saved
file opens on the daylight scene. Press Numpad 0 for the review camera if needed.
The city scene remains available in the same file.

Review renders are saved locally under `references/visual/residential-study/`:
`residential-01-day.png` and `residential-01-night.png`. The machine-readable
`report.json` records the geometry census and validation.

## Design

- 113.15 m total height, 28 × 22 m main shaft and 34 × 28 m podium.
- Two-storey base, 23 lower residential floors, eight set-back upper floors.
- Real punched openings with 0.32 m reveals, exposed sills, bronze casements,
  selected balconies and partial roller blinds.
- 868 windows; 234 deterministically occupied with three shared light tones.
- Mechanical roof enclosure, louver strips, HVAC units, fans and two beacons.
- Four editable meshes split into structure, glazing, frames and roof equipment.

These are simple material swatches, not a finished texture treatment. This first
pass tests silhouette, proportions, openings and light. The ordinary apartment
floors use a 3.2 m pitch. Only exposed faces are retained for tiny casements and
blinds; reveals, sills and larger projections retain physical depth.

## Reproduce

The script is `scripts/blender/create-residential-lookdev.py`. Example:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background /Users/jankoprester/Projects/3d-modeling/blender/2026-city-lookdev.blend \
  --python-exit-code 1 \
  --python scripts/blender/create-residential-lookdev.py -- \
  --output /Users/jankoprester/Projects/3d-modeling/blender/2026-city-lookdev-residential-study.blend \
  --renders references/visual/residential-study
```

This command overwrites its named generated output, so retain a separate copy
before making manual edits there. It refuses to save over its input file or
replace an existing `LOOKDEV_EXPERIMENTS` collection in the input. It uses seed
20260906 and Blender's own Python; no new dependencies are required.

## Validation and limits

- Blender 5.2: both Cycles review renders completed at 960 × 1200, 40 samples
  with denoising; images were visually inspected.
- Geometry assertions: finite coordinates, unit object scale, four meshes,
  measured height consistent with the definition.
- 41,256 triangles and 10 shared material roles. This is a close-review model,
  not a city-wide runtime budget or an optimized distant asset. There is no
  per-window scene-object overhead.
- `npm run build` passed with the existing large shared-chunk warning.
- `npm test`: 179 tests passed. `git diff --check` passed.
- Only the new Blender script and this document change the repository. There
  are no runtime changes or claimed Three.js performance improvements.

Blender reports material/world node deprecation notices for a future release;
they do not prevent authoring, saving or rendering in the tested version.

Next review: judge the tower's proportions, window scale, balcony rhythm and
material character. Refine this one design before making variants or placing
repeated copies into the generated city. Texture baking, lower-detail models,
production library promotion and runtime export remain deferred.

## Atlas 4 concept examples — EXP06 / EXP07

The supplied concept guides the slender tower / substantial podium proportions.
Two examples were added in the existing lookdev file under
`LOOKDEV_EXPERIMENTS / EXP06-07 / Atlas 4 examples`:

- EXP06 glass podium tower: 72 triangles, 138.4 m.
- EXP07 dark shoulder tower: 60 triangles, 138.4 m.

Both share one Atlas 4 material, with diffuse, Non-Color roughness and an OpenGL
normal map at strength 0.25. All roofs use a plain swatch. No equipment textures
or individual rooftop equipment were added. Facade UVs use a shared local XYZ
projection (48 × 150 m per panel), keeping vertical ridges aligned across tiers.
This is a chosen lookdev scale, not a measured floor height from the concept.

The supplied emissive-A PNG is truncated: Pillow reports `image file is truncated`
and Blender reports an IDAT read error. It caused magenta rendering, so it is
excluded. The subsequently supplied full bundle contains a valid Emissive B map,
which is now connected at strength 0.7 in sRGB, with the same UVs and EXTEND mode.
Variant B fully decoded at 4096 × 4096; bundle variant A is also truncated. The original texture
file is untouched. The three other PNGs fully decode at 4096 × 4096. The supplied
map filenames have differing version prefixes; exact per-pixel registration has
not been independently established.

Review scenes: `EXP06-07 / Day`, `EXP06-07 / Night`. Night now includes the validated Emissive B occupancy pattern. The main `Scene` stays the default.
Generator: `scripts/blender/create-atlas4-examples.py`; preview by default, add
`-- --save` to save in place. Existing named examples are protected from replacement.
All 1,346 pre-existing object datablocks were retained. UV equality assertions,
finite/positive geometry and budget checks passed. Render outputs and report live
in `references/visual/atlas-shape-study/exp06-07-*`.

The examples add one shared material and three existing atlas textures; browser
performance is unmeasured. Remaining limits include repeated texture patterns,
baked facade depth. The updated night render was inspected after connecting B.
Next: review lighting before export. The generator also uses the valid B map.

## City placement review

The latest saved nine-building lineup (including the user's Cube.001/Cube.002
and modified EXP models) is placed twice each in the original city Scene.
`CITY_REVIEW_ADDITIONS` contains 18 linked copies, sharing source meshes and
materials while keeping independent transforms. Original lineup objects remain.
`CITY_REVIEW_REPLACED` retains the 18 displaced buildings, hidden in viewport/render.
Each new footprint fits inside its replaced building's world XY bounds with
1 m total size clearance, retains authored scale and matches the old base Z.
Placement is deterministic and limited to existing tower lots in the central area.
All original object datablocks remain; no source meshes were regenerated.

Script: `scripts/blender/place-reviewed-city-buildings.py`. Local placement manifest:
`references/visual/atlas-shape-study/city-review-placements.json`, including old
collection membership for restoration. New copies submit 2,476 triangles total;
no new mesh datablocks or building materials. This is not a measured FPS gain.
Footprint containment, pairwise non-overlap and base elevation assertions passed.
Saved collections were reopened for visual verification. Diff check passed.

This is Blender-only placement. Before rebuilding CITY_GENERATED, restore the
replaced objects and remove the review copies, or promote this mapping into the
layout/export pipeline; otherwise regeneration can duplicate these placements.
Three.js asset registration/export is the next separate step after city review.

## Approved export staging scene

`EXPORT / Approved buildings` in the same lookdev file contains only ten mesh
objects in `EXPORT_APPROVED_BUILDINGS`: the nine saved selected meshes plus
`high-rise-lp-38`, which was not selected in the saved file but explicitly requested.
The saved selection included the 116-triangle comparison slab; this differs from
what appears to be the screenshot lineup, so its inclusion is explicit here.
Each staging object has independent transforms and shares source mesh/material
and modifier data as supported by Blender object copying. Sources and city remain.
Models are arranged in a two-row grid at their authored scale, grounded individually.

Script: `scripts/blender/prepare-export-scene.py`. Manifest:
`references/visual/atlas-shape-study/export-staging.json`. Assertions verify ten
mesh-only staging objects and shared source geometry. Export code must centre and
ground each object independently; grid positions must not enter runtime transforms.

`high-rise-lp-38` is already registered as `high-rise-38`, but its existing GLB is
60.1164 m tall / 1,437 triangles, versus the saved Blender source at 136.2953 m /
446 triangles. This is not assumed to be an identical duplicate. Runtime files
were not overwritten. The next step is to map stable IDs, export the approved
set through the textured-pack pipeline, and review catalogue/placement changes.

## Approved buildings in the Three.js city (2026-09-07)

Exported the ten staging objects without saving or altering the Blender file:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background "/Users/jankoprester/Projects/3d-modeling/blender/2026-city-lookdev.blend" --python scripts/blender/export-approved-buildings.py
```

Output: `public/assets/models/buildings/textured-approved-pilot/` (local generated
assets, ignored by Git). The exporter evaluates modifiers, triangulates, retains
UVs/materials, centres each model, and grounds it independently. Export uses an
isolated temporary scene so other scenes' selections cannot leak into the GLB.
The editable source file is never saved by this script.

The runtime commercial library and offline layout planner now include this pack.
The original `high-rise-38` remains intact; the new source uses
`approved-high-rise-38`. Other IDs are `approved-white-residence`,
`approved-brick-tower`, `approved-chamfered-tower`, `approved-slab`,
`approved-braced-tower`, `approved-offset-slabs`, `approved-terraced-glass`,
`approved-glass-podium`, and `approved-dark-shoulder`.

For seed 20260805, all ten approved models appear, in 23 deterministic placements:
5 offset slabs, 5 slabs, 3 terraced glass, 3 chamfered towers, 2 high-rise-38,
and one each of the other five variants. Total city: 1,169 buildings and 19
unfilled slots. Runtime placement preserves authored scale and uses existing
footprint fitting; it does not reproduce the earlier manual Blender review lots.
The Blender layout importer resolves approved objects from the local export
collection and evaluates their modifiers. Missing sources are checked before
removing the generated city. The existing manual review-copy caveat above still
applies; this task did not rebuild or save the Blender city.

Validation: `npm run build` and `npm test` passed (179 tests / 43 files).
`npm run lookdev:export-layout -- --seed 20260805 --output references/visual/atlas-shape-study/approved-runtime-layout.json`
passed. A read-only Blender check verified all ten importer sources, triangle
counts against the export manifest, and grounded geometry. Browser reported zero
asset failures; night overview measured 120 draw calls, 529,665 rendered triangles,
148 scene objects / 133 visible, and 95 building batches. Rendering was idle/on
demand, so no FPS comparison is claimed. Existing Vite large-chunk warning remains.

The additional GLB is 70,851,292 bytes with 15 embedded images. Shared instancing
limits repeated geometry overhead, but texture download/decode and GPU memory
remain significant; texture compression is the next useful optimization. The
legacy high-rise source emitted an exporter sampler warning, so its material
appearance deserves continued visual review. Base residential/commercial packs
were regenerated from the configured source library because they were missing
locally. Use `appearance=textured`, not the obsolete `appearance=studio` URL.

## Consolidation follow-up

The two-file source arrangement above has been superseded. All 76 textured-pack
models are now local to `2026-city-lookdev.blend`; see the consolidated-master
section of `docs/BUILDING_ASSETS.md` for current scene roles and export commands.
