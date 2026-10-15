import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
const ALLOWED_EXTENSIONS = [
  "EXT_texture_webp",
  "KHR_mesh_quantization",
  "EXT_meshopt_compression",
];
const root = process.argv[2] || "dist";
const manifest = JSON.parse(
  await readFile(join(root, "shared/asset-manifest.json"), "utf8"),
);
const sw = await readFile(join(root, "sw.js"), "utf8");
const urls = new Set(
  [...sw.matchAll(/url:\s*["']([^"']+)["']/g)].map((m) =>
    m[1].replace(/^\//, ""),
  ),
);
const check = async (path) => {
  if (!/^(shared|brands)\/[a-zA-Z0-9/_.-]+$/.test(path) || path.includes(".."))
    throw Error(`Unsafe path: ${path}`);
  if (!urls.has(path)) throw Error(`Not precached: ${path}`);
  return readFile(join(root, path));
};
await check("shared/asset-manifest.json");
let modelBytes = 0;
for (const a of manifest.assets) {
  if (
    a.quotedProduct !== false ||
    !a.nativeDimensions.every((n) => n > 0) ||
    a.up !== "+Y" ||
    a.forward !== "+Z"
  )
    throw Error(`Invalid model contract: ${a.id}`);
  await check(`shared/licenses/${a.licenseKey}.txt`);
  for (const variant of [a, a.lowerDetail]) {
    const bytes = await check(variant.path);
    modelBytes += bytes.length;
    if (
      bytes.length !== variant.bytes ||
      bytes.length >= 1_000_000 ||
      createHash("sha256").update(bytes).digest("hex") !== variant.sha256
    )
      throw Error(`Size/hash mismatch: ${variant.path}`);
    if (
      bytes.readUInt32LE(0) !== 0x46546c67 ||
      bytes.readUInt32LE(4) !== 2 ||
      bytes.readUInt32LE(8) !== bytes.length
    )
      throw Error("Invalid GLB");
    const jsonLength = bytes.readUInt32LE(12),
      doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
    // Embedded WebP textures are allowed (CC0 decor); nothing external.
    // Quantised, meshopt-compressed geometry decodes with three's bundled decoder.
    if (
      doc.images?.some((i) => i.uri || i.mimeType !== "image/webp") ||
      doc.buffers?.some((b) => b.uri) ||
      doc.extensionsRequired?.some((e) => !ALLOWED_EXTENSIONS.includes(e)) ||
      doc.cameras?.length ||
      doc.animations?.length
    )
      throw Error(`Unexpected external dependency/payload: ${a.id}`);
    const triangles = doc.meshes.reduce(
      (n, m) =>
        n +
        m.primitives.reduce(
          (v, p) =>
            v + doc.accessors[p.indices ?? p.attributes.POSITION].count / 3,
          0,
        ),
      0,
    );
    if (triangles !== variant.triangles)
      throw Error(`Triangle count mismatch: ${a.id}`);
  }
}
for (const id of ["kitchen", "wardrobe"])
  await check(`shared/rooms/${id}-warm-v3.json`);
for (const slug of ["default", "druri-design"]) {
  const cat = JSON.parse(
    (await check(`brands/${slug}/catalog.json`)).toString(),
  );
  for (const group of [
    "fronts",
    "carcasses",
    "countertops",
    "backsplashes",
    "plinths",
  ])
    for (const m of cat[group])
      for (const field of ["texture", "normalMap", "roughnessMap", "aoMap"])
        if (m[field]) await check(m[field]);
}
for (const floor of ["laminate", "tiles", "concrete"])
  for (const map of ["color", "normal", "roughness"])
    await check(`shared/textures/${floor}-${map}.webp`);
if (modelBytes > 2_500_000) throw Error("Room kit allocation exceeded");
console.log(
  JSON.stringify(
    {
      models: manifest.assets.length,
      lods: manifest.assets.length * 2,
      modelBytes,
      precacheDependencyClosure: true,
      localEmbeddedOnly: true,
    },
    null,
    2,
  ),
);
