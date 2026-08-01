import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { PREPROCESS_CONFIG } from './preprocess/config';
import { preprocessCityStructure } from './preprocess/preprocessCityStructure';

const startedAt = performance.now();
const sourcePath = resolve(PREPROCESS_CONFIG.sourceFile);
const outputPath = resolve(PREPROCESS_CONFIG.outputFile);
const sourceText = await readFile(sourcePath, 'utf8');
const sourceData: unknown = JSON.parse(sourceText);
const processed = preprocessCityStructure(sourceData, PREPROCESS_CONFIG);
const outputText = `${JSON.stringify(processed)}\n`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, outputText, 'utf8');

const elapsedMilliseconds = performance.now() - startedAt;
const { metadata } = processed;

console.log('City structure preprocessing complete');
console.log(`Source: ${PREPROCESS_CONFIG.sourceFile}`);
console.log(`Output: ${PREPROCESS_CONFIG.outputFile}`);
console.log(`Features read: ${metadata.source.featureCount}`);
console.log(`Features retained: ${metadata.counts.retained}`);
console.log(`Features discarded: ${metadata.counts.discarded}`);
console.log(`Retained by kind: ${JSON.stringify(metadata.counts.retainedByKind)}`);
console.log(`Discarded by reason: ${JSON.stringify(metadata.counts.discardedByReason)}`);
console.log(
  `Projection: ${metadata.projection.kind}, origin ${metadata.projection.originLonLat.join(', ')}, X east / Z south`,
);
console.log(
  `Clip: ${metadata.clip.widthMetres} m × ${metadata.clip.depthMetres} m (${metadata.clip.areaSquareKilometres.toFixed(2)} km²)`,
);
console.log(`Output bounds: ${JSON.stringify(metadata.outputBounds)}`);
console.log(`Output size: ${Buffer.byteLength(outputText).toLocaleString('en-US')} bytes`);
console.log(`Elapsed: ${elapsedMilliseconds.toFixed(1)} ms`);
