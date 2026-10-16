// Phase 1 round 2 before/after evidence: the side panel (Styles and Room tabs,
// scrolled) and inspection close-ups of chosen units.
//   node scripts/review/capture-round2.mjs <base-url> <out-dir> [before|after]
// "before" builds select units through the old Showroom unit list; "after"
// needs the dev server (window.__designer) to select them.
import { connect } from "./cdp.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2];
const OUT = path.resolve(process.argv[3]);
const MODE = process.argv[4] || "after";
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
const ev = (e) => c.evaluate(e);
const ready = async () => {
  for (let i = 0; i < 150; i++) {
    if (
      await ev(
        `!!document.querySelector('canvas')&&!document.querySelector('.scene-loading')`,
      ).catch(() => false)
    )
      return;
    await c.sleep(200);
  }
};
const open = async (card) => {
  await c.send("Page.navigate", { url: `${BASE}/?brand=default` });
  await c.sleep(1800);
  await ev(
    `localStorage.setItem("showroom-language","en");localStorage.setItem("showroom-performance","false");Object.keys(localStorage).filter(k=>k.startsWith("showroom-design")||k.startsWith("showroom-recent")).forEach(k=>localStorage.removeItem(k))`,
  );
  await c.send("Page.navigate", { url: `${BASE}/?brand=default` });
  await c.sleep(2500);
  await ev(
    `[...document.querySelectorAll('img:not(dialog img)')].map(i=>i.closest('button,a')).find(b=>b&&b.textContent.includes(${JSON.stringify(card)})).click()`,
  );
  await ready();
  await c.sleep(4500);
};
const tab = (i) =>
  ev(`document.querySelectorAll(".panel-tabs button")[${i}]?.click()`);
const panelShots = async (name, tabIndex, steps) => {
  await tab(tabIndex);
  await c.sleep(600);
  for (let s = 0; s < steps; s++) {
    const top = await ev(
      `(()=>{const b=document.querySelector(".panel-body");b.scrollTop=${s * 560};return b.scrollTop})()`,
    );
    if (s && top < s * 560 - 559) break;
    await c.sleep(500);
    await c.shot(`${OUT}/panel-${name}-${s}.png`);
  }
  await ev(`document.querySelector(".panel-body").scrollTop=0`);
};
const inspect = async (name, index) => {
  if (MODE === "before") {
    await tab(2);
    await c.sleep(500);
    await ev(
      `document.querySelectorAll(".panel-body .module-list button")[${index}].click()`,
    );
  } else {
    await ev(
      `(()=>{const s=window.__designer.getState();s.select(s.design.cabinets[${index}].id)})()`,
    );
    await c.sleep(300);
    await ev(
      `[...document.querySelectorAll(".canvas-controls button")].find(b=>b.textContent.includes("Inspect up close")).click()`,
    );
  }
  await c.sleep(2200);
  await c.shot(`${OUT}/inspect-${name}.png`);
  // Back to the opening view for the next one.
  await ev(
    `[...document.querySelectorAll(".canvas-controls button")].find(b=>/^(Hero|Main view)$/.test(b.textContent.trim()))?.click()`,
  );
  await c.sleep(1500);
};

await open("Cashmere");
await c.shot(`${OUT}/kitchen-l-hero.png`);
await panelShots("kitchen-styles", 0, 6);
await panelShots("kitchen-room", 1, 3);
for (const [name, i] of [
  ["l-corner-carousel", 0],
  ["l-fridge", 9],
  ["l-hood", 12],
  ["l-left-base", 7],
])
  await inspect(name, i);
await open("Anthracite");
await inspect("island-island-unit", 15);
await inspect("island-oven", 0);
await open("Corner wardrobe");
await panelShots("wardrobe-styles", 0, 5);
await panelShots("wardrobe-room", 1, 2);
await inspect("corner-wardrobe-hanging", 0);
await inspect("corner-wardrobe-left", 4);
process.exit(0);
