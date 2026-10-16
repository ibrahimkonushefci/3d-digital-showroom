import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  BrandSchema,
  CatalogSchema,
  DesignSchema,
  type Catalog,
  type DesignDocument,
} from "../src/catalog/types";
import { presentationPresets } from "../src/designer3d/presets";
import {
  legacyStorage,
  resolveInterior,
  presetComponents,
  snapInterior,
  withInterior,
  interiorAdjustments,
} from "../src/designer3d/interiors";
import {
  validateInterior,
  validateInteriorReferences,
} from "../src/designer3d/interiorValidation";
import { storageMeasurements } from "../src/designer3d/storage";
import { calculatePrice } from "../src/pricing";
import { useDesigner } from "../src/designer3d/store";
import { validateDesign, wallPosition } from "../src/designer3d/layout";
import { readDesign, saveDesign } from "../src/persistence";
import { interiorAssociations } from "../src/documents/finishes";
import { storagePopulation } from "../src/scene/rooms/WardrobePopulation";
import { parseDesignDocument } from "../src/catalog/migrations";
const load = (slug: string) =>
  CatalogSchema.parse(
    JSON.parse(readFileSync(`public/brands/${slug}/catalog.json`, "utf8")),
  );
const fixture = (catalog: Catalog) =>
  structuredClone(
    presentationPresets(catalog).find((p) => p.id === "wardrobe-straight")!
      .design,
  );
const materialize = (design: DesignDocument, catalog: Catalog, index = 1) => {
  const c = design.cabinets[index],
    m = catalog.modules.find((m) => m.id === c.moduleId)!;
  return {
    ...design,
    cabinets: design.cabinets.map((c, i) =>
      i === index ? withInterior(c, presetComponents(c, m, catalog)) : c,
    ),
  };
};
afterEach(() => {
  vi.unstubAllGlobals();
  useDesigner.getState().setDesign(null);
});
for (const slug of ["default", "druri-design"])
  describe(slug, () => {
    const catalog = load(slug),
      brand = BrandSchema.parse(
        JSON.parse(readFileSync(`public/brands/${slug}/brand.json`, "utf8")),
      );
    it("materializes exact preset counts and stationary positions without changing legacy quotes", () => {
      const design = fixture(catalog),
        snapshot = JSON.stringify(design);
      for (const c of design.cabinets) {
        const m = catalog.modules.find((m) => m.id === c.moduleId)!,
          legacy = legacyStorage(c, m),
          parts = resolveInterior(c, m, catalog);
        parts
          .filter((p) => p.kind === "shelf")
          .forEach((part, i) =>
            expect(part.cabinetYcm / 100).toBeCloseTo(legacy.shelves[i], 8),
          );
        expect(parts.filter((p) => p.kind === "drawer")).toHaveLength(
          legacy.drawers,
        );
        const next = {
          ...design,
          cabinets: design.cabinets.map((x) =>
            x.id === c.id
              ? withInterior(c, presetComponents(c, m, catalog))
              : x,
          ),
        };
        expect(validateDesign(next, catalog)).toBe(true);
        for (const lang of ["sq", "en", "de"] as const)
          expect(calculatePrice(next, catalog, lang)).toEqual(
            calculatePrice(design, catalog, lang),
          );
      }
      expect(JSON.stringify(design)).toBe(snapshot);
    });
    it("moves one shelf for free and rejects overlap, retaining geometry, price and history", () => {
      const design = fixture(catalog),
        c = design.cabinets[1],
        m = catalog.modules.find((m) => m.id === c.moduleId)!,
        parts = resolveInterior(c, m, catalog);
      useDesigner.getState().setDesign(design);
      useDesigner
        .getState()
        .selectInterior({ cabinetId: c.id, componentId: parts[0].id });
      const moved = withInterior(
        c,
        parts.map((p, i) =>
          i === 0 ? { ...p, yCm: snapInterior(p.yCm, p.item!, 1) } : p,
        ),
      );
      const next = {
        ...design,
        cabinets: design.cabinets.map((x) => (x.id === c.id ? moved : x)),
      };
      expect(useDesigner.getState().edit(next, catalog)).toBe(true);
      expect(calculatePrice(next, catalog, "en").total).toBe(
        calculatePrice(design, catalog, "en").total,
      );
      expect(next.cabinets.filter((x) => x.id !== c.id)).toEqual(
        design.cabinets.filter((x) => x.id !== c.id),
      );
      const bad = {
        ...next,
        cabinets: next.cabinets.map((x) =>
          x.id === c.id
            ? withInterior(
                x,
                parts.map((p) => ({ ...p, yCm: 72 })),
              )
            : x,
        ),
      };
      expect(useDesigner.getState().edit(bad, catalog)).toBe(false);
      expect(useDesigner.getState().design).toEqual(next);
      expect(useDesigner.getState().past).toHaveLength(1);
      useDesigner.getState().undo();
      expect(useDesigner.getState().design).toEqual(design);
      expect(useDesigner.getState().selectedInterior?.componentId).toBe(
        parts[0].id,
      );
      useDesigner.getState().redo();
      expect(useDesigner.getState().design).toEqual(next);
    });
    it("adds a basket as an itemized delta, removes for zero credit and replaces rail inventory", () => {
      const design = materialize(fixture(catalog), catalog),
        c = design.cabinets[1];
      const basket = {
        id: `${c.id}:basket`,
        productId: "storage-basket",
        yCm: 0,
      };
      const next = {
        ...design,
        cabinets: design.cabinets.map((x) =>
          x.id === c.id
            ? withInterior(x, [...x.interior!.components, basket])
            : x,
        ),
      };
      expect(validateDesign(next, catalog)).toBe(true);
      const p = calculatePrice(next, catalog, "en"),
        base = calculatePrice(design, catalog, "en");
      const line = p.lines.find((l) => l.id.startsWith("interior:"))!;
      expect(line.quantity).toBe(1);
      expect(line.amount).toBe(
        catalog.interiorItems!.find((i) => i.kind === "basket")!.price,
      );
      expect(line.amount).toBe(line.quantity * line.unitPrice);
      expect(p.subtotal - base.subtotal).toBeCloseTo(line.amount);
      const m = catalog.modules.find((m) => m.id === c.moduleId)!;
      const empty = withInterior(c, []);
      expect(interiorAdjustments(empty, m, catalog)).toEqual([]);
      const railCabinet = design.cabinets[0],
        railModule = catalog.modules.find(
          (m) => m.id === railCabinet.moduleId,
        )!;
      const replacement = withInterior(railCabinet, [
        { id: "replacement", productId: "storage-shelf", yCm: 120 },
      ]);
      expect(validateInterior(replacement, railModule, catalog)).toEqual([]);
      expect(
        interiorAdjustments(replacement, railModule, catalog)[0].item.kind,
      ).toBe("shelf");
    });
    it("rejects invalid sizes, rail clearance, off-grid positions, sliding access, and unknown IDs", () => {
      const d = fixture(catalog),
        c = d.cabinets[1],
        m = catalog.modules.find((m) => m.id === c.moduleId)!;
      for (const [components, code] of [
        [
          [{ id: "x", productId: "storage-shelf", yCm: 228 }],
          "interiorBoundsError",
        ],
        [
          [{ id: "x", productId: "storage-shelf", yCm: 101 }],
          "interiorMountError",
        ],
        [[{ id: "x", productId: "missing", yCm: 0 }], "interiorReferenceError"],
        [
          [
            { id: "x", productId: "storage-rail", yCm: 150 },
            { id: "y", productId: "storage-shelf", yCm: 100 },
          ],
          "interiorRailError",
        ],
      ] as const)
        expect(
          validateInterior(withInterior(c, [...components]), m, catalog).some(
            (i) => i.code === code,
          ),
        ).toBe(true);
      const sliding = d.cabinets[3],
        sm = catalog.modules.find((m) => m.id === sliding.moduleId)!;
      expect(
        validateInterior(
          withInterior(sliding, [
            { id: "b", productId: "storage-basket", yCm: 0 },
          ]),
          sm,
          catalog,
        ).some((i) => i.code === "interiorAccessError"),
      ).toBe(true);
      expect(
        validateInterior(
          withInterior({ ...c, width: 30 }, [
            { id: "b", productId: "storage-basket", yCm: 0 },
          ]),
          m,
          catalog,
        ).some((i) => i.code === "interiorBoundsError"),
      ).toBe(true);
      expect(
        validateInterior(
          withInterior(c, [
            {
              id: "b",
              productId: "storage-shelf",
              yCm: 0,
              span: { xCm: 0, widthCm: 30 },
            },
          ]),
          m,
          catalog,
        ).some((i) => i.code === "interiorReferenceError"),
      ).toBe(true);
    });
    it("preserves custom inventory through reload, sharing and A/B with private fields excluded", () => {
      const design = materialize(fixture(catalog), catalog);
      design.offer = {
        number: "private",
        date: "2026-10-14",
        validityDays: 15,
        customer: { name: "Private", phone: "", city: "" },
        salesperson: "",
        paymentTerms: "",
        notes: "",
      };
      const map = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => map.set(k, v),
      });
      saveDesign(slug, design);
      expect(readDesign(slug, "wardrobe", catalog).design).toEqual(design);
      const bad = structuredClone(design);
      bad.cabinets[1].interior!.components[0].productId = "unknown";
      map.set(`showroom-design-${slug}-wardrobe`, JSON.stringify(bad));
      expect(readDesign(slug, "wardrobe", catalog).error).toBe(
        "incompatibleDesign",
      );
      expect(map.get(`showroom-design-${slug}-wardrobe`)).toBe(
        JSON.stringify(bad),
      );
      for (const language of ["sq", "en", "de"] as const)
        expect(
          interiorAssociations(design, catalog, language)[1].description,
        ).toContain("70");
    });
    it("supports 180 cm, corner and walk-in presets while retaining compatible parts on resize", () => {
      for (const p of presentationPresets(catalog).filter(
        (p) => p.design.kind === "wardrobe",
      )) {
        const d = {
          ...p.design,
          cabinets: p.design.cabinets.map((c) => ({ ...c, height: 180 })),
        };
        for (const c of d.cabinets) {
          const m = catalog.modules.find((m) => m.id === c.moduleId)!;
          expect(
            validateInterior(
              withInterior(c, presetComponents(c, m, catalog)),
              m,
              catalog,
            ),
          ).toEqual([]);
        }
      }
      const d = materialize(fixture(catalog), catalog);
      useDesigner.getState().setDesign(d);
      const resized = {
        ...d,
        cabinets: d.cabinets.map((c, i) =>
          i === 1 ? { ...c, height: 180 } : c,
        ),
      };
      expect(useDesigner.getState().edit(resized, catalog)).toBe(false);
      expect(useDesigner.getState().design).toEqual(d);
    });
  });
it("uses explicit credits, capped by included allowance, separately from covered module accessories", () => {
  const catalog = load("default"),
    d = fixture(catalog),
    c = d.cabinets[1],
    m = catalog.modules.find((m) => m.id === c.moduleId)!;
  m.interiorPricing!.removalCredits = { "storage-shelf": 10 };
  m.interiorPricing!.includedAllowance = 30;
  const next = {
    ...d,
    cabinets: d.cabinets.map((x) => (x.id === c.id ? withInterior(x, []) : x)),
  };
  const line = calculatePrice(next, catalog, "en").lines.find((l) =>
    l.id.startsWith("interior:"),
  )!;
  expect(line.quantity).toBe(3);
  expect(line.unitPrice).toBe(-10);
  expect(line.amount).toBe(-30);
  expect(line.name).toContain("removal credit");
  m.interiorPricing!.includedAllowance = 20;
  expect(() => calculatePrice(next, catalog, "en")).toThrow(
    "interiorCreditError",
  );
  m.interiorPricing!.includedAllowance = 30;
  m.accessory = "organizer";
  catalog.interiorItems!.find((i) => i.kind === "shelf")!.coveredAccessoryId =
    "organizer";
  expect(interiorAdjustments(withInterior(c, []), m, catalog)).toEqual([]);
});
it("bounds component arrays and IDs without reducing the 200 cabinet schema limit", () => {
  const catalog = load("default"),
    d = fixture(catalog),
    one = d.cabinets[0];
  const list = Array.from({ length: 33 }, (_, i) => ({
    id: `s${i}`,
    productId: "storage-shelf",
    yCm: i * 2,
  }));
  expect(
    DesignSchema.safeParse({ ...d, cabinets: [withInterior(one, list)] })
      .success,
  ).toBe(false);
  const large = {
    ...d,
    cabinets: Array.from({ length: 200 }, (_, i) => ({ ...one, id: `c${i}` })),
  };
  expect(DesignSchema.safeParse(large).success).toBe(true);
  const excessive = {
    ...large,
    cabinets: large.cabinets.map((c, i) =>
      withInterior(
        c,
        Array.from({ length: 3 }, (_, j) => ({
          id: `${i}-${j}`,
          productId: "storage-shelf",
          yCm: j * 20,
        })),
      ),
    ),
  };
  expect(DesignSchema.safeParse(excessive).success).toBe(false);
  const dupe = {
    ...d,
    cabinets: d.cabinets.map((c, i) =>
      i < 2
        ? withInterior(c, [
            { id: "duplicate", productId: "storage-shelf", yCm: 0 },
          ])
        : c,
    ),
  };
  expect(DesignSchema.safeParse(dupe).success).toBe(false);
  expect(parseDesignDocument(materialize(d, catalog))).toEqual(
    materialize(d, catalog),
  );
});
it("keeps open state transient and reconciles selection/opening on removal, history and cabinet deletion", () => {
  const catalog = load("default"),
    d = materialize(fixture(catalog), catalog),
    c = d.cabinets[1];
  useDesigner.getState().setDesign(d);
  const item = { cabinetId: c.id, componentId: c.interior!.components[0].id };
  useDesigner.getState().selectInterior(item);
  useDesigner.getState().toggleInteriorOpen(item);
  expect(useDesigner.getState().design).toEqual(d);
  expect(
    useDesigner
      .getState()
      .edit(
        { ...d, cabinets: d.cabinets.filter((x) => x.id !== c.id) },
        catalog,
      ),
  ).toBe(true);
  expect(useDesigner.getState().selectedInterior).toBeNull();
  expect(useDesigner.getState().openedInterior).toEqual([]);
  useDesigner.getState().undo();
  expect(useDesigner.getState().design).toEqual(d);
  expect(useDesigner.getState().openedInterior).toEqual([]);
});
it("decorative contents fit changed shelves and pull-outs without changing inventory or price", () => {
  const catalog = load("default"),
    d = materialize(fixture(catalog), catalog),
    c = d.cabinets[1],
    m = catalog.modules.find((m) => m.id === c.moduleId)!;
  const changed = withInterior(c, [
    { id: "basket", productId: "storage-basket", yCm: 70 },
  ]);
  const contents = storagePopulation(
    changed,
    m,
    storageMeasurements(changed, m, catalog),
  );
  expect(contents).toEqual([]);
  expect(changed.interior!.components).toHaveLength(1);
  useDesigner.getState().setDesign(d);
  useDesigner.getState().setInteriorDecoration(false);
  expect(useDesigner.getState().design).toEqual(d);
});
it("uses catalog mounting steps rather than assuming a 32 mm system", () => {
  const catalog = load("default"),
    item = catalog.interiorItems![0];
  item.mounting = { stepCm: 5, originCm: 1 };
  expect(snapInterior(12, item, 1)).toBe(16);
  expect(snapInterior(12, item, -1)).toBe(11);
  expect(snapInterior(12, item)).toBe(11);
});

it("retains compatible materialized legacy mounting positions when a cabinet grows", () => {
  const catalog = load("default"),
    design = fixture(catalog),
    c = { ...design.cabinets[1], height: 180 },
    m = catalog.modules.find((m) => m.id === c.moduleId)!;
  const custom = withInterior(c, presetComponents(c, m, catalog));
  const original = {
    ...design,
    cabinets: design.cabinets.map((x) => (x.id === c.id ? custom : x)),
  };
  useDesigner.getState().setDesign(original);
  const grown = {
    ...original,
    cabinets: original.cabinets.map((x) =>
      x.id === c.id ? { ...x, height: 230 } : x,
    ),
  };
  expect(useDesigner.getState().edit(grown, catalog)).toBe(true);
  expect(grown.cabinets[1].interior).toEqual(custom.interior);
  const invalid = withInterior({ ...custom, height: 230 }, [
    { ...custom.interior!.components[0], yCm: 101 },
  ]);
  expect(
    validateInterior(invalid, m, catalog).some(
      (i) => i.code === "interiorMountError",
    ),
  ).toBe(true);
});

it("keeps decorative folds on their supporting shelf after materializing inventory", () => {
  const catalog = load("default"),
    d = materialize(fixture(catalog), catalog),
    c = d.cabinets[1],
    m = catalog.modules.find((m) => m.id === c.moduleId)!;
  const contents = storagePopulation(c, m, storageMeasurements(c, m, catalog));
  expect(contents.some((i) => i.id === "fold")).toBe(true);
});
