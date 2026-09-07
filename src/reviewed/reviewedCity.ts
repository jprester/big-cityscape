export type ReviewedBlock = Readonly<{ id: string; footprintXZ: readonly (readonly [number, number])[] }>;
export type ReviewedInstance = Readonly<{ id: string; name: string; modelId: string; blockId: string | null; matrix: readonly number[] }>;
export type ReviewedCity = Readonly<{
  schemaVersion: 1; sourceBlend: string; sourceSha256: string; packFile: string; packSha256: string;
  models: readonly Readonly<{id: string; triangles: number}>[];
  blocks: readonly ReviewedBlock[]; instances: readonly ReviewedInstance[];
}>;

export function validateReviewedCity(value: unknown): ReviewedCity {
  const d = value as ReviewedCity;
  if (!d || d.schemaVersion !== 1 || !Array.isArray(d.models) || !Array.isArray(d.blocks) || !Array.isArray(d.instances)
    || typeof d.packFile !== 'string' || !/^[\w-]+\.glb$/.test(d.packFile)
    || typeof d.packSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(d.packSha256)
    || typeof d.sourceBlend !== 'string' || typeof d.sourceSha256 !== 'string') throw new Error('Invalid reviewed city manifest.');
  const unique = (rows: readonly {id:string}[]) => {
    if (rows.some(r => !r || typeof r.id !== 'string' || !r.id) || new Set(rows.map(r=>r.id)).size !== rows.length) throw new Error('Duplicate or missing reviewed ID.');
    return new Set(rows.map(r=>r.id));
  };
  const models = unique(d.models), blocks = unique(d.blocks); unique(d.instances);
  if (!models.size || !blocks.size || !d.instances.length) throw new Error('Reviewed city is empty.');
  for (const b of d.blocks) if (!Array.isArray(b.footprintXZ) || b.footprintXZ.length !== 4 || b.footprintXZ.some((p: readonly number[]) => !Array.isArray(p) || p.length !== 2 || p.some(v=>!Number.isFinite(v)))) throw new Error(`Invalid block ${b.id}.`);
  for (const i of d.instances) {
    if (!models.has(i.modelId) || (i.blockId !== null && !blocks.has(i.blockId))) throw new Error(`Unresolved reference in ${i.id}.`);
    if (!Array.isArray(i.matrix) || i.matrix.length !== 16 || i.matrix.some((v: number)=>!Number.isFinite(v)) || i.matrix[3] !== 0 || i.matrix[7] !== 0 || i.matrix[11] !== 0 || i.matrix[15] !== 1) throw new Error(`Invalid affine matrix for ${i.id}.`);
  }
  return d;
}
