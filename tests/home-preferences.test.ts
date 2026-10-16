import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readHomeAppearance, usePreferences } from "../src/app/preferences";

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  usePreferences.setState({ homeAppearance: "light", revision: 0 });
});
afterEach(() => vi.unstubAllGlobals());

it("defaults to light and accepts only the stored deep-green value", () => {
  expect(readHomeAppearance()).toBe("light");
  values.set("showroom-home-appearance", "system");
  expect(readHomeAppearance()).toBe("light");
  values.set("showroom-home-appearance", "deep-green");
  expect(readHomeAppearance()).toBe("deep-green");
});
it("remembers appearance without changing designs, brand colors or presentation", () => {
  values.set("showroom-design-default-kitchen", '{"id":"customer-draft"}');
  values.set("showroom-brand-default", '{"colors":{"background":"#abcdef"}}');
  usePreferences.getState().setPresentation("default", true);
  const before = new Map(values);
  usePreferences.getState().setHomeAppearance("deep-green");
  expect(usePreferences.getState().homeAppearance).toBe("deep-green");
  expect(readHomeAppearance()).toBe("deep-green");
  for (const [key, value] of before) expect(values.get(key)).toBe(value);
  expect(usePreferences.getState().revision).toBe(1);
  usePreferences.getState().setHomeAppearance("light");
  expect(values.get("showroom-home-appearance")).toBe("light");
});
it("keeps switching in memory when storage access is blocked", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("Storage blocked");
    },
    setItem: () => {
      throw new Error("Storage blocked");
    },
  });
  expect(readHomeAppearance()).toBe("light");
  expect(() =>
    usePreferences.getState().setHomeAppearance("deep-green"),
  ).not.toThrow();
  expect(usePreferences.getState().homeAppearance).toBe("deep-green");
  usePreferences.getState().setHomeAppearance("light");
  expect(usePreferences.getState().homeAppearance).toBe("light");
});
it("works when browser storage does not exist", () => {
  vi.stubGlobal("localStorage", undefined);
  expect(readHomeAppearance()).toBe("light");
  expect(() =>
    usePreferences.getState().setHomeAppearance("deep-green"),
  ).not.toThrow();
  expect(usePreferences.getState().homeAppearance).toBe("deep-green");
});
