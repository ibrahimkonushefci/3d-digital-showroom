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
    items: [product(c, "door", "entry")],
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
  photoDesign: FacadeDesign | null;
  pendingView: "house" | "photo" | null;
  set: (d: FacadeDesign) => void;
  setPhoto: (d: FacadeDesign) => void;
  receive: (d: FacadeDesign) => void;
}>((set) => ({
  design: null,
  photoDesign: null,
  pendingView: null,
  // Shared photo documents must never replace the studio draft.
  set: (design) =>
    set(design.view === "photo" ? { photoDesign: design } : { design }),
  setPhoto: (photoDesign) => set({ photoDesign }),
  receive: (design) =>
    set({
      ...(design.view === "photo" ? { photoDesign: design } : { design }),
      pendingView: design.view,
    }),
}));
export function restoredView(
  brand: string,
  sharedView: "house" | "photo" | null,
): "house" | "photo" {
  if (sharedView) return sharedView;
  try {
    if (
      JSON.parse(localStorage.getItem(`showroom-facade-${brand}`) || "null")
        ?.view === "photo"
    )
      return "photo";
    return localStorage.getItem(`showroom-preview-mode-${brand}`) === "photo"
      ? "photo"
      : "house";
  } catch {
    return "house";
  }
}
export function loadFacade(brand: string, c: Catalog) {
  try {
    const raw = localStorage.getItem(`showroom-facade-${brand}`);
    if (raw) {
      const d = FacadeSchema.parse(JSON.parse(raw));
      if (validFacade(d, c) && d.view !== "photo") return d;
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
        (!p.finishInsideId ||
          c.productFinishes.some((f) => f.id === p.finishInsideId)) &&
        p.options.every((id) => model.options?.some((o) => o.id === id)) &&
        (p.kind === "door" ? c.doorTypes : c.windowMaterials).some(
          (t) => t.id === p.materialType,
        ) &&
        (p.kind === "door" || c.windowProfiles.some((f) => f.id === p.profile))
      );
    })
  );
}

const PhotoDraftSchema = FacadeSchema.extend({
  items: PlacementSchema.array().max(60),
});
export function loadPhotoDraft(brand: string, c: Catalog): FacadeDesign | null {
  for (const key of [
    `showroom-photo-quote-${brand}`,
    `showroom-facade-${brand}`,
  ]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const d = PhotoDraftSchema.parse(JSON.parse(raw));
      if (d.view === "photo" && (!d.items.length || validFacade(d, c)))
        return d;
    } catch {
      /* Keep the original record; do not destroy an unreadable draft. */
    }
  }
  return null;
}
export function persistStudio(brand: string, design: FacadeDesign) {
  const key = `showroom-facade-${brand}`;
  const raw = localStorage.getItem(key);
  if (raw) {
    const old = JSON.parse(raw);
    if (old.view === "photo") {
      // Each write must succeed before replacing a legacy photo document.
      localStorage.setItem(`showroom-facade-photo-backup-${brand}`, raw);
      if (!localStorage.getItem(`showroom-photo-quote-${brand}`))
        localStorage.setItem(`showroom-photo-quote-${brand}`, raw);
    }
  }
  localStorage.setItem(key, JSON.stringify(design));
}
export function persistPhotoDraft(brand: string, design: FacadeDesign) {
  localStorage.setItem(`showroom-photo-quote-${brand}`, JSON.stringify(design));
}
