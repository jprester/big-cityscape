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
const blenderExecutable =
  process.env.BLENDER_EXECUTABLE ??
  '/Applications/Blender.app/Contents/MacOS/Blender';
const lookdevFile = path.resolve(
  repositoryRoot,
  argumentsByName.get('blend') ??
    process.env.CITY_LOOKDEV_BLEND_FILE ??
    'references/raw/2026-city-lookdev.blend',
);
const assetLibraryFile = path.resolve(
  repositoryRoot,
  process.env.BUILDING_BLEND_FILE ??
    'references/raw/2026-export-low-poly-textured-buildings.blend',
);
const layoutFile = path.resolve(
  repositoryRoot,
  argumentsByName.get('layout') ??
    'references/processed/synthetic-city-lookdev.json',
);
const importer = path.resolve(
  repositoryRoot,
  'scripts/blender/import-synthetic-city-lookdev.py',
);
const previewFile = argumentsByName.has('preview')
  ? path.resolve(repositoryRoot, argumentsByName.get('preview')!)
  : undefined;

for (const [label, filePath] of [
  ['Blender executable', blenderExecutable],
  ['look-development blend', lookdevFile],
  ['authoritative building library', assetLibraryFile],
  ['city layout', layoutFile],
  ['Blender importer', importer],
] as const) {
  if (!existsSync(filePath)) {
    const hint =
      label === 'look-development blend'
        ? ' Set CITY_LOOKDEV_BLEND_FILE in .env.local or pass --blend.'
        : '';
    throw new Error(`${label} does not exist: ${filePath}.${hint}`);
  }
}

const blenderArguments = [
  '--background',
  lookdevFile,
  '--python',
  importer,
  '--',
  '--layout',
  layoutFile,
  '--save',
  lookdevFile,
  '--asset-library',
  assetLibraryFile,
];
if (previewFile !== undefined) {
  blenderArguments.push('--preview', previewFile);
}

const result = spawnSync(blenderExecutable, blenderArguments, {
  cwd: repositoryRoot,
  encoding: 'utf8',
  stdio: 'inherit',
});
if (result.error !== undefined) {
  throw result.error;
}
if (result.status !== 0) {
  throw new Error(`Blender look-development import failed with status ${String(result.status)}.`);
}

function readNamedArguments(argumentsList: readonly string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (name === undefined || !name.startsWith('--') || value === undefined) {
      throw new Error('Arguments must be --name value pairs: --blend, --layout, or --preview.');
    }
    values.set(name.slice(2), value);
  }
  return values;
}
