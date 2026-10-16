// Phase 1 round 2 interaction checks (dev server, review Chrome on 9333):
//   node scripts/review/check-round2.mjs http://127.0.0.1:5203 <out-dir>
// Tab scroll memory, Inspect up close as a toggle, the Reset notice not
// moving the showroom, the corner carousel close-up, predictable resizing.
import { connect } from "./cdp.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:5203";
const OUT = path.resolve(process.argv[3] || "out");
fs.mkdirSync(OUT, { recursive: true });
const c = await connect();
await c.send("Page.enable");
await c.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
const ev = (e) => c.evaluate(e);
const results = {};
const ok = (name, pass, detail) => {
  results[name] = { pass, ...(detail === undefined ? {} : { detail }) };
  console.log(pass ? "PASS" : "FAIL", name, detail ?? "");
};
const click = (text) =>
  ev(
    `(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.offsetParent&&!e.disabled&&e.textContent.trim()===${JSON.stringify(text)});if(!e)return false;e.click();return true})()`,
  );
const tab = (i) =>
  ev(`document.querySelectorAll(".panel-tabs button")[${i}].click()`);
const scrollTop = () => ev(`document.querySelector(".panel-body").scrollTop`);
const setScroll = (y) =>
  ev(
    `(()=>{const b=document.querySelector(".panel-body");b.scrollTop=${y};b.dispatchEvent(new Event("scroll"));return b.scrollTop})()`,
  );
const camera = () => ev(`window.__liveCamera.read()`);
const store = `Promise.resolve(window.__designer.getState())`;
const ready = async () => {
  for (let i = 0; i < 150; i++) {
    if (
      await ev(
        `!!document.querySelector('canvas')&&!document.querySelector('.scene-loading')`,
      )
    )
      return;
    await c.sleep(200);
  }
};
const open = async (kind) => {
  await c.send("Page.navigate", { url: `${BASE}/?brand=default` });
  await c.sleep(1500);
  await ev(
    `localStorage.setItem("showroom-language","en");localStorage.setItem("showroom-performance","false");Object.keys(localStorage).filter(k=>k.startsWith("showroom-design")).forEach(k=>localStorage.removeItem(k))`,
  );
  await c.send("Page.navigate", {
    url: `${BASE}/designer/${kind}?brand=default`,
  });
  await ready();
  await c.sleep(3500);
};

await open("kitchen");
// 1. Each tab keeps its own scroll position; an unvisited tab starts at the top.
const styled = await setScroll(700);
await tab(1);
await c.sleep(300);
const roomFirst = await scrollTop();
await setScroll(240);
await tab(0);
await c.sleep(300);
const stylesBack = await scrollTop();
await tab(1);
await c.sleep(300);
const roomBack = await scrollTop();
ok("scroll: unvisited Room tab starts at top", roomFirst === 0, roomFirst);
ok(
  "scroll: Styles returns to its position",
  Math.abs(stylesBack - styled) < 2,
  [styled, stylesBack],
);
ok(
  "scroll: Room returns to its position",
  Math.abs(roomBack - 240) < 2,
  roomBack,
);
await tab(0);
ok(
  "showroom has no Units tab",
  (await ev(`document.querySelectorAll(".panel-tabs button").length`)) === 2,
);

// 2. Inspect up close is a toggle; the corner carousel stays in view.
const before = await camera();
await ev(
  `${store}.then(s=>{const c=s.design.cabinets.find(c=>c.moduleId==="corner");s.select(c.id);return c.id})`,
);
await c.sleep(400);
await click("Inspect up close");
await c.sleep(1800);
const close = await camera();
await c.shot(`${OUT}/inspect-corner-carousel.png`);
await click("Inspect up close");
await c.sleep(1800);
const back = await camera();
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
ok(
  "inspect moves the camera",
  dist(before.position, close.position) > 0.3,
  close.position.map((v) => v.toFixed(2)),
);
ok(
  "second press returns to the earlier view",
  dist(before.position, back.position) < 0.01 &&
    dist(before.target, back.target) < 0.01,
  back.position.map((v) => v.toFixed(3)),
);

// 3. Reset: a toast at the bottom right, the showroom does not move or resize.
const rect = `(()=>{const r=document.querySelector(".canvas-panel").getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(Math.round)})()`;
await ev(
  `document.querySelector('button.picture-tile[aria-label="Sage green"]')?.click()`,
);
await c.sleep(800);
const r0 = await ev(rect);
await click("Reset design");
await c.sleep(600);
const r1 = await ev(rect);
const toast = await ev(
  `(()=>{const t=document.querySelector(".toast");if(!t)return null;const r=t.getBoundingClientRect();return {text:t.innerText,right:Math.round(innerWidth-r.right),bottom:Math.round(innerHeight-r.bottom)}})()`,
);
await c.shot(`${OUT}/reset-toast.png`);
ok(
  "reset keeps the showroom in place",
  JSON.stringify(r0) === JSON.stringify(r1),
  [r0, r1],
);
ok(
  "reset shows a bottom-right toast with Undo",
  !!toast && toast.right < 40 && toast.bottom < 40 && /Undo/.test(toast.text),
  toast,
);

// 4. Predictable resizing: 420 × 360 × 270 → 440 × 360 × 280 keeps 15 units.
await ev(`document.querySelectorAll(".toast-close").forEach(b=>b.click())`);
await tab(1);
await c.sleep(300);
const units = () => ev(`${store}.then(s=>s.design.cabinets.length)`);
const n0 = await units();
await ev(
  `(()=>{const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,v);el.dispatchEvent(new Event("input",{bubbles:true}))};const i=[...document.querySelectorAll(".custom-dimensions input")];set(i[0],"440");set(i[2],"280");return i.length})()`,
);
await c.sleep(200);
await click("Apply dimensions");
await c.sleep(2500);
const n1 = await units();
const resizeToast = await ev(
  `document.querySelector(".toast")?.innerText ?? null`,
);
await c.shot(`${OUT}/resize-440x360x280.png`);
ok("resize keeps 15 units", n0 === 15 && n1 === 15, {
  before: n0,
  after: n1,
  toast: resizeToast,
});
await click("Undo");
await c.sleep(1500);
ok(
  "Undo restores 420 × 360 × 270",
  (await ev(
    `${store}.then(s=>[s.design.room.width,s.design.room.height].join("x"))`,
  )) === "420x270",
);

// 5. Wardrobe: Edit inside switches to editing with the unit selected.
await open("wardrobe");
await ev(`${store}.then(s=>s.select(s.design.cabinets[0].id))`);
await c.sleep(500);
await c.shot(`${OUT}/wardrobe-selected.png`);
await click("Edit inside this wardrobe");
await c.sleep(1500);
const mode = await ev(`${store}.then(s=>s.interactionMode+" "+!!s.selected)`);
ok(
  "Edit inside opens editing with the wardrobe selected",
  mode === "edit true",
  mode,
);
await c.shot(`${OUT}/wardrobe-edit-inside.png`);

fs.writeFileSync(`${OUT}/round2-checks.json`, JSON.stringify(results, null, 2));
process.exit(Object.values(results).every((r) => r.pass) ? 0 : 1);
