import { beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { CatalogSchema } from "../src/catalog/types";
import { presentationPresets } from "../src/designer3d/presets";
const memory = vi.hoisted(() => ({
  values: new Map<string, unknown>(),
  fail: false,
}));
vi.mock("idb", () => ({
  openDB: async () => ({
    get: async (_: string, k: string) => structuredClone(memory.values.get(k)),
    put: async (_: string, v: unknown, k: string) => {
      if (memory.fail) throw Error("quota");
      memory.values.set(k, structuredClone(v));
    },
    close: () => {},
    transaction: () => ({
      store: { delete: async (k: string) => memory.values.delete(k) },
      done: Promise.resolve(),
    }),
  }),
}));
import {
  saveAlternative,
  loadAlternative,
  restoreAlternative,
  compatibleAlternative,
  clearComparisons,
} from "../src/designer3d/comparison";
const catalog = CatalogSchema.parse(
  JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
);
const design = () => presentationPresets(catalog)[0].design;
const capture = async () => "data:image/png;base64,ZXhhbXBsZQ==";
beforeEach(() => {
  memory.values.clear();
  memory.fail = false;
});
it("isolates brand, furniture type and slot, reopens storage, and overwrites only the chosen slot", async () => {
  const d = design();
  await saveAlternative("one", d, catalog, "A", "First", capture);
  await saveAlternative("one", d, catalog, "B", "Second", capture);
  expect(await loadAlternative("two", "kitchen", "A")).toBeUndefined();
  expect(await loadAlternative("one", "wardrobe", "A")).toBeUndefined();
  expect((await loadAlternative("one", "kitchen", "A"))?.name).toBe("First");
  await saveAlternative("one", d, catalog, "A", "Replacement", capture);
  expect((await loadAlternative("one", "kitchen", "B"))?.name).toBe("Second");
  await clearComparisons("two");
  expect((await loadAlternative("one", "kitchen", "A"))?.name).toBe(
    "Replacement",
  );
  await clearComparisons("one");
  expect(await loadAlternative("one", "kitchen", "A")).toBeUndefined();
});
it("removes private fields and preserves current offer details when selecting", async () => {
  const offer = {
    number: "private",
    date: "2026-10-10",
    validityDays: 15,
    customer: { name: "Private", phone: "phone", city: "city" },
    salesperson: "name",
    paymentTerms: "",
    notes: "private",
  };
  const saved = await saveAlternative(
    "one",
    { ...design(), offer },
    catalog,
    "A",
    "A",
    capture,
  );
  expect(saved.design.offer).toBeUndefined();
  expect(JSON.stringify(memory.values.get("one:kitchen:A"))).not.toContain(
    "Private",
  );
  expect(
    restoreAlternative(saved, catalog, { ...design(), offer }).offer,
  ).toEqual(offer);
});
it("preserves previous slot on failed capture, invalid capture, invalid configuration and storage failure", async () => {
  const d = design();
  await saveAlternative("one", d, catalog, "A", "Original", capture);
  for (const fn of [
    async () => {
      throw Error("WebGL");
    },
    async () => "",
  ])
    await expect(
      saveAlternative("one", d, catalog, "A", "Bad", fn),
    ).rejects.toThrow();
  await expect(
    saveAlternative(
      "one",
      { ...d, style: { ...d.style, front: "missing" } },
      catalog,
      "A",
      "Bad",
      capture,
    ),
  ).rejects.toThrow();
  memory.fail = true;
  await expect(
    saveAlternative("one", d, catalog, "A", "Bad", capture),
  ).rejects.toThrow();
  expect((await loadAlternative("one", "kitchen", "A"))?.name).toBe("Original");
});
it("blocks unavailable products without substitutions", async () => {
  const saved = await saveAlternative(
    "one",
    design(),
    catalog,
    "A",
    "A",
    capture,
  );
  const missing = {
    ...catalog,
    fronts: catalog.fronts.filter((f) => f.id !== saved.design.style.front),
  };
  expect(compatibleAlternative(saved, missing)).toBe(false);
  expect(() => restoreAlternative(saved, missing)).toThrow(
    "comparisonUnavailable",
  );
  expect(saved.design.style.front).toBe("cashmere");
});
