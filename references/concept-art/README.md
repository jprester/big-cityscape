# City Field visual target

These two concept renders are the agreed visual target for the finished
project:

- `city-field-target-street-night.png`: long street-axis view;
- `city-field-target-rooftop-night.png`: elevated rooftop and skyline view.

Asset-specific material guides are stored alongside the city-scale targets:

- `residential-texture-guide-27-28-30-31-32-night-v1.png`: five residential
  masses from the supplied Blender view, textured left-to-right as a coherent
  night-city family while preserving their distinct silhouettes.
- `residential-texture-guide-27-28-30-31-32-night-v2.png`: preferred residential
  revision with apartment-scale punched windows, balcony and privacy rhythms,
  masonry/precast variation, residential entrances, and sparse occupancy
  lighting instead of office-style curtain walls.

They were generated from actual City Field screenshots, so their camera
composition, street hierarchy, skyline distribution, and overall massing are
more important than incidental AI-generated architectural details.

## Art-direction goals

- Preserve the current synthetic city plan, scale, density gradients, and
  recognizable low-poly building silhouettes.
- Use a restrained shared material vocabulary: dark glass, concrete, stone,
  metal cladding, roof membranes, and occasional planted terraces.
- Add varied emissive window patterns without requiring a unique texture or
  material per building.
- Keep the night palette predominantly deep blue and charcoal, balanced by warm
  interior and street lighting.
- Use cyan, magenta, and amber advertisements sparingly as accents rather than
  covering every façade.
- Make storefronts, crown logos, street lamps, road markings, trees, planters,
  traffic signals, and modest street activity carry most of the close-range
  detail.
- Give roofs believable silhouettes through HVAC units, vents, railings,
  antennas, warning lights, and occasional gardens.
- Use haze, reflection, roughness variation, and distance falloff to create
  depth while keeping distant geometry inexpensive.

## Interpretation

These images are references, not literal asset specifications. Do not reproduce
every generated window, vehicle, sign, or rooftop object individually. The
implementation should approximate the same hierarchy and atmosphere through
seeded procedural data, shared atlases, instancing, chunk visibility, and a
small number of reviewed exceptions.

When evaluating a visual-detail milestone, compare both camera scales: the
street image tests frontage, lighting, and traversal detail; the rooftop image
tests material variation, roof treatment, skyline legibility, and atmospheric
depth.
