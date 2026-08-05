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

Four explicit block templates emit slots:

| Template | Purpose | Slots per block |
| --- | --- | ---: |
| `fabric-grid` | Fine-grained low-rise transition fabric | 4 |
| `edge-slabs` | Two larger mid-rise street-edge buildings | 2 |
| `anchor-and-fill` | One high-rise anchor plus two mid-rise fillers | 3 |
| `landmark-plaza` | One skyscraper with open space around its slot | 1 |

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

The default seed produces 16 districts, 400 blocks, and 1,242 building slots.
There is one landmark district and one landmark slot. Mean target height falls
from centre to urban to edge, and edge districts contain no high-rise or
skyscraper slots.

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
8. perform a deterministic weighted choice from compatible candidates; and
9. return a declarative placement containing only semantic IDs and transforms.

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
with 29 distinct assets and no rejections. Lower and mid-rise assets without an
explicit limit may still repeat; visual repetition should be evaluated in the
rendered proof district before adding another selection rule.

With the default full-city seed, all 1,242 slots are filled with 48 distinct
assets and no rejections. Unlimited low/mid-rise assets can repeat heavily at
this scale; city population exposes sorted usage totals so this can be measured
and tuned after the chunked city becomes visible.

## Synthetic debug view

Open `?view=synthetic` to inspect the complete city. Use `mode=proof` to return
to the original 500 m district, or the on-screen Full city / Proof district
switch. An optional integer `seed` query parameter regenerates template
choices, slot heights, and asset selection while leaving the direct street
geometry unchanged.

The view exposes independent layers for street negative space, block-template
surfaces, core/transition buildable outlines, placement slots, selected GLBs,
inspection lighting, and a 25 m metric grid. Overview, rooftop, and street
camera presets provide reproducible comparisons. The street preset is derived
from the central generated street gap rather than placed inside a block.

Proof mode loads only its 29 selected asset files and uses one `InstancedMesh`
per asset. Full-city mode loads its 48 selected assets once and packs all models
for each 500 m district into one `BatchedMesh`. This produces 16 independently
cullable building batches rather than approximately 460 per-asset district
batches or 1,242 separate building objects.

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
across district boundaries.

For the current catalogue and default seed, every slot has between 3 and 14
compatible candidates before city-wide repetition caps are applied. The
landmark is deliberately the narrowest category, with three candidates.

The default overview measured 35 draw calls, 42,131 rendered triangles, 47
scene objects, and 41 visible objects in the local browser. Rendering is
on-demand while the camera is idle. No active-frame-rate claim is made yet.

The default full-city overview measured 23 draw calls, 523,732 rendered
triangles, 35 scene objects, 29 visible objects, 16 rendered district batches,
and 1,242 rendered model instances. The street preset reduced that to 16 draw
calls, 291,485 triangles, 9 rendered districts, and 666 rendered buildings.
These are local-browser inspection measurements, not active-frame-rate claims.

## Next slice

Use the complete view for a focused composition pass. The first candidate is a
soft deterministic reuse penalty for unlimited low/mid-rise assets, because the
most common model currently appears 129 times. After that, add a small number
of deliberate park/open-space blocks and one controlled curved or offset band;
do not add general road meshes or decorative detail yet.
