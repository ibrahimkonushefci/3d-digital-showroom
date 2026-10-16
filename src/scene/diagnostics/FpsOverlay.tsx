/** The small `?fps=1` panel: live frame rate and "Copy report". */
import { useEffect, useState } from "react";
import { diag, liveFps, report, resetDiagnostics } from "./recorder";

export default function FpsOverlay() {
  const [, tick] = useState(0);
  const [copied, setCopied] = useState("");
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(timer);
  }, []);
  const fps = liveFps();
  const s = diag.sessions[diag.sessions.length - 1];
  const since = s ? (performance.now() - s.openedAt) / 1000 : 0;
  const recording =
    s?.windows.length &&
    performance.now() - s.windows[s.windows.length - 1].start < 15000;
  const copy = async () => {
    const text = report();
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied");
    } catch {
      // Fallback: show the text selected so Cmd+C works.
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      setCopied(document.execCommand("copy") ? "Copied" : "Copy failed");
      area.remove();
    }
    setTimeout(() => setCopied(""), 2000);
  };
  return (
    <div className="fps-overlay" role="status">
      <strong>{fps === null ? "idle" : `${fps} fps`}</strong>
      <span>
        {diag.live.quality || "-"} · AO {diag.live.ao || "-"} · ×
        {diag.live.dpr || "-"}
      </span>
      <span>
        {s
          ? `${s.windows.length} window${s.windows.length === 1 ? "" : "s"}${recording ? " · recording" : ""} · ${Math.round(since)} s`
          : "open a design"}
      </span>
      <div>
        <button onClick={copy}>{copied || "Copy report"}</button>
        <button onClick={resetDiagnostics}>Reset</button>
      </div>
    </div>
  );
}
