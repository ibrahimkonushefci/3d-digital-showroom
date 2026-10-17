// Picture previews for the Styles and Room tabs, rendered from the real
// scene (finishes, worktops, handles, front styles, floors, ready-made looks,
// unit types and wardrobe interior parts).
//   1. pnpm dev --port 5203 --strictPort   (the render page is dev-only)
//   2. Chrome with --remote-debugging-port=9333 (see capture-showroom.mjs)
//   3. node scripts/review/render-previews.mjs http://127.0.0.1:5203 [filter]
// Writes public/shared/previews/*.webp and src/designer3d/previews.json.
// Re-run after changing finishes, room lighting or the ready-made looks.
// Trying a composition: PREVIEW_OUT=<dir> writes PNGs there instead (no
// manifest), PREVIEW_CAM="px,py,pz,tx,ty,tz,fov" overrides the camera.
import { connect } from "./cdp.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:5203";
const FILTER = process.argv[3] || "";
const TRY = process.env.PREVIEW_OUT;
const OUT = TRY || "public/shared/previews";
const CAM = process.env.PREVIEW_CAM
  ? `&cam=${encodeURIComponent(process.env.PREVIEW_CAM)}`
  : "";
const MANIFEST = "src/designer3d/previews.json";
const catalog = JSON.parse(
  fs.readFileSync("public/brands/default/catalog.json", "utf8"),
);
const looks = fs
  .readFileSync("src/designer3d/looks.ts", "utf8")
  .matchAll(/^\s{4}id: "([a-z-]+)"/gm);
// [item, output size, colour the picture depends on]
const items = [
  ...catalog.fronts.map((m) => [`front:${m.id}`, [160, 160], m.color]),
  ...catalog.countertops.map((m) => [`worktop:${m.id}`, [160, 160], m.color]),
  ...catalog.handles.flatMap((m) => [
    [`handle:${m.id}`, [308, 220], m.color],
    [`handle:${m.id}-wardrobe`, [308, 220], m.color],
  ]),
  ...["flat", "panel"].flatMap((p) =>
    ["kitchen", "wardrobe"].map((k) => [`profile:${p}-${k}`, [308, 220]]),
  ),
  ...["laminate", "tiles", "concrete"].map((f) => [`floor:${f}`, [160, 160]]),
  ...[...looks].map((m) => [`look:${m[1]}`, [320, 200]]),
  ...catalog.modules.map((m) => [`unit:${m.id}`, [240, 200]]),
  ...["shelf", "rail", "drawer", "basket"].map((k) => [
    `interior:${k}`,
    [240, 200],
  ]),
].filter(([item]) => item.includes(FILTER));

const manifest = fs.existsSync(MANIFEST)
  ? JSON.parse(fs.readFileSync(MANIFEST, "utf8"))
  : { version: 1, items: {} };
fs.mkdirSync(OUT, { recursive: true });
const c = await connect();
await c.send("Page.enable");
await c.send("Emulation.setDeviceMetricsOverride", {
  width: 1000,
  height: 700,
  deviceScaleFactor: 2,
  mobile: false,
});
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "previews-"));
async function render(item, [w, h], color) {
  await c.send("Page.navigate", {
    url: `${BASE}/preview-render?brand=default&item=${encodeURIComponent(item)}${CAM}`,
  });
  let ready = false;
  for (let i = 0; i < 150 && !ready; i++) {
    await c.sleep(100);
    ready = await c
      .evaluate(
        `document.querySelector(".preview-render")?.dataset.ready === "1"`,
      )
      .catch(() => false);
  }
  if (!ready) throw new Error("not ready");
  // Textures, contact shadows and the sharp still frame settle.
  await c.sleep(item.startsWith("look:") ? 4500 : 2500);
  const clip = await c.evaluate(
    `(()=>{const r=document.querySelector(".preview-render").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`,
  );
  const png = path.join(tmp, "shot.png");
  await c.shot(png, clip);
  const [kind, id] = item.split(":");
  if (TRY) {
    fs.copyFileSync(png, path.join(OUT, `${kind}-${id}.png`));
    console.log(item);
    return;
  }
  const name = `${kind}-${id}.webp`;
  execFileSync("cwebp", [
    "-quiet",
    "-q",
    kind === "look" ? "80" : "78",
    "-m",
    "6",
    "-resize",
    String(w),
    String(h),
    png,
    "-o",
    path.join(OUT, name),
  ]);
  manifest.items[item] = {
    src: `shared/previews/${name}`,
    ...(color ? { color } : {}),
  };
  console.log(item, fs.statSync(path.join(OUT, name)).size, "bytes");
}
for (const [item, size, color] of items)
  for (let attempt = 1; ; attempt++)
    try {
      await render(item, size, color);
      break;
    } catch (error) {
      // A dev-server reload mid-shot: try again.
      if (attempt === 3) {
        console.log("failed:", item, String(error).slice(0, 120));
        break;
      }
    }
manifest.items = Object.fromEntries(
  Object.entries(manifest.items).sort(([a], [b]) => a.localeCompare(b)),
);
if (!TRY) fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
process.exit(0);
