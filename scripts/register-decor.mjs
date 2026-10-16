// Register Blender-prepared CC0 decor (art/blender/prepare_decor.py output)
// in public/shared/asset-manifest.json with content-hashed file names.
//   node scripts/register-decor.mjs <prepared-dir> <polyhaven-download-dir> [id,id,...]
// With an id list only those entries are (re)registered; the others stay.
// Geometry is quantised and meshopt-compressed like the scripted kit.
import {
  readFile,
  writeFile,
  readdir,
  unlink,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

const [prepared, downloads, onlyList] = process.argv.slice(2);
const root = "public/shared";
const only = onlyList ? new Set(onlyList.split(",")) : null;
const config = JSON.parse(
  await readFile("art/blender/decor.json", "utf8"),
).filter((c) => !only || only.has(c.id));
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
/** Blender occasionally fails to write a roughness image and leaves a texture
 * without a source; drop such references so the material keeps its factor. */
function withoutEmptyTextures(json) {
  const empty = new Set(
    (json.textures ?? []).flatMap((t, i) =>
      t.source === undefined && !Object.keys(t.extensions ?? {}).length
        ? [i]
        : [],
    ),
  );
  if (!empty.size) return json;
  for (const m of json.materials ?? []) {
    const pbr = m.pbrMetallicRoughness ?? {};
    for (const [owner, key] of [
      [pbr, "metallicRoughnessTexture"],
      [pbr, "baseColorTexture"],
      [m, "normalTexture"],
      [m, "occlusionTexture"],
      [m, "emissiveTexture"],
    ])
      if (owner[key] && empty.has(owner[key].index)) delete owner[key];
  }
  return json;
}
/** Blender exports a picture frame's glass as a blended but fully opaque
 * pane, which hides the print: keep it as a faint reflection. */
function clearGlass(json) {
  for (const m of json.materials ?? [])
    if (m.alphaMode === "BLEND" && /glass/i.test(m.name ?? "")) {
      const pbr = (m.pbrMetallicRoughness ??= {});
      const f = pbr.baseColorFactor ?? [1, 1, 1, 1];
      if (f[3] >= 0.5) pbr.baseColorFactor = [f[0], f[1], f[2], 0.12];
    }
  return json;
}
async function optimise(file) {
  const raw = await readFile(file);
  const json = clearGlass(
    withoutEmptyTextures(JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)))),
  );
  const binStart = 20 + raw.readUInt32LE(12);
  const doc = await io.readJSON({
    json,
    resources: { "@glb.bin": new Uint8Array(raw.subarray(binStart + 8)) },
  });
  await doc.transform(
    dedup(),
    prune(),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  return Buffer.from(await io.writeBinary(doc));
}
const manifestPath = `${root}/asset-manifest.json`;
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const origins = {
  "cutting-board": "countertop",
  "fruit-bowl": "countertop",
  "plant-small": "countertop",
  vase: "countertop",
  "wall-art": "wall",
  "wall-art-tall": "wall",
  "dining-chair": "floor",
  "side-table": "floor",
  "vase-tall": "countertop",
  "pendant-globe": "ceiling",
  sideboard: "floor",
  "plant-tree": "floor",
  armchair: "floor",
  "vase-round": "countertop",
  dresser: "floor",
  basket: "floor",
};
const sha = (b) => createHash("sha256").update(b).digest("hex");

/** Bounds, triangles and slots come from the prepared (unquantised) file;
 * bytes, hash and geometry size from the optimised one that ships. */
function stats(source, bytes, path, side) {
  const json = JSON.parse(source.subarray(20, 20 + source.readUInt32LE(12)));
  const shipped = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  let triangles = 0,
    drawCalls = 0,
    geometryBytes = 0;
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  const views = new Set();
  for (const mesh of json.meshes)
    for (const p of mesh.primitives) {
      drawCalls++;
      triangles += json.accessors[p.indices].count / 3;
      const pos = json.accessors[p.attributes.POSITION];
      pos.min.forEach((v, i) => (min[i] = Math.min(min[i], v)));
      pos.max.forEach((v, i) => (max[i] = Math.max(max[i], v)));
    }
  for (const mesh of shipped.meshes)
    for (const p of mesh.primitives)
      for (const a of [p.indices, ...Object.values(p.attributes)])
        views.add(shipped.accessors[a].bufferView);
  for (const v of views) geometryBytes += shipped.bufferViews[v].byteLength;
  // Images are WebP squares from the prepare step; RGBA + mip chain estimate.
  return {
    stats: {
      path,
      sha256: sha(bytes),
      bytes: bytes.length,
      triangles,
      drawCalls,
      geometryBytes,
      nativeDimensions: max.map((v, i) => +(v - min[i]).toFixed(4)),
      bounds: { min, max },
    },
    materials: json.materials.map((m) => m.name),
    decoded: Math.round((json.images?.length ?? 0) * side * side * 4 * 1.33),
  };
}

const ids = new Set(config.map((c) => c.id));
for (const file of await readdir(`${root}/models`))
  if ([...ids].some((id) => file.startsWith(id + "-")))
    await unlink(`${root}/models/${file}`);
manifest.assets = manifest.assets.filter((a) => !ids.has(a.id));
for (const item of config) {
  const variants = [];
  for (const detail of ["balanced", "lightweight"]) {
    const file = join(prepared, `${item.id}-${detail}.glb`);
    const bytes = await optimise(file);
    const path = `shared/models/${item.id}-${detail}-${sha(bytes).slice(0, 10)}.glb`;
    await writeFile(`public/${path}`, bytes);
    const side = (item.texture ?? 512) / (detail === "balanced" ? 1 : 2);
    variants.push(stats(await readFile(file), bytes, path, side));
  }
  const sources = await Promise.all(
    item.parts.map(async (p) => {
      const folder = join(downloads, p.asset);
      const file = (await readdir(folder)).find(
        (f) => f === `${p.asset}_1k.gltf`,
      ) ?? (await readdir(folder)).find((f) => f.endsWith(".blend"));
      return readFile(join(folder, file));
    }),
  );
  manifest.assets.push({
    id: item.id,
    revision: 1,
    ...variants[0].stats,
    lowerDetail: variants[1].stats,
    materialSlots: variants[0].materials,
    origin: origins[item.id],
    up: "+Y",
    forward: "+Z",
    anchors: { attachment: [0, 0, 0] },
    quality: "balanced",
    decodedTextureBytes: variants[0].decoded,
    licenseKey: "polyhaven-cc0",
    source: [
      ...new Set(item.parts.map((p) => `https://polyhaven.com/a/${p.asset}`)),
    ].join(" "),
    sourceSha256: sha(Buffer.concat(sources)),
    quotedProduct: false,
  });
}
manifest.revision = "room-kit-v2";
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  "registered",
  config.map((c) => c.id).join(", "),
  manifest.assets.reduce((n, a) => n + a.bytes + a.lowerDetail.bytes, 0),
  "kit bytes",
);
