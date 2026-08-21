# Synthetic city generation

## Scope

The simplified successor builds a fictional city from direct synthetic blocks
and reviewed building assets. It does not consume processed geography or derive
blocks from road polygons.

The current implementation produces and renders a deterministic, populated
2 × 2 km city from reusable 500 × 500 m districts. The original 500 m proof
district remains available as a separate inspection mode.

## Proof district

The proof district is centred on the origin and contains a direct 5 × 5 block
grid. Unequal block dimensions and unequal street gaps introduce variation
without road topology or polygon derivation. A five-metre inset converts every
block boundary into a buildable boundary.

The inner 3 × 3 blocks use the `core` profile. The sixteen perimeter blocks use
the `transition` profile. The centre block is reserved for the landmark, while
the other core blocks combine one high-rise anchor with two mid-rise fillers.

Six explicit block templates define block use and, where applicable, emit
building slots:

| Template | Purpose | Slots per block |
| --- | --- | ---: |
| `fabric-grid` | Fine-grained low-rise transition fabric | 4 |
| `edge-slabs` | Two larger mid-rise street-edge buildings | 2 |
| `anchor-and-fill` | One high-rise anchor plus two mid-rise fillers | 3 |
| `skyline-anchor` | One secondary skyscraper plus two mid-rise fillers | 3 |
| `landmark-plaza` | One skyscraper with open space around its slot | 1 |
| `open-space` | A buildable-block reservation for a simple public park | 0 |

With the default seed, this produces 25 blocks and 79 slots: 11 fabric-grid
blocks, 5 edge-slab blocks, 8 anchor-and-fill blocks, and 1 landmark block.
Street surfaces are intentionally still just the negative space between block
bounds.

## City composition

The 2 × 2 km city is a direct 4 × 4 composition of translated 500 m districts.
Each district remains an independent future render chunk. Its twenty-metre
outer setback combines with its neighbour's setback to create a forty-metre
arterial gap at district boundaries.

Three composition profiles create a simple height gradient:

| Profile | Districts | Composition behavior |
| --- | ---: | --- |
| `centre` | 4 | Dense inner anchor blocks; one district owns the landmark |
| `urban` | 8 | Mixed anchor, slab, and fabric blocks |
| `edge` | 4 | Low/mid-rise fabric and slabs; no tall slots |

Open space follows an explicit district policy rather than a city-wide random
probability: centre districts contain no parks, each urban district contains
one park on its transition ring, and each edge district contains two separated
parks. The choice of eligible cells is derived from the district seed. The
default city therefore contains 16 open-space blocks, or 4% of its 400 blocks.
Parks emit no building slots.

The default seed produces 16 districts, 400 blocks, and 1,188 building slots.
There is one landmark district, one primary landmark slot, and five restrained
secondary skyline slots. Mean target height falls from centre to urban to edge,
and edge districts contain no high-rise or skyscraper slots.

### Secondary skyline

After the sixteen districts are generated, a deterministic city-level pass
promotes five `anchor-and-fill` blocks to the `skyline-anchor` template. Only
the three non-landmark centre districts are eligible. Every eligible district
receives at least one anchor and no district receives more than two. The chosen
tower centres remain at least 220 metres from each other and from the primary
landmark.

Each promoted block preserves the existing three-slot footprint: its anchor
becomes a 205–255 m skyscraper while its two mid-rise fillers remain in place.
The primary landmark stays in its 290–325 m range, so it remains the tallest
tier. The skyline count can be configured from four to six without introducing
city-wide random tower scatter. Selection uses stable block IDs and the content
seed.

### District grid rhythms

The city no longer repeats one identical block grid in every district. Three
explicit 5 × 5 rhythms vary block widths, block depths, and the four internal
street gaps while preserving the exact 500 × 500 m district footprint:

| Rhythm | Default districts | Character |
| --- | ---: | --- |
| `balanced` | 6 | The original mixed block and street proportions |
| `fine-grain` | 5 | Narrower blocks and more varied local-street gaps |
| `large-block` | 5 | Broader inner blocks with tighter secondary gaps |

Each selected rhythm can be used directly or mirrored on either axis. The
mirror operation reverses block sizes and their intervening gaps together, so
the layout remains valid rather than merely moving individual blocks. Inner
rows remain deep enough for the reviewed high-rise catalogue envelope; all
1,188 slots still populate without relaxing asset-fit rules.

Grid selection uses a dedicated `layoutSeed`. The content seed in the URL still
changes templates, target heights, and asset selection without moving streets.
Changing `layoutSeed` at the city configuration level provides a separately
reproducible horizontal layout.

### Controlled offset spine

One north-south block column in the eastern half of the city uses a controlled
layout variation. Its 20 rectangular blocks follow one smooth sine cycle across
four districts, with a maximum lateral offset of eight metres. The surrounding
street gap is never allowed below six metres. This creates a legible stepped
street edge without rotated polygons, curved road meshes, or a general street
network.

Each block records a `layoutVariationId` and explicit metre-based layout offset.
The variation is configured at city level and distributed into five row offsets
per district. It is deliberately independent of the content seed, so changing
building and template choices does not move the underlying street geometry.

### Street hierarchy and sidewalks

Street negative space now has an explicit semantic representation rather than
being only the uncovered ground between blocks. Each district derives road
rectangles from the actual bounds of neighboring blocks: five segments per
internal gap plus separate intersection rectangles. This means the road
surfaces follow the offset spine and cannot enter a block. Stable IDs record the
district, direction, row or column, and gap.

Internal gaps at least 22 metres wide are classified as `secondary`; narrower
gaps are `local`. The six 40-metre corridors between district rows and columns,
plus four 20-metre perimeter strips, are explicit city-level `arterial`
corridors. The default city contains 906 surface rectangles: 10 arterial, 272
secondary, and 624 local. These counts describe renderable corridor pieces, not
906 separate road networks.

Rendering uses one instanced plane draw per populated hierarchy and one further
instanced draw for 1,600 sidewalk strips. Sidewalks are derived from the
five-metre ring between each block boundary and its buildable boundary, so no
additional parcel or pavement data is required. The four new draws add exactly
5,012 rendered triangles to the full overview. Road and sidewalk layers remain
independently toggleable inspection layers.

### Arterial road markings

The six interior district-boundary arterials carry restrained semantic road
markings. Their centrelines contain 588 nine-metre amber dashes, with explicit
clearance around every arterial crossing. The three north-south and three
east-west arterials form nine marked intersections. Each receives four
fourteen-bar zebra crossings, for 504 off-white crosswalk bars in total. Each
bar is 1.5 metres wide, runs ten metres parallel to vehicle travel, and is
repeated across the road width. The resulting 36.6-metre stripe field leaves
about 1.7 metres at each curb. Perimeter arterials remain unmarked so the
treatment reads as an urban hierarchy rather than a texture spread over every
road.

Markings are declarative metre-based rectangles with stable IDs; they are not
lane meshes or a navigation graph. Rendering packs all centre-line dashes into
one instanced plane draw and all crosswalk bars into a second. The complete
layer therefore adds two draw calls and 2,184 triangles. A city-only `Crossing`
camera preset provides a reproducible close view of the middle marked
intersection.

## Asset-to-slot contract

A `BuildingSlot` is a declarative request produced by a future block template.
It contains stable district, block, and slot IDs; its own seed; a centre and
street-relative rotation; maximum footprint dimensions; target height; allowed
uses and forms; a height class; and a placement role.

Selection proceeds in fixed stages:

1. reject disabled assets;
2. filter reviewed use and form;
3. filter height class and placement role;
4. enforce the asset's optional city-wide repetition cap;
5. evaluate normal and quarter-turned footprint orientations;
6. intersect footprint, uniform-scale, target-height, and height-scale limits;
7. score footprint utilization, aspect balance, transform strength, and ordered
   form preference;
8. multiply compatible weight by `(prior uses + 1)^-1.35` to softly favour
   less-used assets;
9. perform a deterministic weighted choice from compatible candidates; and
10. return a declarative placement containing only semantic IDs and transforms.

Candidate order cannot influence the result. The selection seed is derived from
the slot seed and its district, block, and slot IDs.

The matcher returns structured rejection counts when no candidate works. Every
asset is counted against the first stage that excludes it, making empty slots
debuggable without loading Three.js.

## Scale behavior

The matcher never independently stretches width and depth. It finds a uniform
scale that fits the slot and remains inside the asset's reviewed range. It then
applies only the asset's allowed small height adjustment to meet the slot target
height exactly. A candidate is rejected when those intervals do not intersect.

## Repetition state

Individual slot selection remains pure and does not mutate city state. The
district population stage sorts slots by stable semantic ID, owns a private
usage map, passes its current counts into each selection, and increments the
selected asset after acceptance. Full-city population processes districts in
stable semantic order and carries that usage map across district boundaries.
This enforces reviewed `maximumPerCity` limits globally without making output
depend on incoming district, slot, or catalogue order.

The population result contains placements, compatible-candidate counts for
accepted slots, structured rejection records, sorted asset-usage counts, and
summary totals. Incoming catalogue order also cannot change the result.

With the current catalogue and default district seed, all 79 slots are filled
with 37 distinct assets and no rejections. Its most repeated asset appears seven
times.

With the default full-city seed, all 1,188 slots are filled with 63 distinct
assets and no rejections. The most common asset appears 71 times. The soft reuse
multiplier preserves fit scoring and still allows repetition when an asset is
the only compatible candidate; the statistics panel exposes the current maximum
directly.

## Synthetic debug view

Open the application root to inspect the complete city; the synthetic city is
now the default product view. `?view=synthetic` remains a compatible explicit
URL, while `?view=legacy` opens the earlier geodata implementation for
comparison. Use `mode=proof` to return to the original 500 m district, or the
on-screen Full city / Proof district switch. An optional integer `seed` query parameter regenerates template
choices, slot heights, and asset selection while leaving the direct street
geometry unchanged. The optional `time=day|dusk|night` query parameter selects
an environment preset; Dusk remains the default when the parameter is absent.
The mode switch preserves the selected environment.

The view exposes independent layers for atmosphere, street negative space,
sidewalks, arterial markings, block-template surfaces, park lawns and crossing
paths, core/transition buildable outlines, placement slots, the optional
offset-spine trace, selected GLBs, inspection lighting, and a 25 m metric grid.
The park layer uses only two shared instanced draws, regardless of park count;
it deliberately contains no trees, props, or decorative scatter. Overview,
rooftop, and street camera presets provide reproducible comparisons. The street
preset is derived from the central generated street gap rather than placed
inside a block. Full-city mode also provides a `Spine` street preset aligned
with the narrow side of the offset band.

### Environment presets, atmosphere, and inspection lighting

The inspection panel exposes deterministic Day, Dusk, and Night presets. Each
preset owns the background, three-stop sky gradient, fog distances and colors,
hemisphere light, and directional key light. Switching updates the existing sky,
fog, and light objects in place, then updates the URL with `history.replaceState`.
It does not regenerate blocks, reselect assets, reload GLBs, or rebuild building
batches.

Day uses a pale blue sky, warm horizon, distant fog, and the strongest neutral
light. Dusk preserves the original warm, blue-grey inspection palette. Night
uses a navy gradient, closer dark-blue fog, and restrained cool moonlight. Night
is deliberately a readable massing view rather than a fully illuminated city:
the catalogue does not yet provide semantic window materials, and this slice
does not add point lights or emissive-window proxies.

A scale-aware linear `THREE.Fog` pass adds depth without introducing a
post-processing pass or custom shader. Dusk full-city fog begins at 1.0 km and
reaches the shared blue-grey background at 5.0 km. Proof mode scales the same
rule to 250 m–1.25 km; Day and Night apply their own proportional ranges.

A camera-centred inverted hemisphere now provides the horizon. Vertex colors
form three continuous stops: the exact fog color at the seam, a muted blue band
around ten degrees elevation, and a dark navy zenith. Following the active
camera prevents parallax while walking and avoids cube-map seams. The gradient
is code-native, so it requires no bitmap asset or network request. One checked
`Atmosphere` control owns sky, fog, and background; turning it off restores the
original dark, fog-free geometry inspection view exactly.

Proof and city rendering now reuse one scale-aware hemisphere and directional
light rig. Orbit and walk modes therefore see the same palette and lighting.
The sky adds one draw call, one scene object, and 736 triangles. Fog still adds
fragment-shader work, so this is treated as a small visual cost rather than a
performance improvement.

### First-person walk mode

The `Walk` control enters a pointer-locked first-person view at 1.8-metre eye
height on the central east-west arterial. Mouse movement controls yaw and pitch;
`WASD` or the arrow keys move at seven metres per second; holding `Shift`
multiplies speed by 3.5; and `Escape` returns to orbit inspection. A minimal
crosshair and control reminder replace the composition panels while walking.

The rendered block platforms use a 0.15 m curb-scale height, leaving the camera
approximately 1.65 m above their surface. Walk mode clamps the camera to a
two-metre inset inside the generated city bounds and restores eye height every
frame.

Every selected building placement contributes one axis-aligned footprint
collider using its fitted world-space width and depth. Each street-lamp pole
contributes a 0.13 × 0.13 m footprint using the same semantic position as its
rendered instance. The player uses a 0.38 m horizontal radius. All colliders are
indexed into deterministic 100 m cells, and
movement is divided into steps no longer than 0.2 m before resolving X and Z
independently. This prevents the 24.5 m/s fast mode from tunnelling through a
building or lamp while allowing natural wall sliding. The default city indexes
1,188 building footprints and 1,212 lamp poles; both city and proof district
spawn points remain outside collision geometry.

Collision is deliberately footprint-level rather than mesh-level. It blocks
whole building bounds, including visual setbacks or voids inside a model, and
does not include lamp arms or bulbs, gravity, terrain following, jumping,
stairs, or interiors. Walk mode remains an inspection controller rather than a
general physics character. Leaving the page, hiding it, or disposing the view
exits walk mode and releases its keyboard, mouse, and pointer-lock listeners.

Walk mode temporarily shortens the camera near plane from the 1 m city-scale
inspection value to 0.1 m. This prevents the camera frustum from slicing through
a facade while the 0.38 m player collider is correctly stopped outside it. The
1 m near plane is restored when Walk mode exits, preserving aerial depth
precision.

### Procedural signage foundation

Building assets now expose offline-derived façade slots in normalized local
metres. The signage generator transforms those slots with each selected
building placement and prefers the façade nearest a block edge. It makes
independent seeded decisions for three mounting zones: general façade signs,
storefront bands between 2.4 and 7 m above ground, and crown bands within the
upper 22 m or 22% of buildings at least 70 m tall. Each building receives at
most one sign per zone. Centre, urban, and edge district profiles have
progressively lower density; commercial and mixed-use buildings receive most
storefronts, while offices and landmarks receive most crown logos. Stable
building IDs keep the result independent of input traversal order.

The current visual layer is intentionally an inspectable placeholder: one
instanced plane per selected anchor, colored cyan for advertisements, magenta
for neon, and amber for building logos. The layer is exposed in the normal
debug controls and the statistics panel reports its count. At most three draw
calls and two triangles per selected sign are added. The next visual phase can
replace these shared-color materials with a small generated atlas and emissive
night variants without changing façade extraction or placement data.

This slice does not yet include text legibility, image loading, texture-atlas
packing, emissive bloom, occlusion against detailed façade protrusions,
multiple signs within one mounting zone, manual placement overrides, or
chunk-distance visibility. Slots describe large approximately planar surfaces,
not artist-authored attachment points. Delicate façades can receive explicit
overrides later without changing the procedural default path.

Proof mode loads only its 37 selected asset files and uses one `InstancedMesh`
per asset. Full-city mode loads its 63 selected assets once and packs all models
for each 500 m district into one `BatchedMesh`. This produces 16 independently
cullable building batches rather than approximately 460 per-asset district
batches or 1,188 separate building objects.

Low cameras hide district batches farther than the configured visibility range;
the range expands with altitude so the overview retains all sixteen chunks.
Normal Three.js frustum culling still applies to each district batch. The live
statistics panel reports composition, population, batch, triangle, and
load-failure totals, while the performance panel reports chunks and instances
actually drawn in the last frame.

## Current files

| Concern | File |
| --- | --- |
| Slot definition | `src/city/synthetic/model/buildingSlot.ts` |
| Placement definition | `src/city/synthetic/model/buildingPlacement.ts` |
| Selection result definition | `src/city/synthetic/model/assetSlotSelection.ts` |
| Population result definition | `src/city/synthetic/model/districtPopulation.ts` |
| City composition definition | `src/city/synthetic/model/syntheticCity.ts` |
| City population definition | `src/city/synthetic/model/cityPopulation.ts` |
| Proof-district definitions | `src/city/synthetic/model/proofDistrict.ts` |
| Street-corridor definition | `src/city/synthetic/model/streetCorridor.ts` |
| Road-marking definition | `src/city/synthetic/model/roadMarking.ts` |
| Block-template slot generation | `src/city/synthetic/generation/createBlockSlots.ts` |
| Proof-district generation | `src/city/synthetic/generation/generateProofDistrict.ts` |
| District-grid rhythms | `src/city/synthetic/generation/districtGridVariants.ts` |
| Street-corridor derivation | `src/city/synthetic/generation/deriveSyntheticStreetCorridors.ts` |
| Road-marking derivation | `src/city/synthetic/generation/deriveSyntheticRoadMarkings.ts` |
| Signage derivation | `src/city/synthetic/generation/deriveSyntheticSignage.ts` |
| Secondary skyline promotion | `src/city/synthetic/generation/promoteSecondarySkyline.ts` |
| 2 km city composition | `src/city/synthetic/generation/generateSyntheticCity.ts` |
| Deterministic matcher | `src/city/synthetic/generation/selectAssetForSlot.ts` |
| Stable district population | `src/city/synthetic/generation/populateSyntheticDistrict.ts` |
| Stable full-city population | `src/city/synthetic/generation/populateSyntheticCity.ts` |
| Synthetic debug geometry | `src/city/synthetic/rendering/addSyntheticDistrictDebugLayers.ts` |
| Instanced roads and sidewalks | `src/city/synthetic/rendering/addSyntheticStreetLayers.ts` |
| Instanced arterial markings | `src/city/synthetic/rendering/addSyntheticRoadMarkingLayer.ts` |
| Instanced sign-anchor preview | `src/city/synthetic/rendering/addSyntheticSignageDebugLayer.ts` |
| Reconfigurable distance atmosphere | `src/city/synthetic/rendering/addSyntheticAtmosphereLayer.ts` |
| Reconfigurable inspection lighting | `src/city/synthetic/rendering/addSyntheticInspectionLighting.ts` |
| City chunk outlines | `src/city/synthetic/rendering/addSyntheticCityDebugLayer.ts` |
| Instanced selected models | `src/city/synthetic/rendering/addSyntheticBuildingLayer.ts` |
| Batched city chunks | `src/city/synthetic/rendering/addSyntheticCityBuildingLayer.ts` |
| District visibility rule | `src/city/synthetic/rendering/syntheticDistrictVisibility.ts` |
| First-person controller | `src/app/createFirstPersonController.ts` |
| First-person movement rules | `src/app/firstPersonMovement.ts` |
| Environment preset definitions and URL contract | `src/synthetic/syntheticEnvironmentPresets.ts` |
| Synthetic app lifecycle | `src/synthetic/createSyntheticDistrictApp.ts` |
| Focused tests | `src/city/synthetic/**/*.test.ts` |

## Validation contract

Tests verify that generation is repeatable, a different seed changes semantic
output without changing the street geometry, blocks do not overlap, slots stay
inside buildable bounds, slots within a block do not overlap, and every default
slot has at least one compatible enabled asset in the real catalogue. Population
tests also verify order independence, city-limit enforcement, usage accounting,
and preservation of structured rejection diagnostics.

Full-city tests additionally verify the 2 km bounds, non-overlapping district
chunks, 4/8/4 profile distribution, single landmark ownership, centre-to-edge
height gradient, absence of tall edge slots, and repetition-cap enforcement
across district boundaries. Grid-variant tests verify exact 500 m axis fill,
complete rhythm distribution, valid mirrored orientation, layout-seed
repeatability, and independence from the content seed. Offset-band tests verify
its 20-block continuity, four-district span, smooth bounded change, minimum
street gap, block non-overlap, and slot containment.

Skyline tests verify the configurable four-to-six count, coverage of all three
eligible centre districts, two-anchor district cap, 220 m separation, secondary
height limits below the primary landmark, repeatability, and successful
catalogue population of all six skyscraper slots.

Street tests additionally verify complete internal gap and intersection
coverage, unique semantic IDs, 10 city arterials, exact use of offset-block
edges, positive surface bounds, district containment, and no overlap with any
block.

Road-marking tests verify exact counts, stable unique IDs, repeatability,
containment inside the six interior arterial surfaces, centre-line clearance
at all nine crossings, four fourteen-bar crosswalks per marked intersection,
longitudinal stripe orientation, near-curb stripe-field reach, and separation
between crosswalks and centre dashes.

First-person movement tests verify speed-normalized diagonal travel, partial
input, fixed eye height, city-bound clamping, and invalid-bound rejection.

Atmosphere tests verify extent-scaled fog and sky dimensions, vertex-color sky
geometry, camera following, configuration rejection, visibility toggling,
restoration on disposal, in-place color and scale changes, and the shared light
rig's scale-aware placement. Environment tests verify the three distinct
presets, proportional fog ranges, default and explicit URL parsing, invalid
value rejection, and preservation of unrelated query parameters.

Signage tests verify deterministic output under reordered source data, full
eligible-building façade coverage when density is forced, finite fitted
transforms, storefront and crown vertical-band containment, unique per-building
mounting zones, and consistent per-kind and per-zone accounting. The offline
façade extractor is separately tested on cardinal box surfaces and empty
geometry.

For the current catalogue and default seed, every slot has between 3 and 14
compatible candidates before city-wide repetition caps are applied. The
landmark is deliberately the narrowest category, with three candidates.

The default proof overview measured 47 draw calls, 70,854 rendered triangles,
61 scene objects, and 55 visible objects in the local browser. Rendering is
on-demand while the camera is idle. No active-frame-rate claim is made yet.

The default full-city overview measured 34 draw calls, 1,024,884 rendered
triangles, 51 scene objects, 44 visible objects, 16 rendered district batches,
and 1,188 rendered model instances. The street preset reduced that to 29 draw
calls, 647,759 triangles, 11 rendered districts, and 807 rendered buildings.
The dedicated spine preset measured 29 draw calls, 672,984 triangles, 11
rendered districts, and 805 rendered buildings. The dedicated crossing preset
measured 25 draw calls, 510,112 triangles, 8 rendered districts, and 607
rendered buildings. The revised rooftop preset measured 33 draw calls, 943,183
triangles, 15 rendered districts, and 1,110 rendered buildings.
The first-person spawn measured 29 draw calls, 647,759 triangles, 11 rendered
districts, 807 rendered buildings, 51 scene objects, and 40 visible objects.
Unlike the orbit views, walk mode renders continuously while active; no
frame-rate claim is made yet. Compared with the previous street-and-sidewalk
slice, the marking layer adds exactly two draw
calls and 2,184 triangles; model triangle count and chunk visibility are
unchanged. The revised crossing totals are deterministic projections from the
previous browser measurements: adding 276 two-triangle marking instances
increases every full-city camera total by exactly 552 triangles without
changing draw calls or scene objects.
The latest five-asset intake changes the deterministic full-city model total to
1,011,574 triangles and increases used variants from 58 to 63; this is a
selection outcome, not an optimization claim. Model
triangles exclude the debug layers. These are local-browser inspection
measurements, not active-frame-rate claims.

Day, Dusk, and Night retain the same rendering topology for a given camera.
Preset switching adds no meshes, materials, model instances, or draw calls; it
only changes existing fog, vertex-color, and light state.

For seed `20260805`, the signage plan selects 377 anchors from 1,188 buildings:
267 general façade signs, 87 storefronts, and 23 crowns. In the Night overview,
enabling the preview changes the measured frame from 37 to 40 draw calls and
from 1,092,756 to 1,093,510 triangles: exactly three shared kind batches and 754
plane triangles. Scene-object count remains 67; visible objects increase from
48 to 52 because the debug root and its three instanced meshes become visible.
This is a measured debug-layer cost, not a frame-rate claim.

## Next slice

Replace the colored sign-anchor preview with a compact procedural artwork atlas,
shared emissive-capable materials, and a small optional image-advertisement
library. Keep the existing placement plan and batch by district and atlas page
so night lighting does not create one material or light per sign.
