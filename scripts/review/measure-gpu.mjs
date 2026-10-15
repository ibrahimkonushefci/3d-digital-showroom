// Per-frame render cost while orbiting, for matched before/after comparisons.
//   node scripts/review/measure-gpu.mjs http://localhost:52773 [label]
// Needs Chrome with --remote-debugging-port=9333. Each animation frame's
// callback is timed until gl.finish() returns, so the number includes GPU
// work (headless Chrome otherwise paces every build to the display rate).
// It is a relative measure for this machine, not a Chrome-window frame rate.
import { connect } from "./cdp.mjs";
const BASE = process.argv[2] || "http://localhost:52760";
const LABEL = process.argv[3] || BASE;
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
await c.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(()=>{const get=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(t,...a){const g=get.call(this,t,...a);if(g&&/webgl/.test(t))window.__gl=g;return g};
const raf=window.requestAnimationFrame.bind(window);window.__times=[];
window.requestAnimationFrame=cb=>raf(ts=>{const t0=performance.now();cb(ts);if(window.__gl&&window.__measure){window.__gl.finish();window.__times.push(performance.now()-t0)}});})()`,
});
const SCENES = [
  ["Anthracite", null],
  ["Cashmere", null],
  ["Straight wardrobe", "Interior view"],
];
const click = (t) =>
  c.evaluate(
    `(()=>{const e=[...document.querySelectorAll('button,a,[role=button]')].filter(e=>e.offsetParent!==null).find(e=>e.textContent.trim().includes(${JSON.stringify(t)}));if(!e)return 'missing';e.click();return 'ok'})()`,
  );
for (const [label, button] of SCENES) {
  await c.send("Page.navigate", { url: BASE + "/?brand=default" });
  await c.sleep(2500);
  await click("EN");
  await c.sleep(500);
  await c.evaluate(
    `[...document.querySelectorAll('img')].map(i=>i.closest('button,a')).find(b=>b&&b.textContent.includes(${JSON.stringify(label)})).click()`,
  );
  await c.sleep(7000);
  if (button) {
    await click(button);
    await c.sleep(3000);
  }
  const r = await c.evaluate(
    `(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:document.querySelector('canvas').width,h:document.querySelector('canvas').height}})()`,
  );
  await c.evaluate(`window.__times=[];window.__measure=true`);
  // Slow orbit drag back and forth for ~6 s.
  await c.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: r.x,
    y: r.y,
    button: "left",
    clickCount: 1,
  });
  for (let i = 0; i < 180; i++) {
    const dx = Math.sin(i / 20) * 120;
    await c.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: r.x + dx,
      y: r.y,
      button: "left",
      buttons: 1,
    });
    await c.sleep(33);
  }
  await c.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: r.x,
    y: r.y,
    button: "left",
    clickCount: 1,
  });
  const t = (await c.evaluate(`window.__times`)).sort((a, b) => a - b);
  const q = (p) =>
    t[Math.min(t.length - 1, Math.floor(p * t.length))]?.toFixed(1);
  console.log(
    JSON.stringify({
      build: LABEL,
      scene: label + (button ? " / " + button : ""),
      buffer: `${r.w}x${r.h}`,
      frames: t.length,
      p50: q(0.5),
      p95: q(0.95),
    }),
  );
}
process.exit(0);
