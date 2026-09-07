"""Rebuild the generated City Field look-development collection in Blender."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


GENERATED_COLLECTION_NAME = "CITY_GENERATED"
SOURCE_LIBRARY_COLLECTION_NAME = "CITY_SOURCE_LIBRARY"
GENERATED_PREFIX = "CITY::"
SOURCE_COLLECTION_NAMES = ("residential", "commercial", "skyscrapers")
ROAD_HEIGHTS = {"arterial": 0.04, "secondary": 0.025, "local": 0.015}
ROAD_AXIS_OFFSETS = {"north-south": 0.0, "east-west": 0.001, "intersection": 0.002}


def parse_args() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--layout", required=True)
    parser.add_argument("--save", required=True)
    parser.add_argument("--asset-library", required=True)
    parser.add_argument("--preview")
    return parser.parse_args(arguments)


def remove_collection_tree(collection: bpy.types.Collection) -> None:
    for child in list(collection.children):
        remove_collection_tree(child)
    for obj in list(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(collection)


def create_child_collection(
    parent: bpy.types.Collection, name: str
) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    parent.children.link(collection)
    return collection


def create_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
) -> bpy.types.Material:
    existing = bpy.data.materials.get(name)
    if existing is not None:
        bpy.data.materials.remove(existing, do_unlink=True)
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    if principled is not None:
        principled.inputs["Base Color"].default_value = color
        principled.inputs["Roughness"].default_value = roughness
        principled.inputs["Metallic"].default_value = metallic
    return material


def append_box(
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, int, int, int]],
    bounds: dict[str, float],
    base_z: float,
    height: float,
) -> None:
    start = len(vertices)
    min_x, max_x = bounds["minX"], bounds["maxX"]
    min_y, max_y = bounds["minZ"], bounds["maxZ"]
    top_z = base_z + height
    vertices.extend(
        [
            (min_x, min_y, base_z),
            (max_x, min_y, base_z),
            (max_x, max_y, base_z),
            (min_x, max_y, base_z),
            (min_x, min_y, top_z),
            (max_x, min_y, top_z),
            (max_x, max_y, top_z),
            (min_x, max_y, top_z),
        ]
    )
    faces.extend(
        [
            (start, start + 3, start + 2, start + 1),
            (start + 4, start + 5, start + 6, start + 7),
            (start, start + 1, start + 5, start + 4),
            (start + 1, start + 2, start + 6, start + 5),
            (start + 2, start + 3, start + 7, start + 6),
            (start + 3, start, start + 4, start + 7),
        ]
    )


def create_box_batch(
    name: str,
    entries: list[dict],
    bounds_key: str | None,
    base_z: float,
    height: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
) -> bpy.types.Object | None:
    if not entries:
        return None
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for entry in entries:
        bounds = entry if bounds_key is None else entry[bounds_key]
        append_box(vertices, faces, bounds, base_z, height)
    mesh = bpy.data.meshes.new(f"{GENERATED_PREFIX}{name}::mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    mesh.update()
    obj = bpy.data.objects.new(f"{GENERATED_PREFIX}{name}", mesh)
    collection.objects.link(obj)
    return obj


def normalise_source_mesh(
    source: bpy.types.Object, model_id: str, expected_dimensions: dict[str, float]
) -> bpy.types.Mesh:
    if source.type != "MESH":
        raise RuntimeError(f"Expected {source.name} to be a mesh, got {source.type}")
    if model_id.startswith("approved-"):
        previous_scene = bpy.context.window.scene
        try:
            bpy.context.window.scene = bpy.data.scenes["EXPORT / Approved buildings"]
            bpy.context.view_layer.update()
            depsgraph = bpy.context.evaluated_depsgraph_get()
            mesh = bpy.data.meshes.new_from_object(
                source.evaluated_get(depsgraph),
                preserve_all_data_layers=True,
                depsgraph=depsgraph,
            )
        finally:
            bpy.context.window.scene = previous_scene
    else:
        mesh = source.data.copy()
    mesh.name = f"{GENERATED_PREFIX}model::{model_id}"
    # Disabled source collections report identity matrix_world and matrix_local
    # values after a saved lookdev file is reopened. matrix_basis retains the
    # actual authored location/rotation/scale, so reconstruct the transform from
    # those persistent values (and parent-inverse matrices) explicitly.
    authored_matrix = persistent_object_matrix(source)
    mesh.transform(authored_matrix)
    dimensions = mesh_dimensions(mesh)
    correction = Matrix.Diagonal(
        Vector(
            (
                expected_dimensions["width"] / dimensions.x,
                expected_dimensions["depth"] / dimensions.y,
                expected_dimensions["height"] / dimensions.z,
                1.0,
            )
        )
    )
    mesh.transform(correction)
    coordinates = [vertex.co for vertex in mesh.vertices]
    minimum = Vector(
        (
            min(point.x for point in coordinates),
            min(point.y for point in coordinates),
            min(point.z for point in coordinates),
        )
    )
    maximum = Vector(
        (
            max(point.x for point in coordinates),
            max(point.y for point in coordinates),
            max(point.z for point in coordinates),
        )
    )
    offset = Vector(
        (
            -(minimum.x + maximum.x) / 2,
            -(minimum.y + maximum.y) / 2,
            -minimum.z,
        )
    )
    mesh.transform(Matrix.Translation(offset))
    mesh.update()
    return mesh


def mesh_dimensions(mesh: bpy.types.Mesh) -> Vector:
    coordinates = [vertex.co for vertex in mesh.vertices]
    minimum = Vector(
        (
            min(point.x for point in coordinates),
            min(point.y for point in coordinates),
            min(point.z for point in coordinates),
        )
    )
    maximum = Vector(
        (
            max(point.x for point in coordinates),
            max(point.y for point in coordinates),
            max(point.z for point in coordinates),
        )
    )
    return maximum - minimum


def persistent_object_matrix(source: bpy.types.Object) -> Matrix:
    local_matrix = source.matrix_basis.copy()
    if source.parent is None:
        return local_matrix
    return (
        persistent_object_matrix(source.parent)
        @ source.matrix_parent_inverse
        @ local_matrix
    )


def add_buildings(
    buildings: list[dict],
    collection: bpy.types.Collection,
    source_objects: dict[str, bpy.types.Object],
) -> tuple[int, int]:
    mesh_by_model_id: dict[str, bpy.types.Mesh] = {}
    source_by_model_id: dict[str, str] = {}
    for building in buildings:
        model_id = building["modelId"]
        source_name = building["sourceObject"]
        previous_source = source_by_model_id.get(model_id)
        if previous_source is not None and previous_source != source_name:
            raise RuntimeError(f"Model {model_id} has conflicting Blender sources")
        source_by_model_id[model_id] = source_name
        if model_id not in mesh_by_model_id:
            source = source_objects.get(source_name)
            if source is None:
                raise RuntimeError(
                    f"Authoritative Blender library is missing source object: {source_name}"
                )
            mesh_by_model_id[model_id] = normalise_source_mesh(
                source, model_id, building["sourceDimensionsMetres"]
            )

        position_x, position_y, position_z = building["positionMetres"]
        obj = bpy.data.objects.new(
            f"{GENERATED_PREFIX}building::{building['id']}",
            mesh_by_model_id[model_id],
        )
        obj.location = (position_x, position_z, position_y)
        obj.rotation_euler = (0.0, 0.0, -building["rotationRadians"])
        obj.scale = (1.0, 1.0, 1.0)
        obj["city_placement_id"] = building["id"]
        obj["city_model_id"] = model_id
        obj["city_pack_id"] = building["packId"]
        collection.objects.link(obj)
    return len(buildings), len(mesh_by_model_id)


def linked_source_objects(asset_library_path: Path) -> dict[str, bpy.types.Object]:
    root = bpy.data.collections.get(SOURCE_LIBRARY_COLLECTION_NAME)
    if root is None:
        with bpy.data.libraries.load(str(asset_library_path), link=True) as (
            data_from,
            data_to,
        ):
            missing = sorted(set(SOURCE_COLLECTION_NAMES) - set(data_from.collections))
            if missing:
                raise RuntimeError(
                    "Authoritative asset library is missing collections: "
                    + ", ".join(missing)
                )
            data_to.collections = list(SOURCE_COLLECTION_NAMES)

        root = bpy.data.collections.new(SOURCE_LIBRARY_COLLECTION_NAME)
        bpy.context.scene.collection.children.link(root)
        for collection in data_to.collections:
            if collection is None:
                raise RuntimeError("Blender returned an empty linked source collection")
            root.children.link(collection)

    linked_collections = list(root.children)
    linked_paths = {
        Path(collection.library.filepath).expanduser().resolve()
        for collection in linked_collections
        if collection.library is not None
    }
    if linked_paths != {asset_library_path}:
        raise RuntimeError(
            f"{SOURCE_LIBRARY_COLLECTION_NAME} links {sorted(map(str, linked_paths))}, "
            f"expected only {asset_library_path}"
        )
    linked_names = {collection.name for collection in linked_collections}
    if not set(SOURCE_COLLECTION_NAMES).issubset(linked_names):
        raise RuntimeError(
            f"{SOURCE_LIBRARY_COLLECTION_NAME} is missing linked source collections"
        )

    root.hide_viewport = True
    root.hide_render = True
    sources: dict[str, bpy.types.Object] = {}
    for source_collection in linked_collections:
        for source in source_collection.all_objects:
            if source.name in sources and sources[source.name] != source:
                raise RuntimeError(
                    f"Duplicate authoritative source object name: {source.name}"
                )
            sources[source.name] = source
    return sources


def configure_camera(layout: dict, collection: bpy.types.Collection) -> None:
    camera_definition = layout["camera"]
    camera_data = bpy.data.cameras.new(f"{GENERATED_PREFIX}camera")
    camera_data.lens = 35.0
    camera_data.angle = math.radians(camera_definition["fieldOfViewDegrees"])
    camera_data.clip_start = 1.0
    camera_data.clip_end = 20_000.0
    camera = bpy.data.objects.new(camera_definition["name"], camera_data)
    position_x, position_y, position_z = camera_definition["positionMetres"]
    target_x, target_y, target_z = camera_definition["targetMetres"]
    camera.location = (position_x, position_z, position_y)
    target = Vector((target_x, target_z, target_y))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    collection.objects.link(camera)
    bpy.context.scene.camera = camera


def configure_environment(collection: bpy.types.Collection) -> None:
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 60
    scene.render.image_settings.file_format = "PNG"
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    world = scene.world or bpy.data.worlds.new(f"{GENERATED_PREFIX}world")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background is not None:
        background.inputs["Color"].default_value = (0.008, 0.018, 0.035, 1.0)
        background.inputs["Strength"].default_value = 0.12

    sun_data = bpy.data.lights.new(f"{GENERATED_PREFIX}sun", "SUN")
    sun_data.energy = 1.4
    sun_data.angle = math.radians(8)
    sun = bpy.data.objects.new(f"{GENERATED_PREFIX}sun", sun_data)
    sun.rotation_euler = (math.radians(32), 0.0, math.radians(-35))
    collection.objects.link(sun)


def hide_source_asset_collections() -> None:
    for name in ("residential", "commercial", "skyscrapers"):
        collection = bpy.data.collections.get(name)
        if collection is not None:
            collection.hide_viewport = True
            collection.hide_render = True


def main() -> None:
    args = parse_args()
    layout_path = Path(args.layout).expanduser().resolve()
    save_path = Path(args.save).expanduser().resolve()
    asset_library_path = Path(args.asset_library).expanduser().resolve()
    if not asset_library_path.is_file():
        raise RuntimeError(
            f"Authoritative asset library does not exist: {asset_library_path}"
        )
    layout = json.loads(layout_path.read_text(encoding="utf-8"))
    if layout.get("schemaVersion") != 1:
        raise RuntimeError("Unsupported City Field look-development layout schema")
    source_objects = linked_source_objects(asset_library_path)
    approved = bpy.data.collections.get("EXPORT_APPROVED_BUILDINGS")
    if approved is not None:
        source_objects.update({obj.name: obj for obj in approved.objects})
    missing = sorted({
        building["sourceObject"] for building in layout["buildings"]
        if building["sourceObject"] not in source_objects
    })
    if missing:
        raise RuntimeError(f"Missing building sources before city rebuild: {missing}")

    existing = bpy.data.collections.get(GENERATED_COLLECTION_NAME)
    if existing is not None:
        remove_collection_tree(existing)
    for mesh in list(bpy.data.meshes):
        if mesh.name.startswith(GENERATED_PREFIX) and mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for material in list(bpy.data.materials):
        if material.name.startswith(GENERATED_PREFIX) and material.users == 0:
            bpy.data.materials.remove(material)

    root = bpy.data.collections.new(GENERATED_COLLECTION_NAME)
    bpy.context.scene.collection.children.link(root)
    buildings_collection = create_child_collection(root, "Buildings")
    roads_collection = create_child_collection(root, "Roads")
    blocks_collection = create_child_collection(root, "Blocks")
    sidewalks_collection = create_child_collection(root, "Sidewalks")
    parks_collection = create_child_collection(root, "Parks")
    environment_collection = create_child_collection(root, "Environment")

    ground_material = create_material(
        f"{GENERATED_PREFIX}ground", (0.012, 0.02, 0.028, 1.0), 0.92
    )
    road_materials = {
        "arterial": create_material(
            f"{GENERATED_PREFIX}road::arterial", (0.025, 0.035, 0.045, 1.0), 0.88
        ),
        "secondary": create_material(
            f"{GENERATED_PREFIX}road::secondary", (0.035, 0.048, 0.06, 1.0), 0.9
        ),
        "local": create_material(
            f"{GENERATED_PREFIX}road::local", (0.045, 0.058, 0.068, 1.0), 0.92
        ),
    }
    block_material = create_material(
        f"{GENERATED_PREFIX}block", (0.16, 0.18, 0.19, 1.0), 0.78
    )
    sidewalk_material = create_material(
        f"{GENERATED_PREFIX}sidewalk", (0.32, 0.35, 0.36, 1.0), 0.82
    )
    lawn_material = create_material(
        f"{GENERATED_PREFIX}lawn", (0.055, 0.18, 0.09, 1.0), 0.96
    )
    path_material = create_material(
        f"{GENERATED_PREFIX}park-path", (0.36, 0.33, 0.25, 1.0), 0.9
    )

    create_box_batch(
        "ground",
        [layout["city"]["bounds"]],
        None,
        -0.12,
        0.1,
        ground_material,
        environment_collection,
    )
    for hierarchy, material in road_materials.items():
        for axis, layer_offset in ROAD_AXIS_OFFSETS.items():
            create_box_batch(
                f"roads::{hierarchy}::{axis}",
                [
                    road
                    for road in layout["roads"]
                    if road["hierarchyId"] == hierarchy and road["axis"] == axis
                ],
                "bounds",
                0.0,
                ROAD_HEIGHTS[hierarchy] + layer_offset,
                material,
                roads_collection,
            )
    create_box_batch(
        "blocks",
        layout["blocks"],
        "bounds",
        0.0,
        0.15,
        block_material,
        blocks_collection,
    )
    create_box_batch(
        "sidewalks",
        layout["sidewalks"],
        "bounds",
        0.15,
        0.08,
        sidewalk_material,
        sidewalks_collection,
    )
    create_box_batch(
        "park-lawns",
        layout["parks"],
        "bounds",
        0.15,
        0.08,
        lawn_material,
        parks_collection,
    )
    park_paths: list[dict] = []
    for park in layout["parks"]:
        bounds = park["bounds"]
        width = bounds["maxX"] - bounds["minX"]
        depth = bounds["maxZ"] - bounds["minZ"]
        center_x = (bounds["minX"] + bounds["maxX"]) / 2
        center_z = (bounds["minZ"] + bounds["maxZ"]) / 2
        path_width = min(5.0, min(width, depth) * 0.08)
        park_paths.extend(
            [
                {
                    "minX": center_x - width * 0.41,
                    "maxX": center_x + width * 0.41,
                    "minZ": center_z - path_width / 2,
                    "maxZ": center_z + path_width / 2,
                },
                {
                    "minX": center_x - path_width / 2,
                    "maxX": center_x + path_width / 2,
                    "minZ": center_z - depth * 0.41,
                    "maxZ": center_z + depth * 0.41,
                },
            ]
        )
    create_box_batch(
        "park-paths",
        park_paths,
        None,
        0.23,
        0.035,
        path_material,
        parks_collection,
    )

    building_count, model_count = add_buildings(
        layout["buildings"], buildings_collection, source_objects
    )
    configure_camera(layout, environment_collection)
    configure_environment(environment_collection)
    hide_source_asset_collections()
    bpy.context.scene["city_layout_file"] = str(layout_path)
    bpy.context.scene["city_asset_library"] = str(asset_library_path)
    bpy.context.scene["city_seed"] = layout["city"]["seed"]
    bpy.context.scene["city_building_count"] = building_count
    bpy.context.scene["city_model_count"] = model_count
    bpy.context.scene["city_unfilled_building_count"] = layout["summary"][
        "unfilledBuildingCount"
    ]

    save_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(save_path))
    if args.preview:
        preview_path = Path(args.preview).expanduser().resolve()
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        bpy.context.scene.render.filepath = str(preview_path)
        bpy.ops.render.render(write_still=True)
        print(f"Rendered {preview_path}")
    print(
        f"Saved {save_path} with {building_count} buildings sharing "
        f"{model_count} normalised meshes."
    )


main()
