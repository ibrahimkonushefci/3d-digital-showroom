import type { Cabinet, Catalog, Module } from "../catalog/types";
import { shelfDepth } from "../scene/construction";
import { legacyStorage, resolveInterior } from "./interiors";
/** Metres; shared by geometry, population and inspection. */
export function storageMeasurements(
  c: Cabinet,
  module: Module,
  catalog?: Catalog,
) {
  const legacy = legacyStorage(c, module),
    h = c.height / 100;
  const components = catalog ? resolveInterior(c, module, catalog) : [];
  const shelves =
    c.interior && catalog
      ? components
          .filter((p) => p.kind === "shelf")
          .map((p) => p.cabinetYcm / 100)
          .sort((a, b) => a - b)
      : legacy.shelves;
  const rails =
    c.interior && catalog
      ? components
          .filter((p) => p.kind === "rail")
          .map((p) => p.cabinetYcm / 100)
      : legacy.rail === null
        ? []
        : [legacy.rail];
  const drawers =
    c.interior && catalog
      ? components.filter((p) => p.kind === "drawer").length
      : legacy.drawers;
  const boundaries =
    legacy.drawers && !c.interior
      ? [...shelves.map((y) => y + 0.009), h - 0.018]
      : [0.018, ...shelves.map((y) => y + 0.009), h - 0.018];
  const solids = components
    .filter((p) => p.kind !== "rail")
    .sort((a, b) => a.yCm - b.yCm);
  const free: number[] = [];
  let top = 1.8;
  for (const p of solids) {
    const bottom = 1.8 + p.yCm;
    if (bottom > top + 0.01) free.push((bottom - top) / 100);
    top = Math.max(top, bottom + p.heightCm);
  }
  if (c.height - 1.8 > top) free.push((c.height - 1.8 - top) / 100);
  return {
    width: c.width / 100 - 0.036,
    depth: shelfDepth(c.depth / 100),
    shelves,
    drawers,
    drawerHeight: legacy.drawerHeight,
    rail: rails[0] ?? null,
    rails,
    components,
    clearances:
      c.interior && catalog
        ? free
        : boundaries
            .slice(1)
            .map((y, i) => Math.max(0, y - boundaries[i] - 0.018)),
  };
}
