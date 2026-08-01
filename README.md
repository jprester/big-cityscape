# City Field

City Field is a scale-first Three.js experiment for generating a large, fictional,
high-density futuristic city from simplified real-world urban structure.

Milestone 1 adds an offline structural-data pipeline and browser debug viewer. It
still does not load raw geographic data or generate city buildings.

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
- **Reset aerial camera**: restore the reproducible initial camera pose

The debug panel independently toggles the metre grid, world axes, clipped roads,
railways, water, and working-area bounds. The performance panel reports frames
per second, average frame time, draw calls, rendered triangles, and scene-object
count.

## Coordinate convention

- One Three.js world unit represents one metre.
- `Y` is vertical.
- `X` and `Z` form the horizontal city plane.
- Runtime city data should remain centred close to `[0, 0, 0]`.

Geographic coordinates are projected into local metric coordinates by
`scripts/preprocess-osm.ts`. Raw GeoJSON is never imported into the browser
bundle. See `docs/PREPROCESSING.md` for the selected clip, projection, source
accounting, and current geometry limitations.

## Architecture

```text
src/
  app/      renderer lifecycle, camera, resizing, and performance display
  city/     processed city model, data loading, and structural debug views
  core/     framework-independent deterministic utilities
  debug/    render-only inspection layers and their UI
scripts/
  preprocess/  pure projection, clipping, classification, and tests
```

The debug layer manager owns named Three.js visualization groups and their
disposal callbacks. It is not a source of truth for city data. Later generation
stages should produce declarative domain data first, then create renderable and
debug geometry from that data.

All procedural generation must use an explicitly seeded random source. Direct
calls to `Math.random()` do not belong in generation code.

## Current scope boundary

Milestone 1 includes the Milestone 0 foundation plus deterministic offline
projection and clipping of the smaller structural GeoJSON, compact normalized
runtime data, and batched debug rendering of roads, rail, water, and bounds.

Buildable-block derivation, districts, buildings, chunking, LOD, textures, and
atmosphere are deferred to later milestones in `docs/PROJECT_PLAN.md`.

## Source-data attribution

Structural source data is derived from OpenStreetMap and will require the
appropriate attribution in any distributed data or public build:

> Map data © OpenStreetMap contributors
