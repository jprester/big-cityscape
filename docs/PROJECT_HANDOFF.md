# City Field project handoff

Snapshot date: 2026-08-04  
Default seed: `20260801`  
Current committed baseline: `d7ec2d2` (`feat: enhance city massing generation with tall building clearance and skyline promotion`)

This document is intended for a new Codex or ChatGPT conversation. Conversation
memory should not be assumed to carry across tasks. The repository is durable;
the reasoning and visual decisions that produced it are not.

Before changing the project, read these files in order:

1. `AGENTS.md`
2. `docs/PROJECT_PLAN.md`
3. this document
4. the focused documentation relevant to the task:
   `docs/PREPROCESSING.md`, `docs/BLOCKS.md`, `docs/MASSING.md`, or
   `docs/PERFORMANCE.md`

Then inspect the implementation and current Git status. Do not assume all
documentation measurements are equally recent.

## Project intent

City Field is a scale-first Three.js experiment for a fictional, high-density,
futuristic city. Osaka-derived OpenStreetMap data supplies horizontal structural
inspiration, but the project is not an Osaka simulator.

The central visual goal has been:

> believable urban scale, organization, density, and skyline hierarchy before
> textures, facades, traffic, atmosphere, or photorealism

The implementation deliberately uses vanilla Three.js rather than React or
React Three Fiber. The application has one canvas, a small debug interface, and
direct rendering/resource lifecycles; a UI framework has not yet demonstrated a
useful benefit.

## Current implemented state

### Foundation

- Vite, strict TypeScript, Three.js, and Vitest.
- Seeded deterministic random utilities; generation code does not use
  `Math.random()`.
- OrbitControls with standard Three.js mouse behavior.
- Stable aerial, rooftop, and street camera presets.
- Simple HTML/CSS debug controls and a live performance panel.
- Demand-driven rendering: frames stop after camera damping settles, pause while
  the page is hidden, use the low-power GPU preference, cap active rendering at
  60 FPS, and cap pixel ratio at 1.5.

### Runtime data and city structure

- Raw GeoJSON is processed offline and never loaded by the browser.
- Geographic coordinates are converted to local metre-based `X/Z` coordinates
  centred near the origin.
- Runtime structure includes roads, rail, water, bounds, districts, derived
  blocks, and buildable regions.
- Current processed output contains 118 retained city blocks and 274 buildable
  regions over approximately 1.98 km².
- The browser does not load the large 90+ MB building GeoJSON.

### Roads and infrastructure

- 510 clipped source roads feed a connected render network.
- Four tunnels remain debug-only.
- 506 visible roads preserve 252 exact junctions.
- Four conservative clipping-gap repairs are accepted.
- Nineteen invalid elevated dead-end fragments are hidden.
- Road surfaces are width-classed and merged into highway and ordinary-road
  batches.
- Elevated components preserve deck height and use sampled terminal ramps.
- Water and rail remain structural/debug layers rather than detailed visual
  systems.

### Building generation

- City definitions are declarative data; Three.js objects are not the source of
  truth.
- Building placement is block-aware, district-aware, road-aligned, and seeded.
- Residual urban fabric samples a block/street-aligned 12 m lattice while
  clearing roads, rail, water, bounds, and accepted footprints.
- Buildings within a block share one dominant orientation and regular rows.
- A continuous height field creates a primary core, secondary centres, and
  lower transition fabric.
- Ten promoted skyline sites reach roughly 130–224 m, with one 287 m landmark.
- Up to 120 central and 50 distributed high-rise promotions create the
  residential-to-downtown height transition.
- Buildings at least 60 m tall claim an 8–28 m height-scaled clearance. Taller
  buildings win deterministic conflicts, removing lower neighbours around the
  tower footprint.
- Residential height and footprint variation is approximately ±20%.

At the default seed, the current deterministic domain output is:

| Metric | Current value |
| --- | ---: |
| Buildings | 4,429 |
| Residual-fabric source lots | 4,373 |
| Occupied 250 m chunks | 46 |
| Low / mid / high / landmark height bands | 4,341 / 80 / 7 / 1 |

### Building assets and rendering

- GLB models are normalized on load and rendered with a shared cement-grey
  Lambert material and no textures or shadows.
- Buildings are rendered through one `BatchedMesh` per occupied 250 m chunk.
- Runtime categories are residential, high-rise, and skyscraper.
- The committed catalog currently names 25 residential, 37 high-rise, and 16
  skyscraper files (78 entries before runtime substitutions).
- Ten skyline placements use representative skyscraper models.
- The broadest non-landmark skyline parcel uses naturally wide `high-rise-31`
  instead of stretching a slender skyscraper asset.
- `high-rise-5` is retired at selection time and resolves to `high-rise-31`,
  with `high-rise-29` as fallback. It must not render.
- The last verified live output showed 4,239 residential instances, 180
  high-rise instances using 36 rendered variants, and 10 skyscraper instances.

The last verified default aerial measurement before the local asset edits
listed below was:

| Metric | Last verified value |
| --- | ---: |
| Draw calls | 62 |
| Triangles | 1,414,407 |
| Scene objects | 85 |
| Render state after settling | Idle / on demand |

Triangle counts may change when GLB files change. Re-measure using the same
seed, camera preset, viewport, and enabled layers.

## Architecture map

```text
source GeoJSON
→ offline projection, clipping, and classification
→ compact processed city structure
→ offline block derivation and buildable regions
→ deterministic residual lots and building definitions
→ skyline promotion and tall-building clearance
→ spatial chunk definitions
→ GLB model selection and normalization
→ chunked BatchedMesh rendering
→ independently toggleable debug layers
```

Important files:

| Concern | Primary files |
| --- | --- |
| App lifecycle and render scheduling | `src/app/createApp.ts` |
| Camera | `src/app/createInspectionCamera.ts` |
| Seeded randomness | `src/core/random.ts` |
| Runtime city types | `src/city/model/processedCity.ts` |
| Block types | `src/city/model/cityBlocks.ts` |
| Building definitions | `src/city/model/cityMassing.ts` |
| Building generation | `src/city/generation/generateCityMassing.ts` |
| Residual fabric | `src/city/generation/generateResidualFabric.ts` |
| Height hierarchy | `src/city/generation/cityHeightField.ts` |
| Skyline promotion | `src/city/generation/promoteCitySkyline.ts` |
| Tower spacing | `src/city/generation/enforceTallBuildingClearance.ts` |
| Tunable massing rules | `src/city/generation/massingConfig.ts` |
| Road render topology | `src/city/rendering/createRoadSurfaceNetwork.ts` |
| Model catalog | `src/city/rendering/buildingModelCatalog.ts` |
| Model loading/normalization | `src/city/rendering/loadBuildingModels.ts` |
| Model selection | `src/city/rendering/selectBuildingModel.ts` |
| Skyline asset reservation | `src/city/rendering/planSkylineModelCoverage.ts` |
| Chunked building renderer | `src/city/rendering/addCityMassingLayer.ts` |
| Debug layer ownership | `src/debug/DebugLayerManager.ts` |

## Decisions worth preserving

1. **Data before rendering.** Generation returns stable semantic definitions;
   rendering consumes them. Do not put urban-design decisions into Three.js
   scene traversal.
2. **Determinism is mandatory.** Seeds derive from stable semantic IDs so
   blocks and buildings remain reproducible independently of array order.
3. **Urban hierarchy beats global randomness.** District profiles, a height
   field, block composition, and road alignment decide the large-scale city;
   random variation operates only inside that structure.
4. **Performance is measured.** Chunking, batching, material count, draw calls,
   triangles, objects, and render scheduling matter more than speculative
   optimization.
5. **Source data is inspiration, not truth.** Manual overrides and conservative
   suppression are acceptable when incomplete OSM topology produces visibly
   invalid geometry.
6. **Do not force every model into the city.** A previous “use every asset” rule
   caused poorly matched and heavily stretched buildings. Prefer a curated
   model set and footprint compatibility.
7. **Density before decoration.** Roads, block organization, building spacing,
   and skyline shape were intentionally prioritized over lighting, materials,
   gardens, facades, or atmosphere.

## Known limitations and fragile areas

- The residual city is a regular road-aligned lattice, not cadastral parcels.
- The working boundary is visibly rectangular from high aerial views; there is
  no surrounding proxy city, terrain, hills, or distance fog.
- Cleared tower surroundings are empty ground, not designed plazas or podium
  parcels.
- Model transforms independently fit width, height, and depth. Strongly
  incompatible assets can still look distorted unless selection rejects or
  substitutes them.
- Skyline and high-rise coverage contain explicit heuristics and model-specific
  exceptions. Treat these as curation rules, not general GIS logic.
- Road connectivity is inferred from processed coordinates because OSM node IDs
  are not retained. Repairs are deliberately conservative.
- Elevated roads have no supports, barriers, or lane markings.
- There is no LOD, distance streaming, facade system, terrain, traffic,
  pedestrians, interiors, or advanced water rendering.
- Residual generation still runs at startup.
- `README.md` and the measured tables in `docs/PERFORMANCE.md` still describe an
  older primitive-box count and should not be used as the latest output census.
  `docs/MASSING.md` and this handoff are newer.

## Current uncommitted asset work

At the time of this snapshot, the worktree contains user-owned Blender/GLB
changes. Preserve them; do not reset, overwrite, or delete them without explicit
approval.

Modified tracked assets:

- `high-rise/high-rise-lp-9.glb`
- `skyscraper/skyscraper-lp-11.glb`
- `skyscraper/skyscraper-lp-13.glb` through `skyscraper-lp-16.glb`

New untracked assets:

- `residential/residential-lp-27.glb` through `residential-lp-30.glb`
- `skyscraper/skyscraper-lp-17.glb` through `skyscraper-lp-22.glb`

The current runtime catalog does **not** yet include residential 27–30 or
skyscraper 17–22. Their presence in `public/` does not make them visible in the
city.

## Commands and validation

```sh
npm install
npm run preprocess   # only when processed source data must be regenerated
npm run dev
npm test
npm run build
```

Use `http://localhost:5173/?seed=20260801` for the canonical comparison seed.
For rendering changes, inspect all three saved camera presets and report draw
calls, triangles, objects, visible chunks, and whether the renderer returns to
idle.

## Recommended scope for a simplified successor

A simplified version should reuse the lessons, not copy every current system.
The smallest credible successor would keep:

- Vite + strict TypeScript + vanilla Three.js;
- the seeded-random utility;
- declarative building definitions separated from rendering;
- OrbitControls, saved camera presets, demand-driven rendering, and the
  performance panel;
- one shared cement material;
- chunked or instanced rendering; and
- a small curated model whitelist with explicit footprint metadata.

It can omit or replace:

- general OSM block polygonization;
- topology repair heuristics;
- the 4,373-lot residual-fabric pass;
- “use every model” coverage rules;
- nine procedural archetypes and multiple overlapping promotion passes; and
- the complete debug-layer catalog.

Suggested simplified scope:

1. Use a hand-authored or pre-baked 800–1,200 m square city definition.
2. Keep one water corridor, 10–20 guaranteed-connected roads, and three explicit
   districts: low-rise fabric, high-rise transition, and central skyline.
3. Generate regular block-local grids directly rather than deriving every lot
   from road polygons.
4. Curate perhaps 6 residential, 8 high-rise, and 4 skyscraper models.
5. Match models by footprint dimensions and preferred height range; reject
   candidates that require extreme non-uniform scale.
6. Target roughly 1,000–2,000 buildings first, then expand only after the
   skyline and street rhythm look convincing.
7. Preserve one seed, three comparison cameras, and a small layer set: roads,
   water, buildings, footprints, districts, and chunks.

This retains the strongest parts of the experiment—scale, hierarchy,
determinism, inspection, and performance—without inheriting the most complicated
GIS and curation machinery.

## Suggested prompt for a new conversation

```text
Read AGENTS.md, docs/PROJECT_PLAN.md, and docs/PROJECT_HANDOFF.md, then inspect
the repository and Git status. I want to build a separate, simplified version
of City Field that preserves deterministic generation, urban hierarchy,
demand-driven Three.js rendering, camera presets, and performance inspection,
but avoids the current project's complex block derivation, residual-fabric,
road-repair, and forced model-coverage systems.

First propose the smallest architecture and migration/reuse plan. Do not modify
or discard the current uncommitted GLB assets. Explain which current modules
should be reused, adapted, or left behind before making changes.
```
