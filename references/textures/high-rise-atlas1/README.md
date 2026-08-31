# High-rise atlas overrides

`high-rise-texture-atlas1-emissive.png` is the canonical runtime emissive map
for Blender materials whose names begin with `MAT_High-rise1_Atlas`.

The residential-pack exporter assigns this image directly to the Principled
BSDF **Emission Color** input before exporting the combined GLB. This explicit
override allows atlas corrections to be tested without modifying or resaving
the source `.blend` file.

Expected atlas dimensions: 1024 × 1257 pixels.
