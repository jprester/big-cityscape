"""Concept-guided Atlas 4 towers. Preview by default; --save writes in place."""
import bpy,sys,importlib.util,json,math
from pathlib import Path
from mathutils import Vector
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('examples',Path(__file__).with_name('create-atlas-shape-examples.py'))
e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
e.PLAIN=(.881,.133,.979,.225)
DIR=Path('/Users/jankoprester/Projects/3d-modeling/blender/textures/generated-textures/generated-texture-atlas/High-Rise_Atlas4')
NAMES=['EXP06 / Glass podium tower','EXP07 / Dark shoulder tower']
GLASS=(.515,.513,.735,.985)
DARK=(.765,.513,.985,.985)
STONE=(.015,.513,.235,.985)


def material():
 m=bpy.data.materials.new('EXP06-07 / High-Rise Atlas 4');m.use_nodes=True
 n,l=m.node_tree.nodes,m.node_tree.links
 p=n.get('Principled BSDF');p.inputs['Emission Strength'].default_value=.7
 files=[('highrise-atlas-v1_osaka-modern-02_bundle/highrise-v1-osaka-modern-02_emissive-B_4K.png','Emission Color','sRGB'),('highrise-v4-osaka-modern-02_diffuse_4K.png','Base Color','sRGB'),('highrise-v1-osaka-modern-02_roughness_4K.png','Roughness','Non-Color'),('highrise-v1-osaka-modern-02_normal-OpenGL_4K.png','Normal','Non-Color')]
 for index,(suffix,socket,space) in enumerate(files):
  t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(DIR/suffix),check_existing=True);t.image.colorspace_settings.name=space;t.extension='EXTEND';t.location=(-500,300-index*250)
  if socket=='Normal':
   normal=n.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.25;l.new(t.outputs['Color'],normal.inputs['Color']);l.new(normal.outputs['Normal'],p.inputs['Normal'])
  else:l.new(t.outputs['Color'],p.inputs[socket])
 return m


def align(obj,rect):
 # Shared local X/Y origin, 48m panel width and 150m panel height.
 # No per-tier fitting: the vertical mullions keep their phase at setbacks.
 for p in obj.data.polygons:
  if abs(p.normal.z)>.01:continue
  zs=[obj.data.vertices[i].co.z for i in p.vertices]
  if max(zs)-min(zs)<1:continue
  chosen=STONE if max(zs)<=18.01 else rect
  u0,v0,u1,v1=chosen
  axis=0 if abs(p.normal.y)>.9 else 1
  for i in p.loop_indices:
   co=obj.data.vertices[obj.data.loops[i].vertex_index].co
   obj.data.uv_layers.active.data[i].uv=(u0+(co[axis]+24)/48*(u1-u0),v0+co.z/150*(v1-v0))
 obj['atlas']='High-Rise_Atlas4';obj['panel_metres']=[48,150]
 obj.data.uv_layers.active.name='Atlas4 / shared XYZ projection'
 assert all(0<=c<=1 for u in obj.data.uv_layers.active.data for c in u.uv)
 seen={}
 for p in obj.data.polygons:
  zs=[obj.data.vertices[i].co.z for i in p.vertices]
  if abs(p.normal.z)>.01 or max(zs)-min(zs)<1 or max(zs)<=18.01:continue
  axis=0 if abs(p.normal.y)>.9 else 1
  for i in p.loop_indices:
   co=obj.data.vertices[obj.data.loops[i].vertex_index].co
   key=(axis,round(co[axis],5));u=obj.data.uv_layers.active.data[i].uv.x
   assert key not in seen or abs(seen[key]-u)<1e-6
   seen[key]=u


def main():
 path=Path(bpy.data.filepath);assert path.name=='2026-city-lookdev.blend'
 stamp=path.stat().st_mtime_ns
 assert not any(bpy.data.objects.get(n) for n in NAMES),'Preserve existing examples.'
 before=set(bpy.data.objects)
 col=bpy.data.collections.new('EXP06-07 / Atlas 4 examples');bpy.data.collections['LOOKDEV_EXPERIMENTS'].children.link(col)
 mat=material()
 a=e.Shell(NAMES[0],GLASS,metres=(48,150))
 a.box(0,0,42,34,0,.6,plain=True)
 a.box(0,0,41,33,.6,18)
 a.box(0,0,30,25,18,138)
 a.box(0,0,30.3,25.3,138,138.4,plain=True)
 # Plain side shoulders frame the glazed shaft; no facade ribs or equipment.
 a.box(-16,0,2,23,18,132,plain=True)
 a.box(16,0,2,23,18,132,plain=True)
 o1,r1=a.finish(col,mat,1590);align(o1,GLASS)
 # Restore the narrow structural shoulders to plain swatch after facade mapping.
 for p in o1.data.polygons:
  if abs(p.normal.z)>.01:continue
  coords=[o1.data.vertices[i].co for i in p.vertices]
  if all(abs(v.x)>=15 for v in coords) and max(v.z for v in coords)==132:
   for i,uv in zip(p.loop_indices,[(.881,.133),(.979,.133),(.979,.225),(.881,.225)]):o1.data.uv_layers.active.data[i].uv=uv
 b=e.Shell(NAMES[1],DARK,metres=(48,150))
 b.box(0,0,42,36,0,.6,plain=True)
 b.box(0,0,41,35,.6,18)
 b.box(0,0,34,28,18,114)
 b.box(-3,2,28,24,114,138)
 b.box(-3,2,28.3,24.3,138,138.4,plain=True)
 o2,r2=b.finish(col,mat,1670);align(o2,DARK)
 e.atlas.stage.ORIGIN=Vector((1630,0,0))
 scenes=[]
 for night,label in [(False,'Day'),(True,'Night')]:
  s=e.atlas.stage.review_scene('EXP06-07 / '+label,col,night)
  s.render.resolution_x=1500;s.render.resolution_y=1100
  s.camera.location=(1725,-290,170);e.atlas.stage.aim(s.camera,Vector((1630,0,70)));s.camera.data.lens=45
  s.render.filepath=str(e.OUTPUT/f'exp06-07-{label.lower()}.png');scenes.append(s)
 assert before.issubset(set(bpy.data.objects))
 report={'examples':[r1,r2],'atlas':'High-Rise_Atlas4','images':4,'emission':'Validated bundle variant B; variant A is truncated','sharedMaterials':1,'originalObjectsRetained':len(before),'uvAlignment':'common 48m x 150m projection; equal-U assertions passed','saved':'--save' in sys.argv}
 (e.OUTPUT/'exp06-07-report.json').write_text(json.dumps(report,indent=2)+'\n')
 bpy.context.window.scene=bpy.data.scenes['Scene']
 if '--save' in sys.argv:
  assert path.stat().st_mtime_ns==stamp
  bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
  bpy.ops.wm.save_as_mainfile(filepath=str(path))
 print('ATLAS4',report,flush=True)
 if '--skip-render' not in sys.argv:
  for s in scenes:bpy.ops.render.render(write_still=True,scene=s.name)


if __name__=='__main__':main()
