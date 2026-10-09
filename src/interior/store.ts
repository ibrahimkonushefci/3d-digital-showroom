import { create } from "zustand";
import type { Catalog } from "../catalog/types";
import { InteriorSchema, type InteriorDesign } from "./types";
import { newInterior, validInterior } from "./layout";
export const useInterior = create<{
  design: InteriorDesign | null;
  brandSlug: string | null;
  set: (d: InteriorDesign, brand?: string) => void;
}>((set) => ({
  design: null,
  brandSlug: null,
  set: (design, brandSlug) =>
    set((state) => ({ design, brandSlug: brandSlug ?? state.brandSlug })),
}));
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
