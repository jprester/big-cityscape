# Spatial chunking and performance budgets

Milestone 4 partitions the existing declarative building definitions before
rendering. It does not change block geometry, building placement, archetypes, or
the city seed.

## Chunk semantics

The default chunk size is 200 m, within the project plan's suggested 100–250 m
range. A building is assigned from the centre of its footprint using signed grid
indices:

```text
gridX = floor(centreX / chunkSize)
gridZ = floor(centreZ / chunkSize)
```

IDs encode the chunk size and signed indices, for example
`chunk-200m-xn2-zp1`. Buildings and chunks are sorted by semantic ID/grid index,
so output does not depend on source-array or scene traversal order. Each building
is retained exactly once; the chunk stage reports total assignments and maximum
per-chunk workload.

The current 50 buildings occupy 17 chunks across all three first-pass districts.
This already exercises separated clusters across most of the 1.98 km² working
area without inventing additional non-block-aware buildings.

## Rendering and culling

Each occupied chunk owns one `InstancedMesh` batch. Material categories are
preserved as per-instance colors. All chunks share:

- one unit box geometry;
- one Lambert material;
- one pair of non-shadow-casting lights.

Each batch computes its own bounding box and sphere. Three.js therefore performs
frustum culling at chunk/material granularity instead of treating every building
in the city as one global material batch. The frame overlay reports rendered
chunks, rendered batches, and rendered primitive parts alongside normal renderer
statistics.

The `Occupied chunks` debug layer shows only cells that currently contain
buildings. Empty grid cells do not create scene objects.

## Measured baseline

Measurements were sampled in the local browser at the default seed and viewport.
They are comparison data, not universal hardware guarantees.

| View | Rendered chunks | Massing batches | Box parts | Draw calls | Triangles | Approx. FPS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| aerial | 17 / 17 | 17 / 17 | 86 / 86 | 31 | 1,526 | 120 |
| rooftop | 7 / 17 | 7 / 17 | 41 / 86 | 20 | 986 | 120 |
| street | 9 / 17 | 9 / 17 | 55 / 86 | 22 | 1,154 | 120 |

The first expanded chunk/material implementation rendered the aerial view in 37
calls with 110 scene objects. Consolidating material categories into per-instance
colors brings the same 50 buildings to 31 calls and 87 objects. The street preset
rejects eight chunks and thirty-one box parts.

This is intentionally reported as a tradeoff, not an unconditional performance
improvement. The finer culling boundary becomes valuable when more chunks exist;
at the current scale, frame time remains effectively unchanged.

## Initial budgets

- default spatial cell: 200 m;
- one massing draw call per visible occupied chunk;
- one shared primitive geometry/material and no per-building Three.js object;
- current aerial target: at most 32 total draw calls and 100 scene objects;
- current street target: at most 25 total draw calls and 1,200 triangles;
- sampled interaction target: at least 60 FPS on the development machine.

These budgets should be revisited after any substantial block or district
expansion. A claim of improvement should compare the same seed, camera preset,
viewport, and enabled debug layers.

## Deferred work

- No chunk streaming or asynchronous rebuilding is needed for 17 chunks.
- No maximum view distance is applied; culling currently uses the camera frustum.
- No LOD or skyline proxy exists.
- Structural roads and water are still batched by feature category rather than
  spatial chunk.
- JavaScript heap is not displayed because portable browser memory reporting is
  not consistently available.

The current expansion remains inside the draw-call, object-count, triangle, and
frame-rate budgets. Distance/LOD policy should be introduced only when another
measured expansion justifies it.
