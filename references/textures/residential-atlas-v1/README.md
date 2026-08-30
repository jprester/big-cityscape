# Residential atlas v1

This is a generated source atlas for manually UV mapping the residential
building family in Blender. It follows the approved
`residential-texture-guide-27-28-30-31-32-night-v2.png` art direction.

## Files

- `residential-atlas-v1-source.png`: original 1254 × 1254 generated image.
- `residential-atlas-v1-basecolor-2048.png`: 2048 × 2048 Lanczos-resampled
  working copy for Blender.
- `residential-atlas-v1-emissive-2048.png`: pixel-aligned emissive map derived
  from the base color. Warm apartment/storefront light, cool lobby light, and
  red beacons retain their color; all non-emissive surfaces remain black.
- `residential-atlas-v1-roughness-2048.png`: pixel-aligned grayscale roughness
  map. White masonry/concrete regions are rough; dark glazing, coated metal,
  lit interiors, and beacon lenses are progressively smoother.

The upper two rows contain eight rectified residential façade families. The
lower rows contain podium/lobby glazing, concrete and brick swatches, balcony
and privacy screens, entrance and service modules, individual window modules,
small light modules, and rooftop beacons.

## Intended use

- Start with the 2048 base-color map and manually place UV islands inside the
  large façade or module regions.
- Keep UV islands away from the black gutters to prevent mip-map bleeding.
- Use the large façade panels for distant/mid-distance building surfaces and
  the smaller modules for reviewed entrances, podiums, roofs, and accents.
- Verify repetition and seam placement in Blender before committing UVs. This
  is generated artwork, so it is an art-direction source rather than a promise
  that every region is mathematically seamless.
- The emissive map is rebuilt deterministically with
  `python3 scripts/build-residential-emissive-atlas.py`. It is intentionally
  conservative so pale concrete and masonry do not glow.
- The roughness map is rebuilt with
  `python3 scripts/build-residential-roughness-atlas.py`. Load it as non-color
  data before connecting it to Principled BSDF Roughness.
- Derive any future normal map from this exact approved base image so all
  channels remain pixel-aligned. Do not generate it independently.

## Generation prompt

```text
Use case: stylized-concept
Asset type: production source sheet for a square residential-building texture atlas used for manual UV mapping in Blender and rendering in Three.js.

Input image: use the supplied five-building residential concept only as the authoritative material, color, façade rhythm, and night-lighting reference. Do not render the buildings themselves.

Primary request: Create a clean, square, high-resolution architectural texture atlas source sheet made entirely of flat, perfectly front-facing, rectified texture panels. It must be directly useful for manually UV mapping the five low-poly residential buildings.

Layout:
- Upper 72%: eight large separate façade panels in an exact 4-column by 2-row grid, all equal rectangular size, separated by straight dark 8-pixel-style gutters.
- Lower 28%: a clean modular grid containing four ground-floor/lobby/storefront strips, two roof materials, balcony floor and soffit materials, dark metal balcony rail and privacy-screen patterns, three concrete/brick tileable swatches, entrance-door modules, rooftop louvers and HVAC panels, warm-window modules, dark-window modules, cool lobby-light modules, and tiny red rooftop beacon swatches.
- Every region must have hard straight rectangular boundaries. No overlapping artwork and no labels or text.

Eight façade families, all residential:
1. Dark brown-gray brick apartment façade with narrow punched windows, recessed balcony stacks, graphite rails and privacy screens.
2. Pale warm-gray precast residential tower with vertical panel seams, narrow apartment windows, dark balcony bands.
3. Mid-gray textured brick slab with dense regular apartment windows and shallow loggias.
4. Cool concrete twin-volume façade with strong end walls and recessed dark balcony/window strips.
5. Charcoal brick high-rise with bronze-gray balcony rails and occasional pale stone bands.
6. Graphite fiber-cement panel façade with alternating recessed apartment bays and subtle warm metal accents.
7. Premium pale stone residential podium/tower façade with residential windows, planter ledges and restrained dark metal.
8. Dark concrete residential façade with mixed balcony widths, privacy fins, and a slightly warmer ground-floor transition.

Texture requirements:
- Orthographic elevation only; zero perspective convergence, zero camera angle, zero depth staging.
- Consistent apartment floor height and window scale across all eight panels.
- Punched apartment windows, curtains/blinds, balcony rails, privacy screens and panel seams must read clearly.
- Sparse irregular warm occupied windows, a few cool-white windows, and mostly dark apartments.
- Realistic but restrained weathering, rain streaks, masonry variation, concrete roughness and metal variation.
- Surfaces remain readable at night and should support manual extraction of emissive, roughness and normal maps.
- Rectangular panels should be vertically repeatable where practical; keep edge rhythms compatible across top and bottom.
- Professional game-environment texture photography quality, realistic physically based surface appearance.

Color palette: charcoal, graphite, dark brown-gray brick, cool and warm gray concrete, dark navy glazing, black-bronze rails, pale stone, sparse warm amber interiors, very limited cool cyan-white lobby illumination.

Constraints: texture atlas only; no complete buildings; no perspective; no angled façades; no sky; no ground plane; no people; no vehicles; no landscaping scenes; no city; no logos; no brands; no readable text; no watermark. Avoid office curtain walls, giant panes of glass, uniform all-lit windows, strong neon, fantasy cyberpunk styling, warped grids, diagonal separators, decorative borders, or painterly concept art.
```

Generated with the built-in image-generation tool on 2026-08-26.
