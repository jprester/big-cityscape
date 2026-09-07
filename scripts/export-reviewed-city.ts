import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const blend = process.env.CITY_LOOKDEV_BLEND_FILE;
if (!blend || !existsSync(blend)) {
  throw new Error('Set CITY_LOOKDEV_BLEND_FILE to the saved Blender master.');
}
const result = spawnSync(process.env.BLENDER_EXECUTABLE ?? '/Applications/Blender.app/Contents/MacOS/Blender', [
  '--background', blend, '--python-exit-code', '1', '--python',
  path.resolve('scripts/blender/export-reviewed-city.py'), '--',
  '--output-directory', path.resolve('public/assets/city-reviewed'),
], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Reviewed city export failed (${result.status}).`);
