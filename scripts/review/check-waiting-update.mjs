// Waiting-update startup experiment (Phase 1 follow-up). Serves build A, makes
// it offline-ready, saves an A/B slot, then serves build B (a copy of A whose
// sw.js/index.html differ) so a real update waits. Times first 3D frame for
// online/stopped-server/offline reloads, then tests Later and Save and update
// and compares the saved draft and A/B data before/after.
// Needs headless Chrome on 9333 (see check-front-interactions.mjs). Usage:
//   node scripts/review/check-waiting-update.mjs <dir containing distA and distB>
import { connect } from "./cdp.mjs";
import { spawn } from "node:child_process";
const SP = process.argv[2],
  PORT = 52790,
  BASE = `http://127.0.0.1:${PORT}`;
let server = null;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
async function serve(dir) {
  await stop();
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      String(PORT),
      "--strictPort",
      "--outDir",
      dir,
    ],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(BASE + "/");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw Error("server did not start");
}
async function stop() {
  if (server) {
    server.kill();
    await new Promise((r) => setTimeout(r, 600));
    server = null;
  }
}
const c = await connect();
await c.send("Page.enable");
await c.send("Network.enable");
await c.send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
const text = () => c.evaluate("document.body.innerText");
const waitFor = async (expr, ms) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    try {
      if (await c.evaluate(expr)) return Date.now() - t;
    } catch {}
    await c.sleep(150);
  }
  return -1;
};
const click = (t) =>
  c.evaluate(
    `(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.offsetParent&&e.textContent.trim()===${JSON.stringify(t)});if(!e)return false;e.click();return true})()`,
  );
const firstFrame = `!!document.querySelector('canvas') && !document.querySelector('.scene-loading')`;
async function timedLoad(
  label,
  url = BASE + "/designer/kitchen?brand=default",
) {
  await c.send("Page.navigate", { url });
  const ms = await waitFor(firstFrame, 40000);
  const nav = await c
    .evaluate("Math.round(performance.now())")
    .catch(() => null);
  const state = await c
    .evaluate(
      `({toast: document.body.innerText.includes('An update is ready'), ctrl: !!navigator.serviceWorker.controller, price: (document.body.innerText.match(/\\d[\\d,.]*\\s?€/)||[])[0]})`,
    )
    .catch((e) => String(e));
  log(
    label,
    "first frame after",
    nav,
    "ms (poll",
    ms,
    ")",
    JSON.stringify(state),
  );
  return nav;
}
async function data() {
  return c.evaluate(
    `(async()=>{const k=Object.keys(localStorage).filter(k=>k.startsWith('showroom-design'));const dbs=await indexedDB.databases();let ab=null;for(const d of dbs){const db=await new Promise(r=>{const q=indexedDB.open(d.name);q.onsuccess=()=>r(q.result)});ab=ab||{};for(const s of db.objectStoreNames){ab[d.name+'/'+s]=await new Promise(r=>{const q=db.transaction(s).objectStore(s).count();q.onsuccess=()=>r(q.result)})}db.close()}return {drafts:k, draftHash: k.map(x=>localStorage.getItem(x).length), ab}})()`,
  );
}
await serve(SP + "/distA");
await c.send("Page.navigate", { url: BASE + "/?brand=default" });
await c.sleep(1500);
await click("EN");
log(
  "waiting for Offline ready (A)",
  await waitFor(`document.body.innerText.includes('Offline ready')`, 180000),
);
await c.evaluate(
  `[...document.querySelectorAll('button,a')].find(e=>e.textContent.includes('Cashmere'))?.click()`,
);
await waitFor(firstFrame, 30000);
await c.sleep(1500);
log("save A:", await click("Save A"));
await c.sleep(6000);
const before = await data();
log("data before", JSON.stringify(before));
await timedLoad("A online reload");
await stop();
await c.send("Network.emulateNetworkConditions", {
  offline: true,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
for (let i = 0; i < 2; i++)
  await timedLoad("A offline (no update waiting) #" + i);
await c.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
await serve(SP + "/distB");
await timedLoad("B served, reload (update check)");
log(
  "toast wait",
  await waitFor(
    `document.body.innerText.includes('An update is ready')`,
    60000,
  ),
);
const regs = await c.evaluate(
  `navigator.serviceWorker.getRegistration().then(r=>({active:!!r.active, waiting:!!r.waiting, installing:!!r.installing}))`,
);
log("registration", JSON.stringify(regs));
await timedLoad("online reload with update waiting");
await stop();
for (let i = 0; i < 3; i++)
  await timedLoad("server stopped, update waiting #" + i);
await c.send("Network.emulateNetworkConditions", {
  offline: true,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
for (let i = 0; i < 3; i++)
  await timedLoad("network offline, update waiting #" + i);
log("toast visible offline:", (await text()).includes("An update is ready"));
log("Later:", await click("Later"));
await c.sleep(500);
log("toast after Later:", (await text()).includes("An update is ready"));
const later = await data();
log("data after Later", JSON.stringify(later));
await c.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
await serve(SP + "/distB");
await timedLoad("B back online");
await waitFor(`document.body.innerText.includes('An update is ready')`, 30000);
log("Save and update:", await click("Save and update"));
await c.sleep(4000);
await waitFor(firstFrame, 30000);
const regs2 = await c.evaluate(
  `navigator.serviceWorker.getRegistration().then(r=>({active:!!r.active, waiting:!!r.waiting}))`,
);
const html = await c.evaluate(
  `fetch('/index.html').then(r=>r.text()).then(t=>t.includes('update-test build B'))`,
);
log(
  "after update: registration",
  JSON.stringify(regs2),
  "serving B index:",
  html,
  "toast:",
  (await text()).includes("An update is ready"),
);
const after = await data();
log("data after update", JSON.stringify(after));
await stop();
await c.send("Network.emulateNetworkConditions", {
  offline: true,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
for (let i = 0; i < 2; i++) await timedLoad("offline after update #" + i);
await c.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
});
log(
  "SAME DATA",
  JSON.stringify(before) === JSON.stringify(after),
  JSON.stringify(before) === JSON.stringify(later),
);
process.exit(0);
