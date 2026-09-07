import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { validateReviewedCity, type ReviewedCity } from './reviewedCity';
import { addReviewedBuildings } from './addReviewedBuildings';
import { addReviewedMap } from './addReviewedMap';

function fixture(matrix = new THREE.Matrix4()): ReviewedCity {
  return {schemaVersion:1,sourceBlend:'city.blend',sourceSha256:'a'.repeat(64),packSha256:'b'.repeat(64),packFile:'city.glb',models:[{id:'tower',triangles:12}],blocks:[{id:'block',footprintXZ:[[10,20],[80,20],[80,90],[10,90]]}],instances:[{id:'instance',name:'Authored tower',modelId:'tower',blockId:'block',matrix:matrix.toArray()}]};
}
function source() {
  const group=new THREE.Group();const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,4,6),new THREE.MeshStandardMaterial());mesh.name='tower';mesh.position.set(3,1,-2);group.add(mesh);return {group,mesh};
}
describe('reviewed city snapshot',()=>{
  it('rejects dangling block/model references and duplicate instance IDs',()=>{
    const d=fixture();expect(validateReviewedCity(d)).toBe(d);
    expect(()=>validateReviewedCity({...d,instances:[...d.instances,...d.instances]})).toThrow();
    expect(()=>validateReviewedCity({...d,models:[]})).toThrow();
    expect(()=>validateReviewedCity({...d,blocks:[{...d.blocks[0],id:'other'}]})).toThrow();
    expect(()=>validateReviewedCity({...d,packFile:'../outside.glb'})).toThrow();
  });
  it('composes exported translation, rotation and nonuniform scale with the glTF part transform',()=>{
    const m=new THREE.Matrix4().compose(new THREE.Vector3(123,7,-256),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.73),new THREE.Vector3(1.3,2.1,.8));
    const {group,mesh}=source();const result=addReviewedBuildings(group,fixture(m));
    const batch=result.group.children[0] as THREE.InstancedMesh;expect(batch.isInstancedMesh).toBe(true);
    const actual=new THREE.Matrix4();batch.getMatrixAt(0,actual);
    const expected=m.clone().multiply(mesh.matrixWorld);
    actual.elements.forEach((v,i)=>expect(v).toBeCloseTo(expected.elements[i]!,4));
    const expectedBounds=new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute).applyMatrix4(expected);
    expect(result.bounds.min.distanceTo(expectedBounds.min)).toBeLessThan(1e-7);
  });
  it('preserves mirrored and sheared instances through the non-instanced fallback',()=>{
    for(const m of [new THREE.Matrix4().makeScale(-1,1,1),new THREE.Matrix4().makeShear(.2,0,0,0,0,0)]) {
      const {group,mesh}=source();const result=addReviewedBuildings(group,fixture(m));
      const rendered=result.group.children[0] as THREE.Mesh;
      expect(rendered instanceof THREE.InstancedMesh).toBe(false);
      expect(rendered.matrix.equals(m.clone().multiply(mesh.matrixWorld))).toBe(true);
    }
  });
  it('retains authored block coordinates rather than mirroring or regenerating them',()=>{
    const map=addReviewedMap(fixture().blocks);
    expect(map.bounds.min.toArray()).toEqual([10,0,20]);expect(map.bounds.max.toArray()).toEqual([80,0,90]);
    const surface=map.group.children[0] as THREE.Mesh;surface.geometry.computeBoundingBox();
    expect(surface.geometry.boundingBox!.min.z).toBeCloseTo(20);expect(surface.geometry.boundingBox!.max.z).toBeCloseTo(90);
  });
});
