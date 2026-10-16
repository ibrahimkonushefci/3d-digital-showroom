// Regression check for individual front interaction (Phase 1 follow-up).
// The AO pass once drew the selection outline's raw 2 × 3 m instancing quad,
// so clicking one cabinet painted a huge black panel that stayed after closing.
// This sweeps real clicks over each prepared design and fails if the canvas
// gains a large near-black area compared with its closed starting view.
//
// 1. pnpm build && pnpm preview --port 52771 --strictPort
// 2. Chrome with --remote-debugging-port=9333 and an empty --user-data-dir
//    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new
//    --remote-debugging-port=9333 --user-data-dir=<empty dir> --use-angle=metal --enable-gpu about:blank
// 3. node scripts/review/check-front-interactions.mjs http://127.0.0.1:52771 <out-dir> [lightweight]
import { connect } from "./cdp.mjs";
import fs from "node:fs";
import { decodePng } from "./png.mjs";

const BASE = process.argv[2] || "http://127.0.0.1:52771";
const OUT = process.argv[3] || "out";
const LIGHTWEIGHT = process.argv[4] === "lightweight";
/** Canvas share of near-black pixels allowed above the closed baseline. */
const TOLERANCE = 0.015;
fs.mkdirSync(OUT, { recursive: true });

/** Share of pixels darker than an unlit slot (luma < 14 of 255). */
function darkShare(png) {
  const { width, height, channels, pixels } = decodePng(png);
  let dark = 0;
  for (let i = 0; i < width * height; i++) {
    const r = pixels[i * channels],
      g = pixels[i * channels + 1],
      b = pixels[i * channels + 2];
    if (0.2126 * r + 0.7152 * g + 0.0722 * b < 14) dark++;
  }
  return dark / (width * height);
}

const c = await connect();
await c.send("Page.enable");
// Always the build being served, never an older one from the offline cache.
await c.send("Network.enable");
await c.send("Network.setBypassServiceWorker", { bypass: true });
await c.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
const clickText = (t, exact = false) =>
  c.evaluate(
    `(()=>{const els=[...document.querySelectorAll('button,a,[role=button]')].filter(e=>e.offsetParent!==null&&!e.disabled);const e=els.find(e=>${exact}?e.textContent.trim()===${JSON.stringify(t)}:e.textContent.trim().includes(${JSON.stringify(t)}));if(!e)return false;e.click();return true})()`,
  );
const canvasClip = () =>
  c.evaluate(
    `(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`,
  );
async function measure(name, keep) {
  const clip = await canvasClip();
  const r = await c.send("Page.captureScreenshot", {
    format: "png",
    clip: { ...clip, scale: 1 },
  });
  const png = Buffer.from(r.data, "base64");
  if (keep) fs.writeFileSync(`${OUT}/${name}.png`, png);
  return darkShare(png);
}
async function clickCanvas(fx, fy) {
  const clip = await canvasClip();
  const x = clip.x + clip.width * fx,
    y = clip.y + clip.height * fy;
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
    await c.send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: type === "mouseMoved" ? "none" : "left",
      clickCount: type === "mouseMoved" ? 0 : 1,
    });
}

const failures = [];
const rows = [];
function record(design, step, share, baseline) {
  const ok = share <= baseline + TOLERANCE;
  rows.push({ design, step, dark: +(share * 100).toFixed(2), ok });
  if (!ok) failures.push(`${design} · ${step}: ${(share * 100).toFixed(1)}%`);
}

await c.send("Page.navigate", { url: BASE + "/?brand=default" });
await c.sleep(2500);
await clickText("EN", true);
// Performance mode (lightweight quality, no AO) is read at load.
await c.evaluate(
  `localStorage.setItem("showroom-performance", ${JSON.stringify(String(LIGHTWEIGHT))})`,
);
await c.sleep(500);
const cards = await c.evaluate(
  `[...document.querySelectorAll('img')].map((i,k)=>({k,txt:i.closest('button,a')?.textContent.trim()})).filter(x=>x.txt)`,
);
const seen = new Set();
for (const card of cards) {
  if (seen.has(card.txt)) continue;
  seen.add(card.txt);
  const slug = card.txt
    .replace(/^\d+/, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  await c.send("Page.navigate", { url: BASE + "/?brand=default" });
  await c.sleep(2000);
  await c.evaluate(
    `[...document.querySelectorAll('img')][${card.k}].closest('button,a').click()`,
  );
  await c.sleep(7000);
  const baseline = await measure(`${slug}-baseline`, true);
  rows.push({
    design: slug,
    step: "baseline",
    dark: +(baseline * 100).toFixed(2),
    ok: true,
  });
  // Two bands (upper/wall and lower/base) across the frame: direct clicks,
  // selection changes from one unit to the next and sidebar close.
  let n = 0;
  for (const fy of [0.3, 0.68])
    for (const fx of [0.12, 0.3, 0.48, 0.66, 0.84]) {
      await clickCanvas(fx, fy);
      await c.sleep(1400);
      const opened = await c.evaluate(
        `[...document.querySelectorAll('button')].some(e=>e.offsetParent&&e.textContent.trim()==='Close compartment')`,
      );
      const step = `click ${fx},${fy}${opened ? " open" : ""}`;
      record(slug, step, await measure(`${slug}-${n}-open`, n < 3), baseline);
      if (opened) {
        await clickText("Close compartment", true);
        await c.sleep(1800);
        record(
          slug,
          `${step} → sidebar close (selected)`,
          await measure(`${slug}-${n}-closed`, n < 3),
          baseline,
        );
        await clickText("Open compartment", true);
        await c.sleep(1400);
        record(
          slug,
          `${step} → sidebar reopen`,
          await measure("tmp"),
          baseline,
        );
        await clickText("Close compartment", true);
        await c.sleep(1800);
        record(slug, `${step} → close again`, await measure("tmp"), baseline);
      }
      n++;
    }
  if (await clickText("Open all fronts")) {
    await c.sleep(2000);
    record(slug, "open all", await measure(`${slug}-open-all`, true), baseline);
    await clickText("Close all fronts");
    await c.sleep(2000);
    record(slug, "close all", await measure("tmp"), baseline);
  }
  if (await clickText("Interior view")) {
    await c.sleep(2500);
    // The interior view moves the camera; compare with its own first frame.
    const interior = await measure(`${slug}-interior`, true);
    await clickCanvas(0.5, 0.5);
    await c.sleep(1500);
    record(slug, "interior click", await measure("tmp"), interior);
  }
}
fs.rmSync(`${OUT}/tmp.png`, { force: true });
fs.writeFileSync(
  `${OUT}/front-interactions.json`,
  JSON.stringify(rows, null, 2),
);
console.table(rows);
if (failures.length) {
  console.error(
    "FAIL: large dark area after front interaction\n" + failures.join("\n"),
  );
  process.exit(1);
}
console.log(
  `PASS: ${rows.length} measurements within +${TOLERANCE * 100}% dark share`,
);
process.exit(0);
