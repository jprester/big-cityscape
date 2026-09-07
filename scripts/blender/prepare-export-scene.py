"""Create a reviewable export scene from the saved selection plus high-rise-lp-38."""
import bpy,json,sys,importlib.util
from pathlib import Path
from mathutils import Matrix,Vector
sys.dont_write_bytecode=True
root=Path(__file__).resolve().parents[2]
def persistent(o):
 return o.matrix_basis.copy() if o.parent is None else persistent(o.parent)@o.matrix_parent_inverse@o.matrix_basis

path=Path(bpy.data.filepath);assert path.name=='2026-city-lookdev.blend'
stamp=path.stat().st_mtime_ns
assert not bpy.data.scenes.get('EXPORT / Approved buildings'),'Export scene exists; preserve edits.'
selected=sorted([o for o in bpy.context.scene.objects if o.select_get() and o.type=='MESH' and len(o.data.vertices)],key=lambda o:o.name)
assert len(selected)==9,'Saved selection changed; review before staging.'
source38=bpy.data.objects['high-rise-lp-38']
if source38 not in selected:selected.append(source38)
scene=bpy.data.scenes.new('EXPORT / Approved buildings')
col=bpy.data.collections.new('EXPORT_APPROVED_BUILDINGS');scene.collection.children.link(col)
rows=[]
for index,source in enumerate(selected):
 transform=persistent(source)
 # A hidden source collection may have an unevaluated matrix_world.
 pts=[transform@v.co for v in source.data.vertices]
 lo=Vector(tuple(min(p[i] for p in pts) for i in range(3)));hi=Vector(tuple(max(p[i] for p in pts) for i in range(3)))
 assert hi.z-lo.z>1,source.name+' has no established metre scale'
 obj=source.copy();obj.data=source.data;obj.parent=None
 obj.name='EXPORT / '+source.name
 col.objects.link(obj)
 shift=Vector(((index%5)*75-(lo.x+hi.x)/2,(index//5)*90-(lo.y+hi.y)/2,-lo.z))
 obj.matrix_world=Matrix.Translation(shift)@transform
 obj.hide_render=False;obj.hide_viewport=False
 obj['export_source_object']=source.name
 obj['export_approved']=True
 if source==source38:obj['existing_catalogue_id']='high-rise-38'
 rows.append({'object':obj.name,'source':source.name,'dimensionsMetres':list(hi-lo),'triangles':sum(len(p.vertices)-2 for p in source.data.polygons),'existingCatalogueId':'high-rise-38' if source==source38 else None})
bpy.context.window.scene=scene
for o in scene.objects:o.select_set(True)
bpy.context.view_layer.objects.active=col.objects[0]
# Set a useful modeling view without adding cameras/lights to the export collection.
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   region=area.spaces.active.region_3d;region.view_perspective='PERSP';region.view_location=(150,45,65);region.view_distance=410
   area.spaces.active.shading.type='MATERIAL'
assert len(scene.objects)==10
assert all(o.type=='MESH' for o in scene.objects)
assert all(o.data==bpy.data.objects[o['export_source_object']].data for o in scene.objects)
manifest={'scene':scene.name,'collection':col.name,'models':rows,'exportNote':'Normalize each object to ground-centred local coordinates when exporting; staging grid must not become runtime transforms.'}
(root/'references/visual/atlas-shape-study/export-staging.json').write_text(json.dumps(manifest,indent=2)+'\n')
assert path.stat().st_mtime_ns==stamp
bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
bpy.ops.wm.save_as_mainfile(filepath=str(path))
print('EXPORT_STAGED',json.dumps(manifest),flush=True)
