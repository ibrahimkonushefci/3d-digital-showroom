import { validateInteriorReferences } from "./interiorValidation";
import { resolveInterior } from "./interiors";
import { validateFinishReferences } from "./finishes";
import { create } from "zustand";
import type { Catalog, DesignDocument } from "../catalog/types";
import { validateDesign } from "./layout";
export function reconcileCabinets(
  design: DesignDocument,
  selected: string | null,
  opened: string[],
  focused: string | null = null,
) {
  const ids = new Set(design.cabinets.map((c) => c.id));
  return {
    selected: selected && ids.has(selected) ? selected : null,
    opened: opened.filter((id) => ids.has(id)),
    focused: focused && ids.has(focused) ? focused : null,
  };
}
export type InteriorSelection = { cabinetId: string; componentId: string };
function reconcileInterior(
  design: DesignDocument,
  catalog: Catalog | null,
  selectedInterior: InteriorSelection | null,
  openedInterior: InteriorSelection[],
) {
  const exists = (selection: InteriorSelection) => {
    const c = design.cabinets.find((c) => c.id === selection.cabinetId);
    const m = catalog?.modules.find((m) => m.id === c?.moduleId);
    return (
      !!c &&
      !!m &&
      !!catalog &&
      resolveInterior(c, m, catalog).some((i) => i.id === selection.componentId)
    );
  };
  return {
    selectedInterior:
      selectedInterior && exists(selectedInterior) ? selectedInterior : null,
    openedInterior: openedInterior.filter(exists),
  };
}
type State = {
  interiorDecoration: boolean;
  setInteriorDecoration: (value: boolean) => void;
  selectedInterior: InteriorSelection | null;
  openedInterior: InteriorSelection[];
  interiorCatalog: Catalog | null;
  selectInterior: (selection: InteriorSelection | null) => void;
  toggleInteriorOpen: (selection: InteriorSelection) => void;

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
  /** Cabinet the camera is deliberately inspecting; independent of selection. */
  focused: string | null;
  opened: string[];
  screenshot: string | null;
  error: string | null;
  performance: boolean;
  setDesign: (d: DesignDocument | null) => void;
  edit: (d: DesignDocument, c: Catalog) => boolean;
  select: (id: string | null) => void;
  focus: (id: string | null) => void;
  /** Replace the design with a default as one undoable step. */
  resetDesign: (d: DesignDocument, c: Catalog) => boolean;
  toggleOpen: (id: string) => void;
  toggleAllOpen: () => void;
  undo: () => void;
  redo: () => void;
  setError: (e: string | null) => void;
  setScreenshot: (s: string) => void;
  setPerformance: (v: boolean) => void;
};
export const useDesigner = create<State>((set, get) => ({
  interiorDecoration: true,
  setInteriorDecoration: (interiorDecoration) => set({ interiorDecoration }),
  selectedInterior: null,
  openedInterior: [],
  interiorCatalog: null,
  selectInterior: (selection) =>
    set({
      selectedInterior: selection,
      ...(selection ? { selected: selection.cabinetId } : {}),
    }),
  toggleInteriorOpen: (selection) =>
    set((s) => ({
      openedInterior: s.openedInterior.some(
        (i) =>
          i.cabinetId === selection.cabinetId &&
          i.componentId === selection.componentId,
      )
        ? s.openedInterior.filter(
            (i) =>
              i.cabinetId !== selection.cabinetId ||
              i.componentId !== selection.componentId,
          )
        : [...s.openedInterior, selection],
    })),
  interior: false,
  setInterior: (interior) => set({ interior }),
  design: null,
  cameraView: null,
  setCameraView: (cameraView) => set({ cameraView }),
  interactionMode: "showroom",
  dragPreview: null,
  dragging: false,
  setInteractionMode: (interactionMode) =>
    set({ interactionMode, focused: null, dragPreview: null, dragging: false }),
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
  focused: null,
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
      selectedInterior: null,
      openedInterior: [],
      interiorCatalog: null,
      cameraView: null,
      dragPreview: null,
      dragging: false,
      interactionMode: "showroom",
      past: [],
      future: [],
      selected: null,
      focused: null,
      opened: [],
      error: null,
      screenshot: null,
    }),
  edit: (design, catalog) => {
    const interiorIssues = validateInteriorReferences(design, catalog);
    if (interiorIssues.length) {
      set({ error: interiorIssues[0].code });
      return false;
    }
    if (validateFinishReferences(design, catalog).length) {
      set({ error: "incompatibleDesign" });
      return false;
    }
    if (!validateDesign(design, catalog)) {
      set({ error: "fitError" });
      return false;
    }
    const prev = get().design;
    set({
      design,
      interiorCatalog: catalog,
      ...reconcileInterior(
        design,
        catalog,
        get().selectedInterior,
        get().openedInterior,
      ),
      ...reconcileCabinets(design, get().selected, get().opened, get().focused),
      dragPreview: null,
      dragging: false,
      past: prev ? [...get().past.slice(-29), prev] : [],
      future: [],
      error: null,
      screenshot: null,
    });
    return true;
  },
  select: (selected) =>
    set((s) => ({
      selected,
      selectedInterior:
        s.selectedInterior?.cabinetId === selected ? s.selectedInterior : null,
    })),
  focus: (focused) => set({ focused }),
  resetDesign: (design, catalog) => {
    if (!get().edit(design, catalog)) return false;
    set({
      selected: null,
      focused: null,
      opened: [],
      cameraView: null,
      selectedInterior: null,
      openedInterior: [],
    });
    return true;
  },
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
        ...reconcileInterior(
          past.at(-1)!,
          get().interiorCatalog,
          get().selectedInterior,
          get().openedInterior,
        ),
        past: past.slice(0, -1),
        future: [design, ...future],
        ...reconcileCabinets(
          past.at(-1)!,
          get().selected,
          get().opened,
          get().focused,
        ),
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
        ...reconcileInterior(
          future[0],
          get().interiorCatalog,
          get().selectedInterior,
          get().openedInterior,
        ),
        past: [...past, design],
        future: future.slice(1),
        ...reconcileCabinets(
          future[0],
          get().selected,
          get().opened,
          get().focused,
        ),
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
// Review scripts (development server only) read and drive the editor state.
if (import.meta.env.DEV && typeof window !== "undefined")
  (window as unknown as { __designer: typeof useDesigner }).__designer =
    useDesigner;
