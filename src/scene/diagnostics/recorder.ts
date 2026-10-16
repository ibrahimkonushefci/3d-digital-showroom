/** Frame diagnostics for `?fps=1`: plain module state, read by the overlay
 * a few times a second. Only loaded when the flag is on. */
export type DiagEvent = { at: number; text: string };
export type Window = {
  start: number;
  intervals: number[];
  cpu: number[];
  longTasks: number[];
  events: DiagEvent[];
  /** Pixel ratios moving frames were drawn at. */
  ratios: number[];
  canvas: string;
};
export type Session = {
  design: string;
  openedAt: number;
  windows: Window[];
  events: DiagEvent[];
  longTasks: { at: number; ms: number }[];
  quality: string;
};
const WINDOW_MS = 15000;
/** A later window starts on the first movement this long after the open. */
const LATER_AFTER_MS = 30000;
const MAX_WINDOWS = 8;

export const diag = {
  sessions: [] as Session[],
  /** Timestamps of recent drawn moving frames, for the live rate. */
  recent: [] as number[],
  renderer: "",
  live: { dpr: 0, canvas: "", quality: "", ao: "" },
};
const current = () => diag.sessions[diag.sessions.length - 1];
const openWindow = (s: Session, now: number) => {
  const w = s.windows[s.windows.length - 1];
  return w && now - w.start < WINDOW_MS ? w : null;
};

export function openSession(design: string, quality: string) {
  diag.sessions.push({
    design,
    openedAt: performance.now(),
    windows: [],
    events: [],
    longTasks: [],
    quality,
  });
  if (diag.sessions.length > 12) diag.sessions.shift();
}
export function logEvent(text: string) {
  const s = current();
  if (!s) return;
  const now = performance.now();
  const e = { at: now - s.openedAt, text };
  if (s.events.length < 400) s.events.push(e);
  openWindow(s, now)?.events.push(e);
}
export function logLongTask(start: number, ms: number) {
  const s = current();
  if (!s || start < s.openedAt) return;
  if (s.longTasks.length < 400)
    s.longTasks.push({ at: start - s.openedAt, ms });
  openWindow(s, start)?.longTasks.push(ms);
}
/** One drawn frame. `interval` is null unless this and the previous frame
 * both moved (idle gaps of demand rendering are not a low frame rate). */
export function logFrame(
  now: number,
  interval: number | null,
  cpuMs: number,
  dpr: number,
  canvas: string,
) {
  const s = current();
  if (!s || interval === null) return;
  diag.recent.push(now);
  while (diag.recent.length && now - diag.recent[0] > 1000) diag.recent.shift();
  let w = openWindow(s, now);
  if (!w) {
    const first = s.windows.length === 0;
    const sinceOpen = now - s.openedAt;
    const last = s.windows[s.windows.length - 1];
    const canStartLater =
      sinceOpen > LATER_AFTER_MS &&
      (!last || now - last.start > WINDOW_MS + 15000);
    // The first window is anchored at the open, whatever happens first.
    if (first && sinceOpen < WINDOW_MS)
      w = newWindow(s, s.openedAt, dpr, canvas);
    else if (canStartLater && s.windows.length < MAX_WINDOWS)
      w = newWindow(s, now, dpr, canvas);
  }
  if (!w) return;
  w.intervals.push(interval);
  w.cpu.push(cpuMs);
  if (!w.ratios.includes(dpr)) w.ratios.push(dpr);
}
function newWindow(s: Session, start: number, dpr: number, canvas: string) {
  const w: Window = {
    start,
    intervals: [],
    cpu: [],
    longTasks: [],
    events: [],
    ratios: [dpr],
    canvas,
  };
  // Long tasks and events since the open belong to the first window.
  if (s.windows.length === 0) {
    w.longTasks = s.longTasks.filter((t) => t.at < WINDOW_MS).map((t) => t.ms);
    w.events = s.events.filter((e) => e.at < WINDOW_MS);
  }
  s.windows.push(w);
  return w;
}
export function liveFps() {
  const now = performance.now();
  const r = diag.recent.filter((t) => now - t < 1000);
  return r.length && now - r[r.length - 1] < 250 ? r.length : null;
}
const pct = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};
const f = (n: number) => n.toFixed(1);
export function report(): string {
  const lines = [
    "Showroom frame report",
    `Recorded: ${new Date().toISOString()}`,
    `Browser: ${navigator.userAgent}`,
    `GPU: ${diag.renderer}`,
    `Screen: ${screen.width}x${screen.height} @${devicePixelRatio}x, window ${innerWidth}x${innerHeight}`,
    `Now: quality ${diag.live.quality}, AO ${diag.live.ao}, pixel ratio ${diag.live.dpr}, canvas ${diag.live.canvas}`,
    "",
  ];
  for (const s of diag.sessions) {
    lines.push(
      `== ${s.design} (opened at quality ${s.quality}, ${new Date(performance.timeOrigin + s.openedAt).toLocaleTimeString()})`,
    );
    s.windows.forEach((w, i) => {
      const n = w.intervals.length;
      const slow = w.intervals.filter((x) => x > 20).length;
      const long = w.intervals.filter((x) => x > 50).length;
      const mean = n ? w.intervals.reduce((a, b) => a + b, 0) / n : 0;
      lines.push(
        `Window ${i + 1} (from ${f((w.start - s.openedAt) / 1000)} s): ${n} moving frames` +
          (n
            ? `, ~${Math.round(1000 / mean)} fps, interval p50 ${f(pct(w.intervals, 0.5))} / p90 ${f(pct(w.intervals, 0.9))} / max ${f(Math.max(...w.intervals))} ms, ` +
              `${Math.round((slow / n) * 100)}% slower than 50 fps, ${long} frames > 50 ms, ` +
              `JS per frame p50 ${f(pct(w.cpu, 0.5))} / p90 ${f(pct(w.cpu, 0.9))} ms`
            : "") +
          `, drawn at ${w.ratios.join("/")}x, canvas ${w.canvas}, long tasks ${w.longTasks.length ? w.longTasks.map((t) => Math.round(t)).join("/") + " ms" : "none"}`,
      );
    });
    if (!s.windows.length) lines.push("No moving frames recorded.");
    lines.push("Events (s after open):");
    for (const e of s.events) lines.push(`  ${f(e.at / 1000)}  ${e.text}`);
    if (s.longTasks.length)
      lines.push(
        "Long tasks (s after open, ms): " +
          s.longTasks
            .map((t) => `${f(t.at / 1000)}:${Math.round(t.ms)}`)
            .join(", "),
      );
    lines.push("");
  }
  return lines.join("\n");
}
export function resetDiagnostics() {
  diag.sessions.splice(0, diag.sessions.length - 1);
  const s = current();
  if (s) {
    s.windows = [];
    s.events = [];
    s.longTasks = [];
    s.openedAt = performance.now();
  }
}
