# Buildable block preprocessing

The block stage derives reviewed city coverage from the normalized structural
data. This is an offline stage: the browser loads only compact domain JSON and
has no GIS dependency.

## Reproducible command

```sh
npm run preprocess:blocks
```

The command reads `references/processed/city-structure.json` and writes
`references/processed/city-blocks.json`. Configuration lives in
`scripts/blocks/config.ts`. The output records the source structure SHA-256 so
mismatched artifacts can be diagnosed.

## Derivation

The preprocessor:

1. selects source-layer-zero road paths that are neither bridges nor tunnels;
2. polygonizes their correctly noded linework into closed road-bounded faces;
3. retains faces from 1,500 m² through 40,000 m²;
4. accepts simple single-ring faces and creates a constant-distance 6 m inset
   for convex faces;
5. deterministically ear-clips concave faces and preserves every viable 6 m
   inset triangle, rejecting acute-corner miters that escape their source
   triangle;
6. removes individual inset regions below 100 m²;
7. removes individual regions that violate 14 m rail, 10 m water, or 4 m
   surface-road clearance, without discarding unaffected parts of the block;
8. requires at least 600 m² of aggregate safe buildable area; and
9. assigns a district and block profile from explicit spatial and area rules.

`@turf/polygonize` is used only by the Node.js preprocessing script. It is a
focused development dependency, not a runtime GIS layer. Polygonization assumes
the normalized road endpoints are already correctly noded; dangling lines do
not create a face.

Ear clipping is a small local geometry routine with area-preservation tests. It
does not add another GIS dependency. Concave source boundaries remain intact in
domain data; their conservative placement regions are triangular.

## Current artifact and audit

The checked-in artifact was derived from 453 surface-road paths. Polygonization
found 236 candidates and retained 118 blocks containing 274 buildable regions:
21 full convex insets and 253 triangulated concave insets. The other 118
candidates are fully accounted for:

| Candidate reason | Count |
| --- | ---: |
| outside the configured area range | 33 |
| unsupported polygon topology | 0 |
| concave derivation failure | 5 |
| rail exclusion | 13 |
| water exclusion | 0 |
| surface-road exclusion | 2 |
| inset failure | 3 |
| buildable area below 600 m² | 62 |

Region-level filtering also reports every discarded derived region:

| Region reason | Count |
| --- | ---: |
| area below 100 m² | 298 |
| rail clearance | 44 |
| water clearance | 6 |
| surface-road clearance | 12 |

Every polygonizer result is stored as a deterministic candidate-audit entry
with a stable ID, source outline, centroid, area, and outcome. Rejected outcomes
have separate disabled-by-default debug layers. Partial region removals are
reported in aggregate metadata rather than silently discarded.

An earlier audit exposed unbounded acute-triangle miter intersections outside
their source triangles. Requiring every inset vertex to remain inside its source
polygon, and requiring inset area to shrink, removes those invalid regions.
Preserving all remaining viable ears then exposes multiple safe regions instead
of only one region per concave block.

Rail and water checks operate on those regions. This preserves safe land in a
partially intersected block while retaining the configured clearance; the former
whole-block rail policy was the principal cause of disconnected coverage.

The retained blocks cover 934,447.78 m² and their safe regions cover 282,599.38
m². Individual block areas range from 1,686.79 m² to 38,191.27 m²; individual
region areas range from 100.72 m² to 10,301.63 m². The compact JSON artifact is
177,026 bytes.

## Stable IDs and domain data

Each polygon ring is rounded to centimetres and canonicalized across starting
vertex and winding direction. Block and region IDs use short SHA-256 geometry
hashes, so identities do not depend on polygonizer result order or Three.js
scene order. The domain JSON remains the source of truth; render objects are
created only by downstream render and debug layers.

The current fictional-city rules create three inspectable districts:

- `east-core`: 33 blocks east of X = 450 m and north of the clip origin;
- `west-mixed`: 37 blocks west of that boundary and north of the origin;
- `riverfront-transition`: 48 blocks at or south of Z = 0 m.

Non-riverfront blocks receive compact, regular, or large-parcel profiles from
source area. The sample contains seven compact, 49 regular, 14 large-parcel,
and 48 riverfront blocks. These are fictional semantics, not claims about Osaka
land use.

## Current limitations

- Concave faces use separate conservative inset triangles rather than a complete
  concave offset. Insetting triangulation-internal edges creates intentional
  gaps and leaves some otherwise buildable area unused.
- Multipart polygons and holes are reported as unsupported.
- District boundaries are explicit first-pass rules, not inferred land use.
- The output provides placement regions, not a cadastral parcel model; lot
  subdivision and building placement remain downstream concerns.
- Manual overrides are supported as a future policy, but the current artifact
  uses none.

The residual-fabric stage documented in `MASSING.md` now supplies safe background
coverage without weakening this high-confidence block artifact. Future block
recovery should therefore focus on meaningful primary parcels, anchors, or
manual overrides rather than using block count as a proxy for visual density.
