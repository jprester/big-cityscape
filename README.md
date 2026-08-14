# City Field

City Field is a deterministic Three.js experiment for generating a fictional,
high-density futuristic city. The current product view is a synthetic 2 × 2 km
city assembled from rectangular districts, semantic block templates, and a
reviewed low-poly building catalogue—without real geography or runtime GIS.

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Commands

```sh
npm install
npm run preprocess
npm run catalog:build
npm run dev
npm test
npm run build
```

Running `npm run dev` and opening the root URL now loads the full synthetic city:

```text
http://localhost:5173/
```

The earlier geodata city remains available for comparison at
`http://localhost:5173/?view=legacy`. The asset gallery remains at
`http://localhost:5173/?view=assets`.

## Building asset catalogue

Run `npm run catalog:build` after adding or changing a building GLB. The command
regenerates deterministic geometry measurements for every exported asset.
During an asset-authoring session, `npm run catalog:watch` keeps the generated
measurements current as GLBs are added, replaced, or removed.

While the development server is running, open
`http://localhost:5173/?view=assets` to inspect all assets, their reviewed city
roles, nominal metre dimensions, scale limits, geometry cost, and audit status.
See `docs/BUILDING_ASSETS.md` for the catalogue workflow and conventions.

## Synthetic-city inspection controls

- Left mouse drag: orbit around the current target
- Right mouse drag: pan
- Middle mouse drag, mouse wheel, or pinch: zoom
- **Overview**, **Rooftop**, **Street**, **Crossing**, and **Spine**: restore
  reproducible comparison views
- **Walk**: enter the 1.8 m first-person inspection mode

Append `?seed=123` to the development URL to inspect another deterministic city
variation. Use `?mode=proof` for the 500 × 500 m proof district.

The debug panel independently toggles atmosphere, street surfaces, sidewalks,
block templates, open spaces, buildable bounds, placement slots, chunk bounds,
the offset spine, road markings, selected building models, and inspection
lighting. The statistics and performance panels report composition, draw calls,
triangles, scene objects, rendered chunks and batches, and visible model
instances.

## Coordinate convention

- One Three.js world unit represents one metre.
- `Y` is vertical.
- `X` and `Z` form the horizontal city plane.
- Runtime city data should remain centred close to `[0, 0, 0]`.

The synthetic city is generated directly in local metre coordinates and does
not load geographic data. See `docs/SYNTHETIC_CITY.md` for its composition,
selection, rendering, and performance contract. The legacy route retains the
offline geographic preprocessing described in `docs/PREPROCESSING.md`.

## Architecture

```text
src/
  synthetic/  current product-view lifecycle and environment controls
  app/        retained legacy geodata-view lifecycle
  city/       domain models, deterministic generation, rendering, and debug views
  catalog/    building-asset inspection gallery
  core/     framework-independent deterministic utilities
  debug/    render-only inspection layers and their UI
scripts/
  catalog-building-assets.ts  reproducible GLB measurements
  preprocess/ and blocks/     retained legacy offline geodata processing
```

The debug layer manager owns named Three.js visualization groups and their
disposal callbacks. It is not a source of truth for city data. Later generation
stages should produce declarative domain data first, then create renderable and
debug geometry from that data.

All procedural generation must use an explicitly seeded random source. Direct
calls to `Math.random()` do not belong in generation code.

## Current scope boundary

The default city contains 16 deterministic districts, 400 blocks, 1,188
catalogue-selected buildings, hierarchical street surfaces, sidewalks, open
spaces, road markings, a primary landmark and secondary skyline anchors,
distance atmosphere, day/dusk/night presets, district batching and visibility,
saved camera views, and first-person inspection.

Detailed facades and materials, emissive windows and signage, traffic,
pedestrians, collision, and complex irregular road topology remain future work.

## Source-data attribution

The default synthetic city contains no OpenStreetMap-derived structure. The
legacy route does, and any distribution that includes it still requires the
appropriate attribution:

> Map data © OpenStreetMap contributors
