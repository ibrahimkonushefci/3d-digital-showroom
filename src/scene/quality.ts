import { create } from "zustand";
import { useDesigner } from "../designer3d/store";
export type Quality = "lightweight" | "balanced" | "high";
export const useRenderQuality = create<{
  level: Quality;
  setLevel: (level: Quality) => void;
}>((set) => ({ level: "balanced", setLevel: (level) => set({ level }) }));
export function useQuality() {
  const manual = useDesigner((s) => s.performance);
  const level = useRenderQuality((s) => s.level);
  return manual ? "lightweight" : level;
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
