export type Point2 = readonly [xMetres: number, zMetres: number];
export type LonLat = readonly [longitudeDegrees: number, latitudeDegrees: number];

export type LocalBounds = Readonly<{
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}>;

export type RoadClass =
  | 'motorway'
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'local'
  | 'pedestrian';

export type TransportPath = Readonly<{
  id: string;
  sourceKind: string;
  layer: number;
  bridge: boolean;
  tunnel: boolean;
  paths: readonly (readonly Point2[])[];
}>;

export type RoadPath = TransportPath &
  Readonly<{
    class: RoadClass;
  }>;

export type WaterRegion = Readonly<{
  id: string;
  kind: string;
  rings: readonly (readonly Point2[])[];
}>;

export type DiscardReason =
  | 'outsideClip'
  | 'unsupportedCategory'
  | 'unsupportedGeometry'
  | 'invalidFeature'
  | 'invalidGeometry'
  | 'degenerateGeometry';

export type ProcessedCityStructure = Readonly<{
  schemaVersion: 1;
  metadata: Readonly<{
    source: Readonly<{
      file: string;
      featureCount: number;
      boundsLonLat: readonly [minimum: LonLat, maximum: LonLat];
      attribution: string;
    }>;
    projection: Readonly<{
      kind: 'local-equirectangular';
      units: 'metres';
      originLonLat: LonLat;
      earthRadiusMetres: number;
      axes: Readonly<{
        x: 'east';
        z: 'south';
      }>;
    }>;
    clip: Readonly<{
      id: string;
      widthMetres: number;
      depthMetres: number;
      areaSquareKilometres: number;
      bounds: LocalBounds;
    }>;
    outputBounds: LocalBounds;
    counts: Readonly<{
      retained: number;
      discarded: number;
      retainedByKind: Readonly<{
        roads: number;
        railways: number;
        waterways: number;
        waterRegions: number;
      }>;
      discardedByReason: Readonly<Record<DiscardReason, number>>;
    }>;
  }>;
  roads: readonly RoadPath[];
  railways: readonly TransportPath[];
  waterways: readonly TransportPath[];
  waterRegions: readonly WaterRegion[];
}>;
