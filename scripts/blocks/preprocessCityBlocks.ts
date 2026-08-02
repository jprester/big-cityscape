import { createHash } from 'node:crypto';
import polygonize from '@turf/polygonize';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import type {
  BlockCandidateAudit,
  BlockCandidateDiscardReason,
  BlockProfile,
  BuildableRegion,
  BuildableRegionDiscardReason,
  CityBlock,
  ProcessedCityBlocks,
} from '../../src/city/model/cityBlocks';
import type { Point2, ProcessedCityStructure } from '../../src/city/model/processedCity';
import type { BlockPreprocessConfig } from './config';
import { deriveBuildableRegions } from './deriveBuildableRegions';
import {
  isConvexPolygon,
  minimumPolygonDistance,
  minimumPolygonPathDistance,
  polygonArea,
  polygonCentroid,
} from './polygon';

type DiscardedCandidateCounts = Record<BlockCandidateDiscardReason, number>;
type DiscardedRegionCounts = Record<BuildableRegionDiscardReason, number>;

export function preprocessCityBlocks(
  structure: ProcessedCityStructure,
  config: BlockPreprocessConfig,
  sourceStructureSha256: string,
): ProcessedCityBlocks {
  const districtIds = new Set(config.districts.map((district) => district.id));

  if (districtIds.size !== config.districts.length) {
    throw new Error('District IDs must be unique.');
  }

  const surfaceRoadPaths = structure.roads
    .filter((road) => road.layer === 0 && !road.bridge && !road.tunnel)
    .flatMap((road) => road.paths);
  const roadFeatures: Array<Feature<LineString>> = surfaceRoadPaths.map((path) => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: path.map(([x, z]) => [x, z]),
    },
  }));
  const roadCollection: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: roadFeatures,
  };
  const polygonCandidates = polygonize(roadCollection).features;
  const railPaths = structure.railways.flatMap((railway) => railway.paths);
  const waterRings = structure.waterRegions.flatMap((region) => {
    const outerRing = region.rings[0];
    return outerRing === undefined ? [] : [outerRing];
  });
  const discardedByReason: DiscardedCandidateCounts = {
    area: 0,
    unsupportedTopology: 0,
    concaveDerivationFailure: 0,
    railExclusion: 0,
    waterExclusion: 0,
    roadExclusion: 0,
    insetFailure: 0,
    insufficientBuildableArea: 0,
  };
  const discardedRegionsByReason: DiscardedRegionCounts = {
    area: 0,
    railClearance: 0,
    waterClearance: 0,
    roadClearance: 0,
  };
  const candidateAudit: BlockCandidateAudit[] = [];
  const blocks: CityBlock[] = [];

  for (const candidate of polygonCandidates) {
    const sourceRing = candidate.geometry.coordinates[0];

    if (sourceRing === undefined) {
      discardedByReason.unsupportedTopology += 1;
      candidateAudit.push({
        id: createStableCandidateId(candidate.geometry.coordinates),
        outcome: 'unsupportedTopology',
        polygon: null,
        centroid: null,
        areaSquareMetres: null,
      });
      continue;
    }

    let polygon: readonly Point2[];

    try {
      polygon = canonicalizeRing(sourceRing, config.coordinatePrecisionDecimals);
    } catch {
      discardedByReason.unsupportedTopology += 1;
      candidateAudit.push({
        id: createStableCandidateId(candidate.geometry.coordinates),
        outcome: 'unsupportedTopology',
        polygon: null,
        centroid: null,
        areaSquareMetres: null,
      });
      continue;
    }

    const areaSquareMetres = polygonArea(polygon);
    const auditBase = createCandidateAuditBase(
      polygon,
      areaSquareMetres,
      config.coordinatePrecisionDecimals,
    );

    if (candidate.geometry.coordinates.length !== 1) {
      discardedByReason.unsupportedTopology += 1;
      candidateAudit.push({
        ...auditBase,
        id: createStableCandidateId(candidate.geometry.coordinates),
        outcome: 'unsupportedTopology',
      });
      continue;
    }

    if (
      areaSquareMetres < config.minimumBlockAreaSquareMetres ||
      areaSquareMetres > config.maximumBlockAreaSquareMetres
    ) {
      discardedByReason.area += 1;
      candidateAudit.push({ ...auditBase, outcome: 'area' });
      continue;
    }

    let derivedRegions: ReturnType<typeof deriveBuildableRegions>;

    try {
      derivedRegions = deriveBuildableRegions(
        polygon,
        config.buildableInsetMetres,
      );
    } catch {
      if (isConvexPolygon(polygon)) {
        discardedByReason.insetFailure += 1;
        candidateAudit.push({ ...auditBase, outcome: 'insetFailure' });
      } else {
        discardedByReason.concaveDerivationFailure += 1;
        candidateAudit.push({ ...auditBase, outcome: 'concaveDerivationFailure' });
      }
      continue;
    }

    const roundedRegions = derivedRegions
      .map((region) => {
        const regionPolygon = roundPolygon(
          region.polygon,
          config.coordinatePrecisionDecimals,
        );

        return {
          derivation: region.derivation,
          polygon: regionPolygon,
          areaSquareMetres: polygonArea(regionPolygon),
        };
      });
    const sizedRegions = filterRegions(
      roundedRegions,
      (region) =>
        region.areaSquareMetres >=
        config.minimumBuildableRegionAreaSquareMetres,
      'area',
      discardedRegionsByReason,
    );

    if (sizedRegions.length === 0) {
      discardedByReason.insufficientBuildableArea += 1;
      candidateAudit.push({ ...auditBase, outcome: 'insufficientBuildableArea' });
      continue;
    }

    const railSafeRegions = filterRegions(
      sizedRegions,
      (region) =>
        minimumPolygonPathDistance(region.polygon, railPaths) >=
        config.railBufferMetres,
      'railClearance',
      discardedRegionsByReason,
    );

    if (railSafeRegions.length === 0) {
      discardedByReason.railExclusion += 1;
      candidateAudit.push({ ...auditBase, outcome: 'railExclusion' });
      continue;
    }

    const waterSafeRegions = filterRegions(
      railSafeRegions,
      (region) =>
        waterRings.reduce(
          (minimum, waterRing) =>
            Math.min(minimum, minimumPolygonDistance(region.polygon, waterRing)),
          Number.POSITIVE_INFINITY,
        ) >= config.waterBufferMetres,
      'waterClearance',
      discardedRegionsByReason,
    );

    if (waterSafeRegions.length === 0) {
      discardedByReason.waterExclusion += 1;
      candidateAudit.push({ ...auditBase, outcome: 'waterExclusion' });
      continue;
    }

    const roadSafeRegions = filterRegions(
      waterSafeRegions,
      (region) =>
        minimumPolygonPathDistance(region.polygon, surfaceRoadPaths) >=
        config.surfaceRoadBufferMetres,
      'roadClearance',
      discardedRegionsByReason,
    );

    if (roadSafeRegions.length === 0) {
      discardedByReason.roadExclusion += 1;
      candidateAudit.push({ ...auditBase, outcome: 'roadExclusion' });
      continue;
    }

    const buildableAreaSquareMetres = roadSafeRegions.reduce(
      (total, region) => total + region.areaSquareMetres,
      0,
    );

    if (buildableAreaSquareMetres < config.minimumBuildableAreaSquareMetres) {
      discardedByReason.insufficientBuildableArea += 1;
      candidateAudit.push({ ...auditBase, outcome: 'insufficientBuildableArea' });
      continue;
    }

    const centroid = auditBase.centroid;

    if (centroid === null) {
      throw new Error('A valid block candidate must have a centroid.');
    }

    const districtId = assignDistrict(centroid);

    if (!districtIds.has(districtId)) {
      throw new Error(`Derived block references unknown district "${districtId}".`);
    }

    const blockId = createStableBlockId(polygon);
    const buildableRegions: BuildableRegion[] = roadSafeRegions.map((region) => ({
      id: createStableRegionId(blockId, region.polygon),
      derivation: region.derivation,
      polygon: region.polygon,
      centroid: roundPoint(
        polygonCentroid(region.polygon),
        config.coordinatePrecisionDecimals,
      ),
      areaSquareMetres: roundNumber(region.areaSquareMetres, 2),
    }));
    buildableRegions.sort((first, second) => first.id.localeCompare(second.id));

    blocks.push({
      id: blockId,
      districtId,
      profile: assignBlockProfile(districtId, areaSquareMetres),
      derivation: 'road-polygonized',
      polygon,
      buildableRegions,
      centroid,
      areaSquareMetres: roundNumber(areaSquareMetres, 2),
      buildableAreaSquareMetres: roundNumber(buildableAreaSquareMetres, 2),
    });
    candidateAudit.push({ ...auditBase, outcome: 'retained' });
  }

  blocks.sort(
    (first, second) =>
      first.districtId.localeCompare(second.districtId) ||
      first.centroid[1] - second.centroid[1] ||
      first.centroid[0] - second.centroid[0],
  );
  candidateAudit.sort((first, second) => first.id.localeCompare(second.id));

  const blockIds = new Set(blocks.map((block) => block.id));
  const buildableRegions = blocks.flatMap((block) => block.buildableRegions);
  const regionIds = new Set(buildableRegions.map((region) => region.id));
  const candidateIds = new Set(candidateAudit.map((candidate) => candidate.id));

  if (blockIds.size !== blocks.length) {
    throw new Error('Derived stable block IDs contain a collision.');
  }

  if (regionIds.size !== buildableRegions.length) {
    throw new Error('Derived stable buildable region IDs contain a collision.');
  }

  if (candidateIds.size !== candidateAudit.length) {
    throw new Error('Derived stable block candidate IDs contain a collision.');
  }

  const discardedCandidates = Object.values(discardedByReason).reduce(
    (total, count) => total + count,
    0,
  );
  const discardedBuildableRegions = Object.values(
    discardedRegionsByReason,
  ).reduce((total, count) => total + count, 0);

  if (blocks.length + discardedCandidates !== polygonCandidates.length) {
    throw new Error('Block candidate accounting does not match the polygonizer output.');
  }

  if (candidateAudit.length !== polygonCandidates.length) {
    throw new Error('Block candidate audit does not match the polygonizer output.');
  }

  const totalBlockAreaSquareMetres = roundNumber(
    blocks.reduce((total, block) => total + block.areaSquareMetres, 0),
    2,
  );
  const totalBuildableAreaSquareMetres = roundNumber(
    blocks.reduce((total, block) => total + block.buildableAreaSquareMetres, 0),
    2,
  );

  return {
    schemaVersion: 2,
    metadata: {
      sourceStructureFile: getBaseName(config.sourceStructureFile),
      sourceStructureSha256,
      workingAreaId: structure.metadata.clip.id,
      derivation: 'surface-road-polygonization',
      exclusions: {
        railBufferMetres: config.railBufferMetres,
        waterBufferMetres: config.waterBufferMetres,
        surfaceRoadBufferMetres: config.surfaceRoadBufferMetres,
      },
      buildable: {
        insetMetres: config.buildableInsetMetres,
        minimumAreaSquareMetres: config.minimumBuildableAreaSquareMetres,
        minimumRegionAreaSquareMetres:
          config.minimumBuildableRegionAreaSquareMetres,
        concaveStrategy: 'all-viable-inset-triangles',
      },
      counts: {
        districts: config.districts.length,
        sourceSurfaceRoadPaths: surfaceRoadPaths.length,
        polygonCandidates: polygonCandidates.length,
        blocks: blocks.length,
        manualOverrides: 0,
        discardedCandidates,
        discardedByReason,
        discardedBuildableRegions,
        discardedRegionsByReason,
        buildableRegions: buildableRegions.length,
        regionsByDerivation: {
          convexInset: buildableRegions.filter(
            (region) => region.derivation === 'convex-inset',
          ).length,
          triangulatedInset: buildableRegions.filter(
            (region) => region.derivation === 'triangulated-inset',
          ).length,
        },
      },
      totalBlockAreaSquareMetres,
      totalBuildableAreaSquareMetres,
    },
    districts: config.districts,
    candidateAudit,
    blocks,
  };
}

function filterRegions<T>(
  regions: readonly T[],
  predicate: (region: T) => boolean,
  discardReason: BuildableRegionDiscardReason,
  discardedRegionsByReason: DiscardedRegionCounts,
): readonly T[] {
  return regions.filter((region) => {
    const retained = predicate(region);

    if (!retained) {
      discardedRegionsByReason[discardReason] += 1;
    }

    return retained;
  });
}

function createCandidateAuditBase(
  polygon: readonly Point2[],
  areaSquareMetres: number,
  precisionDecimals: number,
): Omit<BlockCandidateAudit, 'outcome'> {
  return {
    id: createStableCandidateId(polygon),
    polygon,
    centroid: roundPoint(polygonCentroid(polygon), precisionDecimals),
    areaSquareMetres: roundNumber(areaSquareMetres, 2),
  };
}

function assignDistrict([x, z]: Point2): string {
  if (z >= 0) {
    return 'riverfront-transition';
  }

  return x >= 450 ? 'east-core' : 'west-mixed';
}

function assignBlockProfile(districtId: string, areaSquareMetres: number): BlockProfile {
  if (districtId === 'riverfront-transition') {
    return 'riverfront';
  }

  if (areaSquareMetres >= 8_000) {
    return 'large-parcel';
  }

  return areaSquareMetres <= 2_500 ? 'compact-urban' : 'regular-urban';
}

function canonicalizeRing(
  coordinates: readonly (readonly number[])[],
  precisionDecimals: number,
): readonly Point2[] {
  const points = coordinates.map((coordinate) => {
    if (
      coordinate.length < 2 ||
      coordinate[0] === undefined ||
      coordinate[1] === undefined ||
      !Number.isFinite(coordinate[0]) ||
      !Number.isFinite(coordinate[1])
    ) {
      throw new Error('Polygonizer returned an invalid coordinate.');
    }

    return roundPoint([coordinate[0], coordinate[1]], precisionDecimals);
  });
  const first = points[0];
  const last = points.at(-1);

  if (first !== undefined && last !== undefined && pointsEqual(first, last)) {
    points.pop();
  }

  if (points.length < 3) {
    throw new Error('Polygonizer returned a degenerate ring.');
  }

  const variants: Array<{ key: string; points: readonly Point2[] }> = [];

  for (const direction of [points, [...points].reverse()]) {
    for (let startIndex = 0; startIndex < direction.length; startIndex += 1) {
      const rotated = [...direction.slice(startIndex), ...direction.slice(0, startIndex)];
      variants.push({ key: JSON.stringify(rotated), points: rotated });
    }
  }

  variants.sort((firstVariant, secondVariant) =>
    firstVariant.key.localeCompare(secondVariant.key),
  );

  const canonical = variants[0]?.points;

  if (canonical === undefined) {
    throw new Error('Polygonizer ring could not be canonicalized.');
  }

  return canonical;
}

function createStableBlockId(polygon: readonly Point2[]): string {
  const digest = createHash('sha256').update(JSON.stringify(polygon)).digest('hex');
  return `block-${digest.slice(0, 10)}`;
}

function createStableRegionId(
  blockId: string,
  polygon: readonly Point2[],
): string {
  const digest = createHash('sha256').update(JSON.stringify(polygon)).digest('hex');
  return `${blockId}/region-${digest.slice(0, 10)}`;
}

function createStableCandidateId(geometry: unknown): string {
  const digest = createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
  return `candidate-${digest.slice(0, 10)}`;
}

function roundPolygon(
  polygon: readonly Point2[],
  precisionDecimals: number,
): readonly Point2[] {
  return polygon.map((point) => roundPoint(point, precisionDecimals));
}

function roundPoint([x, z]: Point2, precisionDecimals: number): Point2 {
  return [roundNumber(x, precisionDecimals), roundNumber(z, precisionDecimals)];
}

function roundNumber(value: number, precisionDecimals: number): number {
  const factor = 10 ** precisionDecimals;
  return Math.round(value * factor) / factor;
}

function pointsEqual(first: Point2, second: Point2): boolean {
  return first[0] === second[0] && first[1] === second[1];
}

function getBaseName(filePath: string): string {
  return filePath.split(/[\\/]/).at(-1) ?? filePath;
}
