import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { BUILDING_ASSET_CATALOG } from "../src/city/assets/buildingAssetCatalog";
import {
  generateSyntheticCity,
  DEFAULT_SYNTHETIC_CITY_CONFIG,
} from "../src/city/synthetic/generation/generateSyntheticCity";
import { populateSyntheticCity } from "../src/city/synthetic/generation/populateSyntheticCity";
import type { SyntheticBuildingPlacement } from "../src/city/synthetic/model/buildingPlacement";
import type {
  SyntheticBlockDefinition,
  SyntheticBounds2,
} from "../src/city/synthetic/model/proofDistrict";
import { planTexturedBuildingPlacements } from "../src/city/synthetic/rendering/planTexturedBuildingPlacements";

type TexturedBuildingPackId = "residential" | "commercial" | "skyscraper";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const argumentsByName = readNamedArguments(process.argv.slice(2));
const seed = Number(
  argumentsByName.get("seed") ?? DEFAULT_SYNTHETIC_CITY_CONFIG.seed,
);
const outputFile = path.resolve(
  repositoryRoot,
  argumentsByName.get("output") ??
    "references/processed/synthetic-city-lookdev.json",
);

if (!Number.isSafeInteger(seed)) {
  throw new Error("The look-development city seed must be a safe integer.");
}

type ManifestModel = Readonly<{
  id: string;
  sourceObject: string;
  dimensionsMetres: Readonly<{
    width: number;
    height: number;
    depth: number;
  }>;
}>;

type PackManifest = Readonly<{
  schemaVersion: 1;
  sourceBlend: string;
  sourceSha256: string;
  packSha256: string;
  additionalSources?: readonly Readonly<{
    sourceBlend: string;
    sourceSha256: string;
    packSha256: string;
  }>[];
  assetGroup: TexturedBuildingPackId;
  models: readonly ManifestModel[];
}>;

const manifestPaths: Readonly<Record<TexturedBuildingPackId, string>> = {
  residential:
    "public/assets/models/buildings/textured-residential-pilot/manifest.json",
  commercial:
    "public/assets/models/buildings/textured-commercial-pilot/manifest.json",
  skyscraper:
    "public/assets/models/buildings/textured-skyscraper-pilot/manifest.json",
};

const city = generateSyntheticCity({ ...DEFAULT_SYNTHETIC_CITY_CONFIG, seed });
const population = populateSyntheticCity(city);
const placementsByPack = partitionPlacements(population.placements);
const manifests = Object.fromEntries(
  (Object.keys(manifestPaths) as TexturedBuildingPackId[]).map((packId) => [
    packId,
    readManifest(packId),
  ]),
) as Record<TexturedBuildingPackId, PackManifest>;
const plansByPack = Object.fromEntries(
  (Object.keys(manifests) as TexturedBuildingPackId[]).map((packId) => [
    packId,
    planTexturedBuildingPlacements(
      placementsByPack[packId],
      modelDescriptors(manifests[packId]),
      city.slots,
      `textured-${packId}-pilot`,
    ),
  ]),
) as Record<
  TexturedBuildingPackId,
  ReturnType<typeof planTexturedBuildingPlacements>
>;

const resolvedBuildings = (Object.keys(manifests) as TexturedBuildingPackId[])
  .flatMap((packId) => {
    const manifest = manifests[packId];
    const modelById = new Map(
      manifest.models.map((model) => [model.id, model]),
    );

    return plansByPack[packId].assignments.map(({ modelId, placement }) => {
      const model = modelById.get(modelId);
      if (model === undefined) {
        throw new Error(
          `Look-development layout lost ${packId} model ${modelId}.`,
        );
      }
      return {
        id: placement.id,
        districtId: placement.districtId,
        blockId: placement.blockId,
        packId,
        modelId,
        sourceObject: model.sourceObject,
        positionMetres: [placement.center[0], 0.15, placement.center[1]],
        rotationRadians: placement.rotationRadians,
        scale: 1,
        sourceDimensionsMetres: model.dimensionsMetres,
        dimensionsMetres: placement.dimensionsMetres,
      } as const;
    });
  })
  .sort((first, second) => first.id.localeCompare(second.id));

const allUnfilledPlacementIds = (
  Object.keys(manifests) as TexturedBuildingPackId[]
)
  .flatMap((packId) => plansByPack[packId].unfilledPlacementIds)
  .sort();

const sidewalks = city.blocks.flatMap((block) =>
  sidewalkSurfacesForBlock(block).map((bounds, index) => ({
    id: `${block.id}/sidewalk-${index}`,
    bounds,
  })),
);
const tallestBuildingHeight = resolvedBuildings.reduce(
  (maximum, building) => Math.max(maximum, building.dimensionsMetres.height),
  0,
);
const cityWidthMetres = city.bounds.maxX - city.bounds.minX;
const viewExtentMetres = cityWidthMetres * 1.4;

const layout = {
  schemaVersion: 1,
  coordinateSystem: {
    units: "metres",
    runtime: "Three.js X/Y-up/Z",
    blender: "X/Y-ground/Z-up",
    blenderRotationRadians: "-rotationRadians",
  },
  city: {
    id: city.id,
    seed: city.seed,
    layoutSeed: city.layoutSeed,
    bounds: city.bounds,
  },
  sources: Object.fromEntries(
    (Object.keys(manifests) as TexturedBuildingPackId[]).map((packId) => [
      packId,
      {
        sourceBlend: manifests[packId].sourceBlend,
        sourceSha256: manifests[packId].sourceSha256,
        packSha256: manifests[packId].packSha256,
        additionalSources: manifests[packId].additionalSources,
      },
    ]),
  ),
  summary: {
    districtCount: city.districts.length,
    blockCount: city.blocks.length,
    streetCount: city.streetCorridors.length,
    sidewalkCount: sidewalks.length,
    buildingRequestCount: population.placements.length,
    buildingCount: resolvedBuildings.length,
    unfilledBuildingCount: allUnfilledPlacementIds.length,
  },
  buildings: resolvedBuildings,
  unfilledPlacementIds: allUnfilledPlacementIds,
  roads: city.streetCorridors
    .map((road) => ({
      id: road.id,
      hierarchyId: road.hierarchyId,
      axis: road.axis,
      bounds: road.bounds,
    }))
    .sort((first, second) => first.id.localeCompare(second.id)),
  blocks: city.blocks
    .map((block) => ({
      id: block.id,
      templateId: block.templateId,
      bounds: block.bounds,
      buildableBounds: block.buildableBounds,
    }))
    .sort((first, second) => first.id.localeCompare(second.id)),
  sidewalks,
  parks: city.blocks
    .filter((block) => block.templateId === "open-space")
    .map((block) => ({ id: block.id, bounds: block.buildableBounds })),
  camera: {
    name: "City Overview",
    fieldOfViewDegrees: 50,
    positionMetres: [
      viewExtentMetres * 0.62,
      Math.max(viewExtentMetres * 0.54, tallestBuildingHeight * 1.45),
      viewExtentMetres * 0.62,
    ],
    targetMetres: [0, 0, 0],
  },
} as const;

mkdirSync(path.dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(layout, null, 2)}\n`);
console.log(
  `Wrote ${outputFile} with ${resolvedBuildings.length} authored-scale buildings, ` +
    `${city.streetCorridors.length} roads, ${city.blocks.length} blocks, and ` +
    `${allUnfilledPlacementIds.length} unfilled slots.`,
);

function readManifest(packId: TexturedBuildingPackId): PackManifest {
  const filePath = path.resolve(repositoryRoot, manifestPaths[packId]);
  const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1 ||
    !("assetGroup" in value) ||
    value.assetGroup !== packId ||
    !("models" in value) ||
    !Array.isArray(value.models)
  ) {
    throw new Error(
      `Unsupported ${packId} look-development manifest: ${filePath}.`,
    );
  }
  const base = value as PackManifest;
  if (packId !== "commercial") return base;
  const approved = JSON.parse(
    readFileSync(
      path.resolve(
        repositoryRoot,
        "public/assets/models/buildings/textured-approved-pilot/manifest.json",
      ),
      "utf8",
    ),
  ) as PackManifest;
  if (
    approved.schemaVersion !== 1 ||
    approved.assetGroup !== "commercial" ||
    !Array.isArray(approved.models)
  ) {
    throw new Error("Unsupported approved building manifest.");
  }
  return {
    ...base,
    models: [...base.models, ...approved.models],
    additionalSources: [{
      sourceBlend: approved.sourceBlend,
      sourceSha256: approved.sourceSha256,
      packSha256: approved.packSha256,
    }],
  };
}

function modelDescriptors(manifest: PackManifest) {
  return manifest.models.map((model) => ({
    id: model.id,
    widthMetres: model.dimensionsMetres.width,
    heightMetres: model.dimensionsMetres.height,
    depthMetres: model.dimensionsMetres.depth,
  }));
}

function partitionPlacements(
  placements: readonly SyntheticBuildingPlacement[],
): Record<TexturedBuildingPackId, SyntheticBuildingPlacement[]> {
  const categoryByAssetId = new Map(
    BUILDING_ASSET_CATALOG.map((asset) => [asset.id, asset.sourceCategory]),
  );
  const result: Record<TexturedBuildingPackId, SyntheticBuildingPlacement[]> = {
    residential: [],
    commercial: [],
    skyscraper: [],
  };
  for (const placement of placements) {
    const category = categoryByAssetId.get(placement.assetId);
    if (category === undefined) {
      throw new Error(`Unknown building asset ${placement.assetId}.`);
    }
    result[
      category === "residential"
        ? "residential"
        : category === "high-rise"
          ? "commercial"
          : "skyscraper"
    ].push(placement);
  }
  return result;
}

function sidewalkSurfacesForBlock(
  block: SyntheticBlockDefinition,
): readonly SyntheticBounds2[] {
  const { bounds, buildableBounds } = block;
  return [
    { ...bounds, maxZ: buildableBounds.minZ },
    { ...bounds, minZ: buildableBounds.maxZ },
    {
      minX: bounds.minX,
      maxX: buildableBounds.minX,
      minZ: buildableBounds.minZ,
      maxZ: buildableBounds.maxZ,
    },
    {
      minX: buildableBounds.maxX,
      maxX: bounds.maxX,
      minZ: buildableBounds.minZ,
      maxZ: buildableBounds.maxZ,
    },
  ];
}

function readNamedArguments(
  argumentsList: readonly string[],
): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (name === undefined || !name.startsWith("--") || value === undefined) {
      throw new Error(
        "Arguments must be --name value pairs: --seed or --output.",
      );
    }
    values.set(name.slice(2), value);
  }
  return values;
}
