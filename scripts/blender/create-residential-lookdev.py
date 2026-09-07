"""One editable residential prototype, reviewed in Blender before runtime export.

Opens the existing city lookdev file but saves a separate working copy. The
city and linked library are preserved. Shared model data belongs to a local
LOOKDEV_EXPERIMENTS collection; two independent lighting scenes review it.
Run with Blender --background <lookdev.blend> --python-exit-code 1 --python
this_file.py -- --output <study.blend> --renders <directory>.
"""
import argparse
import json
import math
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector

SEED = 20260906
ORIGIN = Vector((1250, 0, 0))


def material(name, color, roughness=0.65, metallic=0, emission=None):
    mat = bpy.data.materials.new('RES01 / '+name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = 1.6
    return mat


class MeshBuilder:
    def __init__(self, name, materials):
        self.name, self.materials = name, materials
        self.vertices, self.faces, self.indices = [], [], []

    def face(self, points, mat):
        offset = len(self.vertices)
        self.vertices.extend(points)
        self.faces.append(tuple(range(offset, offset+len(points))))
        self.indices.append(mat)

    def box(self, center, size, mat):
        x,y,z = center
        w,d,h = [v/2 for v in size]
        vertices = [(x-w,y-d,z-h),(x+w,y-d,z-h),(x+w,y+d,z-h),(x-w,y+d,z-h),
                    (x-w,y-d,z+h),(x+w,y-d,z+h),(x+w,y+d,z+h),(x-w,y+d,z+h)]
        for face in [(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7),(3,2,1,0)]:
            self.face([vertices[i] for i in face],mat)

    def cylinder(self, x,y,z,radius,height,mat,segments=12):
        bottom = [(x+radius*math.cos(i*math.tau/segments),y+radius*math.sin(i*math.tau/segments),z) for i in range(segments)]
        top = [(a,b,c+height) for a,b,c in bottom]
        self.face(list(reversed(bottom)),mat)
        self.face(top,mat)
        for i in range(segments):
            j=(i+1)%segments
            self.face([bottom[i],bottom[j],top[j],top[i]],mat)

    def build(self, collection):
        mesh=bpy.data.meshes.new(self.name+' mesh')
        mesh.from_pydata(self.vertices,[],self.faces)
        for mat in self.materials: mesh.materials.append(mat)
        for polygon,index in zip(mesh.polygons,self.indices): polygon.material_index=index
        mesh.update()
        obj=bpy.data.objects.new(self.name,mesh)
        collection.objects.link(obj)
        obj.location=ORIGIN
        obj['study_seed']=SEED
        return obj


def build_tower(collection):
    # All colors are scene-linear. Architecture uses six non-emissive material
    # roles plus three shared occupied-window tones and a safety beacon.
    mats=[
        material('limestone',(0.34,0.32,0.285),0.78),
        material('reveal / warm concrete',(0.19,0.185,0.17),0.85),
        material('anodized bronze',(0.095,0.08,0.055),0.32,0.65),
        material('unlit glazing',(0.018,0.033,0.043),0.23,0.3),
        material('roof membrane',(0.055,0.065,0.073),0.86),
        material('equipment',(0.13,0.155,0.17),0.5,0.35),
        material('occupied / amber',(0.25,0.19,0.11),0.5,emission=(0.75,0.47,0.2)),
        material('occupied / warm white',(0.27,0.245,0.19),0.5,emission=(0.72,0.61,0.4)),
        material('occupied / cool white',(0.17,0.22,0.24),0.5,emission=(0.38,0.52,0.57)),
        material('aviation red',(0.3,0.005,0.002),0.4,emission=(1,0.006,0.002)),
    ]
    shell=MeshBuilder('RES01 • limestone structure',mats)
    glazing=MeshBuilder('RES01 • apartment glazing and blinds',mats)
    metal=MeshBuilder('RES01 • bronze frames and balcony rails',mats)
    roof=MeshBuilder('RES01 • mechanical roof',mats)
    rng=random.Random(SEED)
    window_count=0
    occupied=0

    def panel(side,width,depth,u,z):
        # Parametric outward-oriented facade plane. u increases anticlockwise.
        if side==0: return (u,-depth/2,z)
        if side==1: return (width/2,u,z)
        if side==2: return (-u,depth/2,z)
        return (-width/2,-u,z)

    def window(side,width,depth,u0,u1,z0,z1,lit,balcony=False):
        nonlocal window_count,occupied
        window_count+=1
        occupied+=int(lit)
        p=lambda u,z: panel(side,width,depth,u,z)
        normal=Vector([(0,-1,0),(1,0,0),(0,1,0),(-1,0,0)][side])
        tangent=Vector([(1,0,0),(0,1,0),(-1,0,0),(0,-1,0)][side])
        left,right=u0+0.4,u1-0.4
        low,high=z0+0.75,z1-0.38
        outer=[p(u0,z0),p(u1,z0),p(u1,z1),p(u0,z1)]
        rim=[p(left,low),p(right,low),p(right,high),p(left,high)]
        inner=[tuple(Vector(v)-normal*0.32) for v in rim]
        # Four wall strips surround an actual opening; no backing wall occludes it.
        for i in range(4):
            j=(i+1)%4
            shell.face([outer[i],outer[j],rim[j],rim[i]],0)
            shell.face([rim[i],rim[j],inner[j],inner[i]],1)
        tone=rng.choices([6,7,8],[0.5,0.43,0.07])[0] if lit else 3
        glazing.face(inner,tone)
        def facade_box(u,z,w,h,thickness,offset,mat,builder=metal):
            loc=Vector(p(u,z))+normal*offset
            if thickness<=0.1:
                # Tiny casements/blinds need only their exposed face. Keep the
                # opening reveals and projecting sills as real depth geometry.
                points=[Vector(p(u-w/2,z-h/2)),Vector(p(u+w/2,z-h/2)),
                        Vector(p(u+w/2,z+h/2)),Vector(p(u-w/2,z+h/2))]
                builder.face([tuple(v+normal*(offset+thickness/2)) for v in points],mat)
                return
            size=(w,thickness,h) if side%2==0 else (thickness,w,h)
            builder.box(loc,size,mat)
        # Thin bronze casements, transom and sill. All are merged, not objects.
        for u in [left,right,(left+right)/2]:
            facade_box(u,(low+high)/2,0.055,high-low,0.065,-0.25,2)
        for z in [low,high]: facade_box((left+right)/2,z,right-left,0.055,0.065,-0.25,2)
        facade_box((left+right)/2,low-0.06,right-left+0.2,0.12,0.45,-0.08,0,shell)
        if lit and rng.random()<0.5:
            # Opaque roller blind partly covers an emissive pane. Real depth and
            # a small bottom rail prevent the lit facade reading as flat pixels.
            drop=rng.uniform(0.3,1.15)
            facade_box((left+right)/2,high-drop/2,right-left,drop,0.025,-0.28,1,glazing)
            facade_box((left+right)/2,high-drop,right-left,0.035,0.04,-0.26,2)
        if balcony:
            floor=Vector(p((u0+u1)/2,z0+0.28))+normal*0.48
            size=(u1-u0-0.15,1.15,0.18) if side%2==0 else (1.15,u1-u0-0.15,0.18)
            shell.box(floor,size,0)
            facade_box((u0+u1)/2,z0+0.95,u1-u0-0.25,0.75,0.1,1.0,3)
            facade_box((u0+u1)/2,z0+1.36,u1-u0-0.1,0.055,0.1,1.0,2)
            for u in [u0+0.15,u1-0.15]: facade_box(u,z0+0.9,0.065,1.0,0.12,1.0,2)

    def facade_tier(width,depth,bottom,floors):
        for side in range(4):
            span=width if side%2==0 else depth
            bays=8 if side%2==0 else 6
            pitch=span/bays
            for row in range(floors):
                # Correlated occupancy by apartment, with independent facade faces.
                for col in range(bays):
                    lit=rng.random()<(0.30 if row%7!=0 else 0.08)
                    z0=bottom+row*3.2
                    window(side,width,depth,-span/2+col*pitch,-span/2+(col+1)*pitch,z0,z0+3.2,
                           lit,side in (0,2) and col in (1,6) and row>0 and row%4!=0)
        # Thin expressed slab ends every four floors and substantial corner piers.
        for row in range(0,floors+1,4):
            z=bottom+row*3.2
            for sign in (-1,1):
                shell.box((0,sign*depth/2,z),(width+0.25,0.28,0.17),0)
                shell.box((sign*width/2,0,z),(0.28,depth+0.25,0.17),0)
        for x in (-width/2,width/2):
            for y in (-depth/2,depth/2): shell.box((x,y,bottom+floors*1.6),(0.62,0.62,floors*3.2),0)

    # Two-storey base; tower is grounded in a modest street wall, not a blank plinth.
    shell.box((0,0,0.2),(34,28,0.4),1)
    shell.box((0,0,4.2),(32.8,26.8,7.6),3)
    for z in [0.6,4.2,7.9]: shell.box((0,0,z),(34,28,0.35),0)
    for x in [-16.6,-12,-8,-4,4,8,12,16.6]:
        for y in [-13.65,13.65]: shell.box((x,y,4.25),(0.48,0.6,7.3),0)
    for y in [-9,-4.5,0,4.5,9]:
        for x in [-16.65,16.65]: shell.box((x,y,4.25),(0.5,0.45,7.3),0)
    glazing.box((0,-13.46,2.0),(6,0.04,3.1),7)
    for x in [-3,0,3]: metal.box((x,-13.52,2.0),(0.07,0.1,3.2),2)
    shell.box((0,-13.25,3.85),(10,3.2,0.22),2)
    metal.box((0,-14.55,3.73),(9.6,0.09,0.06),7)

    facade_tier(28,22,8.2,23)
    # Upper eight floors set back to make the crown read independently.
    terrace_z=8.2+23*3.2
    shell.box((0,0,terrace_z),(28.6,22.6,0.35),0)
    facade_tier(25,19,terrace_z+0.2,8)
    top=terrace_z+0.2+8*3.2
    shell.box((0,0,top),(25.6,19.6,0.45),0)
    roof.box((0,0,top+0.25),(24.8,18.8,0.2),4)
    for z,width,depth in [(8.15,34,28),(terrace_z+0.3,28.4,22.4),(top+0.6,25.4,19.4)]:
        for sign in (-1,1):
            metal.box((0,sign*depth/2,z+0.45),(width,0.12,0.08),2)
            metal.box((sign*width/2,0,z+0.45),(0.12,depth,0.08),2)
    # Crown service enclosure, repeated louvers and low HVAC/fan assemblies.
    roof.box((0,1,top+1.65),(10,7,3.0),5)
    roof.box((0,1,top+3.2),(10.4,7.4,0.2),0)
    for z in range(9):
        for sign in (-1,1): roof.box((0,1+sign*3.52,top+0.4+z*0.3),(9.8,0.08,0.12),2)
    for x in (-7.5,7.5):
        for y in (-4,1,5):
            roof.box((x,y,top+0.7),(2.6,3.5,1.2),5)
            for fy in [-0.85,0.85]:
                roof.cylinder(x,y+fy,top+1.31,0.8,0.12,2)
                roof.box((x,y+fy,top+1.45),(1.5,0.06,0.025),5)
                roof.box((x,y+fy,top+1.45),(0.06,1.5,0.025),5)
    for x in (-10,10):
        roof.cylinder(x,7,top,0.055,5.4,2,8)
        roof.cylinder(x,7,top+5.4,0.11,0.15,9,8)
    objects=[part.build(collection) for part in (shell,glazing,metal,roof)]
    for obj in objects:
        obj['prototype']='RES01 / Meridian House'
        obj['units']='metres; Blender Z up'
    return objects,dict(windows=window_count,occupiedWindows=occupied,heightMetres=top+5.55,
                        family='residential',seed=SEED,materials=len(mats))


def aim(obj,point):
    obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()


def review_scene(name,experiments,night):
    scene=bpy.data.scenes.new(name)
    scene.collection.children.link(experiments)
    stage=bpy.data.collections.new(name+' / presentation')
    scene.collection.children.link(stage)
    scene.render.engine='CYCLES'
    scene.cycles.samples=40
    scene.cycles.use_denoising=True
    scene.render.resolution_x=960
    scene.render.resolution_y=1200
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='AgX'
    scene.world=bpy.data.worlds.new(name+' / sky')
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value=(0.075,0.13,0.24,1) if night else (0.55,0.67,0.82,1)
    bg.inputs['Strength'].default_value=0.3 if night else 0.5
    floor_mat=material(name+' / paving',(0.09,0.11,0.13) if night else (0.24,0.25,0.245),0.72)
    floor=MeshBuilder(name+' / ground',[floor_mat])
    floor.box((0,0,-0.35),(20000,20000,0.5),0)
    floor.build(stage)
    camera_data=bpy.data.cameras.new(name+' / lens')
    camera=bpy.data.objects.new(name+' / camera',camera_data)
    stage.objects.link(camera)
    camera.location=ORIGIN+Vector((100,-140,89))
    camera_data.lens=50
    camera_data.clip_end=30000
    aim(camera,ORIGIN+Vector((0,0,55)))
    scene.camera=camera
    def area(label,position,power,color,size,target):
        data=bpy.data.lights.new(name+' / '+label,'AREA')
        data.energy=power
        data.color=color
        data.shape='DISK'
        data.size=size
        obj=bpy.data.objects.new(data.name,data)
        stage.objects.link(obj)
        obj.location=ORIGIN+Vector(position)
        aim(obj,ORIGIN+Vector(target))
    if night:
        area('cool sky',(-65,-35,150),90000,(0.48,0.65,1),75,(0,0,60))
        area('warm street',(-12,-27,12),2200,(1,0.6,0.28),12,(0,-8,18))
        area('rim',(40,35,125),100000,(0.58,0.72,1),55,(0,0,75))
    else:
        data=bpy.data.lights.new(name+' / sun','SUN')
        data.energy=2.5
        data.angle=math.radians(12)
        sun=bpy.data.objects.new(data.name,data)
        stage.objects.link(sun)
        sun.rotation_euler=(math.radians(28),math.radians(-24),math.radians(-35))
        area('soft fill',(60,-55,95),45000,(0.68,0.8,1),60,(0,0,55))
    return scene


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',required=True)
    parser.add_argument('--renders',required=True)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    output=Path(args.output).resolve()
    if output==Path(bpy.data.filepath).resolve():
        raise RuntimeError('Use a separate output copy to protect the open lookdev file.')
    if bpy.data.collections.get('LOOKDEV_EXPERIMENTS'):
        raise RuntimeError('Existing experiments detected; refusing to replace them.')
    experiments=bpy.data.collections.new('LOOKDEV_EXPERIMENTS')
    bpy.context.scene.collection.children.link(experiments)
    objects,report=build_tower(experiments)
    report['meshObjects']=len(objects)
    report['triangles']=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)
    assert len(objects)==4
    assert all(all(abs(component-1)<1e-6 for component in obj.scale) for obj in objects)
    assert all(all(math.isfinite(v) for v in vertex.co) for obj in objects for vertex in obj.data.vertices)
    assert abs(max(vertex.co.z for obj in objects for vertex in obj.data.vertices)-report['heightMetres'])<0.001
    report['validation']='finite coordinates; unit scales; 4 meshes; height matches geometry'
    day=review_scene('RES01 • Day',experiments,False)
    night=review_scene('RES01 • Night',experiments,True)
    renders=Path(args.renders).resolve()
    renders.mkdir(parents=True,exist_ok=True)
    bpy.context.window.scene=day
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_perspective='CAMERA'
                area.spaces.active.shading.type='MATERIAL'
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    (renders/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print('RESIDENTIAL_STUDY '+json.dumps(report),flush=True)
    for scene,label in [(day,'day'),(night,'night')]:
        scene.render.filepath=str(renders/f'residential-01-{label}.png')
        bpy.ops.render.render(write_still=True,scene=scene.name)


if __name__=='__main__': main()
