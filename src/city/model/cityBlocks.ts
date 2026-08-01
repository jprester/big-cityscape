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
  buildableDerivation: BuildableDerivation;
  polygon: readonly Point2[];
  buildablePolygon: readonly Point2[];
  centroid: Point2;
  areaSquareMetres: number;
  buildableAreaSquareMetres: number;
}>;

export type ProcessedCityBlocks = Readonly<{
  schemaVersion: 1;
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
      concaveStrategy: 'largest-inset-triangle';
    }>;
    counts: Readonly<{
      districts: number;
      sourceSurfaceRoadPaths: number;
      polygonCandidates: number;
      blocks: number;
      manualOverrides: number;
      discardedCandidates: number;
      discardedByReason: Readonly<{
        area: number;
        unsupportedTopology: number;
        concaveDerivationFailure: number;
        railExclusion: number;
        waterExclusion: number;
        roadExclusion: number;
        insetFailure: number;
        insufficientBuildableArea: number;
      }>;
      blocksByBuildableDerivation: Readonly<{
        convexInset: number;
        triangulatedInset: number;
      }>;
    }>;
    totalBlockAreaSquareMetres: number;
    totalBuildableAreaSquareMetres: number;
  }>;
  districts: readonly DistrictDefinition[];
  blocks: readonly CityBlock[];
}>;
