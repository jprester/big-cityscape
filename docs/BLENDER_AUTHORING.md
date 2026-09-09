# Blender authoring workflow

Master: `2026-city-lookdev.blend`. This replaces the earlier old/new export split.

## Everyday work

- **Buildings**: one flat `ASSET_LIBRARY` collection of finished variants. Existing
  custom IDs are retained; new library entries received IDs during migration.
- **City**: reviewed placements in `CITY_BUILDINGS`, editable block meshes in
  `CITY_BLOCKS`, and the existing roads/lighting/presentation references.
- **Workshop**: optional experiments. Modeling in another scene is fine; move or
  link the finished source to Buildings when ready.
- **Archive / Previous organization**: previous shelves, collections and retired
  placements retained for reference. This is not an export source or full snapshot.
- **EXP…** scenes: optional existing lighting/material studies.

The redundant `EXPORT / Approved buildings` scene is removed. Export uses City
placement membership, not the current selection or a hand-maintained model list.

Move a block in Object Mode to move its child buildings with it. Move an individual
building to adjust its placement. Export determines block membership from its
current centre and the block footprints; ambiguous/outside placements remain
unassigned and are reported, never moved automatically. A building reparented
with Keep Transform to its new block will follow that block on later edits.

Linked duplicates (Alt-D) share mesh edits; regular duplicates (Shift-D) can become
independent variants. Many inherited city models already have independent meshes.
Changing a library mesh does not automatically change those copies. The exporter
preserves their actual evaluated geometry instead of replacing it by the nominal
library asset. This is deliberate protection of manual edits; a future explicit
'replace selected instances from library' operation can make propagation easier.

## Export the reviewed scene

Save Blender, then run in the Three.js repository:

```sh
npm run city:export-reviewed
```

Outputs (generated, ignored by Git):

- `public/assets/city-reviewed/reviewed-city-buildings.glb`: unique evaluated meshes
  used in City, with materials and textures, each exported once.
- `public/assets/city-reviewed/reviewed-city.json`: block footprints, instances,
  library references, exact column-major placement matrices and source checksums.

The exporter reads the saved master without saving it. Duplicate instance IDs
created by Blender duplication receive deterministic disambiguation in the export.
Geometry fingerprints include UVs, materials and normals; distinct city variants
are retained even when copied objects carry the same library ID.

Coordinates use metres and the standard glTF basis: Blender (x,y,z) → Three.js
(x,z,-y). Placement matrices are conjugated by that basis change. They preserve
translation, rotation, scale and parent transforms without decomposing them.
This differs from the earlier procedural-layout import convention; the new viewer
must use this schema explicitly rather than mixing old placement coordinates.

The exporter currently supports mesh building instances and four-corner block
footprints. Roads, streetlights, lighting and effects are not exported. Their
runtime rendering remains a separate concern; road generation must eventually use
these block/map coordinates. Current road preview geometry in Blender does not
follow moved blocks automatically.

**Open `?view=reviewed&time=day` for the reviewed Blender city.** The separate
`?view=synthetic` route retains the procedural city. Save Blender, run
`npm run city:export-reviewed`, and refresh the reviewed view to apply later edits. Existing textured-pack commands
are legacy procedural workflows and should not be used to publish the new City.
The old Blender city importer now refuses to rebuild an authored master.

## Organization validation, 2026-09-07

- 82 library entries, including seven recovered from placed models whose source
  was missing or used independent geometry. No model geometry was replaced.
- 1,176 placement objects preserved; all instance IDs unique after migration.
- 400 existing block mesh islands separated into editable blocks.
- Twelve placement centres fall outside all block bounds; retained and reported in
  `references/visual/atlas-shape-study/authoring-organization.json`.
- Reopened master compared against the timestamped `.blend.pre-authoring-*.bak`:
  identical building vertex/polygon counts, maximum world-matrix element error
  0.000014, and identical block vertex positions rounded to 0.0001 m.
- Reviewed export: 78 unique meshes for 1,176 instances. Shared geometry remains
  available to an instanced runtime renderer; no FPS improvement is claimed.
- Build and 179 tests passed. Existing Vite large-chunk warning remains.

Full backup is beside the master. Reopen the master if it was already open during
organization; do not overwrite the reorganized file from an older in-memory copy.


## Reviewed browser mode (2026-09-07)

The current saved master exports 1,180 placements, 78 unique evaluated meshes and
400 block footprints. `src/reviewed/` validates and loads the snapshot, retains full
affine matrices, and batches instances by model part and 500 m spatial cell.
Mirrored or sheared transforms use ordinary meshes to preserve correct rendering.
No model substitution, placement fitting, reseeding or automatic removal occurs.
Twelve outside-block placements remain visible at their authored coordinates.

Day/dusk/night atmosphere, inspection lighting and nearby real streetlights reuse
the existing components. Asphalt fills the gaps between authored blocks;
sidewalks and lamp positions follow their edges. This first reviewed mode uses
basic road presentation; procedural signage, road markings and parks are not
yet transferred. Orbit, rooftop, street and first-person Walk controls are available. Lighting is not expected to match Blender pixel-for-pixel.

Validation: all 1,180 exported GLB + JSON world bounds checked against Blender,
maximum discrepancy below 0.000001 m. Browser loaded without warnings/errors;
day overview measured 553 draw calls and 518,954 triangles; night rooftop measured
320 draw calls and 345,988 triangles. These are view-dependent measurements, not
an FPS improvement claim. Rendering sleeps when idle. Build and 183 tests pass,
including affine transforms, mirrored/sheared fallback, block coordinates and
invalid snapshot references. The existing Vite large shared-chunk warning remains.
Texture compression and batch-count tuning are future performance work.


## First-person walking (2026-09-08)

Click **Walk** in the reviewed city. WASD or arrow keys move, Shift increases
speed, mouse movement looks around, and Esc exits. Camera presets also exit
walking mode. The existing pointer-lock controller and walking HUD are reused.

The spawn is chosen deterministically near the map centre with clearance from
buildings and lamp poles. Collision bounds use the actual exported building
transforms and a spatial index, including rotated/scaled placements. These are
conservative axis-aligned bounds: they may block empty space around angled or
irregular buildings. Walking stays at a fixed 1.8 m eye height; stairs, interiors
and terrain following are not implemented. Walking actively renders frames;
orbit inspection returns to on-demand rendering when idle. No FPS gain is claimed.

Implementation: `src/reviewed/createReviewedCityApp.ts`,
`addReviewedBuildings.ts`, `reviewedWalkSpawn.ts` and its focused tests.
Browser activation and HUD display were verified. Build and all 185 tests pass,
including clear-spawn selection and reporting a completely obstructed map.

### Reviewed city reflections

The reviewed renderer adds a shared, static studio reflection environment to the exported PBR materials. Use **Glass reflections · studio environment** to compare it on and off. Strength follows Day/Dusk/Night; the visible sky remains independent. No Blender material changes or re-export are needed.

The PMREM texture is generated once and disposed with the app. This adds environment sampling to material shading without extra city draw calls or geometry. It approximates studio illumination; it does not reflect neighboring buildings or exactly reproduce Blender’s preview HDRI.
