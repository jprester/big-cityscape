import * as THREE from 'three';
import type { DebugLayerManager } from '../../debug/DebugLayerManager';
import type {
  BuildingMassPart,
  CityMassingDefinition,
  MassingMaterialCategory,
} from '../model/cityMassing';
import { MASSING_MATERIAL_CATEGORIES } from '../model/cityMassing';

const MATERIAL_COLORS: Readonly<Record<MassingMaterialCategory, number>> = {
  commercial: 0x567c91,
  'mixed-use': 0x777d86,
  landmark: 0xb57a58,
};

export function addCityMassingLayer(
  layers: DebugLayerManager,
  massing: CityMassingDefinition,
): void {
  const group = new THREE.Group();
  group.name = 'city:primitive-massing';
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const materials: THREE.MeshLambertMaterial[] = [];
  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  for (const category of MASSING_MATERIAL_CATEGORIES) {
    const parts = massing.buildings
      .filter((building) => building.material === category)
      .flatMap((building) => building.parts);

    if (parts.length === 0) {
      continue;
    }

    const material = new THREE.MeshLambertMaterial({
      color: MATERIAL_COLORS[category],
      emissive: new THREE.Color(MATERIAL_COLORS[category]).multiplyScalar(0.055),
    });
    const instances = new THREE.InstancedMesh(geometry, material, parts.length);
    instances.name = `primitive-masses:${category}`;
    instances.castShadow = false;
    instances.receiveShadow = false;

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];

      if (part === undefined) {
        continue;
      }

      composePartTransform(part, transform, position, rotation, scale, yAxis);
      instances.setMatrixAt(index, transform);
    }

    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingBox();
    instances.computeBoundingSphere();
    group.add(instances);
    materials.push(material);
  }

  const hemisphereLight = new THREE.HemisphereLight(0xc3ddeb, 0x172028, 2.1);
  hemisphereLight.name = 'massing:hemisphere-light';
  const directionalLight = new THREE.DirectionalLight(0xffe5c6, 2.4);
  directionalLight.name = 'massing:key-light';
  directionalLight.position.set(-650, 900, 420);
  group.add(hemisphereLight, directionalLight);

  layers.add({
    id: 'primitive-masses',
    label: `${massing.metadata.buildings} buildings · ${massing.metadata.primitiveParts} box parts`,
    object: group,
    dispose: () => {
      geometry.dispose();

      for (const material of materials) {
        material.dispose();
      }
    },
  });
}

function composePartTransform(
  part: BuildingMassPart,
  transform: THREE.Matrix4,
  position: THREE.Vector3,
  rotation: THREE.Quaternion,
  scale: THREE.Vector3,
  yAxis: THREE.Vector3,
): void {
  position.set(
    part.center[0],
    part.baseHeightMetres + part.heightMetres / 2,
    part.center[1],
  );
  rotation.setFromAxisAngle(yAxis, -part.rotationRadians);
  scale.set(part.widthMetres, part.heightMetres, part.depthMetres);
  transform.compose(position, rotation, scale);
}
