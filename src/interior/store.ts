import { create } from "zustand";
import type { Catalog } from "../catalog/types";
import { InteriorSchema, type InteriorDesign } from "./types";
import { newInterior, validInterior } from "./layout";
export const useInterior = create<{
  design: InteriorDesign | null;
  set: (d: InteriorDesign) => void;
}>((set) => ({ design: null, set: (design) => set({ design }) }));
export function loadInterior(brand: string, c: Catalog) {
  try {
    const raw = localStorage.getItem(`showroom-interior-${brand}`);
    if (raw) {
      const d = InteriorSchema.parse(JSON.parse(raw));
      if (validInterior(d, c)) return d;
    }
  } catch {
    /* ignore invalid save */
  }
  return newInterior(c);
}
