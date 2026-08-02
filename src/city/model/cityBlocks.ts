import type { Point2 } from './processedCity';

export type DistrictProfile =
  | 'dense-central-core'
  | 'commercial-transition'
  | 'dense-mixed'
  | 'infrastructure-edge';

export type BlockProfile =
  | 'compact-urban'
  | 'regular-urban'
  | 'large-parcel'
  | 'riverfront';

export type BuildableDerivation = 'convex-inset' | 'triangulated-inset';

export type BuildableRegionDiscardReason =
  | 'area'
  | 'railClearance'
  | 'waterClearance'
  | 'roadClearance';

export type BuildableRegion = Readonly<{
  id: string;
  derivation: BuildableDerivation;
  polygon: readonly Point2[];
  centroid: Point2;
  areaSquareMetres: number;
}>;

export type BlockCandidateDiscardReason =
  | 'area'
  | 'unsupportedTopology'
  | 'concaveDerivationFailure'
  | 'railExclusion'
  | 'waterExclusion'
  | 'roadExclusion'
  | 'insetFailure'
  | 'insufficientBuildableArea';

export type BlockCandidateOutcome = 'retained' | BlockCandidateDiscardReason;

export type BlockCandidateAudit = Readonly<{
  id: string;
  outcome: BlockCandidateOutcome;
  polygon: readonly Point2[] | null;
  centroid: Point2 | null;
  areaSquareMetres: number | null;
}>;

export type DistrictDefinition = Readonly<{
  id: string;
  label: string;
  profile: DistrictProfile;
}>;

export type CityBlock = Readonly<{
  id: string;
  districtId: string;
  profile: BlockProfile;
  derivation: 'road-polygonized';
  polygon: readonly Point2[];
  buildableRegions: readonly BuildableRegion[];
  centroid: Point2;
  areaSquareMetres: number;
  buildableAreaSquareMetres: number;
}>;

export type ProcessedCityBlocks = Readonly<{
  schemaVersion: 2;
  metadata: Readonly<{
    sourceStructureFile: string;
    sourceStructureSha256: string;
    workingAreaId: string;
    derivation: 'surface-road-polygonization';
    exclusions: Readonly<{
      railBufferMetres: number;
      waterBufferMetres: number;
      surfaceRoadBufferMetres: number;
    }>;
    buildable: Readonly<{
      insetMetres: number;
      minimumAreaSquareMetres: number;
      minimumRegionAreaSquareMetres: number;
      concaveStrategy: 'all-viable-inset-triangles';
    }>;
    counts: Readonly<{
      districts: number;
      sourceSurfaceRoadPaths: number;
      polygonCandidates: number;
      blocks: number;
      manualOverrides: number;
      discardedCandidates: number;
      discardedByReason: Readonly<Record<BlockCandidateDiscardReason, number>>;
      discardedBuildableRegions: number;
      discardedRegionsByReason: Readonly<
        Record<BuildableRegionDiscardReason, number>
      >;
      buildableRegions: number;
      regionsByDerivation: Readonly<{
        convexInset: number;
        triangulatedInset: number;
      }>;
    }>;
    totalBlockAreaSquareMetres: number;
    totalBuildableAreaSquareMetres: number;
  }>;
  districts: readonly DistrictDefinition[];
  candidateAudit: readonly BlockCandidateAudit[];
  blocks: readonly CityBlock[];
}>;
