// Register Blender-prepared CC0 decor (art/blender/prepare_decor.py output)
// in public/shared/asset-manifest.json with content-hashed file names.
//   node scripts/register-decor.mjs <prepared-dir> <polyhaven-download-dir>
import {
  readFile,
  writeFile,
  copyFile,
  readdir,
  unlink,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const [prepared, downloads] = process.argv.slice(2);
const root = "public/shared";
const config = JSON.parse(await readFile("art/blender/decor.json", "utf8"));
const manifestPath = `${root}/asset-manifest.json`;
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const origins = {
  "cutting-board": "countertop",
  "fruit-bowl": "countertop",
  "plant-small": "countertop",
  vase: "countertop",
  "wall-art": "wall",
  basket: "floor",
};
const sha = (b) => createHash("sha256").update(b).digest("hex");

function stats(bytes, path) {
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
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
      for (const a of [p.indices, ...Object.values(p.attributes)])
        views.add(json.accessors[a].bufferView);
    }
  for (const v of views) geometryBytes += json.bufferViews[v].byteLength;
  // Images are WebP squares from the prepare step; RGBA + mip chain estimate.
  const side = path.includes("lightweight") ? 192 : 384;
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
    const bytes = await readFile(join(prepared, `${item.id}-${detail}.glb`));
    const path = `shared/models/${item.id}-${detail}-${sha(bytes).slice(0, 10)}.glb`;
    await copyFile(
      join(prepared, `${item.id}-${detail}.glb`),
      `public/${path}`,
    );
    variants.push(stats(bytes, path));
  }
  const sources = await Promise.all(
    item.parts.map((p) =>
      readFile(join(downloads, p.asset, `${p.asset}_1k.gltf`)),
    ),
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
