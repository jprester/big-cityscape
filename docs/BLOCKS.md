# Buildable block preprocessing

Milestone 2 derives a deliberately small first set of useful blocks from the
normalized Milestone 1 structure. This is an offline data stage: the browser
loads only the resulting compact JSON and has no GIS dependency.

## Reproducible command

```sh
npm run preprocess:blocks
```

The command reads `references/processed/city-structure.json` and writes
`references/processed/city-blocks.json`. Its configuration lives in
`scripts/blocks/config.ts`, and the output records the source structure SHA-256
so mismatched artifacts can be diagnosed.

## Derivation

The preprocessor:

1. selects road paths at source layer zero that are neither bridges nor tunnels;
2. polygonizes their correctly noded linework into closed road-bounded faces;
3. retains faces from 1,500 m² through 40,000 m²;
4. accepts convex, single-ring faces for this first implementation;
5. applies 14 m rail and 10 m water clearances;
6. creates a constant-distance 6 m convex inset;
7. verifies at least 4 m clearance from every selected surface-road path; and
8. assigns a district and block profile from explicit spatial and area rules.

`@turf/polygonize` is used only by the Node.js preprocessing script. It is a
focused development dependency, not a general GIS layer or a runtime dependency.
Polygonization assumes the normalized road endpoints are already correctly
noded; dangling lines do not create a face.

The checked-in dataset was derived from 453 surface-road paths. Polygonization
found 236 candidates and retained 20 blocks. The other 216 candidates are fully
accounted for:

| Reason | Count |
| --- | ---: |
| outside the configured area range | 33 |
| unsupported polygon topology | 0 |
| non-convex shape | 178 |
| rail exclusion | 2 |
| water exclusion | 0 |
| surface-road exclusion | 0 |
| inset failure | 3 |

The retained blocks cover 70,170.04 m²; their buildable polygons cover
45,017.82 m². Individual block areas range from 1,686.79 m² to 12,922.52 m².

## Stable IDs and domain data

Each polygon ring is rounded to centimetres and canonicalized across starting
vertex and winding direction. Its semantic ID is a short SHA-256 geometry hash,
so the ID does not depend on polygonizer result order or Three.js scene order.
The domain JSON remains the source of truth; render objects are created only by
the debug layer.

The current spatial rules create three inspectable districts:

- `east-core`: nine blocks east of X = 450 m and north of the clip origin;
- `west-mixed`: seven blocks west of that boundary and north of the origin;
- `riverfront-transition`: four blocks at or south of Z = 0 m.

Non-riverfront blocks receive compact, regular, or large-parcel profiles from
their source area. The current retained sample contains six compact, ten regular,
and four riverfront blocks; no retained block reaches the large-parcel threshold.

These are intentionally simple fictional-city semantics, not claims about Osaka
land use.

## Current limitations

- Concave road faces are reported and deferred rather than inset approximately.
- Multipart polygons and holes are reported as unsupported.
- District boundaries are explicit first-pass rules, not inferred land use.
- No parcel subdivision or building placement occurs in this stage.
- Manual overrides are supported as a future policy but the current dataset uses
  none; awkward candidates are rejected with a reason instead.

The smallest next geometry improvement would be a focused concave-inset strategy
or a small reviewed override list. Neither is required before using these 20
blocks for Milestone 3 primitive massing.
