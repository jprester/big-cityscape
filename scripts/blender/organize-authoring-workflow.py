"""Organize the saved master without rebuilding the reviewed city."""
import bpy
import json
import hashlib
import shutil
from datetime import datetime
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
path = Path(bpy.data.filepath)
stamp = path.stat().st_mtime_ns
assert path.name == '2026-city-lookdev.blend'
assert 'City' not in bpy.data.scenes, 'Already organized; do not repeat migration'
city = bpy.data.scenes['Scene']
bpy.context.window.scene = city
bpy.context.view_layer.update()

def matrix(obj):
    if obj.parent is None:
        return obj.matrix_basis.copy()
    return matrix(obj.parent) @ obj.matrix_parent_inverse @ obj.matrix_basis

def link(collection, obj):
    if obj.name not in collection.objects:
        collection.objects.link(obj)

def new_collection(name, parent):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c

# Only known placement collections and direct building meshes belong to the city.
placements = list(bpy.data.collections['Buildings'].objects)
placements += list(bpy.data.collections['CITY_REVIEW_ADDITIONS'].objects)
placements += [o for o in city.collection.objects if o.type == 'MESH' and o.name.startswith('high-rise-lp-')]
placements = sorted(set(placements), key=lambda o: o.name)
assert all(o.type == 'MESH' for o in placements)
before = {o: matrix(o) for o in placements}
archive = bpy.data.scenes.new('Archive / Previous organization')
for c in list(city.collection.children):
    archive.collection.children.link(c)
for o in list(city.collection.objects):
    archive.collection.objects.link(o)

library = bpy.data.collections['ASSET_LIBRARY']
sources = list(library.all_objects)
# One flat collection; no old/new distinction. Historical collection membership
# remains accessible through Archive but is no longer an export selection rule.
for o in sources:
    link(library, o)
for c in list(library.children):
    library.children.unlink(c)
asset_ids = set()
for o in sorted(sources, key=lambda o: o.name):
    asset_id = o.get('runtime_asset_id') or 'building-' + o.name.lower().replace(' ', '-')
    assert asset_id not in asset_ids, f'Duplicate library asset ID: {asset_id}'
    o['runtime_asset_id'] = asset_id
    o['authoring_asset_id'] = asset_id
    asset_ids.add(asset_id)

# Recover a library reference for placed models no longer present in the library.
# Reuse shared meshes first; never infer a new variant solely from a copied ID.
mesh_sources = {}
for o in sources:
    mesh_sources.setdefault(o.data, o)
by_id = {o['authoring_asset_id']: o for o in sources}
recovered = []
for o in placements:
    source = mesh_sources.get(o.data)
    legacy = o.get('runtime_asset_id') or o.get('city_model_id')
    if source is None and legacy in by_id:
        source = by_id[legacy]
    if source is None:
        asset_id = legacy or 'building-' + hashlib.sha256(o.data.name.encode()).hexdigest()[:12]
        if asset_id in asset_ids:
            asset_id += '-' + hashlib.sha256(o.name.encode()).hexdigest()[:8]
        source = o.copy()
        source.name = 'Building / ' + o.name.replace('CITY_REVIEW / ', '')
        source.parent = None
        source.matrix_world = Matrix.Translation(Vector((800 + (len(recovered)%8)*100, (len(recovered)//8)*110, 0)))
        source['runtime_asset_id'] = asset_id
        source['authoring_asset_id'] = asset_id
        source['recovered_from_city'] = o.name
        for key in ('city_placement_id','city_model_id','city_pack_id'):
            if key in source: del source[key]
        library.objects.link(source)
        sources.append(source)
        asset_ids.add(asset_id)
        by_id[asset_id] = source
        mesh_sources[o.data] = source
        recovered.append(source.name)
    o['authoring_asset_id'] = source['authoring_asset_id']
    # Keep raw geometry: this migration is not permission to replace a city mesh.
    o['authoring_geometry_matches_source'] = o.data == source.data

# Keep presentation geometry; archive the model shelves and removed instances.
for c in list(city.collection.children):
    if c.name not in ('CITY_GENERATED', 'Collection', 'city-scene'):
        city.collection.children.unlink(c)
placed = new_collection('CITY_BUILDINGS', city.collection)
for o in placements:
    link(placed, o)
    for c in list(o.users_collection):
        if c != placed:
            c.objects.unlink(o)

# Separate the existing block batch into editable blocks, preserving its mesh
# islands and transforms rather than reconstructing blocks from old JSON.
block_batch = bpy.data.objects['CITY::block'] if 'CITY::block' in bpy.data.objects else bpy.data.objects['CITY::blocks']
verts = block_batch.data.vertices
assert len(verts)%8 == 0
polygons = block_batch.data.polygons
assert len(polygons) == len(verts)//8*6, 'Unexpected block topology; review manually'
block_collection = new_collection('CITY_BLOCKS', city.collection)
block_rows = []
layout = json.loads((ROOT/'references/visual/atlas-shape-study/consolidated-runtime-layout.json').read_text())
used = set()
for index in range(len(verts)//8):
    indices = set(range(index*8,index*8+8))
    faces = [list(p.vertices) for p in polygons[index*6:index*6+6]]
    assert all(set(f)<=indices for f in faces), 'Block vertex ordering changed'
    points = [matrix(block_batch) @ verts[i].co for i in sorted(indices)]
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    centre = (lo+hi)/2
    candidates = [(abs((b['bounds']['minX']+b['bounds']['maxX'])/2-centre.x)+abs((b['bounds']['minZ']+b['bounds']['maxZ'])/2-centre.y), b) for b in layout['blocks'] if b['id'] not in used]
    distance, candidate = min(candidates, key=lambda x:x[0])
    block_id = candidate['id'] if distance < .01 else f'authored-block-{index:04d}'
    used.add(block_id)
    mesh = bpy.data.meshes.new('Block footprint')
    mesh.from_pydata([p-centre for p in points],[],[[v-index*8 for v in f] for f in faces])
    for m in block_batch.data.materials: mesh.materials.append(m)
    obj = bpy.data.objects.new('Block / '+block_id,mesh)
    obj.location = centre
    obj['authoring_block_id'] = block_id
    block_collection.objects.link(obj)
    block_rows.append((obj,lo,hi))
for c in list(block_batch.users_collection): c.objects.unlink(block_batch)
archive.collection.objects.link(block_batch)

seen = set()
outside = []
for o in placements:
    old_id = o.get('city_placement_id')
    instance_id = old_id if old_id and old_id not in seen else 'authored-instance-' + hashlib.sha256(o.name.encode()).hexdigest()[:16]
    assert instance_id not in seen
    seen.add(instance_id)
    o['authoring_instance_id'] = instance_id
    world = before[o]
    points = [world @ Vector(corner) for corner in o.bound_box]
    cx = (min(p.x for p in points)+max(p.x for p in points))/2
    cy = (min(p.y for p in points)+max(p.y for p in points))/2
    matches = [b for b,lo,hi in block_rows if lo.x<=cx<=hi.x and lo.y<=cy<=hi.y]
    if len(matches)==1:
        block = matches[0]
        o.parent = block
        o.matrix_parent_inverse = Matrix.Identity(4)
        o.matrix_basis = matrix(block).inverted() @ world
        o['authoring_block_id'] = block['authoring_block_id']
    else:
        o['authoring_block_id'] = ''
        outside.append(o.name)
    assert max(abs(a-b) for ar,br in zip(matrix(o),world) for a,b in zip(ar,br)) < .0002, o.name

city.name = 'City'
bpy.data.scenes['Asset Library'].name = 'Buildings'
# The redundant export scene shares only the library, so removing the scene
# removes no objects. Existing lighting studies remain accessible.
redundant = bpy.data.scenes.get('EXPORT / Approved buildings')
if redundant: bpy.data.scenes.remove(redundant)
city['authoring_layout_master'] = True
city['authoring_schema_version'] = 1
text = bpy.data.texts.get('START HERE / City workflow') or bpy.data.texts.new('START HERE / City workflow')
text.clear()
text.write('Buildings: finished variants in ASSET_LIBRARY; no old/new split.\nCity: reviewed layout. Move a block to move its child buildings.\nWorkshop: experiments; modeling elsewhere is also fine.\nArchive: preserved previous collections and retired placements.\nEXP scenes: optional material/lighting studies.\nDo not run the legacy city rebuild on this authored City.\nAuthoring IDs are metadata; object names are free to change.\nGeometry is preserved; differing city/source meshes must be resolved by the reviewed exporter, not silently replaced.\n')
bpy.context.window.scene = city
bpy.context.view_layer.update()
assert len(placed.objects) == len(placements)
assert path.stat().st_mtime_ns == stamp, 'File changed during migration; abort'
backup = path.with_suffix('.blend.pre-authoring-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'.bak')
shutil.copy2(path,backup)
bpy.ops.wm.save_as_mainfile(filepath=str(path))
report={'backup':str(backup),'buildings':len(sources),'instances':len(placements),'blocks':len(block_rows),'recoveredSources':recovered,'outsideBlocks':outside,'independentCityGeometry':sum(not o['authoring_geometry_matches_source'] for o in placements)}
(ROOT/'references/visual/atlas-shape-study/authoring-organization.json').write_text(json.dumps(report,indent=2)+'\n')
print('AUTHORING_ORGANIZED',json.dumps(report))
