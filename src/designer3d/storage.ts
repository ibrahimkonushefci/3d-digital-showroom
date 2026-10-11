import type { Cabinet, Module } from "../catalog/types";
/** Metres; illustrative carcass clearances shared by geometry and inspection. */
export function storageMeasurements(c: Cabinet, module: Module) {
  const h = c.height / 100;
  const drawers = module.type === "drawers" ? 3 : 0;
  const rail = ["hanging", "sliding"].includes(module.type) ? h - 0.32 : null;
  const shelves = rail
    ? []
    : drawers
      ? [0.68, ...[1.3, 1.9].filter((y) => y < h - 0.12)]
      : [0.32, 0.62, 0.82].map((r) => h * r).filter((y) => y < h - 0.12);
  const boundaries = drawers
    ? [...shelves.map((y) => y + 0.009), h - 0.018]
    : [0.018, ...shelves.map((y) => y + 0.009), h - 0.018];
  return {
    width: c.width / 100 - 0.036,
    depth: c.depth / 100 - 0.035,
    shelves,
    drawers,
    drawerHeight: 0.22,
    rail,
    clearances: boundaries
      .slice(1)
      .map((y, i) => Math.max(0, y - boundaries[i] - 0.018)),
  };
}
