import {
  presetComponents,
  withInterior,
  snapInterior,
  resolveInterior,
} from "../designer3d/interiors";
import type { Catalog, DesignDocument } from "../catalog/types";
import { wallPosition } from "../designer3d/layout";
export type StudyView =
  | "overall"
  | "door40"
  | "door90"
  | "drawers"
  | "worktop"
  | "tall"
  | "shelves"
  | "storage";
/** DEV only: isolate real procedural modules; never writes or regenerates a draft. */
export function studyDesign(
  original: DesignDocument,
  catalog: Catalog,
  view: StudyView,
): DesignDocument {
  if (view === "overall") return original;
  if (view === "storage" && original.kind === "wardrobe") {
    return {
      ...original,
      cabinets: original.cabinets.map((c) => {
        const m = catalog.modules.find((m) => m.id === c.moduleId)!;
        if (!m.interiorPricing) return c;
        const parts = resolveInterior(c, m, catalog);
        if (m.type === "open" || m.id === "wardrobe-shelves") {
          const changed = parts.map((p, i) =>
            i === 0 ? { ...p, yCm: snapInterior(p.yCm, p.item!, 1) } : p,
          );
          return withInterior(c, [
            ...changed,
            { id: `${c.id}:study-basket`, productId: "storage-basket", yCm: 0 },
          ]);
        }
        return withInterior(c, presetComponents(c, m, catalog));
      }),
    };
  }
  const moduleId =
    original.kind === "wardrobe"
      ? view === "drawers"
        ? "wardrobe-drawers"
        : view === "shelves"
          ? "wardrobe-shelves"
          : "wardrobe-hanging"
      : view === "drawers"
        ? "base-drawers"
        : "base-doors";
  const module = catalog.modules.find((m) => m.id === moduleId)!;
  const desired = view === "door40" ? 40 : view === "door90" ? 90 : 60;
  const width = module.widths.includes(desired) ? desired : module.widths[0];
  const cabinet = {
    id: `phase1-study-${original.kind}-${view}`,
    moduleId,
    width,
    height: Math.min(module.height, original.room.height),
    depth: module.depth,
    level: module.level,
    wall: "back" as const,
    ...wallPosition("back", 100, width, module.depth, original.room),
  };
  const cabinets =
    view === "worktop" && original.kind === "kitchen"
      ? original.cabinets.filter((c) => c.level === "base")
      : [cabinet];
  return { ...original, id: `phase1-study-${original.kind}-${view}`, cabinets };
}
