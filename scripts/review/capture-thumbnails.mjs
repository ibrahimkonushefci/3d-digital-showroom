// Home thumbnails from the live opening views (plan §6.8 B7, §8.4).
//   1. pnpm build && pnpm preview --port 52775 --strictPort
//   2. Chrome with --remote-debugging-port=9333 (see capture-showroom.mjs)
//   3. node scripts/review/capture-thumbnails.mjs http://127.0.0.1:52775 [--write]
// Opens every Home card that shows a prepared design, waits for its first
// complete (baked) frame and saves the canvas at 960 × 554 WebP. Without
// --write the images go to verification/thumbnails/ for review only.
import { connect } from "./cdp.mjs";
import { homeCards } from "./home.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:52775";
const WRITE = process.argv.includes("--write");
const OUT = WRITE ? "public" : "verification/thumbnails";
const WIDTH = 960,
  HEIGHT = 554;
const c = await connect();
await c.send("Page.enable");
await c.send("Network.enable");
await c.send("Network.setBypassServiceWorker", { bypass: true });
await c.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 2,
  mobile: false,
});
const home = async () => {
  await c.send("Page.navigate", { url: BASE + "/?brand=default" });
  await c.sleep(2500);
};
await home();
const cards = (await homeCards(c)).filter((x) =>
  x.src.startsWith("shared/showroom/"),
);
const done = new Set();
// The category tiles ("Kitchens", "Wardrobes") reuse a preset's image but
// open the last design: take each image from its own preset card, which
// Home lists after the tiles.
for (const { k, src } of [...cards].reverse()) {
  if (done.has(src)) continue;
  done.add(src);
  await home();
  // Home renders its cards progressively: wait for this one.
  for (let i = 0; i < 100; i++) {
    if (await c.evaluate(`document.querySelectorAll('img').length > ${k}`))
      break;
    await c.sleep(100);
  }
  await c.evaluate(
    `[...document.querySelectorAll('img')][${k}].closest('button,a').click()`,
  );
  for (let i = 0; i < 200; i++) {
    if (
      await c.evaluate(
        `!!document.querySelector('canvas') && !document.querySelector('.scene-loading')`,
      )
    )
      break;
    await c.sleep(100);
  }
  await c.sleep(4000);
  const clip = await c.evaluate(
    `(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`,
  );
  const png = path.join(fs.mkdtempSync("/tmp/thumb-"), "hero.png");
  await c.shot(png, clip);
  // Centre crop to the thumbnail aspect, then scale down.
  const w = Math.round(clip.width * 2),
    h = Math.round(clip.height * 2);
  const cropH = Math.min(h, Math.round((w * HEIGHT) / WIDTH));
  const cropW = Math.min(w, Math.round((cropH * WIDTH) / HEIGHT));
  const target = path.join(OUT, src);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  execFileSync("cwebp", [
    "-quiet",
    "-q",
    "82",
    "-m",
    "6",
    "-crop",
    String(Math.floor((w - cropW) / 2)),
    String(Math.floor((h - cropH) / 2)),
    String(cropW),
    String(cropH),
    "-resize",
    String(WIDTH),
    String(HEIGHT),
    png,
    "-o",
    target,
  ]);
  console.log(target, fs.statSync(target).size, "bytes");
}
process.exit(0);
