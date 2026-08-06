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

Five explicit block templates define block use and, where applicable, emit
building slots:

| Template | Purpose | Slots per block |
| --- | --- | ---: |
| `fabric-grid` | Fine-grained low-rise transition fabric | 4 |
| `edge-slabs` | Two larger mid-rise street-edge buildings | 2 |
| `anchor-and-fill` | One high-rise anchor plus two mid-rise fillers | 3 |
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
There is one landmark district and one landmark slot. Mean target height falls
from centre to urban to edge, and edge districts contain no high-rise or
skyscraper slots.

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
with 36 distinct assets and no rejections. Its most repeated asset appears eight
times.

With the default full-city seed, all 1,188 slots are filled with 55 distinct
assets and no rejections. The most common asset appears 79 times. The soft reuse
multiplier preserves fit scoring and still allows repetition when an asset is
the only compatible candidate; the statistics panel exposes the current maximum
directly.

## Synthetic debug view

Open `?view=synthetic` to inspect the complete city. Use `mode=proof` to return
to the original 500 m district, or the on-screen Full city / Proof district
switch. An optional integer `seed` query parameter regenerates template
choices, slot heights, and asset selection while leaving the direct street
geometry unchanged.

The view exposes independent layers for street negative space, block-template
surfaces, park lawns and crossing paths, core/transition buildable outlines,
placement slots, the optional offset-spine trace, selected GLBs, inspection
lighting, and a 25 m metric grid.
The park layer uses only two shared instanced draws, regardless of park count;
it deliberately contains no trees, props, or decorative scatter. Overview,
rooftop, and street camera presets provide reproducible comparisons. The street
preset is derived from the central generated street gap rather than placed
inside a block. Full-city mode also provides a `Spine` street preset aligned
with the narrow side of the offset band.

### First-person walk mode

The `Walk` control enters a pointer-locked first-person view at 1.8-metre eye
height on the central east-west arterial. Mouse movement controls yaw and pitch;
`WASD` or the arrow keys move at seven metres per second; holding `Shift`
multiplies speed by 3.5; and `Escape` returns to orbit inspection. A minimal
crosshair and control reminder replace the composition panels while walking.

The rendered block platforms use a 0.15 m curb-scale height, leaving the camera
approximately 1.65 m above their surface. Walk mode clamps the camera to a
two-metre inset inside the generated city
bounds and restores eye height every frame. It deliberately does not implement
gravity, terrain following, or collision against buildings yet, so it is an
inspection/navigation tool rather than a game-character controller. Leaving
the page, hiding it, or disposing the view exits walk mode and releases its
keyboard, mouse, and pointer-lock listeners.

Proof mode loads only its 36 selected asset files and uses one `InstancedMesh`
per asset. Full-city mode loads its 55 selected assets once and packs all models
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
| Block-template slot generation | `src/city/synthetic/generation/createBlockSlots.ts` |
| Proof-district generation | `src/city/synthetic/generation/generateProofDistrict.ts` |
| 2 km city composition | `src/city/synthetic/generation/generateSyntheticCity.ts` |
| Deterministic matcher | `src/city/synthetic/generation/selectAssetForSlot.ts` |
| Stable district population | `src/city/synthetic/generation/populateSyntheticDistrict.ts` |
| Stable full-city population | `src/city/synthetic/generation/populateSyntheticCity.ts` |
| Synthetic debug geometry | `src/city/synthetic/rendering/addSyntheticDistrictDebugLayers.ts` |
| City chunk outlines | `src/city/synthetic/rendering/addSyntheticCityDebugLayer.ts` |
| Instanced selected models | `src/city/synthetic/rendering/addSyntheticBuildingLayer.ts` |
| Batched city chunks | `src/city/synthetic/rendering/addSyntheticCityBuildingLayer.ts` |
| District visibility rule | `src/city/synthetic/rendering/syntheticDistrictVisibility.ts` |
| First-person controller | `src/app/createFirstPersonController.ts` |
| First-person movement rules | `src/app/firstPersonMovement.ts` |
| Synthetic app lifecycle | `src/synthetic/createSyntheticDistrictApp.ts` |
| Focused tests | `src/city/synthetic/generation/*.test.ts` |

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
across district boundaries. Offset-band tests verify its 20-block continuity,
four-district span, smooth bounded change, minimum street gap, block
non-overlap, and slot containment.

First-person movement tests verify speed-normalized diagonal travel, partial
input, fixed eye height, city-bound clamping, and invalid-bound rejection.

For the current catalogue and default seed, every slot has between 3 and 14
compatible candidates before city-wide repetition caps are applied. The
landmark is deliberately the narrowest category, with three candidates.

The default proof overview measured 42 draw calls, 43,437 rendered triangles,
54 scene objects, and 48 visible objects in the local browser. Rendering is
on-demand while the camera is idle. No active-frame-rate claim is made yet.

The default full-city overview measured 26 draw calls, 482,897 rendered
triangles, 40 scene objects, 33 visible objects, 16 rendered district batches,
and 1,188 rendered model instances. The street preset reduced that to 19 draw
calls, 275,638 triangles, 9 rendered districts, and 650 rendered buildings.
The dedicated spine preset measured 18 draw calls, 282,256 triangles, 9
rendered districts, and 647 rendered buildings.
The first-person spawn measured 19 draw calls, 275,638 triangles, 9 rendered
districts, and 650 rendered buildings. Unlike the orbit views, walk mode renders
continuously while active; no frame-rate claim is made yet.
The 477,519 model triangles exclude the debug layers. These are local-browser
inspection measurements, not active-frame-rate claims.

## Next slice

Introduce two or three deterministic district-grid variants by mirroring the
existing unequal block widths and street gaps. This should reduce the repeated
5 × 5 rhythm without adding arbitrary polygons or another geometry system.
