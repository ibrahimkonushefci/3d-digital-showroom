import { afterEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { BrandSchema, CatalogSchema } from "../src/catalog/types";
import { presentationPresets } from "../src/designer3d/presets";
import { presetComponents, withInterior } from "../src/designer3d/interiors";
import { createOffer } from "../src/documents/offer";
import { translate } from "../src/i18n";
afterEach(() => vi.unstubAllGlobals());
for (const slug of ["default", "druri-design"])
  it(`${slug}: paginates interior inventory and signed credit lines in SQ/EN/DE`, async () => {
    const catalog = CatalogSchema.parse(
      JSON.parse(readFileSync(`public/brands/${slug}/catalog.json`, "utf8")),
    );
    const brand = BrandSchema.parse(
      JSON.parse(readFileSync(`public/brands/${slug}/brand.json`, "utf8")),
    );
    const design = structuredClone(
      presentationPresets(catalog).find((p) => p.id === "wardrobe-straight")!
        .design,
    );
    const c = design.cabinets[1],
      m = catalog.modules.find((m) => m.id === c.moduleId)!;
    m.interiorPricing!.removalCredits = { "storage-shelf": 10 };
    m.interiorPricing!.includedAllowance = 30;
    const list = presetComponents(c, m, catalog).slice(1);
    design.cabinets[1] = withInterior(c, [
      ...list,
      { id: `${c.id}:basket`, productId: "storage-basket", yCm: 0 },
    ]);
    design.cabinets[0] = withInterior(design.cabinets[0], []);
    vi.stubGlobal("fetch", async (url: string) => {
      const b = readFileSync("public" + url);
      return {
        arrayBuffer: async () =>
          b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
      };
    });
    for (const language of ["sq", "en", "de"] as const) {
      const doc = await createOffer({
        design,
        brand,
        catalog,
        language,
        screenshot: null,
        logoUrl: "missing",
        t: (k, v) => translate(language, k, v),
      });
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
      expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(10000);
    }
  });
