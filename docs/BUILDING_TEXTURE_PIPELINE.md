# Building texture pipeline

## Goal

Move the current 92-building low-poly kit toward the approved night-city concept
without turning every model into a unique manual Blender project. The intended
runtime result is a small number of coherent façade material families with
aligned diffuse, emissive, roughness, and optional normal maps.

This is an offline asset pipeline. Three.js should load its outputs; it should
not repair UVs or bake materials at runtime.

## Repeatable audit

Run:

```sh
npm run textures:audit
```

The command opens the combined source file in headless Blender, audits its
collections, materials, image dependencies, and UV maps, and directly parses
every exported GLB. It writes the detailed local report to:

```text
references/processed/building-texture-audit.json
```

That report is generated and gitignored. The audit does not modify the Blender
file, GLBs, UVs, materials, or source images.

## Baseline findings (2026-08-23)

- All 92 exported GLBs have UV0 on every primitive.
- None of the 92 GLBs contains a glTF material, texture slot, or image payload.
  Their current visible material is supplied entirely by the Three.js runtime.
- The source Blender file contains 195 unique meshes and all 195 have at least
  one UV map.
- The source has 21 materials. Sixteen use image texture nodes.
- Blender has 40 image datablocks: one generated Render Result and 39 external
  image dependencies. None is packed, and all 39 external files are unresolved
  relative to the combined `.blend`.
- Forty-five source meshes contain UV coordinates outside the 0–1 tile. Thirty-
  nine meshes have multiple UV layers, with a maximum of seven. Those layouts
  are not necessarily broken; some were designed for repeating textures or
  different source material systems.
- The older `future-cityscape` project still has coherent commercial,
  industrial, ground, signage, and PBR atlas artwork. Three ground maps are
  exact filename matches. Its commercial atlas pipeline is a useful production
  reference, but most image dependencies named by this combined Blender file
  are not present under their original filenames.

The most important positive result is that geometry does not need manual
unwrapping from zero. A new dedicated `CityAtlasUV` layer can be generated or
repacked while preserving the artists' existing UV maps.

## First atlas-bake experiment

The audit selects six assets by source family and height range. They are a
representative technical sample, not a permanent artistic classification:

| Role | Asset | Height |
| --- | --- | ---: |
| Residential low/mid | `residential-24` | 38 m |
| Residential tall | `residential-22` | 60 m |
| Broad office/commercial | `high-rise-24` | 84 m |
| High-rise tower | `high-rise-35` | 156 m |
| Skyscraper body | `skyscraper-21` | 240 m |
| Landmark crown | `skyscraper-17` | 303 m |

The next pipeline slice should process only these six assets:

1. create a non-destructive `CityAtlasUV` layer;
2. map façades, roofs, podiums, and emissive accents to a shared aligned atlas;
3. export pilot GLBs with UVs, material references, and textures retained;
4. add a texture-capable loader path without changing the current city default;
5. compare the pilots in the asset gallery in day and night modes;
6. measure texture memory, triangles, draw calls, and load size before scaling
   the process to the remaining kit.

## Automation boundary

The following work is suitable for deterministic automation:

- dependency discovery and missing-file reporting;
- UV coverage, range, and layer audits;
- creation of a separate atlas UV layer;
- façade/roof orientation classification from mesh normals and bounds;
- UV packing into declared atlas regions with consistent metres-per-window;
- generation of roughness and emission maps aligned to the diffuse atlas;
- GLB export, validation, previews, and before/after metrics;
- repeatable processing of later replacement or newly added buildings.

Manual Blender work should be reserved for art-direction exceptions:

- choosing which architectural details deserve unique atlas regions;
- correcting a façade whose topology defeats automatic planar projection;
- protecting a distinctive crown, curved surface, or authored logo;
- approving texture scale, lit-window density, and material-family assignment.

The generic bake script from the older project is useful reference code but
should not be copied unchanged. It joins selected meshes, replaces existing UVs
with Smart UV, and produces per-model textures. At city scale that would erase
useful authoring information and create too many unique textures and materials.

## Runtime constraint

The current model loader intentionally removes all attributes except positions,
recomputes normals, and disposes source materials. The full-city layer then uses
one shared Lambert material in each district batch. Texturing therefore needs an
explicit new rendering path that preserves UVs and applies a small material
palette.

The initial target should be two or three building atlas families and roughly
four to eight shared runtime materials, not one material per building. Emissive
maps can provide most night-window light without adding real light sources.
