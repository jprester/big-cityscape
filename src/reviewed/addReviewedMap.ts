import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ReviewedBlock } from './reviewedCity';
import type { SyntheticStreetLampDefinition } from '../city/synthetic/model/streetLamp';

/** Blocks retain exported outlines; asphalt occupies the gaps between them. */
export function addReviewedMap(blocks: readonly ReviewedBlock[]) {
  const group = new THREE.Group();
  const surfaces:THREE.BufferGeometry[]=[];
  const sidewalks:THREE.BufferGeometry[]=[];
  const lamps:SyntheticStreetLampDefinition[]=[];
  const bounds=new THREE.Box3();
  for(const block of blocks) {
    const polygon=block.footprintXZ.map(([x,z])=>new THREE.Vector2(x,-z));
    const shape=new THREE.Shape(polygon);
    const geometry=new THREE.ShapeGeometry(shape); geometry.rotateX(-Math.PI/2); geometry.translate(0,.02,0); surfaces.push(geometry);
    const cx=block.footprintXZ.reduce((n,p)=>n+p[0],0)/4, cz=block.footprintXZ.reduce((n,p)=>n+p[1],0)/4;
    block.footprintXZ.forEach(([x,z],i)=>{
      bounds.expandByPoint(new THREE.Vector3(x,0,z));
      const [bx,bz]=block.footprintXZ[(i+1)%4]!;
      const dx=bx-x,dz=bz-z,length=Math.hypot(dx,dz);
      if(length<1) return;
      let nx=-dz/length,nz=dx/length;
      if(nx*(cx-x)+nz*(cz-z)<0){nx=-nx;nz=-nz;}
      const strip=new THREE.ShapeGeometry(new THREE.Shape([
        new THREE.Vector2(x,-z),new THREE.Vector2(bx,-bz),new THREE.Vector2(bx+nx*1.8,-bz-nz*1.8),new THREE.Vector2(x+nx*1.8,-z-nz*1.8),
      ])); strip.rotateX(-Math.PI/2);strip.translate(0,.04,0);sidewalks.push(strip);
      const count=Math.max(1,Math.floor(length/55));
      for(let j=0;j<count;j++) {
        const t=(j+.5)/count;
        lamps.push({id:`${block.id}/edge-${i}/lamp-${j}`,streetId:`${block.id}/edge-${i}`,hierarchyId:'secondary',position:[x+dx*t+nx*.8,z+dz*t+nz*.8],facing:[-nx,-nz],heightMetres:5.8});
      }
    });
  }
  function merged(parts:THREE.BufferGeometry[],color:number) {
    const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());
    if(!geometry)throw new Error('Could not build reviewed map surfaces.');
    group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.95,side:THREE.DoubleSide})));
  }
  merged(surfaces,0x283036);merged(sidewalks,0x555b5e);
  const size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(size.x+50,size.z+50),new THREE.MeshStandardMaterial({color:0x141b21,roughness:.95}));
  ground.rotation.x=-Math.PI/2;ground.position.set(centre.x,-.02,centre.z);group.add(ground);
  return {group,bounds,lamps};
}
