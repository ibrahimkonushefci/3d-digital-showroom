// Close-up captures of focal props for the Phase 2 gate (2× inspection).
//   node scripts/review/capture-closeups.mjs http://localhost:52773 <out-dir>
// Needs Chrome with --remote-debugging-port=9333 (see capture-showroom.mjs).
// Opens a Home preset in its Hero view, then wheel-zooms towards a canvas point
// (fractions of the canvas) and saves the canvas.
import { connect } from "./cdp.mjs";
import fs from "node:fs";
const BASE = process.argv[2] || "http://localhost:52760";
const OUT = process.argv[3] || "out";
fs.mkdirSync(OUT, { recursive: true });
const c = await connect();
await c.send("Page.enable");
// Always the build being served, never an older one from the offline cache.
await c.send("Network.enable");
await c.send("Network.setBypassServiceWorker", { bypass: true });
await c.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 2,
  mobile: false,
});
const SHOTS = JSON.parse(
  process.env.CLOSEUPS ||
    JSON.stringify([
      // [preset label fragment, name, x, y, wheel steps, button, module to inspect]
      ["Anthracite", "island-sink-tap", 0.5, 0.4, 0, null, "Sink unit"],
      ["Anthracite", "island-oven", 0.5, 0.5, 0, null, "Oven tower"],
      ["Anthracite", "island-fridge", 0.5, 0.5, 0, null, "Fridge space"],
      ["Anthracite", "island-hood", 0.5, 0.5, 0, null, "Integrated extractor"],
      ["Anthracite", "island-pendant", 0.46, 0.13, 7],
      ["Cashmere", "l-sink-tap", 0.5, 0.4, 0, null, "Sink unit"],
      [
        "Straight wardrobe",
        "wardrobe-hanging",
        0.5,
        0.5,
        0,
        "Interior view",
        "Hanging wardrobe",
      ],
      [
        "Straight wardrobe",
        "wardrobe-shelves",
        0.5,
        0.5,
        0,
        "Interior view",
        "Shelved wardrobe",
      ],
    ]),
);
const click = (t) =>
  c.evaluate(
    `(()=>{const e=[...document.querySelectorAll('button,a,[role=button]')].filter(e=>e.offsetParent!==null).find(e=>(${JSON.stringify(t)}==="Interior view"?["Interior view","Look inside"]:[${JSON.stringify(t)}]).some(x=>e.textContent.trim().includes(x)));if(!e)return 'missing';e.click();return 'ok'})()`,
  );
const rect = () =>
  c.evaluate(
    `(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`,
  );
for (const [label, name, fx, fy, steps, button, module] of SHOTS) {
  await c.send("Page.navigate", { url: BASE + "/?brand=default" });
  await c.sleep(2500);
  await click("EN");
  await c.sleep(600);
  const r = await c.evaluate(
    `(()=>{const e=[...document.querySelectorAll('img')].map(i=>i.closest('button,a')).find(b=>b&&b.textContent.includes(${JSON.stringify(label)}));if(!e)return 'missing';e.click();return 'ok'})()`,
  );
  if (r !== "ok") {
    console.log("missing preset", label);
    continue;
  }
  await c.sleep(7000);
  if (button) {
    await click(button);
    await c.sleep(3000);
  }
  if (module) {
    await click("Cabinets & Units");
    await c.sleep(500);
    console.log(module, await click(module));
    await c.sleep(3500);
  }
  const box = await rect();
  const x = box.x + box.width * fx,
    y = box.y + box.height * fy;
  await c.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  for (let i = 0; i < steps; i++) {
    await c.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x,
      y,
      deltaX: 0,
      deltaY: -120,
    });
    await c.sleep(120);
  }
  await c.sleep(2500);
  await c.shot(`${OUT}/${name}.png`, box);
  console.log("saved", name);
}
process.exit(0);
