"""Export evaluated, grounded copies from EXPORT_APPROVED_BUILDINGS; never save source."""
import bpy,json,hashlib,bmesh
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/models/buildings/textured-approved-pilot';OUT.mkdir(parents=True,exist_ok=True)
IDS={'Cube.001':'approved-white-residence','Cube.002':'approved-brick-tower','EXP03 / Chamfered shoulder tower':'approved-chamfered-tower','EXP03 / Reference / 116 triangles':'approved-slab','EXP03 / Reference / 264 triangles':'approved-braced-tower','EXP04 / Offset glass slabs':'approved-offset-slabs','EXP05 / Terraced dark office':'approved-terraced-glass','EXP06 / Glass podium tower':'approved-glass-podium','EXP07 / Dark shoulder tower':'approved-dark-shoulder','high-rise-lp-38':'approved-high-rise-38'}
bpy.context.window.scene=bpy.data.scenes['EXPORT / Approved buildings'];bpy.context.view_layer.update()
sources=list(bpy.data.collections['EXPORT_APPROVED_BUILDINGS'].objects)
assert len(sources)==len(IDS)
col=bpy.data.collections.new('TEMP_EXPORT');bpy.context.scene.collection.children.link(col)
models=[];exported=[]
for source in sources:
 origin=source['export_source_object'];asset=IDS[origin]
 evaluated=source.evaluated_get(bpy.context.evaluated_depsgraph_get())
 mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=bpy.context.evaluated_depsgraph_get())
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 mesh.transform(source.matrix_world)
 lo=Vector(tuple(min(v.co[i] for v in mesh.vertices) for i in range(3)));hi=Vector(tuple(max(v.co[i] for v in mesh.vertices) for i in range(3)))
 mesh.transform(Matrix.Translation(Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z))))
 obj=bpy.data.objects.new(asset,mesh);col.objects.link(obj);exported.append(obj)
 size=hi-lo
 assert mesh.uv_layers and min(v.co.z for v in mesh.vertices)>-1e-4
 models.append({'id':asset,'sourceObject':source.name,'knownCatalogAssetId':None,'dimensionsMetres':{'width':round(size.x,4),'height':round(size.z,4),'depth':round(size.y,4)},'triangles':sum(len(p.vertices)-2 for p in mesh.polygons),'materials':[m.name for m in mesh.materials if m]})
export_scene=bpy.data.scenes.new('TEMP_APPROVED_EXPORT');export_scene.collection.children.link(col);bpy.context.window.scene=export_scene
bpy.ops.object.select_all(action='DESELECT')
for obj in exported:obj.select_set(True)
bpy.context.view_layer.objects.active=exported[0]
file=OUT/'textured-approved-pack.glb'
bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_texcoords=True,export_normals=True,export_tangents=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
manifest={'schemaVersion':1,'sourceBlend':Path(bpy.data.filepath).name,'sourceSha256':sha(bpy.data.filepath),'packSha256':sha(file),'packFile':file.name,'assetGroup':'commercial','modelCount':len(models),'models':sorted(models,key=lambda m:m['id'])}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('APPROVED_EXPORT',len(models),file.stat().st_size,flush=True)
