"""Two additional low-poly silhouettes using the existing Atlas 3 material.

Preview first; --save adds the reviewed examples to 2026-city-lookdev.blend.
"""
import argparse
import importlib.util
import math
from pathlib import Path
import sys
import json
import bpy
from mathutils import Vector

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('atlas',Path(__file__).with_name('create-atlas-shape-study.py'))
atlas=importlib.util.module_from_spec(spec)
spec.loader.exec_module(atlas)
# Insets avoid the black gutters. These are facade panels, not whole-atlas tiles.
GLASS=(0.513,0.515,0.735,0.984)
DARK=(0.014,0.020,0.242,0.490)
PLAIN=atlas.CONCRETE
OUTPUT=atlas.ROOT/'references/visual/atlas-shape-study'


class Shell:
    def __init__(self,name,rect,metres=(35.14,90.0)):
        self.name,self.rect,self.metres=name,rect,metres
        self.verts,self.faces,self.uvs=[],[],[]

    def face(self,pts,coords):
        start=len(self.verts)
        self.verts.extend(pts)
        self.faces.append(tuple(range(start,start+len(pts))))
        self.uvs.append(coords)

    def box(self,cx,cy,w,d,z0,z1,plain=False):
        ring=[(cx-w/2,cy-d/2),(cx+w/2,cy-d/2),(cx+w/2,cy+d/2),(cx-w/2,cy+d/2)]
        for i,a in enumerate(ring):
            b=ring[(i+1)%4]
            length=math.dist(a,b)
            # Split wide/tall surfaces at atlas limits; never stretch an entire
            # facade panel over differently sized masses or cross atlas gutters.
            nx=max(1,math.ceil(length/self.metres[0]))
            cuts=[z0]+[n*self.metres[1] for n in range(1,math.ceil(z1/self.metres[1])) if z0<n*self.metres[1]<z1]+[z1]
            for ix in range(nx):
                t0,t1=ix/nx,(ix+1)/nx
                x0,y0=a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0
                x1,y1=a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1
                for low,high in zip(cuts,cuts[1:]):
                    if plain:u0,v0,u1,v1=PLAIN
                    else:
                        u0,vmin,umax,vmax=self.rect
                        u1=u0+(umax-u0)*(length/nx)/self.metres[0]
                        phase=low%self.metres[1]
                        v0=vmin+(vmax-vmin)*phase/self.metres[1]
                        v1=v0+(vmax-vmin)*(high-low)/self.metres[1]
                    self.face([(x0,y0,low),(x1,y1,low),(x1,y1,high),(x0,y0,high)],[(u0,v0),(u1,v0),(u1,v1),(u0,v1)])
        for z,rev in [(z1,False),(z0,True)]:
            pts=[(x,y,z) for x,y in ring]
            u0,v0,u1,v1=PLAIN
            coords=[(u0,v0),(u1,v0),(u1,v1),(u0,v1)]
            self.face(pts[::-1] if rev else pts,coords[::-1] if rev else coords)

    def finish(self,col,material,x):
        mesh=bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.verts,[],self.faces)
        mesh.materials.append(material)
        mesh.update()
        layer=mesh.uv_layers.new(name='Atlas3 / consistent panel scale')
        for p,uvs in zip(mesh.polygons,self.uvs):
            for loop,uv in zip(p.loop_indices,uvs):layer.data[loop].uv=uv
        obj=bpy.data.objects.new(self.name,mesh)
        col.objects.link(obj)
        obj.location=(x,0,0)
        obj['atlas']='High-Rise_Atlas3'
        obj['roofs']='Plain concrete; equipment to be placed manually'
        obj['panel_metres']=self.metres
        assert all(math.isfinite(c) for v in mesh.vertices for c in v.co)
        assert all(0<=c<=1 for uv in layer.data for c in uv.uv)
        assert all(p.area>0 for p in mesh.polygons)
        triangles=sum(len(p.vertices)-2 for p in mesh.polygons)
        assert triangles<200
        return obj,dict(name=self.name,triangles=triangles,meshObjects=1,materials=1,height=max(v.co.z for v in mesh.vertices))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--save',action='store_true')
    parser.add_argument('--skip-render',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    file=Path(bpy.data.filepath)
    assert file.name=='2026-city-lookdev.blend'
    stamp=file.stat().st_mtime_ns
    names=['EXP04 / Offset glass slabs','EXP05 / Terraced dark office']
    assert not any(bpy.data.objects.get(n) for n in names),'Examples already exist; preserve manual edits.'
    before=set(bpy.data.objects)
    root=bpy.data.collections['LOOKDEV_EXPERIMENTS']
    col=bpy.data.collections.new('EXP04-05 / Atlas shape examples')
    root.children.link(col)
    mat=bpy.data.materials['EXP03 / High-Rise Atlas 3']
    # Shared podium, unequal slabs, narrow open slot between the upper wings.
    a=Shell(names[0],GLASS)
    a.box(0,0,44,32,0,0.6,plain=True)
    a.box(0,0,43,31,0.6,12)
    a.box(-10,-2,18,26,12,144)
    a.box(11,3,18,24,12,108)
    a.box(-10,-2,18.3,26.3,144,144.4,plain=True)
    a.box(11,3,18.3,24.3,108,108.4,plain=True)
    obj1,r1=a.finish(col,mat,1410)
    # Broad office with terraces on two axes; massing changes at 36m intervals.
    b=Shell(names[1],DARK,metres=(35.14,90))
    b.box(0,0,48,36,0,0.6,plain=True)
    b.box(0,0,47,35,0.6,36)
    b.box(-5,2,37,31,36,72)
    b.box(-10,4,27,27,72,108)
    b.box(-10,7,27,21,108,126)
    b.box(-10,7,27.3,21.3,126,126.4,plain=True)
    obj2,r2=b.finish(col,mat,1490)
    OUTPUT.mkdir(parents=True,exist_ok=True)
    atlas.stage.ORIGIN=Vector((1450,0,0))
    scenes=[]
    for night,label in [(False,'Day'),(True,'Night')]:
        scene=atlas.stage.review_scene('EXP04-05 / '+label,col,night)
        scene.render.resolution_x=1500
        scene.render.resolution_y=1100
        scene.camera.location=Vector((1545,-270,175))
        atlas.stage.aim(scene.camera,Vector((1447,0,73)))
        scene.camera.data.lens=42
        scene.render.filepath=str(OUTPUT/f'exp04-05-{label.lower()}.png')
        scenes.append(scene)
    assert before.issubset(set(bpy.data.objects))
    report={'examples':[r1,r2],'sharedMaterial':mat.name,'newImages':0,'originalObjectsRetained':len(before),'saved':args.save,'limitations':['Baked facade depth','Atlas occupancy repeats','Hidden internal faces retained for editable masses']}
    (OUTPUT/'exp04-05-report.json').write_text(json.dumps(report,indent=2)+'\n')
    # Keep the full city as the default scene so the rest of the file stays obvious.
    bpy.context.window.scene=bpy.data.scenes['Scene']
    if args.save:
        assert file.stat().st_mtime_ns==stamp,'File changed; reload before saving.'
        bpy.context.preferences.filepaths.save_version=max(1,bpy.context.preferences.filepaths.save_version)
        bpy.ops.wm.save_as_mainfile(filepath=str(file))
    print('EXAMPLES '+json.dumps(report),flush=True)
    if not args.skip_render:
        for scene in scenes:bpy.ops.render.render(write_still=True,scene=scene.name)


if __name__=='__main__':main()
