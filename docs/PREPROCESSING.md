# Structural data preprocessing

Milestone 1 converts the smaller Osaka structural GeoJSON into compact,
browser-safe local geometry. The source is structural inspiration for a fictional
city; it is not treated as a simulation target.

## Reproducible command

```sh
npm run preprocess
```

The command reads `references/raw/osaka-structure.geojson` and writes
`references/processed/city-structure.json`. The raw building reference is never
opened by this pipeline.

All preprocessing parameters are declared in `scripts/preprocess/config.ts`.
The output is deterministic and deliberately contains no generation timestamp.

## Source inventory

The current structural export contains 2,613 features:

- 2,340 road features;
- 222 railway lines;
- 41 water polygons;
- 10 waterway centre lines.

Its supported source geometries are `LineString` and `Polygon`. Twenty-eight
pedestrian areas are polygons tagged as highways; they are reported as
unsupported road geometry rather than silently converted to road centre lines.

## Working area

The selected `nakanoshima-umeda` window is centred at:

```text
longitude 135.497° E
latitude   34.6975° N
```

It is 1,800 m east–west by 1,100 m north–south, or 1.98 km². The window includes
the east–west river corridor, dense street structure, and a meaningful group of
rail lines while remaining within the initial 1–2 km² scope.

## Projection and axes

The preprocessor uses a local equirectangular approximation with a fixed mean
Earth radius of 6,371,008.8 m:

```text
x = (longitude - originLongitude) × radiansPerDegree × R × cos(originLatitude)
z = -(latitude - originLatitude) × radiansPerDegree × R
```

Therefore:

- one local unit is one metre;
- positive X points east;
- positive Z points south;
- Y remains available for height;
- the clip centre is exactly `[0, 0]` in the horizontal plane.

This approximation is intended only for the current small local window. It must
be revisited before processing a substantially larger region.

## Geometry handling

- Line strings are clipped segment-by-segment with Liang–Barsky rectangular
  clipping and may produce multiple retained paths.
- Water polygon rings are clipped against the rectangular window with
  Sutherland–Hodgman clipping.
- Repeated polygon closing coordinates are removed.
- Output coordinates are rounded to centimetres.
- Malformed, unsupported, outside, or degenerate features receive explicit
  discard counts.

This is deliberately not a general GIS engine. The current source has no
`MultiLineString` or `MultiPolygon` features, and retained water regions in the
selected clip do not require disconnected polygon results. Future source data
with multipart geometry or complex polygon intersections should be reported and
handled through a focused geometry spike rather than guessed by this pipeline.

## Normalized output

The processed file stores:

- projection, origin, axes, source bounds, clip bounds, and attribution;
- complete retained/discarded source accounting;
- classified road paths with bridge, tunnel, and source-layer metadata;
- railway and waterway paths;
- water-region rings;
- local output bounds.

The browser fetches only this compact output. Debug rendering batches line
segments by road class and layer category rather than creating one Three.js
object for every source feature.
