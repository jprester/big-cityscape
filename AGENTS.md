# AGENTS.md

## Purpose

This repository contains **City Field**, a scale-first Three.js experiment for generating a large, realistic, high-density fictional futuristic city from simplified real-world urban structure.

Before making architectural or procedural-generation changes, read:

- `docs/PROJECT_PLAN.md`

Treat that document as the source of truth for scope, priorities, milestones, and non-goals.

## Working style

- Inspect the existing repository before proposing changes.
- State assumptions when the code or data does not establish an answer.
- Prefer small, reviewable increments over broad rewrites.
- Do not implement multiple milestones in one task unless explicitly requested.
- Preserve working behavior while refactoring.
- Explain performance and complexity implications of meaningful design choices.
- Flag uncertainty instead of inventing GIS or geometry behavior.

## Stack

Preferred initial stack:

- Vite
- TypeScript in strict mode
- Three.js
- Vitest where deterministic logic benefits from tests
- simple HTML/CSS for debug controls

Do not introduce React, a state-management framework, an ECS, a physics engine, or a large GIS dependency unless the current task clearly requires it and the benefit is demonstrated.

## Core project constraints

- The city is fictional and futuristic. It is not an Osaka simulation.
- OpenStreetMap data provides structural inspiration only.
- Prioritize realistic urban organization, scale, hierarchy, and performance.
- Use primitives and generated geometry before detailed assets.
- No Blender dependency is required for the initial project.
- Do not prioritize textures, traffic, pedestrians, interiors, or photorealism before primitive massing is convincing.
- Keep one simplified water corridor, but do not overbuild water rendering.
- Avoid premature interoperability with other city projects.

## Data rules

Expected local data layout:

```text
references/
  raw/
    osaka-structure.geojson
    osaka-buildings-reference.geojson
  processed/
    city-structure.json
```

Rules:

- Never load the raw 90+ MB building GeoJSON in the browser.
- Never import raw GeoJSON into the application bundle.
- Treat the building file as optional offline reference data.
- Prefer the smaller structural GeoJSON for the first preprocessing pipeline.
- Convert geographic coordinates to local metre-based coordinates offline.
- Centre processed runtime geometry near the Three.js origin.
- Preserve reproducible preprocessing parameters and source metadata.
- Keep large generated or raw data out of Git unless explicitly requested.
- Do not silently discard malformed or unsupported geometry; report counts and reasons.

## Architecture rules

Keep these concerns separate:

1. source-data loading and offline preprocessing;
2. geographic-to-local coordinate conversion;
3. normalized city-domain data;
4. road, water, block, and infrastructure logic;
5. procedural building definitions;
6. Three.js rendering;
7. debug visualization;
8. performance optimization.

Do not make `THREE.Object3D` instances the source of truth for city data.

Prefer a flow like:

```text
source data
→ normalized local data
→ semantic city definitions
→ procedural building definitions
→ renderable geometry
```

Use declarative data structures and configuration objects rather than scattered mesh creation.

## Determinism

- All procedural generation must use explicit seeds.
- Do not call `Math.random()` inside generation code.
- Provide or reuse a deterministic PRNG utility.
- Make district, block, and building generation independently reproducible.
- Stable semantic IDs should not depend on scene traversal order.
- Tests should verify repeatability for key generation stages.

## Geometry guidance

- Begin with a small vocabulary: box tower, slab, podium tower, stepped tower, perimeter/courtyard block, megastructure mass, infrastructure platform, landmark spire.
- Prefer simple boxes, extrusions, and combinations of primitives.
- Keep building placement block-aware and district-aware.
- Do not scatter unrelated random towers directly across the whole map.
- Heights should form coherent spatial clusters and gradients.
- Water, roads, rail, and other exclusions must prevent invalid building placement.
- Use manual overrides where source geometry is awkward; do not force full automation prematurely.

## Performance guidance

- Organize the city spatially into chunks.
- Prefer shared geometry, instancing, or merged static geometry where appropriate.
- Keep material count low.
- Avoid one expensive scene object per trivial generated element when batching is practical.
- Do not optimize blindly: measure draw calls, triangles, object count, and frame rate.
- Consider future LOD needs, but do not build a complex LOD system before the initial district works.
- Raw preprocessing cost and runtime rendering cost must remain separate concerns.

## Debugging requirements

Generation stages should be independently inspectable.

Maintain or add debug views for relevant tasks:

- dataset bounds and origin;
- imported roads;
- rail/infrastructure;
- water;
- derived blocks;
- buildable polygons;
- districts and profiles;
- building footprints;
- height distribution;
- chunk boundaries;
- final primitive masses.

Prefer reproducible saved camera presets for visual comparisons.

## Testing and validation

For meaningful changes:

- run the TypeScript build;
- run available tests;
- add focused tests for deterministic and geometry-independent logic;
- report commands executed and their results;
- report known limitations and deferred work.

For preprocessing changes, also report:

- number of source features read;
- number retained;
- number discarded or unsupported;
- output bounds;
- output file size;
- coordinate origin/projection approach.

For rendering changes, report relevant changes to:

- draw calls;
- triangles;
- scene object count;
- visible object count;
- approximate frame rate where measured.

Do not claim performance improvements without measurement.

## Scope control

Before implementing a request, identify which milestone it belongs to in `docs/PROJECT_PLAN.md`.

Do not jump to facade detail, shaders, traffic, props, or atmosphere to compensate for weak road/block/building organization.

When a request is broad:

1. propose the smallest useful slice;
2. list the files likely to change;
3. identify risks;
4. wait for approval if the change would create a major architectural commitment.

## Code quality

- Use clear names tied to city semantics.
- Prefer readonly data where practical.
- Keep functions small and stage-specific.
- Avoid hidden global mutable state.
- Isolate Three.js resource creation and disposal.
- Dispose geometries, materials, controls, and listeners correctly.
- Document non-obvious coordinate and polygon conventions.
- Use explicit units in names or comments where ambiguity is possible.
- Avoid abstract frameworks before repeated concrete patterns justify them.

## Completion format

At the end of a coding task, provide:

1. a concise summary of what changed;
2. files added or modified;
3. validation commands and results;
4. performance implications where relevant;
5. known limitations;
6. the smallest sensible next step.

## First-session instruction

For the first Codex session:

- read this file and `docs/PROJECT_PLAN.md`;
- inspect the repository;
- propose a minimal foundation;
- do not build the complete city generator;
- prefer a clean Vite + TypeScript + Three.js scene, seeded-random utility, and debug-layer foundation as the first reviewable milestone.
