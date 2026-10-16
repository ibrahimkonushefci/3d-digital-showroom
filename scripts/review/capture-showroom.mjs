// Matched review captures for the phase gate (see README, "How the visuals are built").
// 1. pnpm build && pnpm preview --port 52760 --strictPort
// 2. Chrome with --remote-debugging-port=9333 and an empty --user-data-dir
// 3. node scripts/review/capture-showroom.mjs http://localhost:52760 <out-dir>
// Every Home preset: Hero (initial), Front, Top, Overview, Open all fronts and,
// for wardrobes, Interior view; canvas-only and full-UI PNGs at 1440×900 @2×.
// Optional: CAPTURE_SIZE=1030x1025 (other window sizes), CAPTURE_SHOTS=hero
// (opening views only), CAPTURE_SCALE=1.
import { connect } from "./cdp.mjs";
import fs from "node:fs";
const OUT = process.argv[3] || "out";
const BASE = process.argv[2] || "http://localhost:52760";
fs.mkdirSync(OUT, { recursive: true });
const c = await connect();
await c.send("Page.enable");
// Always the build being served, never an older one from the offline cache.
await c.send("Network.enable");
await c.send("Network.setBypassServiceWorker", { bypass: true });
const [WIDTH, HEIGHT] = (process.env.CAPTURE_SIZE || "1440x900")
  .split("x")
  .map(Number);
const HERO_ONLY = process.env.CAPTURE_SHOTS === "hero";
await c.send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: Number(process.env.CAPTURE_SCALE || 2),
  mobile: false,
});
// Labels changed in Phase 1 round 2 ("Hero" → "Main view", …); either
// works so before and after builds capture the same views.
const LABELS = {
  Hero: ["Hero", "Main view"],
  Front: ["Front", "Front view"],
  Top: ["Top", "From above"],
  "Interior view": ["Interior view", "Look inside"],
};
const click = async (t, exact = false) => {
  let result = "";
  for (const label of LABELS[t] ?? [t]) {
    result = await c.evaluate(
      `(()=>{const els=[...document.querySelectorAll('button,a,[role=button]')].filter(e=>e.offsetParent!==null);const e=els.find(e=>${exact}?e.textContent.trim()===${JSON.stringify(label)}:e.textContent.trim().includes(${JSON.stringify(label)}));if(!e)return 'missing:'+${JSON.stringify(label)};e.click();return 'ok'})()`,
    );
    if (result === "ok") break;
  }
  return result;
};
const canvasClip = () =>
  c.evaluate(
    `(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`,
  );
async function go(url) {
  await c.send("Page.navigate", { url });
  await c.sleep(2500);
}
async function save(name, wait = 3500) {
  await c.sleep(wait);
  await c.shot(`${OUT}/${name}-ui.png`);
  const clip = await canvasClip();
  await c.shot(`${OUT}/${name}.png`, clip);
  console.log("saved", name);
}
await go(BASE + "/?brand=default");
console.log(await click("EN", true));
await c.sleep(800);
const names = await c.evaluate(
  `[...document.querySelectorAll('img')].map(i=>i.closest('button,a')?.textContent.trim()).filter(Boolean)`,
);
console.log(names);
const cards = await c.evaluate(
  `[...document.querySelectorAll('img')].map((i,k)=>({k,txt:i.closest('button,a')?.textContent.trim()})).filter(x=>x.txt)`,
);
const seen = new Set();
for (const card of cards) {
  if (seen.has(card.txt)) continue;
  seen.add(card.txt);
  await go(BASE + "/?brand=default");
  await c.evaluate(
    `[...document.querySelectorAll('img')][${card.k}].closest('button,a').click()`,
  );
  const slug = card.txt
    .replace(/^\d+/, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  await save(`${slug}-hero`, 7000);
  if (HERO_ONLY) continue;
  for (const v of ["Front", "Top"]) {
    console.log(await click(v, true));
    await save(`${slug}-${v.toLowerCase()}`, 2500);
  }
  console.log(await click("Overall view"));
  await save(`${slug}-overview`, 2500);
  console.log(await click("Hero", true));
  await c.sleep(1500);
  console.log(await click("Open all fronts"));
  await save(`${slug}-open`, 3000);
  const interior = await click("Interior view");
  if (interior === "ok") await save(`${slug}-interior`, 3000);
}
process.exit(0);
