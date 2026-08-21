import * as THREE from 'three';
import type { DebugLayerManager } from '../../../debug/DebugLayerManager';
import {
  SYNTHETIC_SIGN_KINDS,
  type SyntheticSignagePlan,
  type SyntheticSignKind,
  type SyntheticSignPlacement,
} from '../model/signage';

export type SyntheticSignageRenderStats = Readonly<{
  instanceCount: number;
  drawCalls: number;
  triangles: number;
}>;

const SIGN_COLORS: Readonly<Record<SyntheticSignKind, number>> = {
  advertisement: 0x42dfff,
  neon: 0xff4fd8,
  logo: 0xffbd59,
};

export function addSyntheticSignageDebugLayer(
  layers: DebugLayerManager,
  plan: SyntheticSignagePlan,
): SyntheticSignageRenderStats {
  const root = new THREE.Group();
  root.name = 'synthetic:signage-debug';
  const geometry = new THREE.PlaneGeometry(1, 1);
  const materials: THREE.MeshBasicMaterial[] = [];
  let drawCalls = 0;

  for (const kind of SYNTHETIC_SIGN_KINDS) {
    const signs = plan.placements.filter((sign) => sign.kind === kind);

    if (signs.length === 0) {
      continue;
    }

    const material = new THREE.MeshBasicMaterial({
      color: SIGN_COLORS[kind],
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      toneMapped: false,
    });
    // Transparent DoubleSide materials otherwise render one pass per side.
    material.forceSinglePass = true;
    const mesh = new THREE.InstancedMesh(geometry, material, signs.length);
    mesh.name = `synthetic:signage:${kind}`;
    setSignMatrices(mesh, signs);
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    root.add(mesh);
    materials.push(material);
    drawCalls += 1;
  }

  layers.add({
    id: 'synthetic-signage-anchors',
    label:
      `${plan.metadata.signCount} signs · ` +
      `${plan.metadata.mountingZoneCounts.facade} façade · ` +
      `${plan.metadata.mountingZoneCounts.storefront} storefront · ` +
      `${plan.metadata.mountingZoneCounts.crown} crown · ` +
      'cyan/magenta/amber',
    object: root,
    dispose: () => {
      geometry.dispose();
      materials.forEach((material) => material.dispose());
    },
  });

  return {
    instanceCount: plan.metadata.signCount,
    drawCalls,
    triangles: plan.metadata.signCount * 2,
  };
}

function setSignMatrices(
  mesh: THREE.InstancedMesh,
  signs: readonly SyntheticSignPlacement[],
): void {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  signs.forEach((sign, index) => {
    position.set(...sign.center);
    rotation.setFromAxisAngle(yAxis, sign.rotationRadians);
    scale.set(sign.widthMetres, sign.heightMetres, 1);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
}
