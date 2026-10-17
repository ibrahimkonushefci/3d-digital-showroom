// Phase 4 visual pass: the selected unit on pale, dark and wooden fronts
// (closed and open), next to suggested replacements and free places, and a
// selected wardrobe interior part; plus the compact card panels.
//   1. pnpm dev --port 5203 --strictPort   (uses the dev store)
//   2. Chrome with --remote-debugging-port=9333 (see capture-showroom.mjs)
//   3. node scripts/review/capture-selection.mjs http://127.0.0.1:5203 <out-dir>
import { connect } from "./cdp.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:5203";
const OUT = process.argv[3] || "verification/phase4-review/selection";
fs.mkdirSync(OUT, { recursive: true });
const c = await connect();
await c.send("Page.enable");
await c.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 2,
  mobile: false,
});
const run = (body) =>
  c.evaluate(`(()=>{const s=window.__designer.getState();${body}})()`);
const shot = async (name, clip) => {
  await c.sleep(1200);
  await c.shot(path.join(OUT, name + ".png"), clip);
  console.log("wrote", name);
};
const panel = () =>
  c.evaluate(
    `(()=>{const r=document.querySelector('.units-panel').closest('aside,section,.panel,.sidebar')?.getBoundingClientRect()||document.querySelector('.units-panel').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:Math.min(r.height,900-r.y)}})()`,
  );
async function open(preset) {
  await c.send("Page.navigate", { url: BASE + "/?brand=default&lang=en" });
  for (let i = 0; i < 100; i++) {
    await c.sleep(100);
    if (
      await c.evaluate(
        `!!document.querySelector('.home-card[data-preset="${preset}"]')`,
      )
    )
      break;
  }
  await c.evaluate(
    `document.querySelector('.home-card[data-preset="${preset}"]').click()`,
  );
  for (let i = 0; i < 200; i++) {
    await c.sleep(100);
    if (
      await c.evaluate(
        `!!document.querySelector('canvas') && !document.querySelector('.scene-loading')`,
      )
    )
      break;
  }
  const edit = `[...document.querySelectorAll('.segmented-pill')].find(e=>e.innerText.includes('Edit units'))`;
  for (let i = 0; i < 100 && !(await c.evaluate(`!!${edit}`)); i++)
    await c.sleep(100);
  await c.evaluate(`${edit}.click()`);
  await c.sleep(2500);
}

for (const preset of ["japandi", "modern", "classic"]) {
  await open(preset);
  const front = await run(
    `const b=s.design.cabinets.filter(c=>c.level==='base'&&['base-doors','base-drawers'].includes(c.moduleId));const c=b[Math.floor(b.length/2)]||s.design.cabinets[0];s.select(c.id);return s.design.style?.front||''`,
  );
  console.log(preset, "front", JSON.stringify(front));
  await shot(`${preset}-base-selected`);
  await run(`s.toggleOpen(s.selected)`);
  await shot(`${preset}-base-open`);
  await run(
    `s.toggleOpen(s.selected);const w=s.design.cabinets.filter(c=>c.level==='wall'&&c.moduleId==='wall-doors');s.select(w[w.length-1]?.id??null)`,
  );
  await shot(`${preset}-wall-selected`);
  if (preset === "japandi") {
    const p = await panel();
    await shot("panel-selected-unit", p);
    await run(`s.select(null)`);
    await c.sleep(400);
    await shot("panel-catalog", await panel());
    // Selected next to suggested replacements and the green free places
    // (the app shows suggestions only when nothing fits; forced here, after
    // the placing panel has cleared them, to compare all three).
    await run(`s.setPlacing('wall-open')`);
    await c.sleep(800);
    await run(
      `const w=s.design.cabinets.filter(c=>c.level==='wall'&&c.moduleId==='wall-doors');s.setHighlight(w.slice(-3,-1).map(c=>c.id));s.select(w[w.length-1].id)`,
    );
    await shot("selected-vs-suggested-vs-spots");
    await run(`s.setPlacing(null);s.setHighlight([]);s.select(null)`);
  }
}

await open("wardrobe");
await run(
  `const c=s.design.cabinets.find(c=>c.moduleId==='wardrobe-shelves')||s.design.cabinets[1];s.select(c.id)`,
);
await shot("wardrobe-selected");
await run(`s.setInterior(true)`);
await c.sleep(800);
await c.evaluate(
  `(()=>{const r=[...document.querySelectorAll('.interior-row-main')];(r.find(e=>/shelf/i.test(e.innerText))||r[0])?.click()})()`,
);
await shot("wardrobe-interior-part-selected");
await shot("panel-wardrobe-interior", await panel());
await c.evaluate(
  `document.querySelector('.interior-add')?.scrollIntoView({block:"start"})`,
);
await shot("panel-wardrobe-interior-add", await panel());
process.exit(0);
