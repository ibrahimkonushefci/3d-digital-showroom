// Repair decor GLBs damaged by the Blender → WebP export (Phase 1 follow-up):
// 1. The wall art's artwork roughness map lost its image; three's GLTFLoader
//    then rejected the whole file, so the framed print never appeared. Dangling
//    texture slots are dropped (the material's scalar factors take over).
// 2. Its "_glass" layer kept BLEND but lost its transparency and reused the
//    frame's maps, so it covered the picture as an opaque dark pane. Such a
//    layer becomes faint clear glass.
// The file name is re-hashed and the manifest entry updated. Geometry and
// every other texture are untouched.
//   node scripts/repair-decor-textures.mjs
import { readFile, writeFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";

const manifestPath = "public/shared/asset-manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const SLOTS = [
  ["normalTexture"],
  ["occlusionTexture"],
  ["emissiveTexture"],
  ["pbrMetallicRoughness", "baseColorTexture"],
  ["pbrMetallicRoughness", "metallicRoughnessTexture"],
];

/** Texture index → true when it has an image (core or EXT_texture_webp). */
export function textureResolves(json, index) {
  const texture = json.textures?.[index];
  if (!texture) return false;
  const source = texture.source ?? texture.extensions?.EXT_texture_webp?.source;
  return source !== undefined && !!json.images?.[source];
}

function repair(bytes) {
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const rest = bytes.subarray(20 + jsonLength);
  const dropped = [];
  for (const material of json.materials ?? [])
    for (const path of SLOTS) {
      const owner = path.length > 1 ? material[path[0]] : material;
      const slot = path.at(-1);
      if (!owner?.[slot] || textureResolves(json, owner[slot].index)) continue;
      delete owner[slot];
      // A matte print: no metal, paper-like roughness.
      if (slot === "metallicRoughnessTexture") owner.roughnessFactor ??= 0.85;
      dropped.push(`${material.name}.${slot}`);
    }
  for (const material of json.materials ?? []) {
    const pbr = (material.pbrMetallicRoughness ??= {});
    if (
      material.alphaMode === "BLEND" &&
      /_glass$/.test(material.name ?? "") &&
      (pbr.baseColorFactor?.[3] ?? 1) >= 1
    ) {
      delete pbr.baseColorTexture;
      delete pbr.metallicRoughnessTexture;
      pbr.baseColorFactor = [1, 1, 1, 0.08];
      pbr.metallicFactor = 0;
      pbr.roughnessFactor = 0.08;
      dropped.push(`${material.name} → clear glass`);
    }
  }
  if (!dropped.length) return null;
  let text = JSON.stringify(json);
  while (Buffer.byteLength(text) % 4) text += " ";
  const chunk = Buffer.from(text);
  const header = Buffer.alloc(20);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + chunk.length + rest.length, 8);
  header.writeUInt32LE(chunk.length, 12);
  header.write("JSON", 16, "ascii");
  return { bytes: Buffer.concat([header, chunk, rest]), dropped };
}

for (const asset of manifest.assets) {
  for (const entry of [asset, asset.lowerDetail]) {
    if (!entry?.path?.endsWith(".glb")) continue;
    const file = `public/${entry.path}`;
    const fixed = repair(await readFile(file));
    if (!fixed) continue;
    const path = entry.path.replace(
      /-[0-9a-f]{10}\.glb$/,
      `-${sha(fixed.bytes).slice(0, 10)}.glb`,
    );
    await writeFile(`public/${path}`, fixed.bytes);
    if (path !== entry.path) await unlink(file);
    entry.path = path;
    entry.sha256 = sha(fixed.bytes);
    entry.bytes = fixed.bytes.length;
    console.log("repaired", path, fixed.dropped.join(", "));
  }
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
