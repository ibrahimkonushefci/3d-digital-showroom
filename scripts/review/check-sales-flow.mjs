// Sales-flow check for the Phase 1 follow-up gate (production build):
// L kitchen → Save A → another front finish → Save B → Compare A/B → choose A
// (price returns to the original) → Your offer → Download PDF → Copy design
// link → open the link in a fresh page; plus Full screen at two window sizes.
// Same Chrome setup as check-front-interactions.mjs:
//   node scripts/review/check-sales-flow.mjs http://127.0.0.1:52772 <out-dir>
import { connect } from "./cdp.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:52772";
const OUT = path.resolve(process.argv[3] || "out");
fs.mkdirSync(OUT, { recursive: true });
const c = await connect();
await c.send("Page.enable");
await c.send("Page.bringToFront");
const size = (width, height) =>
  c.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
await size(1440, 900);
await c
  .send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: OUT,
    eventsEnabled: true,
  })
  .catch(() =>
    c.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: OUT,
    }),
  );
await c
  .send("Browser.grantPermissions", {
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
    origin: new URL(BASE).origin,
  })
  .catch(() => {});
const ev = (e) => c.evaluate(e);
const click = (t, exact = true) =>
  ev(
    `(()=>{const e=[...document.querySelectorAll('button,a,[role=button]')].find(e=>e.offsetParent&&!e.disabled&&(${exact}?e.textContent.trim()===${JSON.stringify(t)}:e.textContent.includes(${JSON.stringify(t)})));if(!e)return false;e.click();return true})()`,
  );
const price = () =>
  ev(`(document.body.innerText.match(/\\d[\\d,.]*\\s?€/)||[])[0]||null`);
const log = (...a) => console.log(...a);
const results = {};
const firstFrame = async () => {
  for (let i = 0; i < 100; i++) {
    if (
      await ev(
        `!!document.querySelector('canvas')&&!document.querySelector('.scene-loading')`,
      )
    )
      return true;
    await c.sleep(200);
  }
  return false;
};

await c.send("Page.navigate", { url: BASE + "/?brand=default" });
await c.sleep(2500);
await ev(`localStorage.setItem("showroom-performance","false")`);
await click("EN");
await c.sleep(300);
await ev(
  `[...document.querySelectorAll('button,a')].find(e=>e.textContent.includes('Cashmere'))?.click()`,
);
await firstFrame();
await c.sleep(4000);
results.startPrice = await price();
log("L kitchen price", results.startPrice);
await c.shot(`${OUT}/1-kitchen-hero.png`);

// Clear both comparison slots by saving over them.
results.saveA = await click("Save A");
await c.sleep(6000);
// Another front finish: the swatch list's first option that is not Cashmere.
// Front finish swatches are buttons labelled with the material name.
results.finish = await ev(
  `(()=>{const b=[...document.querySelectorAll('button[aria-label]')].find(b=>b.offsetParent&&/natural oak|oak/i.test(b.getAttribute('aria-label')));if(!b)return null;b.click();return b.getAttribute('aria-label')})()`,
);
await c.sleep(2500);
results.changedPrice = await price();
log("finish", results.finish, "→ price", results.changedPrice);
results.saveB = await click("Save B");
await c.sleep(6000);
results.compare = await click("Compare A / B", false);
await c.sleep(2500);
await c.shot(`${OUT}/2-compare-ab.png`);
results.compareImages = await ev(
  `[...document.querySelectorAll('img')].filter(i=>i.offsetParent&&i.naturalWidth>200).map(i=>i.naturalWidth+'x'+i.naturalHeight)`,
);
results.compareText = await ev(
  `document.body.innerText.match(/\\d[\\d,.]*\\s?€/g)`,
);
log("compare images", results.compareImages, "prices", results.compareText);
// Choose A (first "Choose and continue").
results.chooseA = await click("Choose and continue");
await c.sleep(3000);
await firstFrame();
results.afterChooseA = await price();
log("after choosing A", results.afterChooseA);

results.offer = await click("Your offer", false);
await c.sleep(5000);
await c.shot(`${OUT}/3-offer.png`, undefined);
results.offerImages = await ev(
  `[...document.querySelectorAll('img')].filter(i=>i.offsetParent&&i.naturalWidth>300).map(i=>i.naturalWidth+'x'+i.naturalHeight)`,
);
results.offerPrice = await price();
log("offer images", results.offerImages, "price", results.offerPrice);
const before = new Set(fs.readdirSync(OUT));
results.pdfClick = await click("Download PDF offer", false);
let pdf = null;
for (let i = 0; i < 60 && !pdf; i++) {
  await c.sleep(500);
  pdf = fs.readdirSync(OUT).find((f) => !before.has(f) && f.endsWith(".pdf"));
}
results.pdf = pdf
  ? { file: pdf, bytes: fs.statSync(path.join(OUT, pdf)).size }
  : null;
log("pdf", results.pdf);

results.copy = await click("Copy design link", false);
await c.sleep(1000);
results.link = await ev(`navigator.clipboard.readText().catch(()=>null)`).catch(
  () => null,
);
if (!results.link)
  results.link = await ev(
    `(()=>{const i=[...document.querySelectorAll('input,textarea')].find(i=>/http/.test(i.value));return i?i.value:null})()`,
  );
log(
  "link",
  results.link && results.link.slice(0, 90) + "…",
  "length",
  results.link?.length,
);
if (results.link) {
  await ev(`localStorage.removeItem("showroom-design-default-kitchen")`);
  await c.send("Page.navigate", { url: results.link });
  await c.sleep(3000);
  await firstFrame();
  await c.sleep(3000);
  results.linkPrice = await price();
  await c.shot(`${OUT}/4-shared-link.png`);
  log("shared link opens with price", results.linkPrice);
}

// Full screen at the desktop fallback size and the laptop size.
for (const [w, h] of [
  [1030, 1025],
  [1440, 900],
]) {
  await size(w, h);
  await c.send("Page.navigate", {
    url: BASE + "/designer/kitchen?brand=default",
  });
  await firstFrame();
  await c.sleep(3500);
  const canvas = await ev(
    `(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)})()`,
  );
  await c.shot(`${OUT}/5-window-${w}x${h}.png`);
  const fs1 = await ev(
    `(()=>{const b=document.querySelector('button[aria-label="Full screen"]');if(!b)return false;b.click();return true})()`,
  );
  await c.sleep(3500);
  const full = await ev(
    `(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)})()`,
  );
  await c.shot(`${OUT}/6-fullscreen-${w}x${h}.png`);
  await ev(
    `document.querySelector('button[aria-label="Exit full screen"]')?.click()`,
  );
  await c.sleep(1000);
  results[`window${w}`] = {
    canvas,
    fullScreenClicked: fs1,
    fullScreenCanvas: full,
  };
  log(`${w}x${h}: canvas ${canvas}, full screen ${full}`);
}
fs.writeFileSync(`${OUT}/sales-flow.json`, JSON.stringify(results, null, 2));
process.exit(0);
