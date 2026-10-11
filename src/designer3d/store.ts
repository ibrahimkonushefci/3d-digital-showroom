import { create } from "zustand";
import type { Catalog, DesignDocument } from "../catalog/types";
import { validateDesign } from "./layout";
export function reconcileCabinets(
  design: DesignDocument,
  selected: string | null,
  opened: string[],
) {
  const ids = new Set(design.cabinets.map((c) => c.id));
  return {
    selected: selected && ids.has(selected) ? selected : null,
    opened: opened.filter((id) => ids.has(id)),
  };
}
type State = {
  interior: boolean;
  setInterior: (value: boolean) => void;
  design: DesignDocument | null;
  cameraView: {
    position: [number, number, number];
    target: [number, number, number];
  } | null;
  setCameraView: (
    view: {
      position: [number, number, number];
      target: [number, number, number];
    } | null,
  ) => void;
  interactionMode: "showroom" | "edit";
  dragPreview: DesignDocument | null;
  dragging: boolean;
  setInteractionMode: (mode: "showroom" | "edit") => void;
  previewDrag: (design: DesignDocument | null) => void;
  finishDrag: (catalog: Catalog) => boolean;
  cancelDrag: () => void;
  past: DesignDocument[];
  future: DesignDocument[];
  selected: string | null;
  opened: string[];
  screenshot: string | null;
  error: string | null;
  performance: boolean;
  setDesign: (d: DesignDocument | null) => void;
  edit: (d: DesignDocument, c: Catalog) => boolean;
  select: (id: string | null) => void;
  toggleOpen: (id: string) => void;
  toggleAllOpen: () => void;
  undo: () => void;
  redo: () => void;
  setError: (e: string | null) => void;
  setScreenshot: (s: string) => void;
  setPerformance: (v: boolean) => void;
};
export const useDesigner = create<State>((set, get) => ({
  interior: false,
  setInterior: (interior) => set({ interior }),
  design: null,
  cameraView: null,
  setCameraView: (cameraView) => set({ cameraView }),
  interactionMode: "showroom",
  dragPreview: null,
  dragging: false,
  setInteractionMode: (interactionMode) =>
    set({ interactionMode, dragPreview: null, dragging: false }),
  previewDrag: (dragPreview) => set({ dragPreview, dragging: !!dragPreview }),
  cancelDrag: () => set({ dragPreview: null, dragging: false }),
  finishDrag: (catalog) => {
    const preview = get().dragPreview;
    set({ dragPreview: null, dragging: false });
    return preview && JSON.stringify(preview) !== JSON.stringify(get().design)
      ? get().edit(preview, catalog)
      : false;
  },
  past: [],
  future: [],
  selected: null,
  opened: [],
  screenshot: null,
  error: null,
  performance:
    typeof localStorage !== "undefined" &&
    localStorage.getItem("showroom-performance") === "true",
  setDesign: (design) =>
    set({
      design,
      interior: false,
      cameraView: null,
      dragPreview: null,
      dragging: false,
      interactionMode: "showroom",
      past: [],
      future: [],
      selected: null,
      opened: [],
      error: null,
      screenshot: null,
    }),
  edit: (design, catalog) => {
    if (!validateDesign(design, catalog)) {
      set({ error: "fitError" });
      return false;
    }
    const prev = get().design;
    set({
      design,
      ...reconcileCabinets(design, get().selected, get().opened),
      dragPreview: null,
      dragging: false,
      past: prev ? [...get().past.slice(-29), prev] : [],
      future: [],
      error: null,
      screenshot: null,
    });
    return true;
  },
  select: (selected) => set({ selected }),
  toggleOpen: (id) =>
    set((s) => ({
      opened: s.opened.includes(id)
        ? s.opened.filter((i) => i !== id)
        : [...s.opened, id],
    })),
  toggleAllOpen: () => {
    const s = get();
    if (!s.design) return;
    if (s.opened.length > 0) {
      set({ opened: [] });
    } else {
      set({ opened: s.design.cabinets.map((c) => c.id) });
    }
  },
  undo: () => {
    if (get().dragging) return;
    const { past, design, future } = get();
    if (past.length && design)
      set({
        design: past.at(-1)!,
        past: past.slice(0, -1),
        future: [design, ...future],
        ...reconcileCabinets(past.at(-1)!, get().selected, get().opened),
        error: null,
        screenshot: null,
      });
  },
  redo: () => {
    if (get().dragging) return;
    const { past, design, future } = get();
    if (future.length && design)
      set({
        design: future[0],
        past: [...past, design],
        future: future.slice(1),
        ...reconcileCabinets(future[0], get().selected, get().opened),
        error: null,
        screenshot: null,
      });
  },
  setError: (error) => set({ error }),
  setScreenshot: (screenshot) => set({ screenshot }),
  setPerformance: (performance) => {
    localStorage.setItem("showroom-performance", String(performance));
    set({ performance });
  },
}));
