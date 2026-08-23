import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { auditGlbBuffer } from './audit-glb-textures';

describe('auditGlbBuffer', () => {
  it('reports embedded images, UVs, material slots, and extensions', () => {
    const imageBytes = Buffer.from('fake-image');
    const buffer = createGlb(
      {
        asset: { version: '2.0' },
        extensionsUsed: ['KHR_materials_unlit'],
        buffers: [{ byteLength: imageBytes.byteLength }],
        bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: imageBytes.byteLength }],
        accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: 'VEC2' }],
        images: [{ bufferView: 0, mimeType: 'image/png', name: 'facade' }],
        textures: [{ source: 0 }],
        materials: [
          {
            pbrMetallicRoughness: { baseColorTexture: { index: 0 } },
            emissiveTexture: { index: 0 },
            alphaMode: 'MASK',
            doubleSided: true,
          },
        ],
        meshes: [
          {
            primitives: [
              { attributes: { POSITION: 0, TEXCOORD_0: 0 }, material: 0 },
            ],
          },
        ],
      },
      imageBytes,
    );

    const audit = auditGlbBuffer(buffer, 'building.glb');

    expect(audit.primitives).toBe(1);
    expect(audit.primitivesWithUv0).toBe(1);
    expect(audit.materialTextureSlots.baseColor).toBe(1);
    expect(audit.materialTextureSlots.emissive).toBe(1);
    expect(audit.alphaModes).toEqual({ MASK: 1 });
    expect(audit.doubleSidedMaterials).toBe(1);
    expect(audit.extensionsUsed).toEqual(['KHR_materials_unlit']);
    expect(audit.images).toEqual([
      expect.objectContaining({
        storage: 'buffer-view',
        byteLength: imageBytes.byteLength,
        sha256: createHash('sha256').update(imageBytes).digest('hex'),
      }),
    ]);
  });

  it('rejects a malformed GLB header', () => {
    expect(() => auditGlbBuffer(Buffer.alloc(12), 'broken.glb')).toThrow(
      'invalid magic header',
    );
  });
});

function createGlb(document: object, binaryChunk: Uint8Array): Buffer {
  const jsonBytes = Buffer.from(JSON.stringify(document));
  const paddedJsonLength = Math.ceil(jsonBytes.byteLength / 4) * 4;
  const paddedBinaryLength = Math.ceil(binaryChunk.byteLength / 4) * 4;
  const totalLength = 12 + 8 + paddedJsonLength + 8 + paddedBinaryLength;
  const buffer = Buffer.alloc(totalLength);

  buffer.writeUInt32LE(0x46546c67, 0);
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(totalLength, 8);
  buffer.writeUInt32LE(paddedJsonLength, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  jsonBytes.copy(buffer, 20);
  buffer.fill(0x20, 20 + jsonBytes.byteLength, 20 + paddedJsonLength);

  const binaryHeaderOffset = 20 + paddedJsonLength;
  buffer.writeUInt32LE(paddedBinaryLength, binaryHeaderOffset);
  buffer.writeUInt32LE(0x004e4942, binaryHeaderOffset + 4);
  Buffer.from(binaryChunk).copy(buffer, binaryHeaderOffset + 8);

  return buffer;
}
