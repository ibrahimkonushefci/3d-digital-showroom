import { create } from "zustand";
import sq from "./sq.json";
import en from "./en.json";
import de from "./de.json";
import type { Language } from "../catalog/types";
const translations = { sq, en, de };
export type TranslationKey = keyof typeof en;
const initial =
  typeof localStorage === "undefined"
    ? null
    : localStorage.getItem("showroom-language");
export const useLanguage = create<{
  language: Language;
  setLanguage: (l: Language) => void;
}>((set) => ({
  language: initial === "en" || initial === "de" ? initial : "sq",
  setLanguage: (language) => {
    localStorage.setItem("showroom-language", language);
    document.documentElement.lang = language;
    set({ language });
  },
}));
export function useT() {
  const { language } = useLanguage();
  return (key: TranslationKey, values?: Record<string, string | number>) =>
    translate(language, key, values);
}
export function translate(
  language: Language,
  key: TranslationKey,
  values?: Record<string, string | number>,
) {
  let str: string = translations[language][key] || en[key];
  Object.entries(values || {}).forEach(
    ([k, v]) => (str = str.replaceAll(`{${k}}`, String(v))),
  );
  return str;
}
export function money(n: number, l: Language) {
  return (
    new Intl.NumberFormat(l === "en" ? "en-GB" : "de-DE", {
      maximumFractionDigits: 0,
    }).format(n) + " €"
  );
}
export function label(
  value: { sq: string; en: string; de: string },
  language: Language,
) {
  return value[language];
}

export function number(n: number, l: Language, digits = 2) {
  return new Intl.NumberFormat(l === "en" ? "en-GB" : "de-DE", {
    maximumFractionDigits: digits,
  }).format(n);
}
