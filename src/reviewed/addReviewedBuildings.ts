import * as THREE from 'three';
import type { FirstPersonCollisionBounds } from '../app/firstPersonCollision';
import type { ReviewedCity } from './reviewedCity';

/** Full exported affine matrices are used without placement fitting or decomposition. */
export function addReviewedBuildings(source: THREE.Group, data: ReviewedCity) {
  source.updateMatrixWorld(true);
  const group = new THREE.Group();
  const bounds = new THREE.Box3();
  const parts = new Map<string, THREE.Mesh[]>();
  for (const model of data.models) {
    const root = source.getObjectByName(model.id);
    if (!root) throw new Error(`Missing reviewed model ${model.id}`);
    const meshes: THREE.Mesh[] = [];
    root.traverse(o=>{if(o instanceof THREE.Mesh) meshes.push(o);});
    if (!meshes.length) throw new Error(`Empty reviewed model ${model.id}`);
    parts.set(model.id,meshes);
  }
  const batches = new Map<string, {part:THREE.Mesh; matrices:THREE.Matrix4[]}>();
  const instance = new THREE.Matrix4();
  const colliders: FirstPersonCollisionBounds[] = [];
  for (const placement of data.instances) {
    instance.fromArray(placement.matrix);
    const placementBounds = new THREE.Box3();
    for (const [index,part] of parts.get(placement.modelId)!.entries()) {
      const matrix = instance.clone().multiply(part.matrixWorld);
      part.geometry.computeBoundingBox();
      const partBounds = part.geometry.boundingBox!.clone().applyMatrix4(matrix);
      bounds.union(partBounds);
      placementBounds.union(partBounds);
      // Instancing doesn't support mirrored transforms; ordinary meshes also
      // preserve correct inverse-transpose normals for any authored shear.
      const e=matrix.elements;
      const x=new THREE.Vector3(e[0],e[1],e[2]), y=new THREE.Vector3(e[4],e[5],e[6]), z=new THREE.Vector3(e[8],e[9],e[10]);
      const sheared=Math.max(Math.abs(x.clone().normalize().dot(y.clone().normalize())),Math.abs(x.clone().normalize().dot(z.clone().normalize())),Math.abs(y.clone().normalize().dot(z.clone().normalize())))>1e-5;
      if(matrix.determinant()<0 || sheared) {
        const mesh=new THREE.Mesh(part.geometry,part.material); mesh.matrixAutoUpdate=false; mesh.matrix.copy(matrix); group.add(mesh); continue;
      }
      const key=`${placement.modelId}/${index}/${Math.floor(e[12]!/500)}/${Math.floor(e[14]!/500)}`;
      const batch=batches.get(key) ?? {part,matrices:[]}; batch.matrices.push(matrix); batches.set(key,batch);
    }
    if (placementBounds.min.y < 1.8 && placementBounds.max.y > 0) {
      colliders.push({id:placement.id,minX:placementBounds.min.x,maxX:placementBounds.max.x,minZ:placementBounds.min.z,maxZ:placementBounds.max.z});
    }
  }
  for(const {part,matrices} of batches.values()) {
    const mesh=new THREE.InstancedMesh(part.geometry,part.material,matrices.length);
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m)); mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh);
  }
  return {group,bounds,colliders,batches:group.children.length};
}
