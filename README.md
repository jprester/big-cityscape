# City Field

City Field is a scale-first Three.js experiment for generating a large, fictional,
high-density futuristic city from simplified real-world urban structure.

Milestone 0 contains only the rendering and inspection foundation. It deliberately
does not load geographic data or generate city geometry.

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Commands

```sh
npm install
npm run dev
npm test
npm run build
```

## Inspection controls

- Left mouse drag: pan across the ground plane
- Right mouse drag: orbit around the current target
- Mouse wheel or pinch: zoom
- **Reset aerial camera**: restore the reproducible initial camera pose

The debug panel independently toggles the metre grid and world axes. The
performance panel reports frames per second, average frame time, draw calls,
rendered triangles, and scene-object count.

## Coordinate convention

- One Three.js world unit represents one metre.
- `Y` is vertical.
- `X` and `Z` form the horizontal city plane.
- Runtime city data should remain centred close to `[0, 0, 0]`.

Geographic coordinates will be projected into local metric coordinates by a
future offline preprocessing stage. Raw GeoJSON must never be imported into the
browser bundle.

## Architecture

```text
src/
  app/      renderer lifecycle, camera, resizing, and performance display
  core/     framework-independent deterministic utilities
  debug/    render-only inspection layers and their UI
```

The debug layer manager owns named Three.js visualization groups and their
disposal callbacks. It is not a source of truth for city data. Later generation
stages should produce declarative domain data first, then create renderable and
debug geometry from that data.

All procedural generation must use an explicitly seeded random source. Direct
calls to `Math.random()` do not belong in generation code.

## Current scope boundary

Milestone 0 includes Vite, strict TypeScript, Three.js, a metre-scale foundation
scene, an inspection camera, live performance metrics, deterministic randomness,
debug layers, and focused tests.

Road and water preprocessing, geographic projection, blocks, districts,
buildings, chunking, instancing, merging, LOD, textures, and atmosphere are
deferred to later milestones in `docs/PROJECT_PLAN.md`.

## Source-data attribution

Structural source data is derived from OpenStreetMap and will require the
appropriate attribution in any distributed data or public build:

> Map data © OpenStreetMap contributors
