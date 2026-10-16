import { create } from "zustand";
import type { BrandConfig } from "../catalog/types";
export type HomeAppearance = "light" | "deep-green";
export function readHomeAppearance(): HomeAppearance {
  try {
    return localStorage.getItem("showroom-home-appearance") === "deep-green"
      ? "deep-green"
      : "light";
  } catch {
    return "light";
  }
}
export const usePreferences = create<{
  revision: number;
  homeAppearance: HomeAppearance;
  setHomeAppearance: (appearance: HomeAppearance) => void;
  setPresentation: (slug: string, value: boolean) => void;
}>((set) => ({
  revision: 0,
  homeAppearance: readHomeAppearance(),
  setHomeAppearance: (homeAppearance) => {
    try {
      localStorage.setItem("showroom-home-appearance", homeAppearance);
    } catch {
      // Keep the switch usable for this session if storage is unavailable.
    }
    set({ homeAppearance });
  },
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
