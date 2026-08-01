# Primitive city massing

Milestone 3 turns the declarative block dataset into deterministic building
definitions, then renders those definitions with shared primitive geometry. The
generation stage contains no Three.js objects and the rendering stage makes no
urban-design decisions.

## Runtime flow

```text
processed city blocks
→ district massing profiles
→ block-aligned placement zones
→ deterministic building definitions
→ material-batched box instances
```

The default seed is `20260801`. A different safe integer can be supplied without
changing source code:

```text
http://localhost:5173/?seed=20260802
```

The seed is shown in the debug panel so screenshots remain reproducible.

## Placement rules

Each block is generated independently from a child seed derived from the root
seed and stable block/building IDs. Input blocks are sorted by semantic ID, so
generation does not depend on JSON order or Three.js traversal order.

For each convex buildable polygon, the generator:

1. finds its longest edge as the local street-alignment axis;
2. fits a conservative oriented rectangle around the polygon centroid;
3. shrinks the rectangle until all four corners are inside the buildable polygon;
4. subdivides larger zones along their longest dimension with 7 m gaps; and
5. generates every building footprint and primitive part within its assigned lot.

The number of lots follows the district profile and buildable area rather than a
city-wide random scatter. Changing the seed alters archetype selection, plate
sizes, materials, and bounded height variation, but not the block hierarchy or
lot count.

## District hierarchy

The first profiles are intentionally explicit and easy to tune:

| District profile | Background height range | Current role |
| --- | ---: | --- |
| dense central core | 72–218 m | clustered podium and stepped towers |
| commercial transition | 42–148 m | street-aligned slabs and podium towers |
| dense mixed | 30–108 m | smaller slabs and box towers |
| infrastructure edge | 18–62 m | reserved low-density profile |

Height within each range follows distance from a configured district cluster
centre, then receives only limited seeded variation. The largest buildable block
in `east-core` receives one deterministic 286 m stepped landmark. These are
fictional-city rules, not inferred Osaka land use.

## Primitive vocabulary

The generated domain model contains four archetypes:

- `box-tower`: one compact vertical box;
- `slab`: one elongated, street-aligned box;
- `podium-tower`: a broad low podium plus an inset tower plate;
- `stepped-tower`: three progressively smaller stacked plates.

The default dataset currently produces 26 building definitions—four box towers,
seven slabs, eleven podium towers, and four stepped towers—from 45 box parts,
with an observed height range of 54–286 m. Each definition retains its building
ID, block ID, district ID, root-derived seed, role, archetype, material category,
footprint, height, and primitive parts.

## Rendering and inspection

All parts share one unit box geometry and are rendered through at most three
`InstancedMesh` batches: commercial, mixed-use, and landmark. Simple Lambert
materials and two non-shadow-casting lights make the forms readable without
introducing facade shaders or atmosphere.

The debug panel exposes:

- final primitive masses;
- building footprints;
- height-distribution markers;
- all earlier road, water, district, block, and buildable layers;
- saved aerial, rooftop, and street camera presets.

## Current limitations

- Massing exists only on the 20 Milestone 2 blocks, so the full aerial extent is
  intentionally sparse outside those first clusters.
- Placement uses one conservative rectangular zone per convex block rather than
  general parcel subdivision.
- Archetypes use boxes only; there are no facades, roofs, bridges, textures,
  shadows, or bespoke assets.
- No chunking, LOD, or distance-based simplification is implemented yet.
- The large building GeoJSON remains unused and ignored.

The smallest next step is Milestone 4 spatial chunking and culling around the
existing declarative definitions, without expanding visual detail first.
