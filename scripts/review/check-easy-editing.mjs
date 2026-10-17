// Phase 4 task tests with real mouse and keyboard input (plan §6, Phase 4):
// delete a wall cabinet and drag an open shelf into the gap, the same with
// taps only, a full kitchen that offers replacements, replacing doors with
// drawers, a wardrobe unit into a gap and a drawer inside a wardrobe.
//   1. pnpm dev --port 5203 --strictPort   (selection uses the dev store)
//   2. Chrome with --remote-debugging-port=9333 (see capture-showroom.mjs)
//   3. node scripts/review/check-easy-editing.mjs http://127.0.0.1:5203 <out-dir>
// Prints one line per check and writes screenshots to <out-dir>.
import { connect } from "./cdp.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:5203";
const OUT = process.argv[3] || "verification/phase4-review/checks";
fs.mkdirSync(OUT, { recursive: true });
const c = await connect();
await c.send("Page.enable");
const size = async (width, height) =>
  c.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: width < 600,
  });
await size(1440, 900);
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(ok ? "PASS" : "FAIL", name, detail);
};
const shot = (name) => c.shot(path.join(OUT, name + ".png"));
const store = (expr) =>
  c.evaluate(`(()=>{const s=window.__designer.getState();return ${expr}})()`);
const mouse = (type, x, y, buttons = 1) =>
  c.send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: "left",
    buttons,
    clickCount: type === "mouseMoved" ? 0 : 1,
  });
const key = async (k, code = k) => {
  for (const type of ["keyDown", "keyUp"])
    await c.send("Input.dispatchKeyEvent", { type, key: k, code });
};
const centre = (selector, text = "") =>
  c.evaluate(
    `(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.innerText.includes(${JSON.stringify(text)}));if(!e)return null;e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
const click = async (selector, text = "") => {
  const p = await centre(selector, text);
  if (!p) throw new Error("missing " + selector + " " + text);
  await c.sleep(150);
  const q = await centre(selector, text);
  await mouse("mousePressed", q.x, q.y);
  await mouse("mouseReleased", q.x, q.y, 0);
  await c.sleep(400);
};
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
  await click(".segmented-pill", "Edit units");
  await c.sleep(1500);
}
const count = () => store("s.design.cabinets.length");

// 1. Full kitchen: delete a wall cabinet, drag an open shelf into the gap.
await open("japandi");
const wall = await store(
  "(()=>{const w=s.design.cabinets.filter(c=>c.moduleId==='wall-doors')[1];s.select(w.id);return {id:w.id,width:w.width,x:w.x}})()",
);
await c.sleep(600);
await shot("1-selected-wall-cabinet");
const before = await count();
await key("Delete");
await c.sleep(600);
check("Delete key removes the selected unit", (await count()) === before - 1);
check(
  "Undo notice after delete",
  await c.evaluate(`document.body.innerText.includes("Wall cabinet deleted.")`),
);
await shot("2-deleted-with-undo");
const card = await centre(".unit-card", "Open shelf");
await mouse("mousePressed", card.x, card.y);
for (let i = 1; i <= 4; i++) await mouse("mouseMoved", card.x - i * 15, card.y);
await c.sleep(500);
const spots = await c.evaluate(`window.__spotScreen.centres?.()`);
const gapIndex = await c.evaluate(
  `(()=>{const t=[...document.querySelectorAll('.spot-row')].map(b=>b.innerText);return t.findIndex(x=>x.includes('between'))})()`,
);
const target = spots?.[gapIndex >= 0 ? gapIndex : 0];
check("Dragging shows the free places", !!target, JSON.stringify(spots));
if (target) {
  for (let i = 1; i <= 12; i++)
    await mouse(
      "mouseMoved",
      card.x + ((target.x - card.x) * i) / 12,
      card.y + ((target.y - card.y) * i) / 12,
    );
  await c.sleep(900);
  await shot("3-dragging-open-shelf");
  check(
    "The dragged shelf previews in the gap",
    await store(
      "!!s.dragPreview && s.dragPreview.cabinets.length === s.design.cabinets.length + 1",
    ),
  );
  await mouse("mouseReleased", target.x, target.y, 0);
  await c.sleep(800);
  const added = await store(
    "(()=>{const a=s.design.cabinets.find(c=>c.id===s.selected);return a&&{moduleId:a.moduleId,width:a.width,x:a.x}})()",
  );
  check(
    "Dropped shelf fills the gap at the deleted cabinet's width",
    added?.moduleId === "wall-open" &&
      added.width === wall.width &&
      Math.abs(added.x - wall.x) < 0.5,
    JSON.stringify(added),
  );
  await shot("4-dropped-open-shelf");
  await store("(s.undo(), window.__designer.getState().undo(), 0)");
  await c.sleep(500);
  check(
    "Undo restores the wall cabinet",
    await store(`s.design.cabinets.some(c=>c.id===${JSON.stringify(wall.id)})`),
  );
}

// 2. The same with taps only.
await store(`(s.select(${JSON.stringify(wall.id)}),0)`);
await c.sleep(300);
await click(".unit-actions .button.danger");
await click(".unit-card", "Open shelf");
await c.sleep(900);
await shot("5-tap-shows-places");
await click(".spot-label", `+ ${wall.width} cm`);
const tapped = await store(
  "(()=>{const a=s.design.cabinets.find(c=>c.id===s.selected);return a&&{moduleId:a.moduleId,width:a.width}})()",
);
check(
  "Tapping a place label adds the shelf",
  tapped?.moduleId === "wall-open" && tapped.width === wall.width,
  JSON.stringify(tapped),
);
await shot("6-tap-placed");

// 3. Full straight kitchen: suggestions, then replace doors with drawers.
await open("modern");
await click(".unit-card", "Three drawers");
await c.sleep(600);
const help = await c.evaluate(
  `document.querySelector('.placing-help')?.innerText || ''`,
);
check(
  "A full kitchen explains and offers a way",
  help.includes("No free space") && /Replace|narrow|→/.test(help),
  help.replace(/\n+/g, " / "),
);
await shot("7-full-kitchen-suggestions");
await click(".placing-help .icon-button");
const doors = await store(
  "(()=>{const d=s.design.cabinets.find(c=>c.moduleId==='base-doors');s.select(d.id);return {id:d.id,width:d.width}})()",
);
await c.sleep(500);
const price0 = await c.evaluate(
  `document.querySelector('.price-bar strong').innerText`,
);
await click(".unit-swap", "Three drawers");
const swapped = await store(
  `(()=>{const d=s.design.cabinets.find(c=>c.id===${JSON.stringify(doors.id)});return {moduleId:d.moduleId,width:d.width}})()`,
);
const price1 = await c.evaluate(
  `document.querySelector('.price-bar strong').innerText`,
);
check(
  "Replace with drawers keeps the width and updates the price",
  swapped.moduleId === "base-drawers" &&
    swapped.width === doors.width &&
    price0 !== price1,
  `${price0} → ${price1}`,
);
await shot("8-replaced-with-drawers");

// 4. Wardrobes: a unit into the corner wardrobe's free wall, then inside.
await open("wardrobe");
const n0 = await count();
await click(".unit-card", "Wardrobe drawers");
await c.sleep(800);
await shot("9-wardrobe-places");
await click(".spot-row");
check("A wardrobe unit goes into the free wall", (await count()) === n0 + 1);
await c.sleep(500);
await shot("10-wardrobe-added");
// The new unit stands in front of the corner unit's pull-out space.
await store(
  "(s.select(s.design.cabinets.filter(c=>c.wall==='back').sort((a,b)=>a.x-b.x)[0].id),0)",
);
await c.sleep(600);
check(
  "Inside: a drawer is not offered where a neighbour blocks pulling it out",
  await c.evaluate(
    `[...document.querySelectorAll('.interior-add .unit-card')].some(b=>b.innerText.includes('No room in front'))`,
  ),
);
// Inside a hanging or shelved wardrobe of the straight design.
await open("wardrobe-straight");
await store(
  "(s.select((s.design.cabinets.find(c=>c.moduleId==='wardrobe-shelves')||s.design.cabinets.find(c=>c.moduleId==='wardrobe-hanging')).id),0)",
);
await c.sleep(600);
const inside = await c.evaluate(
  `document.querySelector('.interior-rows')?.children.length || 0`,
);
await click(".interior-add .unit-card", "Interior drawer");
await c.sleep(500);
const afterAdd = await c.evaluate(
  `document.querySelector('.interior-rows').children.length`,
);
check(
  "Inside: a drawer is added where it fits",
  afterAdd === inside + 1,
  `${inside} → ${afterAdd}`,
);
const shelfRemove = await c.evaluate(
  `(()=>{const li=[...document.querySelectorAll('.interior-rows > li')].find(l=>l.innerText.includes('Shelf'));if(!li)return false;li.querySelector('.danger').click();return true})()`,
);
await c.sleep(500);
check(
  "Inside: a shelf is removed",
  shelfRemove &&
    (await c.evaluate(
      `document.querySelector('.interior-rows').children.length`,
    )) ===
      afterAdd - 1,
);
await shot("11-wardrobe-interior");

// 5. Phone width: the Units tab stays usable.
await size(390, 844);
await c.sleep(1200);
const narrow = await c.evaluate(
  `({overflow: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('.units-panel button')].filter(b=>b.offsetParent).map(b=>b.getBoundingClientRect()).filter(r=>r.height<44 && r.width>0).length})`,
);
check(
  "Phone width: no sideways scrolling",
  narrow.overflow <= 0,
  JSON.stringify(narrow),
);
check(
  "Phone width: buttons at least 44 px tall",
  narrow.small === 0,
  JSON.stringify(narrow),
);
await shot("12-phone-units");
await size(1440, 900);
fs.writeFileSync(
  path.join(OUT, "checks.json"),
  JSON.stringify(results, null, 2),
);
console.log(
  results.filter((r) => r.ok).length + "/" + results.length + " passed",
);
process.exit(results.every((r) => r.ok) ? 0 : 1);
