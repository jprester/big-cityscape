"""Read-only snapshot of the authored city; retains evaluated instance geometry."""
import bpy
import argparse
import hashlib
import json
import sys
from pathlib import Path
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--output-directory', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
out = Path(args.output_directory)
out.mkdir(parents=True, exist_ok=True)
city = bpy.data.scenes['City']
bpy.context.window.scene = city
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
placements = sorted(bpy.data.collections['CITY_BUILDINGS'].objects, key=lambda o:o.name)
conversion = Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
inverse = conversion.inverted()

def flat(matrix):
    return [float(matrix[row][col]) for col in range(4) for row in range(4)]

def fingerprint(mesh):
    data = {
        'vertices':[list(v.co) for v in mesh.vertices],
        'faces':[(list(p.vertices),p.material_index,p.use_smooth) for p in mesh.polygons],
        'uv':[[list(v.uv) for v in layer.data] for layer in mesh.uv_layers],
        'materials':[m.name if m else None for m in mesh.materials],
        'normals':[list(n.vector) for n in mesh.corner_normals],
    }
    return hashlib.sha256(json.dumps(data,separators=(',',':')).encode()).hexdigest()

blocks = []
for obj in sorted(bpy.data.collections['CITY_BLOCKS'].objects,key=lambda o:o.name):
    points = [conversion @ (obj.matrix_world @ v.co) for v in obj.data.vertices[:4]]
    blocks.append({'id':obj['authoring_block_id'],'footprintXZ':[[p.x,p.z] for p in points]})
def contains(point, polygon):
    x,z = point
    inside = False
    for a,b in zip(polygon, polygon[1:]+polygon[:1]):
        if (a[1] > z) != (b[1] > z):
            crossing = (b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]
            if x < crossing: inside = not inside
    return inside

meshes = {}
models = []
instances = []
ids = set()
for obj in placements:
    assert obj.type == 'MESH', f'Unsupported placement: {obj.name}'
    evaluated = obj.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=depsgraph)
    digest = fingerprint(mesh)
    model_id = 'reviewed-' + digest[:20]
    if model_id not in meshes:
        meshes[model_id] = mesh
        models.append({'id':model_id,'triangles':sum(len(p.vertices)-2 for p in mesh.polygons)})
    else:
        bpy.data.meshes.remove(mesh)
    instance_id = obj.get('authoring_instance_id') or 'instance-' + hashlib.sha256(obj.name.encode()).hexdigest()[:16]
    if instance_id in ids:
        instance_id += '-' + hashlib.sha256(obj.name.encode()).hexdigest()[:12]
    assert instance_id not in ids
    ids.add(instance_id)
    world = evaluated.matrix_world.copy()
    runtime = conversion @ world @ inverse
    # Verify the exported geometry basis and placement basis agree.
    for point in (Vector((0,0,0)),Vector((1,2,3))):
        assert ((runtime @ (conversion @ point))-(conversion @ (world @ point))).length < .001
    points = [conversion @ (world @ Vector(p)) for p in evaluated.bound_box]
    centre = ((min(p.x for p in points)+max(p.x for p in points))/2,(min(p.z for p in points)+max(p.z for p in points))/2)
    matches = [b['id'] for b in blocks if contains(centre,b['footprintXZ'])]
    parent_block = obj.parent.get('authoring_block_id') if obj.parent else None
    block_id = parent_block if parent_block in matches else matches[0] if len(matches)==1 else None
    instances.append({'id':instance_id,'name':obj.name,'modelId':model_id,'libraryAssetId':obj.get('authoring_asset_id'),'blockId':block_id,'matrix':flat(runtime)})
assert len({b['id'] for b in blocks}) == len(blocks)
assert all(i['blockId'] is None or i['blockId'] in {b['id'] for b in blocks} for i in instances)
scene = bpy.data.scenes.new('TEMP_REVIEWED_EXPORT')
bpy.context.window.scene = scene
for model_id, mesh in meshes.items():
    obj = bpy.data.objects.new(model_id,mesh)
    scene.collection.objects.link(obj)
    obj.select_set(True)
bpy.context.view_layer.objects.active = next(iter(scene.objects))
pack = out/'reviewed-city-buildings.glb'
bpy.ops.export_scene.gltf(filepath=str(pack),export_format='GLB',use_active_scene=True,use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
layout={'schemaVersion':1,'sourceBlend':Path(bpy.data.filepath).name,'sourceSha256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),'coordinateSystem':'metres; Three.js X/Y-up/Z; Blender (x,y,z) maps to (x,z,-y); column-major matrices','packFile':pack.name,'packSha256':hashlib.sha256(pack.read_bytes()).hexdigest(),'models':models,'blocks':blocks,'instances':instances,'unassignedInstances':[i['id'] for i in instances if i['blockId'] is None]}
(out/'reviewed-city.json').write_text(json.dumps(layout,indent=2)+'\n')
print('REVIEWED_EXPORT',len(models),'unique meshes,',len(instances),'instances,',len(blocks),'blocks')
