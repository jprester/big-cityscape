# Primitive city massing

The massing stage turns declarative block data into deterministic building
definitions, then renders those definitions with shared primitive geometry. The
generation stage contains no Three.js objects and the rendering stage makes no
urban-design decisions.

## Runtime flow

```text
processed city blocks
→ district massing profiles
→ continuous citywide height field
→ stable buildable regions
→ block composition or block-aligned lots
processed roads, rail, water, and occupied footprints
→ deterministic residual-fabric lots
→ deterministic building definitions
→ chunk-batched box instances
```

The default seed is `20260801`. A different safe integer can be supplied without
changing source code:

```text
http://localhost:5173/?seed=20260802
```

The seed is shown in the debug panel so screenshots remain reproducible.

## Placement rules

Each block, region, and building is generated independently from a child seed
derived from the root seed and stable semantic IDs. Input blocks and regions are
sorted by ID, so generation does not depend on JSON order or scene traversal.

Each semantic block first derives one dominant axial street-grid orientation
from all of its boundary edges. Every buildable region in that block receives
the same orientation. For each convex buildable region, the generator:

1. finds its longest edge as the local street-alignment axis;
2. searches independent width and depth scales plus a small deterministic set
   of off-centre positions for a conservative oriented rectangle;
3. requires all four rectangle corners to remain inside the region;
4. reserves viable large regions for one perimeter, commercial, shared-podium,
   or megastructure composition; otherwise derives one to seven lots from
   regional area and district profile, subdividing the placement zone along its
   longest dimension with 7 m gaps; and
5. creates every footprint and primitive part within its assigned lot.

The configured landmark is the exception to subdivision: it reserves the
largest region in its selected block as one parcel so its 300 m height is
supported by a credible podium and tower plate. The mass uses four
progressively narrower plates and the same cool material family as the city, so
it reads as a skyline landmark rather than an orange debug marker.

Lot count follows regional area and district profile rather than a city-wide
random scatter. The first lot in the largest region of each block is an anchor.
Sufficiently large regions inside the height field can also become secondary
anchors; remaining lots form lower background fabric. Changing the seed alters
archetype selection, plate sizes, materials, and bounded height variation, but
not the planned centres. Every non-landmark height is capped from both the minor
floor-plate dimension and footprint area. Very narrow lots therefore become
lower infill rather than implausibly slender towers.

### Residual urban fabric

Closed road polygons are not required for background coverage. A second pure
data stage samples the complete working bounds on a stable 12 m grid and creates
5–7 m by 7–9 m lots. Lots inside a retained block use that block's exact
orientation. Other lots sample non-motorway street segments within 110 m using
length and distance weights. Street directions are treated axially, so two
perpendicular sides of one urban grid reinforce the same frame, and the result
is snapped to 5° bands to remove segment-by-segment angular noise. Both centre
coordinates are then snapped to the resulting 12 m oriented lattice. Retained
blocks anchor their lattice at the block centroid; the surrounding field uses
the world origin. A candidate survives only when its exact centimetre-rounded
footprint:

- remains inside the working bounds;
- clears the configured road-class setback;
- clears rail by 14 m and water by 10 m; and
- stays at least 0.1 m from every block-driven building and previously accepted
  residual footprint.

Uniform spatial indices limit clearance and overlap checks to nearby segments
and footprints. Candidate IDs derive from signed grid coordinates, and all size,
archetype, material, and height variation derives from the root seed. The output
is declarative and has its own disabled-by-default debug layer.

## District hierarchy

The first profiles are explicit and easy to tune:

| District profile | Residual fabric | Block background | Anchor |
| --- | ---: | ---: | ---: |
| dense central core | 12–42 m | 28–82 m | 95–218 m |
| commercial transition | 10–34 m | 24–72 m | 76–148 m |
| dense mixed | 8–28 m | 18–58 m | 62–108 m |
| infrastructure edge | 7–20 m | 14–38 m | 40–62 m |

Height within each range samples one explicit continuous field containing a
primary core, two weaker secondary centres, and each district's local cluster.
The field determines skyline structure first; limited seeded variation operates
inside that structure. The largest safe block in `east-core` receives one
deterministic 300 m composed landmark. These are fictional-city rules, not
inferred Osaka land use.

## Primitive vocabulary and current output

The domain model contains nine compatible archetypes with height-sensitive
variants:

- `box-tower`: a compact box, or a broad base plus inset tower when tall;
- `slab`: one elongated, street-aligned box;
- `perimeter-block`: four street-wall bars enclosing an open court;
- `podium-tower`: a broad street base, inset tower, and mechanical crown;
- `multi-tower-podium`: one shared base, a dominant tower and a lower secondary
  tower;
- `stepped-tower`: a broad low mass, or three progressively smaller stacked
  plates when tall;
- `commercial-block`: a broad base with offset upper and roof plates;
- `megastructure`: one large base, cross-spine, and unequal major masses; and
- `landmark-spire`: a broad podium and three progressively narrower skyline
  plates.

Complex compositions require a viable parcel width and otherwise fall back to a
slab. Compact lots use higher footprint coverage than larger tower parcels. The
current default seed produces 4,674 definitions and 4,843 primitive parts in 46
chunks, with height bands of 4,647 low-rise, 24 mid-rise, two high-rise, and one
300 m landmark. The low residual height band creates a continuous urban carpet;
the block-driven secondary anchors now create visible peaks instead of relying
on one isolated tower.

Each definition retains its source category, building ID, block ID, region or
fabric-lot ID, district ID, root-derived seed, role, archetype, material
category, footprint, height, and primitive parts.

## Rendering and inspection

All parts share one unit box geometry and one Lambert material. One
`InstancedMesh` is rendered per occupied 250 m chunk, with commercial, mixed-use,
or landmark color per instance. Two non-shadow-casting lights make forms readable
without introducing facade shaders or atmosphere.

Before geometry creation, the 510 split source ways become a continuous render
network. Four tunnels remain debug-only; the other 506 roads preserve 252 exact
way-to-way junctions. Bridge paths are sampled at no more than 15 m intervals,
grouped into connected components, and remain at clearance height across their
complete span. Untagged motorway pieces between bridge spans remain on the
component deck, while terminal links meeting a surface trunk or primary road
are sampled and descend toward that arterial. This prevents interior connectors
from passing through smaller roads without leaving genuine exits suspended at
deck height. Compatible non-motorway approaches still target a seven-percent
grade where the source path is long enough. The OSM `layer` tag ranks each
connected bridge component instead of creating a literal height step at every
way boundary.

Four short clipping gaps are repaired in the final render network. A repair is added
only when two singleton endpoints are mutually nearest, share one road class,
are at most 18 m apart, and both headings align with the connecting segment.
This deliberately excludes the nearby parallel carriageways and unrelated
street ends that would make broad proximity snapping unsafe.

After those repairs, elevated motorway and trunk paths are checked as connected
components against their rendered endpoint heights. Nineteen interior paths
belonging to branches that still terminate without another road or the working
boundary are suppressed, including the visibly suspended ramp fragments. This
rule is limited to elevated limited-access paths; ordinary surface cul-de-sacs
remain valid.

Road geometry uses bounded outside bevels at source-polyline bends. Endpoint
fills are deduplicated and emitted only where two or more exact endpoints really
meet; clipped or otherwise unconnected ends use clean butt caps. Three-plus-way
branches taper to 55% width at their shared node before expanding along the
sampled approach, limiting the large overlapping wedges produced by acute
merges. Surfaces still render as two merged width-driven batches: highway decks
and ordinary streets. A 3 cm render offset gives the highway batch stable depth
priority at genuine at-grade overlaps without changing semantic road heights.
Widths remain per source carriageway rather than per complete corridor. The
colored structural centreline layer follows the same deck and ramp heights for
inspection.

The debug panel exposes:

- final primitive masses;
- building footprints;
- height-distribution markers;
- occupied chunk boundaries;
- all earlier road, water, district, block, and buildable-region layers; and
- saved aerial, rooftop, and street camera presets.

## Current limitations

- Residual coverage is a regular road-aligned sampling field, not a cadastral or
  organically subdivided parcel model.
- The residual field still dominates the citywide height histogram. Reaching a
  realistic percentage of mid-rise buildings requires grouping adjacent proxy
  lots into larger block compositions rather than making narrow lots taller.
- The rectangular working boundary remains visible from the aerial preset. A
  low-detail surrounding proxy city plus distance fog is intentionally deferred
  until foreground block hierarchy is stable.
- Twenty-five narrow or awkward safe regions cannot fit the current 6 m minimum
  placement dimension and are explicitly reported as skipped.
- Placement subdivides one conservative rectangular zone per region along one
  axis; it is not yet a two-dimensional or cadastral parcel model.
- Archetypes use boxes only; there are no facades, roof details, textures,
  shadows, or bespoke assets.
- Road connectivity is inferred from exact processed coordinates because the
  compact runtime data does not retain OSM node IDs. Only the four retained strict
  mutually-nearest gap repairs described above are inferred; other
  near-but-distinct endpoints remain separate.
- Road ribbons still omit lane markings, bridge supports, junction-specific
  lane geometry, and terrain grading.
- Chunk frustum culling is implemented, but LOD and distance-based simplification
  are not.
- Residual generation currently runs at startup; the spatial indices keep it
  near interactive-development cost, but it can move offline if the working area
  expands substantially.
- The large building GeoJSON remains unused and ignored.

See `docs/PERFORMANCE.md` for chunk semantics, current budgets, and measured
culling behavior.
