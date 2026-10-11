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
it("selects actual configuration finishes across every offer kind", () => {
  for (const p of presentationPresets(c))
    expect(proposalFinishes(p.design, c)[0].id).toBe(p.design.style.front);
});
it("exports multilingual proposals without an image, paginating lengthy offer details", async () => {
  const bytes = readFileSync("public/shared/fonts/DejaVuSans.ttf");
  vi.stubGlobal("fetch", async () => ({
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }));
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
  const bytes = readFileSync("public/shared/fonts/DejaVuSans.ttf");
  vi.stubGlobal("fetch", async () => ({
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }));
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
