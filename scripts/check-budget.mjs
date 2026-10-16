import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const root = process.argv[2] || "dist";
async function walk(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map(async (e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      ),
    )
  ).flat();
}
const files = await walk(root);
const shipped = (
  await Promise.all(files.map(async (f) => (await stat(f)).size))
).reduce((a, b) => a + b, 0);
const sw = await readFile(join(root, "sw.js"), "utf8");
const urls = [
  ...new Set([...sw.matchAll(/url:\s*["']([^"']+)["']/g)].map((m) => m[1])),
];
if (!urls.length) throw Error("Precache manifest not found");
const cached = (
  await Promise.all(
    urls.map(async (u) => (await stat(join(root, u.replace(/^\//, "")))).size),
  )
).reduce((a, b) => a + b, 0);
const result = {
  shippedBytes: shipped,
  uniquePrecacheBytes: cached,
  precacheUrls: urls.length,
  // Raised for the Phase 2 rooms by the owner (16 October 2026): about 11 MB.
  workingTargetBytes: 11_000_000,
  strictCeilingBytes: 12_000_000,
  largestFiles: (
    await Promise.all(
      files.map(async (f) => ({
        path: f.slice(root.length + 1),
        bytes: (await stat(f)).size,
      })),
    )
  )
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10),
};
const jsonIndex = process.argv.indexOf("--json");
if (jsonIndex !== -1) {
  const path = process.argv[jsonIndex + 1];
  if (!path || path.startsWith("--"))
    throw Error("--json requires an output path");
  await writeFile(path, JSON.stringify(result, null, 2) + "\n");
}
console.log(
  `Asset budget: shipped ${shipped.toLocaleString()} bytes; unique precache ${cached.toLocaleString()} bytes (${urls.length} URLs).`,
);
if (Math.max(shipped, cached) >= 12_000_000)
  throw Error("12 MB asset budget exceeded");
if (Math.max(shipped, cached) > 11_000_000)
  console.warn("Working budget exceeds 11 MB; optimize before adding assets.");
