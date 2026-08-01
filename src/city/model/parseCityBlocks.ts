import type { ProcessedCityBlocks } from './cityBlocks';

export function parseCityBlocks(value: unknown): ProcessedCityBlocks {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.metadata) ||
    !Array.isArray(value.districts) ||
    !Array.isArray(value.blocks)
  ) {
    throw new Error('Processed city blocks have an unsupported schema.');
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
      !isValidPolygon(block.buildablePolygon) ||
      !isPoint(block.centroid)
    ) {
      throw new Error('Processed city block definitions are malformed.');
    }
  }

  return value as ProcessedCityBlocks;
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
