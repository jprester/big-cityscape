# Blender city look-development bridge

The Blender look-development scene is a visual consumer of the same seeded,
declarative city plan used by Three.js. TypeScript remains the source of truth
for districts, blocks, slots, model selection, and authored-scale transforms.
Building geometry and materials are library-linked from the authoritative file
configured by `BUILDING_BLEND_FILE`.

Configure the local scene in `.env.local`:

```dotenv
CITY_LOOKDEV_BLEND_FILE=/absolute/path/to/2026-city-lookdev.blend
```

Regenerate the layout and rebuild the `CITY_GENERATED` collection:

```bash
npm run lookdev:update
```

To also render the overview camera for inspection:

```bash
npm run lookdev:update -- --preview references/visual/city-lookdev-preview.png
```

The deterministic intermediate file is written to
`references/processed/synthetic-city-lookdev.json`. It is ignored by Git and
contains buildings, roads, blocks, sidewalks, parks, source hashes, the seed,
and the overview camera.

## Blender scene policy

- Only `CITY_GENERATED` is deleted and rebuilt.
- `CITY_SOURCE_LIBRARY` contains hidden, read-only links to `residential`,
  `commercial`, and `skyscrapers` in the authoritative building file. Blender
  refreshes these links whenever the lookdev file is reopened.
- Legacy embedded source collections are hidden and left untouched for now;
  generated city meshes are never sourced from them.
- Every building renders at authored scale `1.0`; a placement can only rotate
  the normalised source mesh around Blender Z.
- Repeated buildings share one normalised mesh datablock per selected model.
- Three.js X/Z ground coordinates map to Blender X/Y, and Three.js Y maps to
  Blender Z. Rotation changes sign because that mapping changes handedness.
- Generated roads, blocks, sidewalks, lawns, and paths are batched into a small
  number of meshes rather than thousands of individual objects.
- Road hierarchy and intersection surfaces use small, explicit height offsets
  matching the Three.js layers so overlapping rectangles do not z-fight.
- Source transforms are reconstructed from persistent `matrix_basis` values.
  Blender reports identity `matrix_world` and `matrix_local` values for objects
  in disabled source collections after a saved file is reopened, so using
  either would incorrectly flatten or shrink buildings on the next rebuild.
- The importer verifies each normalised source mesh against the dimensions in
  the runtime manifest and corrects residual axis-scale drift before instancing.

## Current scope

This first bridge reproduces the city composition and is intended for texture,
material, lighting, skyline, and camera look development. Runtime-only systems
such as chunk visibility, collisions, UI, and interactive lighting remain in
Three.js. Street lamps, road markings, and procedural signs can be added after
the base composition is visually verified.

Existing registered models update in the lookdev city as soon as the source
file is saved and `npm run lookdev:update` is run. Brand-new objects still need
a stable asset ID and placement metadata before the generator can select them;
a Blender-first staging registry is a separate next step.
