"""Texture-first revision of the single residential study; no runtime changes."""
import argparse
import importlib.util
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('study', Path(__file__).with_name('create-residential-lookdev.py'))
study = importlib.util.module_from_spec(spec)
spec.loader.exec_module(study)


def facade_material(path):
    mat = study.material('V2 / textured charcoal facade', (0.15, 0.16, 0.17), 0.65)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(str(path), check_existing=True)
    tex.image.pack()
    tex.extension = 'REPEAT'
    tex.label = 'Generated orthographic facade / eight floors and eight bays'
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
    # The atlas has neutral cladding. Red-minus-blue isolates warm interiors,
    # preserving curtains, shadows and small lamps instead of filling windows.
    channels = nodes.new('ShaderNodeSeparateColor')
    links.new(tex.outputs['Color'], channels.inputs['Color'])
    warmth = nodes.new('ShaderNodeMath')
    warmth.operation = 'SUBTRACT'
    links.new(channels.outputs['Red'], warmth.inputs[0])
    links.new(channels.outputs['Blue'], warmth.inputs[1])
    mask = nodes.new('ShaderNodeMapRange')
    mask.clamp = True
    mask.inputs['From Min'].default_value = 0.012
    mask.inputs['From Max'].default_value = 0.16
    mask.inputs['To Max'].default_value = 2.8
    links.new(warmth.outputs[0], mask.inputs['Value'])
    links.new(mask.outputs['Result'], bsdf.inputs['Emission Strength'])
    return mat


class Shell(study.MeshBuilder):
    def __init__(self, materials):
        super().__init__('RES02 / textured low-poly shell', materials)
        self.uvs = []

    def face(self, points, mat):
        super().face(points, mat)
        self.uvs.append([(0, 0), (1, 0), (1, 1), (0, 1)])

    def volume(self, center, size, bays, floors, offset=0):
        start = len(self.faces)
        self.box(center, size, 0)
        for side in range(4):
            u = (side * 2) / 8
            v = (offset + side * 2) / 8
            w, h = bays[side % 2] / 8, floors / 8
            self.uvs[start + side] = [(u, v), (u+w, v), (u+w, v+h), (u, v+h)]
        self.indices[start+4] = self.indices[start+5] = 1

    def build(self, collection):
        obj = super().build(collection)
        layer = obj.data.uv_layers.new(name='Facade metres / 3.2m modules')
        for polygon, coords in zip(obj.data.polygons, self.uvs):
            for loop, uv in zip(polygon.loop_indices, coords):
                layer.data[loop].uv = uv
        return obj


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--renders', required=True)
    parser.add_argument('--texture', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    output, renders = Path(args.output).resolve(), Path(args.renders).resolve()
    if output == Path(bpy.data.filepath).resolve():
        raise RuntimeError('Output must be a separate copy.')
    if bpy.data.collections.get('LOOKDEV_EXPERIMENTS'):
        raise RuntimeError('Input already contains studies; use the original city lookdev.')
    collection = bpy.data.collections.new('LOOKDEV_EXPERIMENTS')
    bpy.context.scene.collection.children.link(collection)
    mats = [facade_material(Path(args.texture).resolve()),
            study.material('V2 / roof and plinth', (0.055, 0.065, 0.075), 0.8),
            study.material('V2 / dark metal', (0.08, 0.095, 0.11), 0.4, 0.35)]
    shell = Shell(mats)
    shell.box((0, 0, 0.3), (29, 23, 0.6), 1)
    # Three simple masses: low base, main shaft, offset upper volume.
    shell.volume((0, 0, 3.8), (28.8, 22.4, 6.4), (9, 7), 2)
    shell.volume((0, 0, 45.4), (25.6, 19.2, 76.8), (8, 6), 24, 2)
    shell.volume((-3.2, 0, 96.6), (19.2, 19.2, 25.6), (6, 6), 8, 5)
    # Flat caps and one compact service enclosure; no rail crown or facade ribs.
    shell.box((0, 0, 83.95), (25.8, 19.4, 0.3), 2)
    shell.box((-3.2, 0, 109.55), (19.4, 19.4, 0.3), 2)
    shell.box((-3.2, 2, 110.6), (7, 6, 1.8), 1)
    shell.box((0, -12, 3.8), (8, 2.4, 0.25), 2)
    obj = shell.build(collection)
    obj['design'] = 'Simple stepped charcoal residence / texture-first revision'
    obj['texture_source'] = 'Built-in imagegen; packed facade.png'
    triangles = sum(len(p.vertices)-2 for p in obj.data.polygons)
    assert triangles <= 120
    assert all(math.isfinite(c) for v in obj.data.vertices for c in v.co)
    assert len(obj.data.uv_layers.active.data) == len(obj.data.loops)
    renders.mkdir(parents=True, exist_ok=True)
    day = study.review_scene('RES02 • Day', collection, False)
    night = study.review_scene('RES02 • Night', collection, True)
    close = study.review_scene('RES02 • Facade detail', collection, True)
    close.camera.location = study.ORIGIN + Vector((33, -49, 63))
    study.aim(close.camera, study.ORIGIN + Vector((0, -5, 59)))
    close.camera.data.lens = 65
    scenes = [(day, 'day'), (night, 'night'), (close, 'detail')]
    for scene, label in scenes:
        scene.render.filepath = str(renders / f'residential-02-{label}.png')
    bpy.context.window.scene = night
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.shading.type = 'MATERIAL'
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    report = {'triangles': triangles, 'meshObjects': 1, 'materialSlots': 3,
              'textureSize': list(mats[0].node_tree.nodes.get('Image Texture').image.size),
              'texturePacked': True, 'heightMetres': max(v.co.z for v in obj.data.vertices),
              'limitations': ['Baked window depth has no parallax', 'Eight-floor texture repeat',
                              'Emission derived in Blender shader; export requires baking']}
    (renders/'report.json').write_text(json.dumps(report, indent=2)+'\n')
    print('TEXTURE_STUDY '+json.dumps(report), flush=True)
    for scene, label in scenes:
        bpy.ops.render.render(write_still=True, scene=scene.name)


if __name__ == '__main__':
    main()
