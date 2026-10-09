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
import { calculatePrice, windowPrice } from "../src/pricing";
import {
  homography,
  inverse,
  transform,
  validCorners,
  type Corners,
} from "../src/doorPreview/homography";
import { decodeShare, encodeShare, messageUrl } from "../src/sharing";
import { resolveBrand } from "../src/brand";
import { useDesigner } from "../src/designer3d/store";
import { money } from "../src/i18n";
import { SavedPhotoSchema } from "../src/doorPreview/types";
const catalog = CatalogSchema.parse(
    JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
  ),
  brand = BrandSchema.parse(
    JSON.parse(readFileSync("public/brands/default/brand.json", "utf8")),
  );
describe("catalog and branding", () => {
  it("loads all demo brands and catalogs", () => {
    for (const slug of ["default", "druri-design", "drita-home"]) {
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
        ).doors,
      ).toHaveLength(slug === "druri-design" ? 0 : 7);
    }
  });
  it("uses query before configured subdomain and environment", () => {
    expect(
      resolveBrand(
        "?brand=druri-design",
        "drita-home.example.com",
        "default",
        "example.com",
      ),
    ).toBe("druri-design");
    expect(
      resolveBrand("", "drita-home.example.com", "druri-design", "example.com"),
    ).toBe("drita-home");
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
  for (const layout of ["straight", "l", "u", "parallel", "island"] as Layout[])
    it(`fits ${layout} kitchens without collisions`, () => {
      const d = generateLayout(newDesign("kitchen", layout), catalog);
      expect(d).not.toBeNull();
      expect(validateDesign(d!, catalog)).toBe(true);
      expect(d!.cabinets.some((c) => c.level === "wall")).toBe(true);
    });
  for (const layout of ["straight", "corner", "walkin"] as Layout[])
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
  it("rejects a parallel layout with insufficient aisle space", () => {
    const d = newDesign("kitchen", "parallel");
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
  it("honors window area and minimum prices", () => {
    const model = catalog.windows[1];
    expect(windowPrice(model, 120, 140)).toBeCloseTo(
      1.68 * model.perSquareMeter,
    );
    expect(windowPrice(model, 20, 20)).toBe(model.minimumPrice);
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
  it("round-trips a design and basic branding without a photo or logo", () => {
    const d = examples(catalog)[0];
    const encoded = encodeShare(
      d,
      { ...brand, companyName: "Test Studio" },
      catalog.id,
      true,
    );
    const decoded = decodeShare(encoded);
    expect(decoded.design).toEqual(d);
    expect(decoded.brand!.companyName).toBe("Test Studio");
    expect(decoded.brand).not.toHaveProperty("logo");
    expect(decoded).not.toHaveProperty("photo");
  });
  it("rejects malformed and oversized links", () => {
    expect(() => decodeShare("invalid")).toThrow();
    expect(() => decodeShare("x".repeat(31000))).toThrow();
  });
  it("does not invent a company message destination", () => {
    expect(messageUrl("whatsapp", brand, "test")).toBe(
      "https://wa.me/?text=test",
    );
    expect(
      messageUrl(
        "whatsapp",
        {
          ...brand,
          contact: { ...brand.contact, whatsapp: "+383 44 123 456" },
        },
        "Hello there",
      ),
    ).toBe("https://wa.me/38344123456?text=Hello%20there");
  });
});
describe("perspective transform", () => {
  const corners: Corners = [
    { x: 0.2, y: 0.1 },
    { x: 0.8, y: 0.2 },
    { x: 0.9, y: 0.85 },
    { x: 0.15, y: 0.9 },
  ];
  it("maps all four source corners to their exact destinations", () => {
    const h = homography(corners);
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ].forEach((p, i) => {
      const q = transform(h, p);
      expect(q.x).toBeCloseTo(corners[i].x, 9);
      expect(q.y).toBeCloseTo(corners[i].y, 9);
    });
  });
  it("round-trips interior points through the inverse", () => {
    const h = homography(corners),
      p = { x: 0.35, y: 0.65 };
    const q = transform(inverse(h), transform(h, p));
    expect(q.x).toBeCloseTo(p.x, 9);
    expect(q.y).toBeCloseTo(p.y, 9);
  });
  it("rejects crossed, tiny and out-of-bounds corners", () => {
    expect(validCorners([corners[0], corners[2], corners[1], corners[3]])).toBe(
      false,
    );
    expect(
      validCorners([
        { x: 0, y: 0 },
        { x: 0.01, y: 0 },
        { x: 0.01, y: 0.01 },
        { x: 0, y: 0.01 },
      ]),
    ).toBe(false);
    expect(() =>
      homography([
        { x: -0.1, y: 0 },
        { x: 0.5, y: 0 },
        { x: 0.5, y: 0.5 },
        { x: 0, y: 0.5 },
      ]),
    ).toThrow();
  });
});

describe("saved photo validation", () => {
  it("rejects remote photos and malformed placements", () => {
    expect(
      SavedPhotoSchema.safeParse({
        photo: "https://example.com/photo.jpg",
        placements: [],
      }).success,
    ).toBe(false);
    expect(
      SavedPhotoSchema.safeParse({
        photo: "data:image/jpeg;base64,AA",
        placements: [{ kind: "door" }],
      }).success,
    ).toBe(false);
  });
});
