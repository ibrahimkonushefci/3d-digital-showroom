// Optimise the Blender-scripted Phase 2 kit (art/blender/phase2_kit.py output)
// and register it in public/shared/asset-manifest.json with content-hashed names.
//   node scripts/register-kit.mjs <kit-dir>
// Each <id>.json beside the GLBs carries Blender's bounds/triangles/material slots.
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, quantize, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

const [dir] = process.argv.slice(2);
if (!dir) throw Error("usage: node scripts/register-kit.mjs <kit-dir>");
const root = "public/shared";
const manifestPath = `${root}/asset-manifest.json`;
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const sourceSha256 = sha(
  Buffer.concat([
    await readFile("art/blender/phase2_kit.py"),
    await readFile("art/blender/kit_lib.py"),
  ]),
);
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });

async function optimise(file) {
  const doc = await io.read(file);
  await doc.transform(
    dedup(),
    prune(),
    // 14-bit positions keep ~0.1 mm on a 2 m fridge; colours are AO only.
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeColor: 8 }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  let drawCalls = 0,
    geometryBytes = 0;
  const seen = new Set();
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      drawCalls++;
      for (const a of [prim.getIndices(), ...prim.listAttributes()])
        if (a && !seen.has(a)) {
          seen.add(a);
          geometryBytes += a.getByteLength();
        }
    }
  const bytes = Buffer.from(await io.writeBinary(doc));
  return { bytes, drawCalls, geometryBytes };
}

// Re-encode earlier CC0 decor geometry the same way (textures unchanged).
const replacedDecor = new Set();
if (process.argv.includes("--decor"))
  for (const a of manifest.assets.filter(
    (x) => x.licenseKey === "polyhaven-cc0",
  ))
    for (const v of [a, a.lowerDetail]) {
      const { bytes } = await optimise(`public/${v.path}`);
      if (bytes.length >= v.bytes) continue;
      const hash = sha(bytes);
      replacedDecor.add(v.path);
      v.path = v.path.replace(
        /-[a-f0-9]{10}\.glb$/,
        `-${hash.slice(0, 10)}.glb`,
      );
      await writeFile(`public/${v.path}`, bytes);
      v.sha256 = hash;
      v.bytes = bytes.length;
      console.log("decor", v.path, bytes.length);
    }
const ids = (await readdir(dir))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5))
  .sort();
const replaced = new Set();
for (const id of ids) {
  const info = JSON.parse(await readFile(join(dir, `${id}.json`), "utf8"));
  const lods = {};
  for (const lod of info.shared ? ["balanced"] : ["balanced", "lightweight"]) {
    const { bytes, drawCalls, geometryBytes } = await optimise(
      join(dir, `${id}-${lod}.glb`),
    );
    const hash = sha(bytes);
    const path = `shared/models/${id}-${lod}-${hash.slice(0, 10)}.glb`;
    await writeFile(`public/${path}`, bytes);
    const b = info[lod];
    lods[lod] = {
      path,
      sha256: hash,
      bytes: bytes.length,
      triangles: b.triangles,
      drawCalls,
      geometryBytes,
      nativeDimensions: b.max.map((v, i) => +(v - b.min[i]).toFixed(6)),
      bounds: { min: b.min, max: b.max },
    };
  }
  // Hard-surface pieces share one file for both levels (bevels do not decimate).
  if (info.shared) lods.lightweight = lods.balanced;
  const previous = manifest.assets.find((a) => a.id === id);
  if (previous) {
    replaced.add(previous.path);
    replaced.add(previous.lowerDetail.path);
  }
  const entry = {
    id,
    revision:
      previous && previous.sha256 !== lods.balanced.sha256
        ? previous.revision + 1
        : (previous?.revision ?? 1),
    ...lods.balanced,
    lowerDetail: lods.lightweight,
    materialSlots: info.balanced.materials,
    origin: info.origin,
    up: "+Y",
    forward: "+Z",
    anchors: { attachment: [0, 0, 0] },
    quality: "balanced",
    decodedTextureBytes: 0,
    licenseKey: "original-room-kit-v2",
    source: "art/blender/phase2_kit.py",
    sourceSha256,
    quotedProduct: false,
  };
  manifest.assets = previous
    ? manifest.assets.map((a) => (a.id === id ? entry : a))
    : [...manifest.assets, entry];
  console.log(
    id.padEnd(14),
    `${lods.balanced.bytes} + ${lods.lightweight.bytes} bytes`,
    `${lods.balanced.triangles} tris`,
  );
}
manifest.revision = "room-kit-v3";
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
// Remove superseded hashed files no longer referenced by the manifest.
const live = new Set(
  manifest.assets.flatMap((a) => [a.path, a.lowerDetail.path]),
);
for (const p of [...replaced, ...replacedDecor])
  if (!live.has(p)) await unlink(`public/${p}`).catch(() => {});
console.log("kit files:", live.size);
let total = 0;
for (const a of manifest.assets) {
  total += a.bytes;
  if (a.lowerDetail.path !== a.path) total += a.lowerDetail.bytes;
}
console.log("unique kit bytes:", total);
