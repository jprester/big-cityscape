"""Audit source building materials, image dependencies, and UV coverage in Blender."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any

import bpy


TARGET_COLLECTIONS = ("residential", "high-rise", "skyscrapers")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    return parser.parse_args(_arguments_after_separator())


def _arguments_after_separator() -> list[str]:
    import sys

    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def hash_file(file_path: Path) -> str:
    digest = hashlib.sha256()
    with file_path.open("rb") as file_handle:
        for block in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def audit_image(image: bpy.types.Image) -> dict[str, Any]:
    raw_path = image.filepath or image.filepath_raw or ""
    absolute_path = bpy.path.abspath(raw_path) if raw_path else ""
    path = Path(absolute_path) if absolute_path else None
    packed = bool(getattr(image, "packed_file", None)) or bool(
        getattr(image, "packed_files", ())
    )
    requires_external_file = bool(raw_path) and image.source in {
        "FILE",
        "MOVIE",
        "SEQUENCE",
        "TILED",
    }
    exists = path.is_file() if path is not None else False

    return {
        "name": image.name,
        "source": image.source,
        "filepath": raw_path,
        "resolvedPath": absolute_path or None,
        "packed": packed,
        "requiresExternalFile": requires_external_file,
        "fileExists": exists,
        "fileByteLength": path.stat().st_size if exists and path is not None else None,
        "sha256": hash_file(path) if exists and path is not None else None,
        "dimensions": [int(image.size[0]), int(image.size[1])],
        "users": image.users,
        "colorspace": image.colorspace_settings.name,
    }


def audit_material(material: bpy.types.Material) -> dict[str, Any]:
    nodes = list(material.node_tree.nodes) if material.use_nodes and material.node_tree else []
    node_type_counts: dict[str, int] = {}
    image_nodes: list[dict[str, Any]] = []
    principled_links: list[dict[str, Any]] = []

    for node in nodes:
        node_type_counts[node.bl_idname] = node_type_counts.get(node.bl_idname, 0) + 1

        if isinstance(node, bpy.types.ShaderNodeTexImage):
            image_nodes.append(
                {
                    "node": node.name,
                    "image": node.image.name if node.image else None,
                    "interpolation": node.interpolation,
                    "projection": node.projection,
                    "extension": node.extension,
                }
            )

        if isinstance(node, bpy.types.ShaderNodeBsdfPrincipled):
            for socket in node.inputs:
                if not socket.is_linked:
                    continue
                link = socket.links[0]
                principled_links.append(
                    {
                        "input": socket.name,
                        "fromNode": link.from_node.name,
                        "fromNodeType": link.from_node.bl_idname,
                        "fromOutput": link.from_socket.name,
                    }
                )

    return {
        "name": material.name,
        "useNodes": material.use_nodes,
        "users": material.users,
        "blendMethod": getattr(material, "surface_render_method", None),
        "nodeCount": len(nodes),
        "nodeTypes": dict(sorted(node_type_counts.items())),
        "imageNodes": sorted(image_nodes, key=lambda item: item["node"]),
        "principledLinks": sorted(
            principled_links, key=lambda item: (item["input"], item["fromNode"])
        ),
    }


def audit_mesh(mesh: bpy.types.Mesh) -> dict[str, Any]:
    uv_layers: list[dict[str, Any]] = []

    for uv_layer in mesh.uv_layers:
        minimum_u = float("inf")
        minimum_v = float("inf")
        maximum_u = float("-inf")
        maximum_v = float("-inf")
        out_of_unit_range = 0
        finite_uvs = 0

        for uv_loop in uv_layer.data:
            u = float(uv_loop.uv.x)
            v = float(uv_loop.uv.y)
            if not (u == u and v == v):
                continue
            finite_uvs += 1
            minimum_u = min(minimum_u, u)
            minimum_v = min(minimum_v, v)
            maximum_u = max(maximum_u, u)
            maximum_v = max(maximum_v, v)
            out_of_unit_range += 0 if 0.0 <= u <= 1.0 and 0.0 <= v <= 1.0 else 1

        bounds = (
            [minimum_u, minimum_v, maximum_u, maximum_v]
            if finite_uvs > 0
            else None
        )
        uv_layers.append(
            {
                "name": uv_layer.name,
                "active": uv_layer == mesh.uv_layers.active,
                "loopCount": len(uv_layer.data),
                "finiteUvCount": finite_uvs,
                "outOfUnitRangeCount": out_of_unit_range,
                "bounds": bounds,
            }
        )

    return {
        "name": mesh.name,
        "users": mesh.users,
        "vertices": len(mesh.vertices),
        "polygons": len(mesh.polygons),
        "loops": len(mesh.loops),
        "materialSlots": [material.name if material else None for material in mesh.materials],
        "uvLayers": uv_layers,
    }


def target_objects() -> list[bpy.types.Object]:
    objects: dict[str, bpy.types.Object] = {}
    for collection_name in TARGET_COLLECTIONS:
        collection = bpy.data.collections.get(collection_name)
        if collection is None:
            continue
        for obj in collection.all_objects:
            objects[obj.name_full] = obj
    return [objects[name] for name in sorted(objects)]


def build_report() -> dict[str, Any]:
    objects = target_objects()
    mesh_objects = [obj for obj in objects if obj.type == "MESH" and obj.data is not None]
    meshes = {obj.data.name_full: obj.data for obj in mesh_objects}
    audited_meshes = [audit_mesh(meshes[name]) for name in sorted(meshes)]
    audited_materials = [audit_material(material) for material in sorted(bpy.data.materials, key=lambda item: item.name)]
    audited_images = [audit_image(image) for image in sorted(bpy.data.images, key=lambda item: item.name)]
    missing_images = [
        image
        for image in audited_images
        if image["requiresExternalFile"]
        and not image["packed"]
        and not image["fileExists"]
    ]
    meshes_with_uvs = sum(1 for mesh in audited_meshes if mesh["uvLayers"])
    materials_with_images = sum(1 for material in audited_materials if material["imageNodes"])

    return {
        "schemaVersion": 1,
        "blendFile": bpy.data.filepath,
        "blenderVersion": bpy.app.version_string,
        "targetCollections": [
            {
                "name": name,
                "exists": bpy.data.collections.get(name) is not None,
                "objectCount": len(bpy.data.collections[name].all_objects)
                if bpy.data.collections.get(name) is not None
                else 0,
            }
            for name in TARGET_COLLECTIONS
        ],
        "summary": {
            "targetObjects": len(objects),
            "meshObjects": len(mesh_objects),
            "uniqueMeshes": len(audited_meshes),
            "meshesWithUvs": meshes_with_uvs,
            "meshesWithoutUvs": len(audited_meshes) - meshes_with_uvs,
            "materials": len(audited_materials),
            "materialsWithImageNodes": materials_with_images,
            "images": len(audited_images),
            "packedImages": sum(1 for image in audited_images if image["packed"]),
            "resolvedExternalImages": sum(
                1
                for image in audited_images
                if image["requiresExternalFile"] and image["fileExists"]
            ),
            "missingExternalImages": len(missing_images),
        },
        "images": audited_images,
        "materials": audited_materials,
        "meshes": audited_meshes,
        "objects": [
            {
                "name": obj.name,
                "type": obj.type,
                "data": obj.data.name if obj.data else None,
                "collections": sorted(collection.name for collection in obj.users_collection),
                "modifiers": [modifier.type for modifier in obj.modifiers],
            }
            for obj in objects
        ],
    }


def main() -> None:
    args = parse_args()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report = build_report()
    output_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    summary = report["summary"]
    print(
        "Texture audit: "
        f"{summary['uniqueMeshes']} meshes, {summary['materials']} materials, "
        f"{summary['images']} images, {summary['missingExternalImages']} missing external images."
    )
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
