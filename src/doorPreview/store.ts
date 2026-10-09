import { create } from "zustand";
import { uid } from "../designer3d/layout";
import type { Catalog } from "../catalog/types";
import {
  FacadeSchema,
  PlacementSchema,
  type FacadeDesign,
  type Placement,
} from "./types";
export function product(
  c: Catalog,
  kind: "door" | "window",
  id: string = uid(),
): Placement {
  const m =
    kind === "door"
      ? c.doors[0]
      : c.windows.find((m) => m.style === "double") || c.windows[0];
  return PlacementSchema.parse({
    id,
    kind,
    modelId: m.id,
    corners: [
      { x: 0.35, y: 0.25 },
      { x: 0.65, y: 0.25 },
      { x: 0.65, y: 0.85 },
      { x: 0.35, y: 0.85 },
    ],
    color: "#383e42",
    finishId: "anthracite",
    handle: "bar",
    brightness: 1,
    width: kind === "door" ? 100 : 140,
    height: kind === "door" ? 210 : 140,
  });
}
export function newFacade(c: Catalog): FacadeDesign {
  return {
    version: 1,
    id: uid(),
    kind: "facade",
    view: "house",
    items: [
      product(c, "door", "entry"),
      ...[
        "ground-left",
        "ground-right",
        "upper-left",
        "upper-right",
        "balcony",
      ].map((id) => ({
        ...product(c, "window", id),
        width: id === "balcony" ? 90 : 140,
        height: id === "balcony" ? 215 : 140,
        options: ["shutter-manual", "sill"],
      })),
    ],
    facadeColor: "#e6e0d4",
    evening: false,
    railing: "glass",
    gate: "sliding",
    garage: false,
    installation: true,
    vat: false,
    exact: false,
    removal: false,
  };
}
export const useFacade = create<{
  design: FacadeDesign | null;
  set: (d: FacadeDesign) => void;
}>((set) => ({ design: null, set: (design) => set({ design }) }));
export function loadFacade(brand: string, c: Catalog) {
  try {
    const raw = localStorage.getItem(`showroom-facade-${brand}`);
    if (raw) {
      const d = FacadeSchema.parse(JSON.parse(raw));
      if (validFacade(d, c)) return d;
    }
  } catch {
    /* invalid local data */
  }
  return newFacade(c);
}

export function validFacade(d: FacadeDesign, c: Catalog) {
  if (!d.items.length) return false;
  return (
    new Set(d.items.map((p) => p.id)).size === d.items.length &&
    d.items.every((p) => {
      const model = (p.kind === "door" ? c.doors : c.windows).find(
        (m) => m.id === p.modelId,
      );
      return (
        !!model &&
        (!p.finishId || c.productFinishes.some((f) => f.id === p.finishId)) &&
        p.options.every((id) => model.options?.some((o) => o.id === id)) &&
        (p.kind === "door" ? c.doorTypes : c.windowMaterials).some(
          (t) => t.id === p.materialType,
        ) &&
        (p.kind === "door" || c.windowProfiles.some((f) => f.id === p.profile))
      );
    })
  );
}
