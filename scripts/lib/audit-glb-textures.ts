import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

type JsonObject = Record<string, unknown>;

export type GlbImageAudit = Readonly<{
  index: number;
  name: string | null;
  mimeType: string | null;
  storage: 'buffer-view' | 'data-uri' | 'external' | 'unknown';
  byteLength: number | null;
  sha256: string | null;
  uri: string | null;
  externalFileExists: boolean | null;
}>;

export type GlbTextureAudit = Readonly<{
  assetPath: string;
  byteLength: number;
  meshes: number;
  primitives: number;
  primitivesWithUv0: number;
  primitivesWithUv1: number;
  materials: number;
  textures: number;
  samplers: number;
  images: readonly GlbImageAudit[];
  materialTextureSlots: Readonly<{
    baseColor: number;
    metallicRoughness: number;
    normal: number;
    occlusion: number;
    emissive: number;
  }>;
  alphaModes: Readonly<Record<string, number>>;
  doubleSidedMaterials: number;
  extensionsUsed: readonly string[];
  extensionsRequired: readonly string[];
}>;

export async function auditGlbFile(
  absolutePath: string,
  assetPath: string,
): Promise<GlbTextureAudit> {
  const buffer = await fs.readFile(absolutePath);
  const audit = auditGlbBuffer(buffer, assetPath);
  const images = await Promise.all(
    audit.images.map(async (image): Promise<GlbImageAudit> => {
      if (image.storage !== 'external' || image.uri === null) {
        return image;
      }

      const imagePath = path.resolve(path.dirname(absolutePath), image.uri);

      try {
        const imageBytes = await fs.readFile(imagePath);
        return {
          ...image,
          byteLength: imageBytes.byteLength,
          sha256: sha256(imageBytes),
          externalFileExists: true,
        };
      } catch (error) {
        if (isMissingFileError(error)) {
          return { ...image, externalFileExists: false };
        }

        throw error;
      }
    }),
  );

  return { ...audit, images };
}

export function auditGlbBuffer(
  buffer: Uint8Array,
  assetPath: string,
): GlbTextureAudit {
  if (buffer.byteLength < 12) {
    throw new Error(`GLB ${assetPath} is shorter than its 12-byte header.`);
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error(`GLB ${assetPath} has an invalid magic header.`);
  }

  const version = view.getUint32(4, true);
  if (version !== 2) {
    throw new Error(`GLB ${assetPath} uses unsupported version ${version}.`);
  }

  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== buffer.byteLength) {
    throw new Error(
      `GLB ${assetPath} declares ${declaredLength} bytes but contains ${buffer.byteLength}.`,
    );
  }

  let offset = 12;
  let document: JsonObject | undefined;
  let binaryChunk: Uint8Array | undefined;

  while (offset < buffer.byteLength) {
    if (offset + 8 > buffer.byteLength) {
      throw new Error(`GLB ${assetPath} contains a truncated chunk header.`);
    }

    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkEnd > buffer.byteLength) {
      throw new Error(`GLB ${assetPath} contains a truncated chunk body.`);
    }

    const chunk = buffer.subarray(chunkStart, chunkEnd);
    if (chunkType === JSON_CHUNK_TYPE) {
      document = JSON.parse(new TextDecoder().decode(chunk).trim()) as JsonObject;
    } else if (chunkType === BIN_CHUNK_TYPE && binaryChunk === undefined) {
      binaryChunk = chunk;
    }

    offset = chunkEnd;
  }

  if (document === undefined) {
    throw new Error(`GLB ${assetPath} has no JSON chunk.`);
  }

  const meshes = objectArray(document.meshes);
  const materials = objectArray(document.materials);
  const textures = objectArray(document.textures);
  const samplers = objectArray(document.samplers);
  const bufferViews = objectArray(document.bufferViews);
  const imageDefinitions = objectArray(document.images);
  let primitives = 0;
  let primitivesWithUv0 = 0;
  let primitivesWithUv1 = 0;

  for (const mesh of meshes) {
    for (const primitive of objectArray(mesh.primitives)) {
      primitives += 1;
      const attributes = objectValue(primitive.attributes);
      primitivesWithUv0 += attributes.TEXCOORD_0 === undefined ? 0 : 1;
      primitivesWithUv1 += attributes.TEXCOORD_1 === undefined ? 0 : 1;
    }
  }

  const images = imageDefinitions.map((image, index) =>
    auditImage(image, index, bufferViews, binaryChunk),
  );
  const materialTextureSlots = {
    baseColor: 0,
    metallicRoughness: 0,
    normal: 0,
    occlusion: 0,
    emissive: 0,
  };
  const alphaModes: Record<string, number> = {};
  let doubleSidedMaterials = 0;

  for (const material of materials) {
    const pbr = objectValue(material.pbrMetallicRoughness);
    materialTextureSlots.baseColor += hasTextureIndex(pbr.baseColorTexture) ? 1 : 0;
    materialTextureSlots.metallicRoughness += hasTextureIndex(
      pbr.metallicRoughnessTexture,
    )
      ? 1
      : 0;
    materialTextureSlots.normal += hasTextureIndex(material.normalTexture) ? 1 : 0;
    materialTextureSlots.occlusion += hasTextureIndex(material.occlusionTexture)
      ? 1
      : 0;
    materialTextureSlots.emissive += hasTextureIndex(material.emissiveTexture) ? 1 : 0;

    const alphaMode = stringValue(material.alphaMode) ?? 'OPAQUE';
    alphaModes[alphaMode] = (alphaModes[alphaMode] ?? 0) + 1;
    doubleSidedMaterials += material.doubleSided === true ? 1 : 0;
  }

  return {
    assetPath,
    byteLength: buffer.byteLength,
    meshes: meshes.length,
    primitives,
    primitivesWithUv0,
    primitivesWithUv1,
    materials: materials.length,
    textures: textures.length,
    samplers: samplers.length,
    images,
    materialTextureSlots,
    alphaModes: sortedRecord(alphaModes),
    doubleSidedMaterials,
    extensionsUsed: stringArray(document.extensionsUsed).sort(),
    extensionsRequired: stringArray(document.extensionsRequired).sort(),
  };
}

function auditImage(
  image: JsonObject,
  index: number,
  bufferViews: readonly JsonObject[],
  binaryChunk: Uint8Array | undefined,
): GlbImageAudit {
  const name = stringValue(image.name);
  const mimeType = stringValue(image.mimeType);
  const uri = stringValue(image.uri);
  const bufferViewIndex = numberValue(image.bufferView);

  if (bufferViewIndex !== null) {
    const bufferView = bufferViews[bufferViewIndex];
    const byteOffset = numberValue(bufferView?.byteOffset) ?? 0;
    const byteLength = numberValue(bufferView?.byteLength);

    if (binaryChunk === undefined || byteLength === null) {
      return {
        index,
        name,
        mimeType,
        storage: 'buffer-view',
        byteLength,
        sha256: null,
        uri: null,
        externalFileExists: null,
      };
    }

    const bytes = binaryChunk.subarray(byteOffset, byteOffset + byteLength);
    return {
      index,
      name,
      mimeType,
      storage: 'buffer-view',
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
      uri: null,
      externalFileExists: null,
    };
  }

  if (uri?.startsWith('data:') === true) {
    const separatorIndex = uri.indexOf(',');
    const header = uri.slice(0, separatorIndex);
    const payload = uri.slice(separatorIndex + 1);
    const bytes = header.endsWith(';base64')
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload));
    return {
      index,
      name,
      mimeType: mimeType ?? /^data:([^;,]+)/.exec(header)?.[1] ?? null,
      storage: 'data-uri',
      byteLength: bytes.byteLength,
      sha256: sha256(bytes),
      uri: null,
      externalFileExists: null,
    };
  }

  if (uri !== null) {
    return {
      index,
      name,
      mimeType,
      storage: 'external',
      byteLength: null,
      sha256: null,
      uri,
      externalFileExists: null,
    };
  }

  return {
    index,
    name,
    mimeType,
    storage: 'unknown',
    byteLength: null,
    sha256: null,
    uri: null,
    externalFileExists: null,
  };
}

function objectArray(value: unknown): readonly JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => objectValue(item) === item)
    : [];
}

function objectValue(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hasTextureIndex(value: unknown): boolean {
  return numberValue(objectValue(value).index) !== null;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function sortedRecord(record: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record).sort(([first], [second]) => first.localeCompare(second)),
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
