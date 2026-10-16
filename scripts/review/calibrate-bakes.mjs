// Exposure match of each baked room to its live lighting (Phase 3).
//   node scripts/review/calibrate-bakes.mjs http://127.0.0.1:5203 [name-filter]
// DEV server + Chrome on 9333. For every Home preset with a bake: the hero
// frame's mean luma with live lighting vs. baked lighting; the bake's gain is
// adjusted until they agree within 1.5%, then stored in the bake manifest.
// The bake keeps its own distribution (darker corners, brighter window
// light); only its overall level follows the approved live exposure.
import { connect } from "./cdp.mjs";
import { homeCards } from "./home.mjs";
import { meanLuma } from "./png.mjs";
import fs from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:5203";
const FILTER = process.argv[3];
const MANIFEST = "public/shared/bakes/manifest.json";
const TARGET = Number(process.env.BAKE_TARGET || 1);
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
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
  await c.sleep(2500);
  await c.evaluate(
    `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='EN')?.click()`,
  );
  await c.sleep(600);
};
await home();
const cards = await homeCards(c);
const seen = new Set();
for (const card of cards) {
  if (FILTER && !card.txt.includes(FILTER)) continue;
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
  for (let i = 0; i < 150; i++) {
    if (await c.evaluate(`!document.querySelector('.scene-loading')`)) break;
    await c.sleep(100);
  }
  await c.sleep(2500);
  const info = await c.evaluate(
    `(()=>{const b=window.__shellBake;return b&&b.entry?{signature:b.signature}:null})()`,
  );
  if (!info || seen.has(info.signature)) continue;
  seen.add(info.signature);
  const entry = manifest.bakes[info.signature];
  const clip = await c.evaluate(
    `(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`,
  );
  const measure = async (weight, gain) => {
    await c.evaluate(
      `(()=>{const b=window.__shellBake;window.__bakeForce=${weight};b.uniforms.bakeScale.value=${entry.encodeMax * gain};b.invalidate()})()`,
    );
    await c.sleep(1200);
    const { data } = await c.send("Page.captureScreenshot", {
      format: "png",
      clip: { ...clip, scale: 1 },
    });
    return meanLuma(Buffer.from(data, "base64"));
  };
  const live = await measure(0, 1);
  let gain = entry.gain || 1,
    baked = 0;
  for (let i = 0; i < 5; i++) {
    baked = await measure(1, gain);
    if (Math.abs(baked / (live * TARGET) - 1) < 0.015) break;
    // Display values are roughly gamma 2.2 of light; tone mapping flattens
    // the top, so step a little further than the inverse gamma.
    gain *= Math.pow((live * TARGET) / baked, 2.4);
  }
  entry.gain = Math.round(gain * 1000) / 1000;
  console.log(
    `${entry.preset}: live ${live.toFixed(1)}, baked ${baked.toFixed(1)}, gain ${entry.gain}`,
  );
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}
process.exit(0);
