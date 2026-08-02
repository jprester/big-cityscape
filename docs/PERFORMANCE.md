# Spatial chunking and performance budgets

The renderer partitions declarative building definitions before creating any
Three.js massing objects. Chunking does not change block geometry, placement,
archetypes, or the city seed.

## Chunk semantics

The default chunk size is 250 m, at the upper end of the project plan's
suggested 100–250 m range. A building is assigned from its footprint centre
using signed grid indices:

```text
gridX = floor(centreX / chunkSize)
gridZ = floor(centreZ / chunkSize)
```

IDs encode chunk size and signed indices, for example `chunk-250m-xn2-zp1`.
Buildings and chunks are sorted by semantic ID/grid index, so output does not
depend on source-array or scene traversal order. Each building is retained
exactly once; the stage reports total assignments and maximum per-chunk work.

The default seed's 4,791 buildings occupy 46 chunks across all three first-pass
districts. The residual fabric uses every visible road corridor—including
bridges and nonzero layers—plus exact rail, water, bounds, and existing-footprint
checks rather than unconstrained visual scattering.

## Rendering and culling

Each occupied chunk owns one `InstancedMesh` batch. Material categories are
preserved as per-instance colors. All chunks share:

- one unit box geometry;
- one Lambert material;
- one pair of non-shadow-casting lights.

Each batch computes its own bounding box and sphere. Three.js performs frustum
culling at chunk granularity instead of treating the city as one global batch.
The frame overlay reports rendered chunks, batches, and primitive parts
alongside normal renderer statistics.

The `Occupied chunks` debug layer shows only cells containing buildings. Empty
grid cells do not create scene objects.

## Measured baseline

Measurements were sampled in the local browser at the default seed and viewport.
They are comparison data, not universal hardware guarantees.

| View | Rendered chunks | Massing batches | Box parts | Draw calls | Triangles | Approx. FPS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| aerial | 46 / 46 | 46 / 46 | 4,903 / 4,903 | 62 | 67,830 | 120 |
| rooftop | 29 / 46 | 29 / 46 | 3,474 / 4,903 | 45 | 50,682 | 120 |
| street | 13 / 46 | 13 / 46 | 1,546 / 4,903 | 28 | 27,546 | 120 |

Rooftop and street culling remain useful despite the coarse cell size: the
street preset renders 28% of occupied chunks and 31% of all box parts. The
solid transport network adds two merged surface batches independent of the
number of road segments. Segment ribbons, bounded bevels, shared-endpoint fills,
sampled bridge and terminal-ramp spans add approximately 8,500 triangles in
every preset. The previous round fill at every source vertex and clipped
endpoint added about
12,200 unnecessary coplanar triangles. The normal scene remains at 85 objects
and the observed frame rate remains unchanged.

Stable block labels are created only while their debug layer is enabled. This
keeps the normal scene at 85 objects; enabling all 118 CSS labels raises it to
203 temporarily, and disabling the layer removes them again. Enabling a
candidate-audit reason adds one debug-line draw call. Audit overlays are excluded
from the default budget comparison.

## Current budgets

- default spatial cell: 250 m;
- one massing draw call per visible occupied chunk;
- one shared primitive geometry/material and no per-building Three.js object;
- two merged road-surface draw calls for all visible non-tunnel roads;
- aerial target: at most 65 total draw calls and 90 scene objects;
- street target: at most 30 total draw calls and 60,000 triangles;
- sampled interaction target: at least 60 FPS on the development machine.

These budgets should be revisited after any substantial block or district
expansion. Performance comparisons must use the same seed, camera preset,
viewport, and enabled debug layers.

## Deferred work

- No chunk streaming or asynchronous rebuilding is needed for 46 chunks.
- No maximum view distance is applied; culling currently uses the camera frustum.
- No LOD or skyline proxy exists.
- Structural roads and water are batched by feature category rather than spatial
  chunk.
- Road chunking can avoid submitting the complete joined network in close views,
  but is deferred while the measured frame rate remains stable and the network
  stays below the revised triangle budget.
- JavaScript heap is not displayed because portable browser memory reporting is
  not consistently available.

The current expansion remains inside revised draw-call, object-count, triangle,
and frame-rate budgets. Distance or LOD policy should be introduced only when a
later measured expansion justifies it.
