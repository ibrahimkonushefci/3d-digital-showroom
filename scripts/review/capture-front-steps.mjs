// Full-UI evidence for the reviewer's exact individual-front steps (Phase 1
// follow-up): L kitchen → one wall cabinet left of the hood; straight
// wardrobe → leftmost hinged unit. Open by clicking, close and reopen from the
// sidebar, then select a neighbour. Prints the near-black canvas share.
// Same setup as check-front-interactions.mjs:
//   node scripts/review/capture-front-steps.mjs http://127.0.0.1:52772 <out-dir>
import { connect } from "./cdp.mjs";
import fs from "node:fs";
import zlib from "node:zlib";

const BASE = process.argv[2] || "http://127.0.0.1:52772";
const OUT = process.argv[3] || "out";
fs.mkdirSync(OUT, { recursive: true });
const c = await connect();
await c.send("Page.enable");
await c.send("Page.bringToFront");
await c.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
const evaluate = (e) => c.evaluate(e);
const clickText = (t) =>
  evaluate(
    `(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.offsetParent&&!e.disabled&&e.textContent.trim()===${JSON.stringify(t)});if(!e)return false;e.click();return true})()`,
  );
/** Title of the selection card holding the Open/Close compartment button. */
const sidebar = () =>
  evaluate(
    `(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.offsetParent&&/^(Open|Close) compartment$/.test(e.textContent.trim()));let n=b;for(let i=0;i<4&&n;i++){n=n.parentElement;if(n&&n.innerText.split('\\n').length>2)break}return n?n.innerText.split('\\n').slice(0,2).join(' · '):''})()`,
  );
const clip = () =>
  evaluate(
    `(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`,
  );
async function dark() {
  const r = await c.send("Page.captureScreenshot", {
    format: "png",
    clip: { ...(await clip()), scale: 1 },
  });
  const b = Buffer.from(r.data, "base64");
  // Decode just enough PNG to count near-black pixels.
  let o = 8,
    w = 0,
    h = 0,
    ch = 4;
  const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o),
      type = b.toString("ascii", o + 4, o + 8);
    const d = b.subarray(o + 8, o + 8 + len);
    if (type === "IHDR")
      ((w = d.readUInt32BE(0)),
        (h = d.readUInt32BE(4)),
        (ch = d[9] === 6 ? 4 : 3));
    else if (type === "IDAT") idat.push(d);
    o += len + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)),
    s = w * ch,
    px = Buffer.alloc(h * s);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (s + 1)];
    for (let x = 0; x < s; x++) {
      const a = x >= ch ? px[y * s + x - ch] : 0,
        up = y ? px[(y - 1) * s + x] : 0,
        c2 = x >= ch && y ? px[(y - 1) * s + x - ch] : 0;
      let v = raw[y * (s + 1) + 1 + x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const p = a + up - c2,
          pa = Math.abs(p - a),
          pb = Math.abs(p - up),
          pc = Math.abs(p - c2);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c2;
      }
      px[y * s + x] = v & 255;
    }
  }
  let n = 0;
  for (let i = 0; i < w * h; i++)
    if (
      0.2126 * px[i * ch] + 0.7152 * px[i * ch + 1] + 0.0722 * px[i * ch + 2] <
      14
    )
      n++;
  return +((100 * n) / (w * h)).toFixed(2);
}
async function shot(name) {
  await c.shot(`${OUT}/${name}.png`);
  const d = await dark();
  console.log(name.padEnd(28), "near-black", d + "%", "|", await sidebar());
}
async function clickAt(fx, fy) {
  const r = await clip();
  const x = r.x + r.width * fx,
    y = r.y + r.height * fy;
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
    await c.send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: type === "mouseMoved" ? "none" : "left",
      clickCount: type === "mouseMoved" ? 0 : 1,
    });
}
async function open(card) {
  await c.send("Page.navigate", { url: BASE + "/?brand=default" });
  await c.sleep(2500);
  await evaluate(`localStorage.setItem("showroom-performance","false")`);
  await clickText("EN");
  await c.sleep(300);
  await evaluate(
    `[...document.querySelectorAll('button,a')].find(e=>e.textContent.includes(${JSON.stringify(card)}))?.click()`,
  );
  await c.sleep(8000);
}
/** First point (scanning left to right in a band) whose click selects `kind`. */
async function find(kind, fy, from = 0.05, to = 0.6) {
  for (let fx = from; fx <= to; fx += 0.03) {
    await clickAt(fx, fy);
    await c.sleep(900);
    if ((await sidebar()).toLowerCase().includes(kind)) return fx;
    await clickText("Close compartment");
    await c.sleep(300);
  }
  return null;
}

await open("Cashmere");
await shot("kitchen-0-hero");
// Wall cabinets sit in the upper third; the hood is near the centre.
const fx = await find("wall cabinet", 0.3, 0.3, 0.6);
console.log("wall cabinet at", fx);
await c.sleep(1200);
await shot("kitchen-1-open-selected");
await clickText("Close compartment");
await c.sleep(1800);
await shot("kitchen-2-closed-selected");
await clickText("Open compartment");
await c.sleep(1500);
await shot("kitchen-3-reopened");
await clickText("Close compartment");
await c.sleep(1800);
if (fx !== null) await clickAt(fx - 0.06, 0.3);
await c.sleep(1500);
await shot("kitchen-4-neighbour-selected");

await open("Straight wardrobe");
await shot("wardrobe-0-hero");
const wx = await find("wardrobe", 0.45, 0.08, 0.4);
console.log("wardrobe unit at", wx);
await c.sleep(1200);
await shot("wardrobe-1-open-selected");
await clickText("Close compartment");
await c.sleep(1800);
await shot("wardrobe-2-closed-selected");
await clickText("Open compartment");
await c.sleep(1500);
await shot("wardrobe-3-reopened");
await clickText("Close compartment");
await c.sleep(1800);
await clickAt((wx ?? 0.15) + 0.2, 0.45);
await c.sleep(1500);
await shot("wardrobe-4-neighbour-selected");
process.exit(0);
