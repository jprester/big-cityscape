"""Align EXP05 vertical mullions to the edited base tier; preserve V and roofs."""
import bpy
import sys
import json
from pathlib import Path
from mathutils import Vector

obj=bpy.data.objects['EXP05 / Terraced dark office']
mesh=obj.data
uv=mesh.uv_layers.active
path=Path(bpy.data.filepath)
assert path.name=='2026-city-lookdev.blend'
stamp=path.stat().st_mtime_ns
before=[tuple(x.uv) for x in uv.data]
geometry=[tuple(v.co) for v in mesh.vertices]
faces=[p for p in mesh.polygons if abs(p.normal.z)<0.01 and max(mesh.vertices[i].co.z for i in p.vertices)-min(mesh.vertices[i].co.z for i in p.vertices)>2]
# Recover each wall orientation's projection from the user's lowest tier.
projections={}
for axis,sign in [(0,-1),(0,1),(1,-1),(1,1)]:
    walls=[p for p in faces if p.normal[axis]*sign>0.99]
    base=min(walls,key=lambda p:min(mesh.vertices[i].co.z for i in p.vertices))
    horizontal=1-axis
    samples=[(mesh.vertices[mesh.loops[i].vertex_index].co[horizontal],uv.data[i].uv.x) for i in base.loop_indices]
    low,high=min(samples),max(samples)
    scale=(high[1]-low[1])/(high[0]-low[0])
    offset=low[1]-low[0]*scale
    projections[(axis,sign)]=(horizontal,scale,offset)
    for p in walls:
        for i in p.loop_indices:
            co=mesh.vertices[mesh.loops[i].vertex_index].co
            uv.data[i].uv.x=offset+scale*co[horizontal]
# Assertions verify a single projection per direction, not just UV bounds.
error=0
for p in faces:
    axis=0 if abs(p.normal.x)>.99 else 1
    sign=1 if p.normal[axis]>0 else -1
    horizontal,scale,offset=projections[(axis,sign)]
    for i in p.loop_indices:
        expected=offset+scale*mesh.vertices[mesh.loops[i].vertex_index].co[horizontal]
        error=max(error,abs(uv.data[i].uv.x-expected))
        assert .510<=uv.data[i].uv.x<=.743
assert error<1e-6
assert all(old[1]==new.uv.y for old,new in zip(before,uv.data))
assert geometry==[tuple(v.co) for v in mesh.vertices]
for p in mesh.polygons:
    if p not in faces:
        assert all(tuple(uv.data[i].uv)==before[i] for i in p.loop_indices)
mesh.update()
report={'facadeFaces':len(faces),'maxProjectionError':error,'geometryUnchanged':True,'verticalUVsUnchanged':True,'roofUVsUnchanged':True}
out=Path(__file__).resolve().parents[2]/'references/visual/atlas-shape-study'
(out/'exp05-alignment-report.json').write_text(json.dumps(report,indent=2)+'\n')
if '--save' in sys.argv:
    assert path.stat().st_mtime_ns==stamp
    bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
print('UV_ALIGNMENT',report,flush=True)
# Render from a dedicated temporary scene; no presentation changes saved.
scene=bpy.data.scenes['EXP04-05 / Day'].copy()
scene.name='Temporary UV check'
scene.camera=scene.camera.copy()
scene.camera.data=scene.camera.data.copy()
scene.collection.objects.link(scene.camera)
center=obj.matrix_world@Vector((-5,0,63))
scene.camera.location=center+Vector((100,-210,65))
scene.camera.rotation_euler=(center-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.type='ORTHO'
scene.camera.data.ortho_scale=155
scene.render.resolution_x=1000
scene.render.resolution_y=1200
# Render only target building and presentation, without changing saved visibility.
for other in scene.objects:
    if other.type=='MESH' and other!=obj and other.name.startswith('EXP04 /'):other.hide_render=True
scene.render.filepath=str(out/'exp05-aligned.png')
bpy.ops.render.render(write_still=True,scene=scene.name)
