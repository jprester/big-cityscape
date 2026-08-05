# City Field / Big Cityscape — Project Plan

## 1. Project summary

**City Field** (current working title **Big Cityscape**) is a scale-first experimental Three.js project for building a convincing, high-density fictional futuristic city.

The project begins with realistic urban organization at kilometre scale and deliberately uses extremely simple geometry: primitives, generated meshes, shared materials, and procedural rules. Visual quality will improve later. The initial success criterion is not detailed architecture; it is whether the city feels spatially credible when viewed and traversed at street, rooftop, and aerial scales.

This project is intentionally independent from the existing detail-first cyberpunk city project (https://github.com/jprester/future-cityscape and locally in ../future-cityscape folder). It should explore a novel, code-driven workflow rather than inherit a Blender-heavy asset pipeline.

### Simplified synthetic-city branch scope

The `simplified-city-generation` branch intentionally replaces the original
geodata-driven horizontal-structure experiment with a smaller synthetic-city
successor. For this branch, the following scope overrides the OSM, road-mesh,
waterway, railway, and polygon-derived block requirements later in this plan:

- target a synthetic 2 × 2 km city, beginning with one populated 500 × 500 m
  proof district;
- generate rectangular blocks directly and treat configurable gaps between
  them as streets;
- use only a few explicit offsets, rotations, or curved block bands for
  variation;
- select reviewed GLB buildings through the generated asset catalogue;
- preserve deterministic semantic data, debug inspection, chunked rendering,
  camera presets, and measured performance; and
- avoid real geography, GIS preprocessing, road topology repair, waterways,
  railways, and arbitrary polygon subdivision.

The successor flow is:

```text
synthetic city composition
→ district-aware blocks
→ block-template placement slots
→ deterministic compatible asset selection
→ declarative building placements
→ chunked rendering
```

See `docs/BUILDING_ASSETS.md` for the asset catalogue and
`docs/SYNTHETIC_CITY.md` for the current implementation contract.

## 2. Core hypothesis

A convincing city can be produced more efficiently by starting with:

1. realistic road and block organization;
2. district hierarchy and density gradients;
3. believable building massing and spacing;
4. infrastructure and open-space constraints;
5. aggressive rendering optimization;

and only later adding facade detail, textures, props, and bespoke assets.

The project is also intended to test an AI-native workflow. Most meaningful changes should be expressible through TypeScript, structured data, procedural rules, and reproducible seeds rather than manual 3D editing.

## 3. Relationship to the map reference

The source layout is based on exported OpenStreetMap data from central Osaka.

The Osaka data is **structural inspiration**, not a simulation target. The final city must be fictional and futuristic.

Preserve or derive useful horizontal organization such as:

- major and secondary road hierarchy;
- irregular city-block shapes;
- a simplified water corridor;
- selected bridges;
- railway or elevated infrastructure corridors;
- open spaces and unusual residual parcels;
- variation between fine-grained blocks and larger superblocks.

Do not reproduce Osaka's real buildings, skyline, land use, or architectural identity.

The intended transformation is approximately:

> Osaka-like horizontal urban complexity + Shenzhen-scale redevelopment + Hong Kong-level vertical density.

## 4. Input data

Recommended repository layout:

```text
references/
  raw/
    osaka-structure.geojson
    osaka-buildings-reference.geojson
  processed/
    city-structure.json
```

### 4.1 Structural GeoJSON

The smaller structural export is the primary input. It may contain:

- roads;
- railway lines;
- waterways;
- water polygons;
- relevant OpenStreetMap properties.

This data should eventually be converted into a compact, normalized, local-coordinate format suitable for the browser.

### 4.2 Building GeoJSON

The building export is larger than 90 MB. Treat it as optional offline reference data.

Important constraints:

- Never fetch or parse the raw building file in the browser.
- Do not import it into the runtime bundle.
- Do not assume it must be used in the first milestone.
- Use it only when it helps infer density, frontage rhythm, parcel scale, or block subdivision.
- Prefer extracting a small subset or summary during offline preprocessing.
- It is acceptable to ignore it entirely in the first implementation.

Unless there is a reason to version the raw data, keep large raw files out of Git and document how to restore them locally.

### 4.3 Coordinate conversion

GeoJSON longitude and latitude coordinates must be converted to local metric coordinates before rendering.

Requirements:

- choose a stable geographic origin near the dataset centre;
- project coordinates into metres;
- subtract the local origin;
- map the horizontal plane consistently to Three.js axes;
- store only compact local coordinates in processed runtime data;
- retain enough metadata to reproduce the conversion.

The runtime city should remain centred close to `[0, 0, 0]`.

## 5. Initial project scope

The first meaningful prototype should cover approximately **1–2 square kilometres**, not the entire exported map.

It should include:

- one simplified water corridor;
- a small number of manually or procedurally defined bridges;
- a recognizable major-road hierarchy;
- secondary streets;
- derived or simplified buildable blocks;
- primitive building massing;
- several building-height clusters;
- one or two landmark locations;
- free camera movement;
- debug visualizations;
- deterministic regeneration.

The waterway should initially be only a simple polygon or plane. Do not implement waves, reflections, boats, simulation, or detailed embankments.

## 6. Non-goals for the initial phases

Do not prioritize:

- geographic fidelity to Osaka;
- importing or reproducing real buildings;
- Blender integration;
- bespoke building assets;
- detailed PBR textures;
- traffic simulation;
- pedestrians;
- interiors;
- complex water rendering;
- physically complete transport simulation;
- a full game;
- photorealism;
- procedural generation of the entire city in one step.

The first question is: **Does an untextured primitive city already feel like a plausible place?**

## 7. Technical stack

Initial stack:

- Vite;
- TypeScript with strict mode;
- Three.js;
- Vitest for deterministic geometry and data tests where useful;
- simple HTML/CSS controls for debug UI.

Avoid React unless the interface grows complex enough to justify it. The rendering and generation core must remain framework-independent.

Choose geometry/GIS libraries only after a focused spike demonstrates that they reduce complexity. Do not add a large dependency stack pre-emptively.

## 8. Architectural principles

### 8.1 Declarative city definition

The city should be represented as structured data and parameters rather than scattered imperative `new THREE.Mesh()` calls.

Example conceptual hierarchy:

```text
City
  → Districts
    → Roads and infrastructure
    → Blocks
      → Lots or placement zones
        → Building definitions
          → Rendered geometry
```

Possible core types:

```ts
type Point2 = readonly [x: number, z: number];

type CityDefinition = {
  seed: number;
  districts: DistrictDefinition[];
  water: WaterRegion[];
  infrastructure: InfrastructureDefinition[];
};

type DistrictDefinition = {
  id: string;
  polygon: Point2[];
  profile: DistrictProfile;
  density: number;
  heightRange: readonly [number, number];
};

type CityBlock = {
  id: string;
  polygon: Point2[];
  districtId: string;
  buildablePolygon?: Point2[];
  profile: BlockProfile;
};

type BuildingDefinition = {
  id: string;
  blockId: string;
  footprint: Point2[];
  height: number;
  archetype: BuildingArchetype;
  seed: number;
};
```

These are conceptual examples, not mandatory final APIs.

### 8.2 Determinism

Every procedural decision must be reproducible.

- Use explicit seeds.
- Avoid direct use of `Math.random()` in generation code.
- Make it possible to regenerate a district, block, or building independently.
- Store the seed and semantic identity of generated entities.

### 8.3 Staged generation

Keep generation stages separate:

1. load and normalize source data;
2. derive or simplify road geometry;
3. identify water and infrastructure exclusions;
4. derive buildable block polygons;
5. assign district and block profiles;
6. subdivide selected blocks;
7. generate building definitions;
8. render geometry;
9. merge, instance, or simplify for performance.

Each stage should be inspectable without running all later stages.

### 8.4 Semantic metadata

Generated objects should retain useful metadata such as:

- district ID;
- block ID;
- lot ID where applicable;
- building archetype;
- generation seed;
- LOD or chunk ID.

Do not make the rendered scene the only source of truth.

### 8.5 Primitive vocabulary

Start with a deliberately small vocabulary:

- box tower;
- slab;
- podium tower;
- stepped tower;
- courtyard or perimeter block;
- megastructure mass;
- infrastructure platform;
- landmark spire.

Complex skyscrapers should initially be combinations of boxes and simple extrusions.

### 8.6 Urban hierarchy over random noise

Generation order should follow urban hierarchy:

```text
city structure
→ district roles
→ road hierarchy
→ block morphology
→ buildable area
→ building archetypes
→ individual variation
```

Do not distribute independent random towers across the map. Heights and forms should be spatially correlated.

## 9. Urban design rules

The city should contain readable contrast.

Suggested district patterns:

### Dense central core

- podium-heavy blocks;
- several tall towers per block;
- 150–500 m landmark range;
- high site coverage;
- wider avenues and major transit access;
- strong skyline clustering.

### Commercial transition district

- street-aligned building masses;
- occasional courtyard blocks;
- 50–220 m height range;
- one dominant tower on selected corners;
- more visible street walls.

### Megastructure district

- very large parcels or superblocks;
- one dominant interconnected mass;
- elevated platforms and bridges later;
- fewer but larger forms;
- open service or infrastructure zones.

### Dense mixed district

- finer-grained blocks;
- slabs, mid-rise towers, and occasional high-rise insertions;
- more height variation;
- stronger local street network.

### Infrastructure corridor

- railway, elevated expressway, utility, or service land;
- lower building coverage;
- long sightlines;
- physical separation between districts.

Do not make every block a skyscraper block. Lower and emptier areas are necessary to make the tallest clusters feel large.

## 10. Waterway strategy

Keep one major water corridor early because it creates valuable city-scale structure:

- irregular waterfront blocks;
- bridges as landmarks and chokepoints;
- longer sightlines;
- district boundaries;
- visible skyline separation.

Initial implementation:

- one flat water mesh;
- simplified polygon;
- no simulation;
- no reflections required;
- manually specified bridges are acceptable;
- no buildings generated inside water or exclusion buffers.

Water must remain a local generation constraint rather than infect every subsystem.

## 11. Rendering and performance strategy

The project is explicitly performance-oriented.

### 11.1 Spatial organization

Divide the city into chunks, initially around 100–250 m across.

Each chunk should be independently:

- generated or loaded;
- culled;
- rebuilt;
- debugged;
- merged or instanced;
- assigned an LOD later.

### 11.2 Geometry

Prefer:

- shared primitive geometries;
- `InstancedMesh` for repeated forms;
- merged static geometry by chunk and material;
- simple extrusions for irregular footprints;
- very low material counts;
- no per-building unique textures during early phases.

Avoid thousands of separately managed high-overhead scene objects where merging or instancing is practical.

### 11.3 Materials

Initial materials should be simple categories, for example:

- commercial glass mass;
- residential or mixed dark mass;
- industrial or infrastructure mass;
- landmark mass;
- road;
- ground;
- water.

No detailed facade shaders are required for the first milestone.

### 11.4 LOD progression

Possible later progression:

```text
very far: skyline proxy masses
far: merged block geometry
medium: simplified generated buildings
near: complete procedural massing
future hero areas: higher-quality procedural or bespoke replacements
```

LOD is not required in the first small prototype, but the architecture should not make it impossible.

### 11.5 Measurements

Track at least:

- frame rate;
- draw calls;
- triangle count;
- scene object count;
- JavaScript heap where practical;
- data load and preprocessing time;
- processed city-data size;
- visible distance;
- number of generated buildings and blocks.

## 12. Debug and inspection modes

Debug views are first-class features.

At minimum, support modes for:

- raw imported lines/polygons;
- local coordinate axes and dataset bounds;
- roads only;
- water only;
- derived blocks;
- buildable polygons;
- district assignments;
- block profiles;
- building footprints;
- primitive building masses;
- height visualization;
- chunk boundaries;
- final scene.

Use stable saved camera positions so screenshots can be compared between iterations.

## 13. Suggested source layout

```text
src/
  app/
    createApp.ts
    debugUi.ts
  city/
    model/
      types.ts
      profiles.ts
    data/
      loadProcessedCity.ts
    generation/
      random.ts
      generateDistricts.ts
      generateBlocks.ts
      generateBuildings.ts
      archetypes/
        boxTower.ts
        slab.ts
        podiumTower.ts
        steppedTower.ts
    geometry/
      polygon.ts
      coordinates.ts
    rendering/
      createCityScene.ts
      renderRoads.ts
      renderWater.ts
      renderBlocks.ts
      renderBuildings.ts
      materials.ts
    debug/
      debugLayers.ts
      debugState.ts
  main.ts
scripts/
  preprocess-osm.ts
references/
  raw/
  processed/
tests/
```

This is a suggested direction, not a requirement to create every file immediately.

## 14. Milestones

### Milestone 0 — Repository foundation

Deliverables:

- Vite + strict TypeScript + Three.js project;
- minimal scene and render loop;
- orbit/free-fly camera suitable for city inspection;
- resize handling;
- basic performance overlay;
- deterministic random utility;
- project documentation.

Success condition:

- clean development environment;
- no city generator yet;
- architecture is understandable and minimal.

### Milestone 1 — Structural data viewer

Deliverables:

- offline preprocessing script for the smaller structural GeoJSON;
- local metric coordinate conversion;
- compact processed JSON;
- rendering of roads, rail lines, water, and bounds as debug geometry;
- configurable clipping to a smaller 1–2 km² working area.

Success condition:

- imported structure aligns correctly;
- no raw GeoJSON is loaded by the browser;
- the selected area is centred and inspectable.

### Milestone 2 — Buildable blocks

Deliverables:

- derive or manually define a first set of city blocks;
- water and infrastructure exclusion handling;
- simplified block polygons;
- block debug labels or IDs;
- basic district/profile assignment.

Success condition:

- approximately 20–50 useful blocks exist;
- awkward source geometry can be simplified or overridden;
- block layout already resembles a believable city plan.

### Milestone 3 — Primitive city massing

Deliverables:

- 3–4 building archetypes;
- deterministic building placement;
- coherent height clusters;
- selected landmarks;
- street-aligned or podium-based placement;
- simple material categories.

Success condition:

- the untextured city feels spatially credible from street, rooftop, and aerial cameras;
- changing one seed produces variation without destroying urban coherence.

### Milestone 4 — Performance expansion

Deliverables:

- chunking;
- culling strategy;
- merging and/or instancing;
- larger visible area;
- performance metrics and budgets.

Success condition:

- the city can expand beyond the initial district without scene-object overhead becoming dominant.

### Milestone 5 — First quality pass

Only after massing and performance are successful:

- procedural facade rhythm;
- emissive window approximation;
- improved road surfaces;
- bridge forms;
- atmospheric lighting and fog;
- selected rooftop details;
- better silhouettes.

Do not jump to this milestone to disguise weak urban organization.

## 15. Initial implementation task

The first Codex session should:

1. inspect this plan and `AGENTS.md`;
2. propose a minimal repository structure;
3. initialize Vite + strict TypeScript + Three.js if needed;
4. create the rendering foundation;
5. add a deterministic seeded-random utility;
6. create placeholder debug-layer architecture;
7. avoid implementing the full data pipeline or city generator in the same task.

The first coding task should remain small enough to review completely.

## 16. Decision log

Important decisions already made:

- The project is scale-first and independent from the detail-first city project.
- It is a fictional futuristic city, not an Osaka simulation.
- Real map data supplies horizontal organization only.
- The smaller structural GeoJSON is the main source.
- The 90+ MB building GeoJSON is optional offline reference material.
- One simplified water corridor should be present early.
- Primitive geometry and procedural rules come before visual detail.
- Deterministic, declarative, AI-friendly code is a core requirement.
- The project should begin with a smaller 1–2 km² slice before expanding.

## 17. Attribution

The source geographic data comes from OpenStreetMap.

Retain appropriate attribution in project documentation and any public build:

> Map data © OpenStreetMap contributors

Review OpenStreetMap/ODbL obligations before distributing derived datasets.
