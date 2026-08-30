import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const argumentsByName = readNamedArguments(process.argv.slice(2));
const blenderExecutable =
  process.env.BLENDER_EXECUTABLE ??
  '/Applications/Blender.app/Contents/MacOS/Blender';
const blendFile = path.resolve(
  repositoryRoot,
  argumentsByName.get('blend') ??
    'references/raw/2026-export-low-poly-textured-buildings.blend',
);
const outputDirectory = path.resolve(
  repositoryRoot,
  argumentsByName.get('output-directory') ??
    'public/assets/models/buildings/textured-residential-pilot',
);
const textureSearchRoot = path.resolve(
  repositoryRoot,
  argumentsByName.get('texture-search-root') ??
    '../../../../../3d-modeling/blender',
);
const outputFile = path.join(outputDirectory, 'textured-residential-pack.glb');
const manifestFile = path.join(outputDirectory, 'manifest.json');
const exporter = path.join(
  repositoryRoot,
  'scripts/blender/export-textured-residential-pack.py',
);

for (const [label, filePath] of [
  ['Blender executable', blenderExecutable],
  ['source blend', blendFile],
  ['texture search root', textureSearchRoot],
  ['export script', exporter],
] as const) {
  if (!existsSync(filePath)) {
    throw new Error(`${label} does not exist: ${filePath}`);
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
    '--texture-search-root',
    textureSearchRoot,
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
        'Arguments must be --name value pairs: --blend, --output-directory, or --texture-search-root.',
      );
    }
    values.set(name.slice(2), value);
  }

  return values;
}
