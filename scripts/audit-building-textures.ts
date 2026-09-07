import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { auditGlbFile, type GlbTextureAudit } from './lib/audit-glb-textures';

const execFileAsync = promisify(execFile);
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const BLEND_PATH = path.resolve(process.env.CITY_LOOKDEV_BLEND_FILE ?? 'references/raw/2026-city-lookdev.blend');
const GLB_ROOT = path.resolve('public/assets/models/buildings/lowpoly-buildings-pack');
const CATALOG_PATH = path.resolve('src/city/assets/buildingAssetCatalog.generated.json');
const BLENDER_SCRIPT_PATH = path.resolve('scripts/blender/audit-building-textures.py');
const OUTPUT_PATH = path.resolve('references/processed/building-texture-audit.json');
const DEFAULT_MACOS_BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender';

type BlenderAudit = Readonly<{
  schemaVersion: number;
  summary: Readonly<Record<string, number>>;
  images: readonly Readonly<{
    name: string;
    filepath: string;
    fileExists: boolean;
    packed: boolean;
  }>[];
  [key: string]: unknown;
}>;

type CatalogAsset = Readonly<{
  id: string;
  sourceCategory: string;
  sourceDimensions: Readonly<{ width: number; height: number; depth: number }>;
}>;

async function main(): Promise<void> {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'city-texture-audit-'));
  const blenderOutputPath = path.join(temporaryDirectory, 'blender-audit.json');

  try {
    const blenderAudit = await runBlenderAudit(blenderOutputPath);
    const glbFiles = await findGlbFiles(GLB_ROOT);
    const glbAssets: GlbTextureAudit[] = [];

    for (const absolutePath of glbFiles) {
      const assetPath = path.relative(process.cwd(), absolutePath).split(path.sep).join('/');
      glbAssets.push(await auditGlbFile(absolutePath, assetPath));
    }

    const catalogAssets = await readCatalogAssets();
    const imageHashes = glbAssets.flatMap((asset) =>
      asset.images.flatMap((image) =>
        image.sha256 === null ? [] : [{ hash: image.sha256, assetPath: asset.assetPath }],
      ),
    );
    const duplicateImageGroups = [...groupBy(imageHashes, (item) => item.hash).entries()]
      .filter(([, items]) => items.length > 1)
      .map(([sha256, items]) => ({
        sha256,
        assetPaths: [...new Set(items.map((item) => item.assetPath))].sort(),
        occurrences: items.length,
      }))
      .sort((first, second) => first.sha256.localeCompare(second.sha256));
    const report = {
      schemaVersion: 1,
      generatedFrom: {
        blendFile: relativePath(BLEND_PATH),
        glbRoot: relativePath(GLB_ROOT),
      },
      summary: {
        glbAssets: glbAssets.length,
        glbBytes: glbAssets.reduce((sum, asset) => sum + asset.byteLength, 0),
        glbsWithCompleteUv0: glbAssets.filter(
          (asset) => asset.primitives > 0 && asset.primitivesWithUv0 === asset.primitives,
        ).length,
        glbsWithAnyImages: glbAssets.filter((asset) => asset.images.length > 0).length,
        glbsWithTextureSlots: glbAssets.filter(
          (asset) => Object.values(asset.materialTextureSlots).some((count) => count > 0),
        ).length,
        glbImages: imageHashes.length,
        uniqueGlbImages: new Set(imageHashes.map((item) => item.hash)).size,
        duplicateGlbImageGroups: duplicateImageGroups.length,
        missingGlbExternalImages: glbAssets.reduce(
          (sum, asset) =>
            sum + asset.images.filter((image) => image.externalFileExists === false).length,
          0,
        ),
      },
      blender: blenderAudit,
      glb: {
        assets: glbAssets,
        duplicateImageGroups,
      },
      recommendedBakeCandidates: selectBakeCandidates(catalogAssets, glbAssets),
    };

    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log(`Audited ${glbAssets.length} exported GLBs.`);
    console.log(`GLBs with complete UV0: ${report.summary.glbsWithCompleteUv0}.`);
    console.log(`GLBs with images: ${report.summary.glbsWithAnyImages}.`);
    console.log(`GLBs with material texture slots: ${report.summary.glbsWithTextureSlots}.`);
    console.log(
      `Blender images: ${blenderAudit.summary.images ?? 0}; ` +
        `missing external: ${blenderAudit.summary.missingExternalImages ?? 0}.`,
    );
    console.log(`Wrote ${relativePath(OUTPUT_PATH)}.`);
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function runBlenderAudit(outputPath: string): Promise<BlenderAudit> {
  const blenderBinary = await resolveBlenderBinary();
  const { stdout, stderr } = await execFileAsync(
    blenderBinary,
    [
      '--background',
      BLEND_PATH,
      '--python',
      BLENDER_SCRIPT_PATH,
      '--',
      '--output',
      outputPath,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );

  if (stdout.trim()) {
    console.log(stdout.trim());
  }
  if (stderr.trim()) {
    console.error(stderr.trim());
  }

  return JSON.parse(await fs.readFile(outputPath, 'utf8')) as BlenderAudit;
}

async function resolveBlenderBinary(): Promise<string> {
  if (process.env.BLENDER_BIN !== undefined) {
    return process.env.BLENDER_BIN;
  }

  try {
    await fs.access(DEFAULT_MACOS_BLENDER, fs.constants.X_OK);
    return DEFAULT_MACOS_BLENDER;
  } catch {
    return 'blender';
  }
}

async function findGlbFiles(directory: string): Promise<readonly string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findGlbFiles(entryPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) {
      files.push(entryPath);
    }
  }

  return files.sort((first, second) => first.localeCompare(second, undefined, { numeric: true }));
}

async function readCatalogAssets(): Promise<readonly CatalogAsset[]> {
  const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8')) as {
    assets?: readonly CatalogAsset[];
  };
  return catalog.assets ?? [];
}

function selectBakeCandidates(
  catalogAssets: readonly CatalogAsset[],
  glbAssets: readonly GlbTextureAudit[],
): readonly Readonly<{
  role: string;
  assetId: string;
  sourceCategory: string;
  heightMetres: number;
  exportedTextureImages: number;
}>[] {
  const auditById = new Map(
    glbAssets.map((asset) => [path.basename(asset.assetPath, '.glb'), asset]),
  );
  const categoryRoles: Readonly<Record<string, readonly [string, string]>> = {
    residential: ['residential-low/mid reference', 'residential-tall reference'],
    'high-rise': ['commercial/office broad reference', 'high-rise tower reference'],
    skyscraper: ['skyscraper body reference', 'landmark crown reference'],
  };
  const candidates: Array<{
    role: string;
    assetId: string;
    sourceCategory: string;
    heightMetres: number;
    exportedTextureImages: number;
  }> = [];

  for (const [category, roles] of Object.entries(categoryRoles)) {
    const assets = catalogAssets
      .filter((asset) => asset.sourceCategory === category)
      .sort(
        (first, second) =>
          first.sourceDimensions.height - second.sourceDimensions.height ||
          first.id.localeCompare(second.id, undefined, { numeric: true }),
      );
    const selections = [
      { assetIndex: Math.floor((assets.length - 1) * 0.33), role: roles[0] },
      { assetIndex: Math.floor((assets.length - 1) * 0.8), role: roles[1] },
    ] as const;

    for (const selection of selections) {
      const asset = assets[selection.assetIndex];
      if (asset === undefined) {
        continue;
      }
      candidates.push({
        role: selection.role,
        assetId: asset.id,
        sourceCategory: asset.sourceCategory,
        heightMetres: asset.sourceDimensions.height,
        exportedTextureImages: auditById.get(asset.id)?.images.length ?? 0,
      });
    }
  }

  return candidates;
}

function groupBy<T>(
  items: readonly T[],
  keyForItem: (item: T) => string,
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyForItem(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function relativePath(absolutePath: string): string {
  return path.relative(process.cwd(), absolutePath).split(path.sep).join('/');
}

await main();
