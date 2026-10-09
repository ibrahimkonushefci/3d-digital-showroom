import { create } from "zustand";
import type { BrandConfig } from "../catalog/types";
export const usePreferences = create<{
  revision: number;
  setPresentation: (slug: string, value: boolean) => void;
}>((set) => ({
  revision: 0,
  setPresentation: (slug, value) => {
    try {
      localStorage.setItem(`showroom-presentation-${slug}`, String(value));
    } catch {
      /* session preference still refreshes */
    }
    set((s) => ({ revision: s.revision + 1 }));
  },
}));
export function usePresentation(brand: BrandConfig) {
  usePreferences((s) => s.revision);
  try {
    const saved = localStorage.getItem(`showroom-presentation-${brand.slug}`);
    return saved === null ? brand.presentationMode : saved === "true";
  } catch {
    return brand.presentationMode;
  }
}
