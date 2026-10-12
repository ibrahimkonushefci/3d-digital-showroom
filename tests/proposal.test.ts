import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createOffer } from "../src/documents/offer";
import { proposalFinishes } from "../src/documents/finishes";
import { CatalogSchema, BrandSchema, DesignSchema } from "../src/catalog/types";
import { presentationPresets } from "../src/designer3d/presets";
import { translate } from "../src/i18n";
const c = CatalogSchema.parse(
    JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
  ),
  b = BrandSchema.parse(
    JSON.parse(readFileSync("public/brands/default/brand.json", "utf8")),
  );
afterEach(() => vi.unstubAllGlobals());
/** Serves the bundled font a request asks for, as the browser would. */
const stubFonts = () =>
  vi.stubGlobal("fetch", async (url: string) => {
    const bytes = readFileSync("public" + url);
    return {
      arrayBuffer: async () =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
    };
  });
it("selects actual configuration finishes across every offer kind", () => {
  for (const p of presentationPresets(c))
    expect(proposalFinishes(p.design, c)[0].id).toBe(p.design.style.front);
});
it("exports multilingual proposals without an image, paginating lengthy offer details", async () => {
  stubFonts();
  const design = DesignSchema.parse({
    ...presentationPresets(c)[0].design,
    offer: {
      number: "SQ-DE-2026-0001",
      date: "2026-10-09",
      validityDays: 15,
      customer: { name: "Ëndrra Müller", phone: "", city: "Prishtinë" },
      salesperson: "Ä Ö Ü Ë Ç",
      paymentTerms: "40%",
      notes: "Dimensionet dhe materialet. ".repeat(50),
    },
  });
  for (const language of ["sq", "en", "de"] as const) {
    const doc = await createOffer({
      design,
      brand: b,
      catalog: c,
      language,
      screenshot: null,
      logoUrl: "missing",
      t: (k, v) => translate(language, k, v),
    });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(10000);
  }
});
it("keeps the representative furniture offers on two pages in SQ, EN and DE", async () => {
  stubFonts();
  for (const language of ["sq", "en", "de"] as const)
    for (const preset of presentationPresets(c).filter((p) =>
      ["japandi", "wardrobe-straight"].includes(p.id),
    )) {
      const doc = await createOffer({
        design: preset.design,
        brand: b,
        catalog: c,
        language,
        screenshot: null,
        logoUrl: "missing",
        t: (k, v) => translate(language, k, v),
      });
      expect(doc.getNumberOfPages()).toBe(2);
    }
});
it("prints every translation and catalog name with glyphs from the subset PDF fonts", () => {
  // Keep in sync with the pyftsubset ranges documented in public/shared/ASSETS.md.
  const ranges = [
    [0x20, 0x7e],
    [0xa0, 0x17f],
    [0x218, 0x21b],
    [0x2010, 0x2015],
    [0x2018, 0x201e],
    [0x2022, 0x2022],
    [0x2026, 0x2026],
    [0x2039, 0x203a],
    [0x20ac, 0x20ac],
    [0x2116, 0x2116],
    [0x2122, 0x2122],
    [0x2212, 0x2212],
  ];
  const missing = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === "string")
      for (const ch of value.replace(/\n/g, ""))
        if (
          !ranges.some(
            ([a, b]) => ch.codePointAt(0)! >= a && ch.codePointAt(0)! <= b,
          )
        )
          missing.add(ch);
        else if (value && typeof value === "object")
          Object.values(value).forEach(walk);
  };
  for (const file of [
    "src/i18n/sq.json",
    "src/i18n/en.json",
    "src/i18n/de.json",
    "public/brands/default/catalog.json",
    "public/brands/default/brand.json",
    "public/brands/druri-design/catalog.json",
    "public/brands/druri-design/brand.json",
  ])
    walk(JSON.parse(readFileSync(file, "utf8")));
  expect([...missing]).toEqual([]);
});
