# Buildable block preprocessing

The block stage derives a reviewed first coverage set from the normalized
Milestone 1 structure. This is an offline data stage: the browser loads only the
resulting compact JSON and has no GIS dependency.

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
4. accepts simple single-ring faces and applies 14 m rail and 10 m water
   clearances;
5. creates a constant-distance 6 m inset for convex faces;
6. deterministically ear-clips concave faces and selects their largest viable
   6 m inset triangle;
7. requires at least 600 m² of buildable area;
8. verifies at least 4 m clearance from every selected surface-road path; and
9. assigns a district and block profile from explicit spatial and area rules.

`@turf/polygonize` is used only by the Node.js preprocessing script. It is a
focused development dependency, not a general GIS layer or a runtime dependency.
Polygonization assumes the normalized road endpoints are already correctly
noded; dangling lines do not create a face.

Ear clipping is a small local geometry routine with area-preservation tests; it
does not add another GIS dependency. Concave source boundaries remain intact in
the domain data. Only their conservative buildable zones are triangular.

The checked-in dataset was derived from 453 surface-road paths. Polygonization
found 236 candidates and retained 41 blocks: 20 full convex insets and 21
triangulated concave insets. The other 195 candidates are fully accounted for:

| Reason | Count |
| --- | ---: |
| outside the configured area range | 33 |
| unsupported polygon topology | 0 |
| concave derivation failure | 0 |
| rail exclusion | 73 |
| water exclusion | 4 |
| surface-road exclusion | 66 |
| inset failure | 3 |
| buildable area below 600 m² | 16 |

The retained blocks cover 229,762.31 m²; their buildable polygons cover
76,747.50 m². Individual block areas range from 1,686.79 m² to 33,172.41 m²;
buildable areas range from 605.45 m² to 10,301.63 m².

## Stable IDs and domain data

Each polygon ring is rounded to centimetres and canonicalized across starting
vertex and winding direction. Its semantic ID is a short SHA-256 geometry hash,
so the ID does not depend on polygonizer result order or Three.js scene order.
The domain JSON remains the source of truth; render objects are created only by
the debug layer.

The current spatial rules create three inspectable districts:

- `east-core`: fourteen blocks east of X = 450 m and north of the clip origin;
- `west-mixed`: eleven blocks west of that boundary and north of the origin;
- `riverfront-transition`: sixteen blocks at or south of Z = 0 m.

Non-riverfront blocks receive compact, regular, or large-parcel profiles from
their source area. The current retained sample contains six compact, nineteen
regular, and sixteen riverfront blocks; no retained non-riverfront block reaches
the large-parcel threshold.

These are intentionally simple fictional-city semantics, not claims about Osaka
land use.

## Current limitations

- Concave road faces use one conservative inset triangle rather than a complete
  concave offset, leaving some otherwise buildable area unused.
- Multipart polygons and holes are reported as unsupported.
- District boundaries are explicit first-pass rules, not inferred land use.
- No parcel subdivision or building placement occurs in this stage.
- Manual overrides are supported as a future policy but the current dataset uses
  none; awkward candidates are rejected with a reason instead.

The next geometry improvement, when justified, would be a robust full concave
offset or a small reviewed override list. Neither is required for the current 41
blocks and 50-building massing set.
