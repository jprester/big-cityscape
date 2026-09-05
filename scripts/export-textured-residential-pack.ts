import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const localEnvironmentFile = path.join(repositoryRoot, '.env.local');

if (existsSync(localEnvironmentFile)) {
  process.loadEnvFile(localEnvironmentFile);
}

const argumentsByName = readNamedArguments(process.argv.slice(2));
const assetGroup = argumentsByName.get('asset-group') ?? 'residential';

if (assetGroup !== 'residential' && assetGroup !== 'commercial') {
  throw new Error('The asset group must be "residential" or "commercial".');
}
const blenderExecutable =
  process.env.BLENDER_EXECUTABLE ??
  '/Applications/Blender.app/Contents/MacOS/Blender';
const blendFile = path.resolve(
  repositoryRoot,
  argumentsByName.get('blend') ??
    process.env.BUILDING_BLEND_FILE ??
    'references/raw/2026-export-low-poly-textured-buildings.blend',
);
const outputDirectory = path.resolve(
  repositoryRoot,
  argumentsByName.get('output-directory') ??
    `public/assets/models/buildings/textured-${assetGroup}-pilot`,
);
const textureSearchRoot = path.resolve(
  repositoryRoot,
  argumentsByName.get('texture-search-root') ??
    process.env.BUILDING_TEXTURE_ROOT ??
    '../../../../../3d-modeling/blender',
);
const outputFile = path.join(outputDirectory, `textured-${assetGroup}-pack.glb`);
const manifestFile = path.join(outputDirectory, 'manifest.json');
const highRiseEmissive = path.join(
  repositoryRoot,
  'references/textures/high-rise-atlas1/high-rise-texture-atlas1-emissive.png',
);
const exporter = path.join(
  repositoryRoot,
  'scripts/blender/export-textured-residential-pack.py',
);

for (const [label, filePath] of [
  ['Blender executable', blenderExecutable],
  ['source blend', blendFile],
  ['texture search root', textureSearchRoot],
  ['high-rise emissive override', highRiseEmissive],
  ['export script', exporter],
] as const) {
  if (!existsSync(filePath)) {
    const configurationHint =
      label === 'source blend'
        ? ' Set BUILDING_BLEND_FILE in .env.local or pass --blend.'
        : label === 'texture search root'
          ? ' Set BUILDING_TEXTURE_ROOT in .env.local or pass --texture-search-root.'
          : '';
    throw new Error(`${label} does not exist: ${filePath}.${configurationHint}`);
  }
}

const result = spawnSync(
  blenderExecutable,
  [
    '--background',
    blendFile,
    '--python',
    exporter,
    '--',
    '--output',
    outputFile,
    '--manifest',
    manifestFile,
    '--asset-group',
    assetGroup,
    '--texture-search-root',
    textureSearchRoot,
    '--high-rise-emissive',
    highRiseEmissive,
  ],
  { cwd: repositoryRoot, encoding: 'utf8', stdio: 'inherit' },
);

if (result.error !== undefined) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error(`Blender export failed with status ${String(result.status)}.`);
}

function readNamedArguments(argumentsList: readonly string[]): Map<string, string> {
  const values = new Map<string, string>();

  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (name === undefined || !name.startsWith('--') || value === undefined) {
      throw new Error(
        'Arguments must be --name value pairs: --asset-group, --blend, --output-directory, or --texture-search-root.',
      );
    }
    values.set(name.slice(2), value);
  }

  return values;
}
