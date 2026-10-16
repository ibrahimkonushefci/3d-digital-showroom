// Phase 3 room-shell lightmaps for the prepared designs.
//   1. pnpm dev --port 5203 --strictPort      (the export hook is DEV only)
//   2. Chrome with --remote-debugging-port=9333 (see capture-showroom.mjs)
//   3. node scripts/bake-rooms.mjs http://127.0.0.1:5203 <work-dir> [name-filter]
//      [--samples N] [--preview] [--export-only]
// For every Home preset: open it, export the scene (window.__bakeExport),
// bake in Blender (art/blender/bake_room.py), encode to WebP and register it
// in public/shared/bakes/manifest.json under the design's bake signature.
import { connect } from "./review/cdp.mjs";
import { homeCards } from "./review/home.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:5203";
const WORK = path.resolve(process.argv[3] || "bake-work");
const args = process.argv.slice(4);
const FILTER = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
const flag = (name) => args.includes(name);
const option = (name) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender";
const OUT = "public/shared/bakes";
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const c = await connect();
await c.send("Page.enable");
await c.send("Network.enable");
await c.send("Network.setBypassServiceWorker", { bypass: true });
await c.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
const home = async () => {
  await c.send("Page.navigate", { url: BASE + "/?brand=default" });
  await c.sleep(3000);
};
await home();
// English card names (the default language may differ).
await c.evaluate(
  `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='EN')?.click()`,
);
await c.sleep(800);
const cards = await homeCards(c);
const manifestPath = path.join(OUT, "manifest.json");
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : { revision: 1, bakes: {} };
const done = new Set();
for (const card of cards) {
  if (FILTER && !card.txt.toLowerCase().includes(FILTER.toLowerCase()))
    continue;
  await home();
  // Home renders its cards progressively: wait for this one.
  for (let i = 0; i < 100; i++) {
    if (await c.evaluate(`document.querySelectorAll('img:not(dialog img)').length > ${card.k}`))
      break;
    await c.sleep(100);
  }
  await c.evaluate(
    `[...document.querySelectorAll('img:not(dialog img)')][${card.k}].closest('button,a').click()`,
  );
  for (let i = 0; i < 200; i++) {
    const ready = await c.evaluate(
      `!document.querySelector('.scene-loading') && typeof window.__bakeExport === 'function'`,
    );
    if (ready) break;
    await c.sleep(100);
  }
  await c.sleep(2500);
  if (!(await c.evaluate(`typeof window.__bakeExport === 'function'`))) {
    console.log(`skipped ${card.txt.slice(0, 30)}: no designer scene`);
    continue;
  }
  const { glb, json } = await c.evaluate(`window.__bakeExport()`);
  if (done.has(json.signature)) continue;
  done.add(json.signature);
  const name = card.txt.replace(/\s+/g, " ").slice(0, 40);
  json.preset = name;
  const base = path.join(WORK, json.signature);
  fs.writeFileSync(base + ".glb", Buffer.from(glb, "base64"));
  fs.writeFileSync(base + ".json", JSON.stringify(json, null, 2));
  console.log(`exported ${name} → ${json.signature} (${json.meshes} meshes)`);
  if (flag("--export-only")) continue;
  const started = Date.now();
  const log = execFileSync(
    BLENDER,
    [
      "--background",
      "--factory-startup",
      "--python",
      "art/blender/bake_room.py",
      "--",
      base + ".glb",
      base + ".json",
      base + "-bake",
      ...(option("--samples") ? ["--samples", option("--samples")] : []),
      ...(flag("--preview") ? ["--preview"] : []),
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const baked = log.split("\n").find((l) => l.startsWith("BAKED"));
  if (!baked) throw Error("Bake failed:\n" + log.slice(-3000));
  const result = JSON.parse(fs.readFileSync(base + "-bake.json", "utf8"));
  const file = `${json.signature}.webp`;
  execFileSync("cwebp", [
    "-quiet",
    "-q",
    "92",
    "-m",
    "6",
    "-sharp_yuv",
    base + "-bake.png",
    "-o",
    path.join(OUT, file),
  ]);
  const previous = manifest.bakes[json.signature];
  manifest.bakes[json.signature] = {
    preset: name,
    file,
    bytes: fs.statSync(path.join(OUT, file)).size,
    rects: result.rects,
    room: result.room,
    // World position of the shell's corner (the presentation envelope).
    origin: json.origin,
    encodeMax: result.encodeMax,
    gamma: result.gamma,
    // Exposure match to the live lighting (scripts/review/calibrate-bakes.mjs).
    gain: previous?.gain ?? 1,
    samples: result.samples,
    script: "art/blender/bake_room.py",
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `baked ${name} in ${((Date.now() - started) / 1000).toFixed(0)} s:`,
    file,
    manifest.bakes[json.signature].bytes,
    "bytes",
    JSON.stringify(result.stats),
  );
}
process.exit(0);
