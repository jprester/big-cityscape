import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseProcessedCity } from '../src/city/model/parseProcessedCity';
import { BLOCK_PREPROCESS_CONFIG } from './blocks/config';
import { preprocessCityBlocks } from './blocks/preprocessCityBlocks';

const startedAt = performance.now();
const sourcePath = resolve(BLOCK_PREPROCESS_CONFIG.sourceStructureFile);
const outputPath = resolve(BLOCK_PREPROCESS_CONFIG.outputFile);
const sourceText = await readFile(sourcePath, 'utf8');
const sourceStructureSha256 = createHash('sha256').update(sourceText).digest('hex');
const structure = parseProcessedCity(JSON.parse(sourceText) as unknown);
const processed = preprocessCityBlocks(
  structure,
  BLOCK_PREPROCESS_CONFIG,
  sourceStructureSha256,
);
const outputText = `${JSON.stringify(processed)}\n`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, outputText, 'utf8');

const elapsedMilliseconds = performance.now() - startedAt;

console.log('City block preprocessing complete');
console.log(`Source: ${BLOCK_PREPROCESS_CONFIG.sourceStructureFile}`);
console.log(`Output: ${BLOCK_PREPROCESS_CONFIG.outputFile}`);
console.log(`Districts: ${processed.metadata.counts.districts}`);
console.log(`Surface road paths: ${processed.metadata.counts.sourceSurfaceRoadPaths}`);
console.log(`Polygon candidates: ${processed.metadata.counts.polygonCandidates}`);
console.log(`Candidate audit entries: ${processed.candidateAudit.length}`);
console.log(`Blocks: ${processed.metadata.counts.blocks}`);
console.log(
  `Buildable regions: ${processed.metadata.counts.buildableRegions} ${JSON.stringify(processed.metadata.counts.regionsByDerivation)}`,
);
console.log(`Discarded candidates: ${processed.metadata.counts.discardedCandidates}`);
console.log(
  `Discard reasons: ${JSON.stringify(processed.metadata.counts.discardedByReason)}`,
);
console.log(
  `Discarded buildable regions: ${processed.metadata.counts.discardedBuildableRegions} ${JSON.stringify(processed.metadata.counts.discardedRegionsByReason)}`,
);
console.log(
  `Candidate source area by outcome: ${JSON.stringify(summarizeCandidateAreaByOutcome())}`,
);
console.log(`Manual overrides: ${processed.metadata.counts.manualOverrides}`);
console.log(
  `Exclusions: rail ${processed.metadata.exclusions.railBufferMetres} m, water ${processed.metadata.exclusions.waterBufferMetres} m, surface roads ${processed.metadata.exclusions.surfaceRoadBufferMetres} m`,
);
console.log(
  `Buildable policy: ${processed.metadata.buildable.insetMetres} m inset, ${processed.metadata.buildable.minimumRegionAreaSquareMetres} m² minimum region, ${processed.metadata.buildable.minimumAreaSquareMetres} m² minimum aggregate, ${processed.metadata.buildable.concaveStrategy}`,
);
console.log(
  `Total block area: ${processed.metadata.totalBlockAreaSquareMetres.toLocaleString('en-US')} m²`,
);
console.log(
  `Total buildable area: ${processed.metadata.totalBuildableAreaSquareMetres.toLocaleString('en-US')} m²`,
);
console.log(`Output size: ${Buffer.byteLength(outputText).toLocaleString('en-US')} bytes`);
console.log(`Elapsed: ${elapsedMilliseconds.toFixed(1)} ms`);

function summarizeCandidateAreaByOutcome(): Readonly<Record<string, number>> {
  const areaByOutcome: Record<string, number> = {};

  for (const candidate of processed.candidateAudit) {
    areaByOutcome[candidate.outcome] =
      (areaByOutcome[candidate.outcome] ?? 0) +
      (candidate.areaSquareMetres ?? 0);
  }

  return Object.fromEntries(
    Object.entries(areaByOutcome)
      .sort(([firstOutcome], [secondOutcome]) =>
        firstOutcome.localeCompare(secondOutcome),
      )
      .map(([outcome, areaSquareMetres]) => [
        outcome,
        Math.round(areaSquareMetres * 100) / 100,
      ]),
  );
}
