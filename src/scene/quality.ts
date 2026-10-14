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
}>((set) => ({ level: "balanced", setLevel: (level) => set({ level }) }));
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
