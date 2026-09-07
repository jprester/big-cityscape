"""Place the reviewed lineup in compatible occupied city footprints, reversibly."""
import bpy,json,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2]
NAMES=['EXP03 / Reference / 116 triangles','EXP03 / Chamfered shoulder tower','EXP03 / Reference / 264 triangles','EXP04 / Offset glass slabs','EXP05 / Terraced dark office','EXP06 / Glass podium tower','EXP07 / Dark shoulder tower','Cube.001','Cube.002']

def bounds(o):
 pts=[o.matrix_world@Vector(v) for v in o.bound_box]
 return Vector(tuple(min(p[i] for p in pts) for i in range(3))),Vector(tuple(max(p[i] for p in pts) for i in range(3)))

def main():
 path=Path(bpy.data.filepath);assert path.name=='2026-city-lookdev.blend'
 stamp=path.stat().st_mtime_ns
 assert not bpy.data.collections.get('CITY_REVIEW_ADDITIONS'),'Already placed; preserve edits.'
 scene=bpy.data.scenes['Scene'];bpy.context.window.scene=scene;bpy.context.view_layer.update()
 original=set(bpy.data.objects)
 sources=[bpy.data.objects[n] for n in NAMES]
 assert all(o.type=='MESH' and len(o.data.vertices)>0 for o in sources)
 collection=bpy.data.collections.new('CITY_REVIEW_ADDITIONS');scene.collection.children.link(collection)
 backup=bpy.data.collections.new('CITY_REVIEW_REPLACED');scene.collection.children.link(backup)
 targets=[o for o in scene.objects if o.name.startswith('CITY::building') and o.type=='MESH']
 remaining=set(targets);records=[]
 for repeat in range(2):
  for index,source in enumerate(sources):
   lo,hi=bounds(source);size=hi-lo
   ideal=Vector((((index%3)-1)*280,((index//3)-1)*240+(repeat-.5)*110,0))
   choices=[]
   for target in remaining:
    low,high=bounds(target);extent=high-low;center=(low+high)/2
    if extent.z<65 or abs(center.x)>650 or abs(center.y)>650:continue
    for quarter in (0,1):
     w,d=(size.y,size.x) if quarter else (size.x,size.y)
     if w+1<=extent.x and d+1<=extent.y:
      score=(Vector((center.x,center.y,0))-ideal).length+abs(extent.z-size.z)*.3
      choices.append((score,target.name,quarter,target,low,high))
   assert choices,'No compatible lot for '+source.name
   _,_,quarter,target,low,high=min(choices,key=lambda c:c[:3])
   remaining.remove(target)
   rotation=Matrix.Rotation(quarter*math.pi/2,4,'Z')
   transform=rotation@source.matrix_world
   points=[transform@Vector(v) for v in source.bound_box]
   rlo=Vector(tuple(min(p[i] for p in points) for i in range(3)));rhi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
   offset=Vector(((low.x+high.x-rlo.x-rhi.x)/2,(low.y+high.y-rlo.y-rhi.y)/2,low.z-rlo.z))
   copy=source.copy();copy.data=source.data;copy.name=f'CITY_REVIEW / {source.name} / {repeat+1}'
   copy.parent=None;copy.matrix_world=Matrix.Translation(offset)@transform
   collection.objects.link(copy);copy.hide_render=False;copy.hide_viewport=False;copy.hide_set(False)
   copy['review_source']=source.name;copy['replaces_city_object']=target.name
   copy['city_placement_id']=target.get('city_placement_id','')
   bpy.context.view_layer.update()
   nlo,nhi=bounds(copy)
   assert nlo.x>=low.x-.001 and nlo.y>=low.y-.001 and nhi.x<=high.x+.001 and nhi.y<=high.y+.001
   assert abs(nlo.z-low.z)<1e-4
   record={'source':source.name,'placed':copy.name,'replaced':target.name,'originalCollections':[c.name for c in target.users_collection],'bounds':[list(nlo),list(nhi)],'triangles':sum(len(p.vertices)-2 for p in source.data.polygons)}
   backup.objects.link(target)
   for c in list(target.users_collection):
    if c!=backup:c.objects.unlink(target)
   records.append(record)
 backup.hide_render=True;backup.hide_viewport=True
 assert original.issubset(set(bpy.data.objects))
 # Check the additions against each other as a second placement guard.
 for i,a in enumerate(records):
  for b in records[i+1:]:
   al,ah=a['bounds'];bl,bh=b['bounds']
   assert not (al[0]<bh[0] and ah[0]>bl[0] and al[1]<bh[1] and ah[1]>bl[1])
 out=ROOT/'references/visual/atlas-shape-study'
 report={'placements':records,'count':len(records),'uniqueSourceMeshes':len(sources),'newMeshDatablocks':0,'originalObjectsRetained':len(original),'validation':'Footprints inside replaced building bounds; no mutual overlap; base elevations matched','scope':'Blender only; review additions require promotion before generated-city rebuild'}
 (out/'city-review-placements.json').write_text(json.dumps(report,indent=2)+'\n')
 if '--save' in sys.argv:
  assert path.stat().st_mtime_ns==stamp
  bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
  bpy.ops.wm.save_as_mainfile(filepath=str(path))
 print('PLACED',len(records),'linked objects from',len(sources),'sources',flush=True)
 # Temporary city camera for review; existing camera/settings are not saved over.
 scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
 scene.render.resolution_x=1500;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
 camera=bpy.data.objects.new('Temporary additions camera',bpy.data.cameras.new('Temporary additions camera'))
 scene.collection.objects.link(camera);scene.camera=camera
 camera.location=(880,-1100,850);aim=Vector((0,0,50));camera.rotation_euler=(aim-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.lens=48;camera.data.clip_end=10000
 scene.render.filepath=str(out/'city-review-additions.png')
 bpy.ops.render.render(write_still=True,scene=scene.name)

if __name__=='__main__':main()
