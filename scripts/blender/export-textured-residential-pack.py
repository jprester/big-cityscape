"""Export the textured residential Blender collection as one runtime GLB pack.

The source file intentionally remains untouched. Each mesh is duplicated,
normalised around the origin, and exported while retaining UVs and materials.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Vector


EXISTING_ASSET_IDS = {
    "residential-lp-3.002": "residential-3",
    "residential-lp-5.002": "residential-5",
    "residential-lp-6.002": "residential-6",
    "residential-lp-7.002": "residential-7",
    "residential-lp-8.002": "residential-8",
    "residential-lp-9-mat": "residential-9",
    "residential-lp-10-mat": "residential-10",
    "residential-lp-18.002": "residential-18",
    "residential-lp-20.002": "residential-20",
    "residential-lp-23.002": "residential-23",
    "residential-lp-24.002": "residential-24",
    "residential-lp-25.001": "residential-25",
    "residential-lp-26.002": "residential-26",
    "residential-lp-28.002": "residential-28",
    "residential-lp-30.002": "residential-30",
}

NEW_ASSET_IDS = {
    "BUILDING_standardSurface1_0": "residential-pilot-asian-a",
    "BUILDING_standardSurface1_0.001": "residential-pilot-asian-b",
    "BUILDING_standardSurface1_0.002": "residential-pilot-asian-c",
    "RES_04.001": "residential-pilot-04",
    "RES_05.001": "residential-pilot-05",
    "RES_06.001": "residential-pilot-06",
    "RES_07.001": "residential-pilot-07",
    "RES_08.001": "residential-pilot-08",
    "RES_09.001": "residential-pilot-09",
    "RES_10": "residential-pilot-10",
}

ASSET_IDS = {**EXISTING_ASSET_IDS, **NEW_ASSET_IDS}


def arguments_after_separator() -> list[str]:
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--texture-search-root", action="append", default=[])
    parser.add_argument("--high-rise-emissive", required=True)
    return parser.parse_args(arguments_after_separator())


def sha256_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def relink_external_images(search_roots: list[Path]) -> list[dict[str, str]]:
    by_filename: dict[str, Path] = {}
    for root in search_roots:
        if not root.is_dir():
            continue
        for candidate in root.rglob("*"):
            if candidate.is_file() and candidate.name not in by_filename:
                by_filename[candidate.name] = candidate

    unresolved: list[str] = []
    resolved: list[dict[str, str]] = []
    for image in bpy.data.images:
        if image.source != "FILE" or image.packed_file is not None:
            continue
        original = image.filepath or image.filepath_raw
        if original and Path(bpy.path.abspath(original)).is_file():
            continue
        filename = Path(original).name if original else ""
        candidate = by_filename.get(filename)
        if candidate is None:
            unresolved.append(f"{image.name}: {filename or '<no path>'}")
            continue
        image.filepath = str(candidate)
        image.reload()
        resolved.append({"image": image.name, "path": str(candidate)})

    if unresolved:
        raise RuntimeError(
            "Could not resolve external Blender images:\n" + "\n".join(unresolved)
        )
    return resolved


def override_high_rise_emissive(image_path: Path) -> list[dict[str, str]]:
    if not image_path.is_file():
        raise RuntimeError(f"High-rise emissive override does not exist: {image_path}")

    override_image = bpy.data.images.load(str(image_path), check_existing=False)
    override_image.name = "runtime-high-rise-emissive"
    override_image.colorspace_settings.name = "sRGB"
    applied: list[dict[str, str]] = []

    for material in bpy.data.materials:
        if not material.name.startswith("MAT_High-rise1_Atlas"):
            continue
        if material.node_tree is None:
            raise RuntimeError(f"High-rise material has no node tree: {material.name}")

        material_applied = False
        for node in material.node_tree.nodes:
            if not isinstance(node, bpy.types.ShaderNodeBsdfPrincipled):
                continue
            emission_input = node.inputs.get("Emission Color")
            if emission_input is None or not emission_input.is_linked:
                continue
            for link in emission_input.links:
                if not isinstance(link.from_node, bpy.types.ShaderNodeTexImage):
                    continue
                link.from_node.image = override_image
                applied.append(
                    {
                        "material": material.name,
                        "node": link.from_node.name,
                        "image": image_path.name,
                    }
                )
                material_applied = True

        if not material_applied:
            raise RuntimeError(
                f"Could not find a directly linked emissive image in {material.name}"
            )

    if not applied:
        raise RuntimeError("No MAT_High-rise1_Atlas materials accepted the emissive override")
    return applied


def normalise_duplicate(source: bpy.types.Object, asset_id: str) -> bpy.types.Object:
    duplicate = source.copy()
    duplicate.data = source.data.copy()
    duplicate.name = asset_id
    duplicate.data.name = f"{asset_id}-geometry"
    export_collection.objects.link(duplicate)

    world_matrix = source.matrix_world.copy()
    for vertex in duplicate.data.vertices:
        vertex.co = world_matrix @ vertex.co

    corners = [world_matrix @ Vector(corner) for corner in source.bound_box]
    minimum = Vector((
        min(point.x for point in corners),
        min(point.y for point in corners),
        min(point.z for point in corners),
    ))
    maximum = Vector((
        max(point.x for point in corners),
        max(point.y for point in corners),
        max(point.z for point in corners),
    ))
    offset = Vector((-(minimum.x + maximum.x) / 2, -(minimum.y + maximum.y) / 2, -minimum.z))
    for vertex in duplicate.data.vertices:
        vertex.co += offset

    duplicate.matrix_world = Matrix.Identity(4)
    return duplicate


def object_manifest(source: bpy.types.Object, duplicate: bpy.types.Object, asset_id: str) -> dict:
    coordinates = [vertex.co for vertex in duplicate.data.vertices]
    minimum = Vector((
        min(point.x for point in coordinates),
        min(point.y for point in coordinates),
        min(point.z for point in coordinates),
    ))
    maximum = Vector((
        max(point.x for point in coordinates),
        max(point.y for point in coordinates),
        max(point.z for point in coordinates),
    ))
    dimensions = maximum - minimum
    triangles = sum(max(0, len(polygon.vertices) - 2) for polygon in duplicate.data.polygons)
    return {
        "id": asset_id,
        "sourceObject": source.name,
        "catalogueStatus": "existing" if source.name in EXISTING_ASSET_IDS else "pilot-new",
        "knownCatalogAssetId": EXISTING_ASSET_IDS.get(source.name),
        "dimensionsMetres": {
            "width": round(float(dimensions.x), 4),
            "height": round(float(dimensions.z), 4),
            "depth": round(float(dimensions.y), 4),
        },
        "vertices": len(duplicate.data.vertices),
        "triangles": triangles,
        "uvLayers": [layer.name for layer in duplicate.data.uv_layers],
        "materials": [material.name for material in duplicate.data.materials if material],
    }


args = parse_args()
output_path = Path(args.output).resolve()
manifest_path = Path(args.manifest).resolve()
output_path.parent.mkdir(parents=True, exist_ok=True)
manifest_path.parent.mkdir(parents=True, exist_ok=True)

resolved_images = relink_external_images(
    [Path(root).expanduser().resolve() for root in args.texture_search_root]
)
high_rise_emissive_path = Path(args.high_rise_emissive).expanduser().resolve()
texture_overrides = override_high_rise_emissive(high_rise_emissive_path)

missing_objects = sorted(set(ASSET_IDS) - set(bpy.data.objects.keys()))
if missing_objects:
    raise RuntimeError("Missing expected source objects: " + ", ".join(missing_objects))

export_collection = bpy.data.collections.new("runtime-textured-residential-pack")
bpy.context.scene.collection.children.link(export_collection)

exported_objects: list[bpy.types.Object] = []
models: list[dict] = []
for source_name, asset_id in sorted(ASSET_IDS.items(), key=lambda item: item[1]):
    source = bpy.data.objects[source_name]
    if source.type != "MESH":
        raise RuntimeError(f"Expected {source_name} to be a mesh, got {source.type}")
    duplicate = normalise_duplicate(source, asset_id)
    exported_objects.append(duplicate)
    models.append(object_manifest(source, duplicate, asset_id))

bpy.ops.object.select_all(action="DESELECT")
for exported_object in exported_objects:
    exported_object.select_set(True)
bpy.context.view_layer.objects.active = exported_objects[0]

bpy.ops.export_scene.gltf(
    filepath=str(output_path),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_tangents=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)

manifest = {
    "schemaVersion": 1,
    "sourceBlend": Path(bpy.data.filepath).name,
    "sourceSha256": sha256_file(Path(bpy.data.filepath)),
    "packSha256": sha256_file(output_path),
    "packFile": output_path.name,
    "modelCount": len(models),
    "existingModelCount": len(EXISTING_ASSET_IDS),
    "pilotModelCount": len(NEW_ASSET_IDS),
    "resolvedExternalImageCount": len(resolved_images),
    "textureOverrides": {
        "highRiseEmissive": {
            "file": high_rise_emissive_path.name,
            "sha256": sha256_file(high_rise_emissive_path),
            "appliedTo": texture_overrides,
        }
    },
    "models": sorted(models, key=lambda model: model["id"]),
}
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

print(
    f"Exported {len(models)} textured residential models to {output_path} "
    f"({output_path.stat().st_size / 1024 / 1024:.1f} MiB)."
)
print(f"Wrote {manifest_path}.")
