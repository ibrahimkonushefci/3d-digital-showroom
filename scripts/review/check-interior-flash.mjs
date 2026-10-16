// Cold-load check for a black frame when the corner wardrobe's Interior view
// opens soon after loading. Each run starts a fresh Chrome profile with no
// HTTP or shader cache, opens the design from Home, presses "Interior view"
// after a varying delay and records every drawn frame (CDP screencast).
// A frame counts as a flash when the near-black share of the 3D view jumps
// well above the run's normal level.
//   node scripts/review/check-interior-flash.mjs http://127.0.0.1:52775 <out-dir> [runs]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { decodePng } from "./png.mjs";

const BASE = process.argv[2] || "http://127.0.0.1:52775";
const OUT = process.argv[3] || "out";
const RUNS = Number(process.argv[4] || 10);
const PORT = 9334;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "flash-"));
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--use-angle=metal",
    "--enable-gpu",
    "--disable-gpu-shader-disk-cache",
    "--window-size=1440,900",
    "about:blank",
  ]);
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (
        await fetch(`http://127.0.0.1:${PORT}/json/list`)
      ).json();
      const page = list.find((t) => t.type === "page");
      if (page) return { chrome, profile, page };
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw Error("Chrome did not start");
}

async function client(url) {
  const ws = new WebSocket(url);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let id = 0;
  const pending = new Map(),
    listeners = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id);
      pending.delete(d.id);
      d.error ? p.j(Error(JSON.stringify(d.error))) : p.r(d.result);
    } else listeners.forEach((l) => l(d));
  };
  const send = (method, params = {}) =>
    new Promise((r, j) => {
      const i = ++id;
      pending.set(i, { r, j });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression) =>
    (
      await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
    ).result.value;
  return { send, evaluate, on: (f) => listeners.push(f), ws };
}

/** Share of near-black pixels inside the canvas rectangle of a frame. */
function darkShare(png, rect, scale) {
  const { width, height, channels, pixels } = decodePng(png);
  const x0 = Math.max(0, Math.round(rect.x * scale)),
    y0 = Math.max(0, Math.round(rect.y * scale)),
    x1 = Math.min(width, Math.round((rect.x + rect.width) * scale)),
    y1 = Math.min(height, Math.round((rect.y + rect.height) * scale));
  let dark = 0,
    total = 0;
  for (let y = y0; y < y1; y += 2)
    for (let x = x0; x < x1; x += 2) {
      const i = (y * width + x) * channels;
      const l =
        0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      if (l < 14) dark++;
      total++;
    }
  return total ? (100 * dark) / total : 0;
}

const delays = [0, 150, 300, 500, 800, 1200, 1800, 2500, 3500, 5000];
const results = [];
for (let run = 0; run < RUNS; run++) {
  const delay = delays[run % delays.length];
  const { chrome, profile, page } = await launch();
  const c = await client(page.webSocketDebuggerUrl);
  try {
    await c.send("Page.enable");
    await c.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await c.send("Page.navigate", { url: BASE + "/?brand=default&lang=en" });
    await sleep(2500);
    await c.evaluate(
      `localStorage.setItem("showroom-language","en"); localStorage.setItem("showroom-performance","false")`,
    );
    await c.send("Page.navigate", { url: BASE + "/?brand=default&lang=en" });
    await sleep(2000);
    const frames = [];
    let started = 0;
    c.on((m) => {
      if (m.method !== "Page.screencastFrame") return;
      frames.push({
        at: performance.now() - started,
        data: m.params.data,
        scale: m.params.metadata.deviceWidth
          ? m.params.metadata.deviceWidth / 1440
          : 1,
      });
      c.send("Page.screencastFrameAck", { sessionId: m.params.sessionId });
    });
    started = performance.now();
    await c.send("Page.startScreencast", {
      format: "png",
      maxWidth: 1440,
      maxHeight: 900,
      everyNthFrame: 1,
    });
    await c.evaluate(
      `[...document.querySelectorAll('button,a')].find(e=>e.textContent.includes("Corner wardrobe"))?.click()`,
    );
    // Wait for the Interior view button, then the run's delay.
    for (let i = 0; i < 100; i++) {
      const ready = await c.evaluate(
        `!![...document.querySelectorAll('button')].find(e=>e.offsetParent&&["Interior view","Look inside"].includes(e.textContent.trim()))`,
      );
      if (ready) break;
      await sleep(50);
    }
    const buttonAt = performance.now() - started;
    await sleep(delay);
    const clickedAt = performance.now() - started;
    await c.evaluate(
      `[...document.querySelectorAll('button')].find(e=>e.offsetParent&&["Interior view","Look inside"].includes(e.textContent.trim()))?.click()`,
    );
    await sleep(6000);
    await c.send("Page.stopScreencast");
    const rect = await c.evaluate(
      `(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`,
    );
    // What is on screen now (a fresh capture, not the last streamed frame).
    const finalShot = Buffer.from(
      (await c.send("Page.captureScreenshot", { format: "png" })).data,
      "base64",
    );
    fs.writeFileSync(`${OUT}/run-${run + 1}-final.png`, finalShot);
    const finalDark = darkShare(finalShot, rect, 2);
    const shares = frames.map((f) => ({
      at: f.at,
      share: darkShare(Buffer.from(f.data, "base64"), rect, f.scale),
    }));
    // The level before the click; a flash is any later frame, or the final
    // screen, clearly darker than that.
    const before = shares.filter((s) => s.at <= clickedAt).map((s) => s.share);
    const normal = before.length ? Math.min(...before.slice(-3)) : 0;
    const drawn = shares.findIndex((s) => s.at > clickedAt);
    const flashes = shares.filter(
      (s, i) => i >= drawn && drawn >= 0 && s.share > normal + 5,
    );
    const worst = shares.reduce(
      (a, s, i) => (i > drawn && s.share > a.share ? { ...s, i } : a),
      { share: -1, i: -1, at: 0 },
    );
    if (worst.i >= 0)
      fs.writeFileSync(
        `${OUT}/run-${run + 1}-darkest.png`,
        Buffer.from(frames[worst.i].data, "base64"),
      );
    const result = {
      run: run + 1,
      delayMs: delay,
      buttonAtMs: Math.round(buttonAt),
      clickedAtMs: Math.round(clickedAt),
      frames: frames.length,
      beforeClickDarkPercent: +normal.toFixed(2),
      darkestPercent: +worst.share.toFixed(2),
      darkestAtMs: Math.round(worst.at),
      flashFrames: flashes.length + (finalDark > normal + 5 ? 1 : 0),
      finalDarkPercent: +finalDark.toFixed(2),
      timeline: shares
        .map((s) => `${Math.round(s.at)}:${s.share.toFixed(1)}`)
        .join(" "),
    };
    results.push(result);
    console.log(JSON.stringify(result));
  } finally {
    c.ws.close();
    chrome.kill();
    await sleep(500);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}
fs.writeFileSync(
  `${OUT}/interior-flash.json`,
  JSON.stringify(results, null, 2),
);
const bad = results.filter((r) => r.flashFrames > 0);
console.log(
  bad.length
    ? `FLASH in ${bad.length} of ${results.length} runs`
    : `No black frame in ${results.length} cold loads`,
);
