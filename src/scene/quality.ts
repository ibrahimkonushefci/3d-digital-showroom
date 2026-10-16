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
/** AO resolution as a fraction of the drawing buffer: always full. Half
 * resolution was tried first; upscaled without depth awareness it drew
 * blocky halos at every silhouette and dotted the front seams. Lightweight
 * renders without AO. */
export function aoScale(level: Quality) {
  return level === "lightweight" ? 0 : 1;
}
/**
 * Pixel ratios of the drawing: a still view renders at the display's own
 * ratio (capped at 2), so stills and front seams are sharp; while the camera
 * or a front moves, a lighter ratio keeps motion fluid and is replaced by
 * the sharp one MOTION_SETTLE_MS after the movement stops. Quality itself
 * never changes on its own: only Performance mode chooses lightweight.
 */
export function pixelRatios(
  level: Quality,
  device = globalThis.devicePixelRatio || 1,
) {
  if (level === "lightweight") return { still: 1, motion: 1 };
  const still = Math.min(Math.max(device, 1), 2);
  return { still, motion: Math.min(still, 1.5) };
}
export const MOTION_SETTLE_MS = 150;
export function useQuality(): Quality {
  const override = useContext(QualityOverride);
  const manual = useDesigner((s) => s.performance);
  return override ?? (manual ? "lightweight" : "balanced");
}
