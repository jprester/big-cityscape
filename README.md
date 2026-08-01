# City Field

City Field is a scale-first Three.js experiment for generating a large, fictional,
high-density futuristic city from simplified real-world urban structure.

Milestone 3 adds deterministic primitive building massing over the first
road-bounded blocks. The browser still does not load raw geographic data or use
real-world building footprints.

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Commands

```sh
npm install
npm run preprocess
npm run dev
npm test
npm run build
```

## Inspection controls

- Left mouse drag: pan across the ground plane
- Right mouse drag: orbit around the current target
- Mouse wheel or pinch: zoom
- **Aerial**, **Rooftop**, and **Street**: restore reproducible comparison views

Append `?seed=123` to the development URL to inspect another deterministic
massing variation.

The debug panel independently toggles the metre grid, world axes, clipped roads,
railways, water, working-area bounds, district fills, block outlines, buildable
outlines, stable block IDs, primitive building masses, building footprints, and
height markers. The performance panel reports frames per second, average frame
time, draw calls, rendered triangles, total scene objects, and visible objects.

## Coordinate convention

- One Three.js world unit represents one metre.
- `Y` is vertical.
- `X` and `Z` form the horizontal city plane.
- Runtime city data should remain centred close to `[0, 0, 0]`.

Geographic coordinates are projected into local metric coordinates by
`scripts/preprocess-osm.ts`. Raw GeoJSON is never imported into the browser
bundle. See `docs/PREPROCESSING.md` for the selected clip and projection, and
`docs/BLOCKS.md` for the block derivation rules and current limitations.
Primitive placement and rendering are documented in `docs/MASSING.md`.

## Architecture

```text
src/
  app/      renderer lifecycle, camera, resizing, and performance display
  city/     domain models, deterministic generation, rendering, and debug views
  core/     framework-independent deterministic utilities
  debug/    render-only inspection layers and their UI
scripts/
  preprocess/  pure projection, clipping, classification, and tests
  blocks/      offline road polygonization, exclusions, insets, and tests
```

The debug layer manager owns named Three.js visualization groups and their
disposal callbacks. It is not a source of truth for city data. Later generation
stages should produce declarative domain data first, then create renderable and
debug geometry from that data.

All procedural generation must use an explicitly seeded random source. Direct
calls to `Math.random()` do not belong in generation code.

## Current scope boundary

Milestone 3 includes the earlier foundation, structural viewer, and 20-block
dataset plus four primitive archetypes, coherent district height profiles, one
landmark, material-batched rendering, and deterministic seed variation.

Detailed parcels, chunking, LOD, facades, textures, traffic, and atmosphere
remain deferred to later milestones in `docs/PROJECT_PLAN.md`.

## Source-data attribution

Structural source data is derived from OpenStreetMap and will require the
appropriate attribution in any distributed data or public build:

> Map data © OpenStreetMap contributors
