import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { BrandSchema, CatalogSchema, DesignSchema } from "../src/catalog/types";
import { presentationPresets } from "../src/designer3d/presets";
import { validateDesign } from "../src/designer3d/layout";
import { calculatePrice } from "../src/pricing";
import { loadDesign } from "../src/persistence";
import { assembleRenderInput } from "../src/scene/renderInput";

for (const slug of ["default", "druri-design"]) {
  const fixture = JSON.parse(
    readFileSync(`tests/fixtures/realism/${slug}.json`, "utf8"),
  );
  const catalog = CatalogSchema.parse(
    JSON.parse(readFileSync(`public/brands/${slug}/catalog.json`, "utf8")),
  );
  const brand = BrandSchema.parse(fixture.brand);
  describe(`frozen ${slug} compatibility`, () => {
    it("preserves five preset layouts, dimensions, IDs, resolved products and exact SQ/EN/DE line prices", () => {
      const current = presentationPresets(catalog);
      expect(current).toHaveLength(5);
      for (const preset of fixture.presets) {
        const design = DesignSchema.parse(preset.design);
        expect(validateDesign(design, catalog)).toBe(true);
        const live = current.find((p) => p.id === preset.id)!;
        const normalized = {
          ...live.design,
          // Phase 2 adds only an explicit preset window; frozen customer designs
          // keep their exact original openings. All furniture/state stays equal.
          room: { ...live.design.room, openings: design.room.openings },
          // Phase 2 (second round) gives the prepared designs new default
          // finishes, floor and wall colour; furniture and layout stay frozen.
          style: design.style,
          environment: design.environment,
          finishZones: design.finishZones,
          id: design.id,
          cabinets: live.design.cabinets.map((c, i) => ({
            ...c,
            id: design.cabinets[i].id,
          })),
        };
        expect(normalized).toEqual(design);
        expect(validateDesign(live.design, catalog)).toBe(true);
        for (const lang of ["sq", "en", "de"] as const) {
          expect(calculatePrice(design, catalog, lang)).toEqual(
            preset.prices[lang],
          );
          expect(
            calculatePrice(
              { ...live.design, style: design.style, finishZones: design.finishZones },
              catalog,
              lang,
            ),
          ).toEqual(preset.prices[lang]);
          const input = assembleRenderInput(design, catalog);
          expect(
            calculatePrice(
              input.commercial.design,
              input.commercial.catalog,
              lang,
            ),
          ).toEqual(preset.prices[lang]);
        }
        expect(
          assembleRenderInput(design, catalog).furniture.cabinets.map(
            (c) => c.cabinet.id,
          ),
        ).toEqual(design.cabinets.map((c) => c.id));
      }
    });
    it("reads v1 and v2 through persistence without regenerating or writing the draft", () => {
      for (const raw of [fixture.v1, fixture.v2]) {
        const original = JSON.stringify(raw);
        const setItem = vi.fn();
        vi.stubGlobal("localStorage", {
          getItem: (key: string) =>
            key === `showroom-design-${slug}-kitchen` ? original : null,
          setItem,
        });
        try {
          const loaded = loadDesign(slug, "kitchen", catalog)!;
          expect(loaded).toEqual(DesignSchema.parse(raw));
          expect(loaded.cabinets).toEqual(raw.cabinets);
          expect(setItem).not.toHaveBeenCalled();
          expect(loadDesign(`${slug}-other`, "kitchen", catalog)).toBeNull();
        } finally {
          vi.unstubAllGlobals();
        }
      }
      expect(
        DesignSchema.safeParse({ ...fixture.v2, version: 4 }).success,
      ).toBe(false);
    });
    it("keeps private offer details out of the picture and the quote", () => {
      const offer = {
        number: "TEST",
        date: "2026-10-13",
        validityDays: 15,
        customer: { name: "Synthetic fixture", phone: "", city: "" },
        salesperson: "",
        paymentTerms: "",
        notes: "PRIVATE-FIXTURE",
        discountPercent: 7,
      };
      const design = { ...DesignSchema.parse(fixture.v2), offer };
      const input = assembleRenderInput(
        design,
        catalog,
        undefined,
        "lightweight",
      );
      expect(input.commercial.design.offer).toEqual(offer);
      expect(input.furniture.style.front.id).toBe(design.style.front);
      expect(calculatePrice(input.commercial.design, catalog, "de")).toEqual(
        calculatePrice(design, catalog, "de"),
      );
    });
    it("rejects unresolved furniture references and presentation quality never alters the quote", () => {
      const design = DesignSchema.parse(fixture.v2);
      for (const quality of ["lightweight", "balanced", "high"] as const) {
        const input = assembleRenderInput(design, catalog, undefined, quality);
        expect(calculatePrice(input.commercial.design, catalog, "en")).toEqual(
          fixture.presets[0].prices.en,
        );
        expect(input.presentation).not.toHaveProperty("offer");
      }
      expect(() =>
        assembleRenderInput(
          { ...design, style: { ...design.style, front: "missing" } },
          catalog,
        ),
      ).toThrow("Unresolved furniture product");
      expect(() =>
        assembleRenderInput(
          {
            ...design,
            cabinets: [{ ...design.cabinets[0], moduleId: "missing" }],
          },
          catalog,
        ),
      ).toThrow("Unresolved furniture module");
    });
  });
}
