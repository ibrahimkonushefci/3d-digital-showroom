import { create } from "zustand";
import { createContext, useContext } from "react";
import { useDesigner } from "../designer3d/store";
export type Quality = "lightweight" | "balanced" | "high";
export const QualityOverride = createContext<Quality | null>(null);
/** One shadow caster; quality changes never create a continuous reflection loop. */
export function roomQuality(level: Quality) {
  return {
    shadows: level !== "lightweight",
    shadowSize: level === "high" ? 2048 : 1024,
    probeResolution: level === "lightweight" ? 0 : 128,
    authoredResolution: 64,
  };
}
/** Slow consecutive motion frames count; only an explicit idle boundary is excluded. */
export function movingFrameMs(
  dtSeconds: number,
  active: boolean,
  previousActive: boolean,
): number | null {
  return active && previousActive && Number.isFinite(dtSeconds) && dtSeconds > 0
    ? dtSeconds * 1000
    : null;
}
export const useRenderQuality = create<{
  level: Quality;
  setLevel: (level: Quality) => void;
  /** Ambient occlusion paused for this session after sustained slow motion. */
  aoPaused: boolean;
  pauseAO: () => void;
}>((set) => ({
  level: "balanced",
  setLevel: (level) => set({ level }),
  aoPaused: false,
  pauseAO: () => set({ aoPaused: true }),
}));
/** AO resolution as a fraction of the drawing buffer: full on balanced and
 * high. Half resolution was tried first; upscaled without depth awareness it
 * drew blocky halos at every silhouette and dotted the front seams, the
 * "dirty" look of the first Phase 1 build. Lightweight renders without AO. */
export function aoScale(level: Quality) {
  return level === "lightweight" ? 0 : 1;
}
/**
 * Automatic fallback that keeps shadows: if moving frames stay slower than
 * ~33 fps (p90 above 30 ms) even at balanced quality, AO pauses for the rest
 * of the session. It is the most expensive pass (a second scene render plus
 * a 16-sample shader), so this restores fluid motion without the visible
 * step of lightweight mode, which stays a manual choice.
 */
export function aoShouldPause(level: Quality, frames: number[]): boolean {
  if (level !== "balanced") return false;
  const active = frames.filter((n) => n > 0 && n < 250);
  if (active.length < 90) return false;
  const sorted = [...active].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.9)] > 30;
}
export function useQuality() {
  const override = useContext(QualityOverride);
  const manual = useDesigner((s) => s.performance);
  const level = useRenderQuality((s) => s.level);
  return override ?? (manual ? "lightweight" : level);
}
/**
 * Ignore idle gaps: demand rendering is not a low frame rate. Automatic
 * changes stay between balanced and high so the scene never silently loses
 * shadows and surface detail in front of a client; lightweight is manual only.
 */
export function qualityForFrames(level: Quality, frames: number[]): Quality {
  if (level === "lightweight") return level;
  const active = frames.filter((n) => n > 0 && n < 100);
  if (active.length < 90) return level;
  const sorted = [...active].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  if (p90 > 22 && level === "high") return "balanced";
  if (p90 < 15 && level === "balanced") return "high";
  return level;
}
