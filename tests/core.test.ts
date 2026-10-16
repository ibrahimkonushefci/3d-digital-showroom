import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  BrandSchema,
  CatalogSchema,
  DesignSchema,
  type Layout,
} from "../src/catalog/types";
import {
  bounds,
  examples,
  generateLayout,
  newDesign,
  validateDesign,
  wallPosition,
} from "../src/designer3d/layout";
import { calculatePrice } from "../src/pricing";
import { resolveBrand } from "../src/brand";
import { useDesigner } from "../src/designer3d/store";
import { money } from "../src/i18n";
const catalog = CatalogSchema.parse(
    JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
  ),
  brand = BrandSchema.parse(
    JSON.parse(readFileSync("public/brands/default/brand.json", "utf8")),
  );
describe("catalog and branding", () => {
  it("loads existing furniture branding while discarding obsolete module flags", () => {
    const parsed = BrandSchema.parse({
      ...brand,
      modules: { ...brand.modules, doorPreview: true, interiorDesigner: true },
    });
    expect(parsed.modules).toEqual({
      kitchenDesigner: true,
      wardrobeDesigner: true,
    });
  });
  it("loads all demo brands and catalogs", () => {
    for (const slug of ["default", "druri-design"]) {
      expect(
        BrandSchema.parse(
          JSON.parse(readFileSync(`public/brands/${slug}/brand.json`, "utf8")),
        ).slug,
      ).toBe(slug);
      expect(
        CatalogSchema.parse(
          JSON.parse(
            readFileSync(`public/brands/${slug}/catalog.json`, "utf8"),
          ),
        ).modules,
      ).not.toHaveLength(0);
    }
  });
  it("uses query before configured subdomain and environment", () => {
    expect(
      resolveBrand(
        "?brand=druri-design",
        "custom-furniture.example.com",
        "default",
        "example.com",
      ),
    ).toBe("druri-design");
    expect(
      resolveBrand(
        "",
        "custom-furniture.example.com",
        "druri-design",
        "example.com",
      ),
    ).toBe("custom-furniture");
    expect(resolveBrand("", "localhost", "druri-design")).toBe("druri-design");
  });
  it("rejects unsafe asset paths and invalid colors", () => {
    expect(BrandSchema.safeParse({ ...brand, logo: "../secret" }).success).toBe(
      false,
    );
    expect(
      BrandSchema.safeParse({
        ...brand,
        colors: { ...brand.colors, primary: "red" },
      }).success,
    ).toBe(false);
  });
  it("has a translation for every key in every language", () => {
    const languages = ["sq", "en", "de"].map((l) =>
      JSON.parse(readFileSync(`src/i18n/${l}.json`, "utf8")),
    );
    for (const l of languages) {
      expect(Object.keys(l).sort()).toEqual(Object.keys(languages[0]).sort());
      expect(
        Object.values(l).every((v) => typeof v === "string" && v.length),
      ).toBe(true);
    }
  });
  it("formats EUR with locale separators", () => {
    expect(money(1250, "sq")).toBe("1.250 €");
    expect(money(1250, "de")).toBe("1.250 €");
    expect(money(1250, "en")).toBe("1,250 €");
  });
});
describe("room layouts", () => {
  for (const layout of ["straight", "l", "island"] as Layout[])
    it(`fits ${layout} kitchens without collisions`, () => {
      const d = generateLayout(newDesign("kitchen", layout), catalog);
      expect(d).not.toBeNull();
      expect(validateDesign(d!, catalog)).toBe(true);
      expect(d!.cabinets.some((c) => c.level === "wall")).toBe(true);
    });
  for (const layout of ["straight", "corner"] as Layout[])
    it(`fits ${layout} wardrobes`, () => {
      const d = generateLayout(newDesign("wardrobe", layout), catalog)!;
      expect(d).not.toBeNull();
      expect(d.cabinets.every((c) => c.level === "wardrobe")).toBe(true);
      expect(validateDesign(d, catalog)).toBe(true);
    });
  it("keeps every preset valid", () => {
    expect(examples(catalog)).toHaveLength(4);
    for (const d of examples(catalog)) {
      expect(DesignSchema.safeParse(d).success).toBe(true);
      expect(validateDesign(d, catalog)).toBe(true);
    }
  });
  it("rejects an island kitchen with insufficient aisle space", () => {
    const d = newDesign("kitchen", "island");
    d.room.depth = 200;
    expect(generateLayout(d, catalog)).toBeNull();
  });
  it("does not fill cabinets into door openings", () => {
    const d = newDesign("kitchen", "straight");
    d.room.openings = [
      {
        id: "door",
        wall: "back",
        type: "door",
        offset: 120,
        width: 100,
        height: 210,
        sill: 0,
      },
    ];
    const generated = generateLayout(d, catalog)!;
    expect(validateDesign(generated, catalog)).toBe(true);
    expect(
      generated.cabinets
        .filter((c) => c.wall === "back")
        .every((c) => {
          const b = bounds(c);
          return b.x1 <= 120 || b.x0 >= 220;
        }),
    ).toBe(true);
  });
  it("allows bases below a window but excludes upper cabinets there", () => {
    const d = newDesign("kitchen", "straight");
    d.room.openings = [
      {
        id: "window",
        wall: "back",
        type: "window",
        offset: 120,
        width: 120,
        height: 100,
        sill: 100,
      },
    ];
    const generated = generateLayout(d, catalog)!;
    expect(
      generated.cabinets.some(
        (c) => c.level === "base" && c.x >= 120 && c.x <= 240,
      ),
    ).toBe(true);
    expect(
      generated.cabinets
        .filter((c) => c.level === "wall")
        .every((c) => {
          const b = bounds(c);
          return b.x1 <= 120 || b.x0 >= 240;
        }),
    ).toBe(true);
  });
  it("rejects overlapping or out-of-wall edits", () => {
    const d = examples(catalog)[0];
    const overlap = structuredClone(d);
    overlap.cabinets.push({ ...d.cabinets[0], id: "overlap" });
    expect(validateDesign(overlap, catalog)).toBe(false);
    const outside = structuredClone(d);
    outside.cabinets[0].x = -50;
    expect(validateDesign(outside, catalog)).toBe(false);
  });
  it("rejects unsupported modules and finishes in shared data", () => {
    const d = examples(catalog)[0];
    expect(
      validateDesign(
        { ...d, style: { ...d.style, front: "missing" } },
        catalog,
      ),
    ).toBe(false);
    expect(
      validateDesign(
        { ...d, cabinets: [{ ...d.cabinets[0], moduleId: "missing" }] },
        catalog,
      ),
    ).toBe(false);
  });
  it("maps wall placements consistently", () => {
    expect(wallPosition("left", 100, 60, 60, newDesign().room)).toEqual({
      x: 30,
      z: 130,
      rotation: Math.PI / 2,
    });
    expect(wallPosition("right", 100, 60, 60, newDesign().room).x).toBe(390);
  });
});
describe("pricing", () => {
  it("calculates module, accessory, countertop, handles, LED, installation and VAT from catalog", () => {
    const d = newDesign("kitchen", "straight");
    const m = catalog.modules.find((m) => m.id === "base-drawers")!;
    d.cabinets = [
      {
        id: "one",
        moduleId: m.id,
        width: 60,
        height: 72,
        depth: 60,
        level: "base",
        wall: "back",
        ...wallPosition("back", 0, 60, 60, d.room),
      },
    ];
    d.style.front = "gloss";
    d.style.handle = "bar";
    d.installation = true;
    d.vat = true;
    const p = calculatePrice(d, catalog, "en");
    const expected = 330 * 0.6 * 1.25 + 35 + 150 * 0.6 + 3 * 9 + 12 * 0.6;
    expect(p.subtotal).toBeCloseTo(expected);
    expect(p.total).toBeCloseTo(expected * 1.08 * 1.18);
    expect(p.low).toBeCloseTo(p.total * 0.93);
    expect(p.high).toBeCloseTo(p.total * 1.07);
  });
  it("applies catalog carcass, panel and plinth rates", () => {
    const d = examples(catalog)[0],
      next = structuredClone(catalog);
    next.carcasses.find((m) => m.id === d.style.carcass)!.multiplier = 1.5;
    next.plinths.find((m) => m.id === d.style.plinth)!.perMeter = 50;
    next.pricing.panelMultiplier = 1.2;
    const price = calculatePrice(
      { ...d, style: { ...d.style, profile: "panel" } },
      next,
      "en",
    );
    expect(price.total).toBeGreaterThan(calculatePrice(d, catalog, "en").total);
    expect(price.lines.find((l) => l.id === "plinth")!.amount).toBeCloseTo(
      price.lines.find((l) => l.id === "plinth")!.quantity * 50,
    );
  });
  it("responds to edited catalog prices without changing code", () => {
    const d = examples(catalog)[0],
      next = structuredClone(catalog);
    next.pricing.ledPerMeter += 100;
    expect(calculatePrice(d, next, "en").total).toBeGreaterThan(
      calculatePrice(d, catalog, "en").total,
    );
  });
});
describe("history and sharing", () => {
  beforeEach(() => useDesigner.getState().setDesign(examples(catalog)[0]));
  it("preserves previous design on a rejected edit", () => {
    const old = useDesigner.getState().design!;
    const changed = structuredClone(old);
    changed.cabinets[0].x = -100;
    expect(useDesigner.getState().edit(changed, catalog)).toBe(false);
    expect(useDesigner.getState().design).toEqual(old);
    expect(useDesigner.getState().past).toHaveLength(0);
  });
  it("undoes and redoes a valid change", () => {
    const d = useDesigner.getState().design!;
    useDesigner
      .getState()
      .edit({ ...d, style: { ...d.style, front: "sage" } }, catalog);
    useDesigner.getState().undo();
    expect(useDesigner.getState().design!.style.front).toBe(d.style.front);
    useDesigner.getState().redo();
    expect(useDesigner.getState().design!.style.front).toBe("sage");
  });
});
import { selectFamily } from "../src/scene/furnitureMaterials";
it("selects only a family-listed available decor, retaining compatible choices", () => {
  const items = [
    { id: "a" },
    { id: "b" },
  ] as import("../src/catalog/types").Material[];
  expect(selectFamily("b", ["a", "b"], items)).toBe("b");
  expect(selectFamily("old", ["missing", "a", "b"], items)).toBe("a");
});
