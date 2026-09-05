# Textured building pilot

This pilot tests the manually textured residential and commercial models from
an authoritative Blender project outside this repository, without changing the
production massing renderer or its geometry-only building catalogue.

## Run it

Create `.env.local` from `.env.example` and point it to the authoritative
Blender source and its texture directory:

```dotenv
BUILDING_BLEND_FILE=/absolute/path/to/2026-export-low-poly-textured-buildings.blend
BUILDING_TEXTURE_ROOT=/absolute/path/to/blender
```

`.env.local` is intentionally ignored by Git, so each workstation can use its
own paths without copying the Blender source into `references/raw/`.

Regenerate both runtime packs after editing the Blender source:

```bash
npm run textures:export-building-packs
```

The residential and commercial packs can also be regenerated independently
with `textures:export-residential-pack` and `textures:export-commercial-pack`.
The generated pack directories are intentionally ignored by Git because the
GLBs embed the full-resolution source atlases. A fresh checkout therefore needs
this export step before using `appearance=textured`.

Then open either composition with the texture appearance enabled:

```text
?view=synthetic&mode=city&seed=20260805&time=night&appearance=textured
?view=synthetic&mode=proof&seed=20260805&time=night&appearance=textured
```

The city statistics panel also has **Massing** and **Textures** switches.

## Export structure

- The 25 residential source objects are exported into one GLB. Fifteen retain
  existing catalogue IDs and ten use stable `residential-pilot-*` IDs.
- The 32 commercial source objects are exported into a second GLB. Thirteen
  retain existing `high-rise-*` catalogue IDs and nineteen use stable
  `commercial-pilot-*` IDs pending final classification.
- Shared texture atlases are embedded only once within each pack.
- Geometry is centred and grounded during export. UVs, material slots, source
  materials, emissive maps, roughness maps, and normal maps are preserved.
- The `.blend` file is opened read-only by background Blender and is never saved.
- The generated manifest records source names, dimensions, materials, mesh
  counts, the source file hash, and the exported pack hash used for cache
  invalidation.
- `MAT_High-rise1_Atlas*` materials explicitly use the project-owned emissive
  override at `references/textures/high-rise-atlas1/`.

Command-line arguments override `.env.local` for one-off exports:

```bash
npm run textures:export-residential-pack -- \
  --blend /absolute/path/to/buildings.blend \
  --texture-search-root /absolute/path/to/blender/assets
npm run textures:export-commercial-pack -- \
  --blend /absolute/path/to/buildings.blend \
  --texture-search-root /absolute/path/to/blender/assets
```

## Runtime policy

The pilot uses one `InstancedMesh` per model/material part. Placements whose
catalogue source category is `residential` use the residential pack; `high-rise`
placements use the commercial pack; skyscrapers continue through the original
geometry renderer. Existing matching catalogue IDs keep their original
placements. Other placements receive a deterministic, proportionally similar
model from the appropriate pack. Every exported model is guaranteed at least
one placement so it can be reviewed.

The two Asian podium variants (`residential-pilot-asian-a` and
`residential-pilot-asian-b`) receive eight best-fit placements each. A single
instance was too difficult to find during ordinary city inspection.

Textured models use a single uniform scale derived from the available footprint.
Their original width, depth, and height proportions are therefore preserved.

This is intentionally separate from the production loader, which strips UVs
and materials to support low-material-count city batching.

## Known limitations

- The residential GLB is about 55 MiB and the commercial GLB is about 113 MiB
  because the source atlases are embedded at full resolution.
- The textured packs render the full city without district visibility culling.
- Blender reports missing tangent generation for models whose source geometry
  is not triangulated. Those models still render, but normal-map response may
  be incomplete until the source mesh is triangulated or tangents are repaired.
- New pilot assets are still selected primarily by proportions. Final catalogue
  integration should classify their use, height, form, and district roles.
