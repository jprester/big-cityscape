import { createFirstPersonController, type FirstPersonController } from '../app/createFirstPersonController';
import { createFirstPersonCollisionIndex } from '../app/firstPersonCollision';
import { createFirstPersonHud } from '../app/createFirstPersonHud';
import { reviewedWalkSpawn } from './reviewedWalkSpawn';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createInspectionCamera } from '../app/createInspectionCamera';
import { createPerformancePanel } from '../app/createPerformancePanel';
import { DebugLayerManager } from '../debug/DebugLayerManager';
import { createDebugPanel } from '../debug/createDebugPanel';
import { addSyntheticInspectionLighting } from '../city/synthetic/rendering/addSyntheticInspectionLighting';
import { addSyntheticAtmosphereLayer } from '../city/synthetic/rendering/addSyntheticAtmosphereLayer';
import { addSyntheticStreetLampLayer } from '../city/synthetic/rendering/addSyntheticStreetLampLayer';
import { createSyntheticEnvironmentPreset, readSyntheticEnvironmentPreset, type SyntheticEnvironmentPresetId } from '../synthetic/syntheticEnvironmentPresets';
import { validateReviewedCity } from './reviewedCity';
import { addReviewedBuildings } from './addReviewedBuildings';
import { addReviewedMap } from './addReviewedMap';

export async function createReviewedCityApp(host:HTMLElement) {
  host.textContent='Loading the reviewed Blender city…';
  const base=`${import.meta.env.BASE_URL}assets/city-reviewed/`;
  const response=await fetch(`${base}reviewed-city.json`,{cache:'no-store'});
  if(!response.ok)throw new Error('Run npm run city:export-reviewed to create the reviewed city snapshot.');
  const data=validateReviewedCity(await response.json());
  const gltf=await new GLTFLoader().loadAsync(`${base}${data.packFile}?revision=${data.packSha256.slice(0,12)}`);
  const buildings=addReviewedBuildings(gltf.scene,data);
  const map=addReviewedMap(data.blocks);
  const scene=new THREE.Scene();scene.name='reviewed-blender-city';
  const layers=new DebugLayerManager();scene.add(layers.root);
  layers.add({id:'reviewed-buildings',label:`${data.instances.length.toLocaleString()} Blender building placements`,object:buildings.group});
  layers.add({id:'reviewed-map',label:`${data.blocks.length} authored blocks · road surface + sidewalks`,object:map.group});
  const extent=Math.max(map.bounds.max.x-map.bounds.min.x,map.bounds.max.z-map.bounds.min.z);
  let presetId=readSyntheticEnvironmentPreset(window.location.search);
  let preset=createSyntheticEnvironmentPreset(presetId,extent);
  const light=addSyntheticInspectionLighting(layers,extent,preset.lighting);
  const atmosphere=addSyntheticAtmosphereLayer(layers,scene,preset.atmosphere);
  const lamps=addSyntheticStreetLampLayer(layers,map.lamps,preset.streetLamps);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.domElement.className='city-canvas';renderer.domElement.setAttribute('aria-label','Reviewed Blender city viewport');
  const centre=map.bounds.getCenter(new THREE.Vector3());
  const inspection=createInspectionCamera(renderer.domElement,extent*1.4,{xMetres:centre.x,zMetres:centre.z,heightMetres:buildings.bounds.max.y});
  let frame=0,running=false,previous=performance.now();
  let walk: FirstPersonController | undefined;
  const performancePanel=createPerformancePanel(renderer,scene);
  const invalidate=()=>{if(running&&!frame)frame=requestAnimationFrame(render);};
  function render(now:number) {
    frame=0;
    const delta=Math.min((now-previous)/1000,.1);previous=now;
    const changed=walk?.isActive() ? false : inspection.update(delta);
    const walked=walk?.update(delta) ?? false;
    atmosphere.update(inspection.camera);lamps.update(inspection.camera);
    renderer.render(scene,inspection.camera);performancePanel.update(delta);
    if(changed || walked || walk?.isActive())invalidate();else performancePanel.setIdle();
  }
  function environment(id:SyntheticEnvironmentPresetId) {
    presetId=id;preset=createSyntheticEnvironmentPreset(id,extent);
    light.setConfig(preset.lighting);atmosphere.setConfig(preset.atmosphere);lamps.setConfig(preset.streetLamps);
    const url=new URL(window.location.href);url.searchParams.set('time',id);history.replaceState(null,'',url);invalidate();
  }
  const hud = createFirstPersonHud();
  const walkBounds = {minX:map.bounds.min.x,maxX:map.bounds.max.x,minZ:map.bounds.min.z,maxZ:map.bounds.max.z};
  const colliders = [...buildings.colliders, ...map.lamps.map(lamp => ({
    id:lamp.id,minX:lamp.position[0]-.065,maxX:lamp.position[0]+.065,minZ:lamp.position[1]-.065,maxZ:lamp.position[1]+.065,
  }))];
  const spawn = reviewedWalkSpawn(walkBounds, colliders);
  walk = createFirstPersonController({
    camera:inspection.camera,canvas:renderer.domElement,orbitControls:inspection.controls,
    bounds:walkBounds,spawnPosition:spawn,spawnTarget:[spawn[0],1.8,spawn[2]-30],
    eyeHeightMetres:1.8,walkSpeedMetresPerSecond:7,fastMultiplier:3.5,boundaryInsetMetres:2,
    collisionIndex:createFirstPersonCollisionIndex(colliders,100),collisionRadiusMetres:.38,
    collisionSubstepMetres:.2,nearPlaneMetres:.1,
    onActiveChange:active=>{hud.setActive(active);host.classList.toggle('first-person-active',active);invalidate();},
    onChange:invalidate,
  });
  const panel=createDebugPanel(layers,[
    {id:'overview',label:'Overview',activate:()=>{walk?.exit();inspection.setPreset('aerial');inspection.camera.position.add(centre);inspection.controls.target.copy(centre);invalidate();}},
    {id:'rooftop',label:'Rooftop',activate:()=>{walk?.exit();inspection.setPreset('rooftop');invalidate();}},
    {id:'street',label:'Street',activate:()=>{walk?.exit();inspection.setPreset('street');invalidate();}},
    {id:'walk',label:'Walk',activate:()=>walk?.enter()},
  ],'Reviewed Blender city',invalidate,(['day','dusk','night'] as const).map(id=>({id,label:id[0]!.toUpperCase()+id.slice(1),selected:id===presetId,activate:()=>environment(id)})));
  const summary=document.createElement('p');
  summary.textContent=`${data.models.length} unique meshes · ${buildings.batches} building batches · ${data.instances.filter(i=>i.blockId===null).length} placements outside blocks. Source: ${data.sourceBlend}.`;
  panel.element.append(summary);
  const alternate=document.createElement('a');alternate.href='?view=synthetic&mode=city&appearance=textured';alternate.textContent='Open procedural city';panel.element.append(alternate);
  host.replaceChildren(renderer.domElement,panel.element,performancePanel.element,hud.element);
  const resize=()=>{const width=host.clientWidth||window.innerWidth,height=host.clientHeight||window.innerHeight;renderer.setSize(width,height);inspection.resize(width,height);invalidate();};
  window.addEventListener('resize',resize);inspection.controls.addEventListener('change',invalidate);resize();
  return {
    start:()=>{running=true;invalidate();},
    dispose:()=>{
      running=false;walk?.dispose();hud.dispose();host.classList.remove('first-person-active');cancelAnimationFrame(frame);window.removeEventListener('resize',resize);inspection.controls.removeEventListener('change',invalidate);inspection.dispose();panel.dispose();performancePanel.dispose();
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
      for(const root of [scene,gltf.scene])root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);if(o instanceof THREE.InstancedMesh)o.dispose();}});
      materials.forEach(m=>{Object.values(m).forEach(v=>{if(v instanceof THREE.Texture)textures.add(v);});m.dispose();});
      geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());layers.dispose();renderer.dispose();host.replaceChildren();
    },
  };
}
