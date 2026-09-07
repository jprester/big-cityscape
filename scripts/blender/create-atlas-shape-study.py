"""One atlas-based shape study in the user's existing city lookdev file.

Run against 2026-city-lookdev.blend. Default renders without saving; --save
adds the reviewed study in place, using Blender's normal .blend1 backup.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import math
import bpy
from mathutils import Vector

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('presentation', Path(__file__).with_name('create-residential-lookdev.py'))
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)
ROOT = Path(__file__).resolve().parents[2]
ATLAS = Path('/Users/jankoprester/Projects/3d-modeling/blender/textures/generated-textures/generated-texture-atlas/High-Rise_Atlas3')
NAME = 'EXP03 / Chamfered shoulder tower'
# Measured from the Atlas 3 slab's 17.5698 m x 39.632 m facade quad.
DU = (0.8720080853 - 0.7589475513) / 17.569824
DV = (0.9873549938 - 0.7829888463) / 39.631954
FACADE = (0.7589475513, 0.5786225796, 0.9850686193, 0.9873549938)
CONCRETE = (0.881, 0.035, 0.970, 0.125)


def atlas_material():
    mat = bpy.data.materials.new('EXP03 / High-Rise Atlas 3')
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Emission Strength'].default_value = 1.0
    for index, (suffix, socket, color) in enumerate([
        ('diffuse', 'Base Color', 'sRGB'),
        ('roughness', 'Roughness', 'Non-Color'),
        ('emissive', 'Emission Color', 'sRGB'),
    ]):
        path = ATLAS / f'High-Rise_Atlas3_{suffix}.png'
        assert path.is_file(), path
        tex = nodes.new('ShaderNodeTexImage')
        # Independent image datablocks avoid altering source roughness settings.
        tex.image = bpy.data.images.load(str(path), check_existing=False)
        tex.image.colorspace_settings.name = color
        tex.location = (-360, 260-index*260)
        tex.extension = 'EXTEND'
        links.new(tex.outputs['Color'], bsdf.inputs[socket])
    return mat


class Building:
    def __init__(self):
        self.vertices, self.faces, self.uvs = [], [], []

    def face(self, points, uv):
        offset = len(self.vertices)
        self.vertices.extend(points)
        self.faces.append(tuple(range(offset, offset+len(points))))
        self.uvs.append(uv)

    def prism(self, width, depth, chamfer, z0, z1, cx=0, cy=0, facade=True):
        w, d, c = width/2, depth/2, chamfer
        ring = [(-w+c,-d),(w-c,-d),(w,-d+c),(w,d-c),(w-c,d),(-w+c,d),(-w,d-c),(-w,-d+c)] if c else [(-w,-d),(w,-d),(w,d),(-w,d)]
        for i, (x,y) in enumerate(ring):
            xx,yy = ring[(i+1)%len(ring)]
            length = math.hypot(xx-x, yy-y)
            if facade:
                u0,v0,_,v1 = FACADE
                u1 = u0 + length*DU
                v0 = v1 - (z1-z0)*DV
                assert u1 <= FACADE[2]+1e-5 and v0 >= FACADE[1]-1e-5
            else:
                u0,v0,u1,v1 = CONCRETE
            self.face([(x+cx,y+cy,z0),(xx+cx,yy+cy,z0),(xx+cx,yy+cy,z1),(x+cx,y+cy,z1)], [(u0,v0),(u1,v0),(u1,v1),(u0,v1)])
        for z,reverse in [(z1,False),(z0,True)]:
            points=[(x+cx,y+cy,z) for x,y in ring]
            # Keep roofs clear for manually placed equipment; no baked machinery.
            rect = CONCRETE
            u0,v0,u1,v1=rect
            uv=[(u0+(x+w)/width*(u1-u0),v0+(y+d)/depth*(v1-v0)) for x,y in ring]
            self.face(points[::-1] if reverse else points,uv[::-1] if reverse else uv)

    def finish(self, collection, material):
        mesh=bpy.data.meshes.new(NAME)
        mesh.from_pydata(self.vertices,[],self.faces)
        mesh.materials.append(material)
        mesh.update()
        uv=mesh.uv_layers.new(name='Atlas3 / reference-matched density')
        for polygon,coords in zip(mesh.polygons,self.uvs):
            for loop,pair in zip(polygon.loop_indices,coords): uv.data[loop].uv=pair
        obj=bpy.data.objects.new(NAME,mesh)
        collection.objects.link(obj)
        obj.location=stage.ORIGIN
        obj['atlas']='High-Rise_Atlas3'
        obj['comparison']='high-rise-lp-2.002; high-rise-lp-32.002; high-rise-lp-34.002'
        obj['uv_density_per_metre']=[DU,DV]
        obj['study']='EXP03'
        return obj


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--save',action='store_true')
    p.add_argument('--skip-render',action='store_true')
    args=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    path=Path(bpy.data.filepath)
    assert path.name=='2026-city-lookdev.blend', 'Use the existing city lookdev file.'
    original_mtime=path.stat().st_mtime_ns
    if bpy.data.objects.get(NAME): raise RuntimeError('Study already exists: refusing to replace manual edits.')
    original_scene=bpy.context.scene
    original_objects=set(bpy.data.objects)
    root=bpy.data.collections.get('LOOKDEV_EXPERIMENTS')
    if not root:
        root=bpy.data.collections.new('LOOKDEV_EXPERIMENTS')
        original_scene.collection.children.link(root)
    collection=bpy.data.collections.new('EXP03 / Atlas shape study')
    root.children.link(collection)
    b=Building()
    b.prism(38,30,3,0,0.5,facade=False)
    b.prism(35.1396,27.329,3.9044,0.5,8)
    b.prism(35.1396,27.329,3.9044,8,87.2639)
    b.prism(23.4264,23.4264,3.9044,87.2639,126.89585,cx=-5.8566)
    b.prism(23.6264,23.6264,4.0044,126.89585,127.24585,cx=-5.8566,facade=False)
    b.prism(7,6,0,127.24585,129.0,cx=-5.8566,cy=2,facade=False)
    obj=b.finish(collection,atlas_material())
    tri=sum(len(p.vertices)-2 for p in obj.data.polygons)
    assert tri<200 and len(obj.data.materials)==1
    assert all(math.isfinite(v) for vertex in obj.data.vertices for v in vertex.co)
    assert all(0 <= v <= 1 for uv in obj.data.uv_layers.active.data for v in uv.uv)
    renders=ROOT/'references/visual/atlas-shape-study'
    renders.mkdir(parents=True,exist_ok=True)
    scenes=[]
    for night,label in [(False,'Day'),(True,'Night')]:
        scene=stage.review_scene('EXP03 / '+label,collection,night)
        scene.camera.location=stage.ORIGIN+Vector((115,-180,112))
        stage.aim(scene.camera,stage.ORIGIN+Vector((0,0,65)))
        scene.render.filepath=str(renders/f'exp03-{label.lower()}.png')
        scenes.append(scene)
    # Reference copies use the city's authored metre scale and original materials.
    references=bpy.data.collections.new('EXP03 / Existing comparisons')
    root.children.link(references)
    for index,tri_ref in enumerate([116,264]):
        source=next(o for o in original_objects if o.name.startswith('CITY::') and o.type=='MESH' and sum(len(p.vertices)-2 for p in o.data.polygons)==tri_ref and any(s.material and s.material.name.startswith('MAT_High-rise') for s in o.material_slots))
        copy=bpy.data.objects.new('EXP03 / Reference / '+str(tri_ref)+' triangles',source.data.copy())
        points=[source.matrix_world@v.co for v in source.data.vertices]
        lo=Vector(tuple(min(v[a] for v in points) for a in range(3)))
        hi=Vector(tuple(max(v[a] for v in points) for a in range(3)))
        for v,point in zip(copy.data.vertices,points):v.co=point-Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
        copy.location=stage.ORIGIN+Vector(((-75 if index==0 else 75),0,0))
        references.objects.link(copy)
        copy['source_object']=source.name
    comparison=stage.review_scene('EXP03 / Comparison',collection,False)
    comparison.collection.children.link(references)
    comparison.render.resolution_x=1500
    comparison.render.resolution_y=1000
    comparison.camera.location=stage.ORIGIN+Vector((100,-340,175))
    stage.aim(comparison.camera,stage.ORIGIN+Vector((0,0,73)))
    comparison.camera.data.lens=48
    comparison.render.filepath=str(renders/'exp03-comparison.png')
    scenes.append(comparison)
    bpy.context.window.scene=scenes[1]
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_perspective='CAMERA'
                area.spaces.active.shading.type='MATERIAL'
    assert all(o in bpy.data.objects.values() for o in original_objects)
    report={'triangles':tri,'meshObjects':1,'materials':1,'heightMetres':129,'atlas':'High-Rise_Atlas3','uvDensity':[DU,DV], 'originalObjectsRetained':len(original_objects),'savedInPlace':args.save}
    (renders/'exp03-report.json').write_text(json.dumps(report,indent=2)+'\n')
    if args.save:
        assert path.stat().st_mtime_ns==original_mtime, 'File changed during preparation; reload before saving.'
        bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
        bpy.ops.wm.save_as_mainfile(filepath=str(path))
    print('EXP03 '+json.dumps(report),flush=True)
    if not args.skip_render:
        for scene in scenes:bpy.ops.render.render(write_still=True,scene=scene.name)


if __name__=='__main__':main()
