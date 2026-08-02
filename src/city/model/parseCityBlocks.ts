import type { ProcessedCityBlocks } from './cityBlocks';

export function parseCityBlocks(value: unknown): ProcessedCityBlocks {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 2 ||
    !isRecord(value.metadata) ||
    !Array.isArray(value.districts) ||
    !Array.isArray(value.candidateAudit) ||
    !Array.isArray(value.blocks)
  ) {
    throw new Error('Processed city blocks have an unsupported schema.');
  }

  for (const candidate of value.candidateAudit) {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== 'string' ||
      !isCandidateOutcome(candidate.outcome) ||
      (candidate.polygon !== null && !isValidPolygon(candidate.polygon)) ||
      (candidate.centroid !== null && !isPoint(candidate.centroid)) ||
      (candidate.areaSquareMetres !== null &&
        (typeof candidate.areaSquareMetres !== 'number' ||
          !Number.isFinite(candidate.areaSquareMetres)))
    ) {
      throw new Error('Processed block candidate audit entries are malformed.');
    }
  }

  for (const district of value.districts) {
    if (
      !isRecord(district) ||
      typeof district.id !== 'string' ||
      typeof district.label !== 'string' ||
      typeof district.profile !== 'string'
    ) {
      throw new Error('Processed city district definitions are malformed.');
    }
  }

  for (const block of value.blocks) {
    if (
      !isRecord(block) ||
      typeof block.id !== 'string' ||
      typeof block.districtId !== 'string' ||
      typeof block.profile !== 'string' ||
      !isValidPolygon(block.polygon) ||
      !Array.isArray(block.buildableRegions) ||
      block.buildableRegions.length === 0 ||
      !block.buildableRegions.every(isBuildableRegion) ||
      !isPoint(block.centroid) ||
      !isFiniteNumber(block.areaSquareMetres) ||
      !isFiniteNumber(block.buildableAreaSquareMetres)
    ) {
      throw new Error('Processed city block definitions are malformed.');
    }
  }

  return value as ProcessedCityBlocks;
}

function isBuildableRegion(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.derivation === 'convex-inset' ||
      value.derivation === 'triangulated-inset') &&
    isValidPolygon(value.polygon) &&
    isPoint(value.centroid) &&
    isFiniteNumber(value.areaSquareMetres)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCandidateOutcome(value: unknown): boolean {
  return (
    value === 'retained' ||
    value === 'area' ||
    value === 'unsupportedTopology' ||
    value === 'concaveDerivationFailure' ||
    value === 'railExclusion' ||
    value === 'waterExclusion' ||
    value === 'roadExclusion' ||
    value === 'insetFailure' ||
    value === 'insufficientBuildableArea'
  );
}

function isValidPolygon(value: unknown): boolean {
  return Array.isArray(value) && value.length >= 3 && value.every(isPoint);
}

function isPoint(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    Number.isFinite(value[0]) &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[1])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
