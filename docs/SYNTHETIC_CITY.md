# Synthetic city generation

## Scope

The simplified successor builds a fictional city from direct synthetic blocks
and reviewed building assets. It does not consume processed geography or derive
blocks from road polygons.

The current implementation produces a deterministic, populated 500 × 500 m
proof district and an inspection-oriented Three.js view. It generates blocks
and building slots, selects real catalogue assets, records placement
diagnostics, and renders the selected models in instanced batches.

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
selected asset after acceptance. This enforces reviewed `maximumPerCity`
limits without making output depend on incoming slot order.

The population result contains placements, compatible-candidate counts for
accepted slots, structured rejection records, sorted asset-usage counts, and
summary totals. Incoming catalogue order also cannot change the result.

With the current catalogue and default district seed, all 79 slots are filled
with 29 distinct assets and no rejections. Lower and mid-rise assets without an
explicit limit may still repeat; visual repetition should be evaluated in the
rendered proof district before adding another selection rule.

## Synthetic debug view

Open `?view=synthetic` to inspect the proof district. An optional integer
`seed` query parameter regenerates template choices, slot heights, and asset
selection while leaving the direct street geometry unchanged.

The view exposes independent layers for street negative space, block-template
surfaces, core/transition buildable outlines, placement slots, selected GLBs,
inspection lighting, and a 25 m metric grid. Overview, rooftop, and street
camera presets provide reproducible comparisons. The street preset is derived
from the central generated street gap rather than placed inside a block.

Only the 29 selected asset files are loaded for the default seed. Placements
sharing an asset use one `InstancedMesh`, producing 29 building batches rather
than one scene object per building. The live statistics panel reports district,
population, model-batch, triangle, and load-failure totals.

## Current files

| Concern | File |
| --- | --- |
| Slot definition | `src/city/synthetic/model/buildingSlot.ts` |
| Placement definition | `src/city/synthetic/model/buildingPlacement.ts` |
| Selection result definition | `src/city/synthetic/model/assetSlotSelection.ts` |
| Population result definition | `src/city/synthetic/model/districtPopulation.ts` |
| Proof-district definitions | `src/city/synthetic/model/proofDistrict.ts` |
| Block-template slot generation | `src/city/synthetic/generation/createBlockSlots.ts` |
| Proof-district generation | `src/city/synthetic/generation/generateProofDistrict.ts` |
| Deterministic matcher | `src/city/synthetic/generation/selectAssetForSlot.ts` |
| Stable district population | `src/city/synthetic/generation/populateSyntheticDistrict.ts` |
| Synthetic debug geometry | `src/city/synthetic/rendering/addSyntheticDistrictDebugLayers.ts` |
| Instanced selected models | `src/city/synthetic/rendering/addSyntheticBuildingLayer.ts` |
| Synthetic app lifecycle | `src/synthetic/createSyntheticDistrictApp.ts` |
| Focused tests | `src/city/synthetic/generation/*.test.ts` |

## Validation contract

Tests verify that generation is repeatable, a different seed changes semantic
output without changing the street geometry, blocks do not overlap, slots stay
inside buildable bounds, slots within a block do not overlap, and every default
slot has at least one compatible enabled asset in the real catalogue. Population
tests also verify order independence, city-limit enforcement, usage accounting,
and preservation of structured rejection diagnostics.

For the current catalogue and default seed, every slot has between 3 and 14
compatible candidates before city-wide repetition caps are applied. The
landmark is deliberately the narrowest category, with three candidates.

The default overview measured 35 draw calls, 42,131 rendered triangles, 47
scene objects, and 41 visible objects in the local browser. Rendering is
on-demand while the camera is idle. No active-frame-rate claim is made yet.

## Next slice

Review the proof district visually before scaling outward. The next code slice
should address only concrete composition issues found in that review—most
likely template density, repeated low/mid-rise assets, or deliberate open-space
blocks—then preserve the accepted 500 m district as the first city chunk.
