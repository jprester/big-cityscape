# Textured residential pilot

This pilot tests the manually textured residential models from
`references/raw/2026-export-low-poly-textured-buildings.blend` without changing
the production massing renderer or its geometry-only building catalogue.

## Run it

Regenerate the runtime pack after editing the Blender source:

```bash
npm run textures:export-residential-pack
```

Then open either composition with the texture appearance enabled:

```text
?view=synthetic&mode=city&seed=20260805&time=night&appearance=textured
?view=synthetic&mode=proof&seed=20260805&time=night&appearance=textured
```

The city statistics panel also has **Massing** and **Textures** switches.

## Export structure

- All 25 source objects are exported into one GLB so shared texture atlases are
  embedded only once.
- Fifteen source objects retain their existing catalogue IDs.
- Ten new objects use stable `residential-pilot-*` IDs pending final catalogue
  classification.
- Geometry is centred and grounded during export. UVs, material slots, source
  materials, emissive maps, roughness maps, and normal maps are preserved.
- The `.blend` file is opened read-only by background Blender and is never saved.
- The generated manifest records source names, dimensions, materials, mesh
  counts, and the source file hash.

The exporter searches the sibling `Projects/3d-modeling/blender` tree for the
external image paths referenced by the current source file. On another machine,
pass a replacement root:

```bash
npm run textures:export-residential-pack -- \
  --texture-search-root /absolute/path/to/blender/assets
```

## Runtime policy

The pilot uses one `InstancedMesh` per model/material part. Only placements
whose catalogue source category is `residential` are replaced. High-rise,
skyscraper, and other source categories continue through the original geometry
renderer. Existing matching residential IDs keep their original placements.
Other residential placements receive a deterministic, proportionally similar
pilot model; every exported model is guaranteed at least one placement so it
can be reviewed.

Textured models use a single uniform scale derived from the available footprint.
Their original width, depth, and height proportions are therefore preserved.

This is intentionally separate from the production loader, which strips UVs
and materials to support low-material-count city batching.

## Known limitations

- The combined GLB is currently about 55 MiB because several source maps are
  6000 × 4766 and are embedded at source resolution.
- The pilot renders the full city without district visibility culling.
- Blender reports missing tangent generation for models whose source geometry
  is not triangulated. Those models still render, but normal-map response may
  be incomplete until the source mesh is triangulated or tangents are repaired.
- New pilot assets are still selected primarily by proportions. Final catalogue
  integration should classify their use, height, form, and district roles.
