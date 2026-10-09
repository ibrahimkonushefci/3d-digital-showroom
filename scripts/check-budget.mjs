import { readdir, stat, readFile } from "node:fs/promises";
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
console.log(
  `Asset budget: shipped ${shipped.toLocaleString()} bytes; unique precache ${cached.toLocaleString()} bytes (${urls.length} URLs).`,
);
if (Math.max(shipped, cached) >= 10_000_000)
  throw Error("10 MB asset budget exceeded");
if (Math.max(shipped, cached) > 9_000_000)
  console.warn("Working budget exceeds 9 MB; optimize before adding assets.");
