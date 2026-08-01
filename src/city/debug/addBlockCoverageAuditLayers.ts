import * as THREE from 'three';
import type { DebugLayerManager } from '../../debug/DebugLayerManager';
import type {
  BlockCandidateAudit,
  BlockCandidateDiscardReason,
  ProcessedCityBlocks,
} from '../model/cityBlocks';
import type { Point2 } from '../model/processedCity';

const AUDIT_HEIGHT_METRES = 1.14;

type RejectionLayerDefinition = Readonly<{
  reason: BlockCandidateDiscardReason;
  label: string;
  color: number;
}>;

const REJECTION_LAYERS: readonly RejectionLayerDefinition[] = [
  { reason: 'area', label: 'area range', color: 0xb8a87a },
  { reason: 'railExclusion', label: 'rail clearance', color: 0xe766b5 },
  { reason: 'waterExclusion', label: 'water clearance', color: 0x4ccae8 },
  { reason: 'roadExclusion', label: 'road clearance', color: 0xf28a55 },
  { reason: 'insetFailure', label: 'convex inset', color: 0xb47be8 },
  {
    reason: 'insufficientBuildableArea',
    label: 'buildable area',
    color: 0xe4c657,
  },
  {
    reason: 'concaveDerivationFailure',
    label: 'concave derivation',
    color: 0xdf5c69,
  },
  {
    reason: 'unsupportedTopology',
    label: 'unsupported topology',
    color: 0x9aa7b0,
  },
];

export function addBlockCoverageAuditLayers(
  layers: DebugLayerManager,
  cityBlocks: ProcessedCityBlocks,
): void {
  for (const definition of REJECTION_LAYERS) {
    const candidates = cityBlocks.candidateAudit.filter(
      (candidate) => candidate.outcome === definition.reason,
    );

    if (candidates.length === 0) {
      continue;
    }

    addRejectionLayer(layers, definition, candidates);
  }
}

function addRejectionLayer(
  layers: DebugLayerManager,
  definition: RejectionLayerDefinition,
  candidates: readonly BlockCandidateAudit[],
): void {
  const polygons = candidates
    .filter(hasPolygon)
    .map((candidate) => candidate.polygon);
  const positions = createOutlinePositions(polygons);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  if (positions.length > 0) {
    geometry.computeBoundingSphere();
  }

  const material = new THREE.LineBasicMaterial({
    color: definition.color,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = `debug:block-candidate-${definition.reason}`;

  layers.add({
    id: `block-candidate-${definition.reason}`,
    label: `${candidates.length} rejected · ${definition.label}`,
    object: lines,
    visible: false,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
}

function hasPolygon(
  candidate: BlockCandidateAudit,
): candidate is BlockCandidateAudit & { polygon: readonly Point2[] } {
  return candidate.polygon !== null;
}

function createOutlinePositions(
  polygons: readonly (readonly Point2[])[],
): readonly number[] {
  const positions: number[] = [];

  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];

      if (start !== undefined && end !== undefined) {
        positions.push(
          start[0],
          AUDIT_HEIGHT_METRES,
          start[1],
          end[0],
          AUDIT_HEIGHT_METRES,
          end[1],
        );
      }
    }
  }

  return positions;
}
