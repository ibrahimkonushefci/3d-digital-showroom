import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BrandSchema,
  CatalogSchema,
  validateCatalogForBrand,
} from "../src/catalog/types";
import { examples } from "../src/designer3d/layout";
import { saveDesign, restoreSummary } from "../src/persistence";
import { withDemoContacts } from "../src/brand/contacts";
import { messageUrl } from "../src/sharing";
const read = (slug: string, file: string) =>
  JSON.parse(readFileSync(`public/brands/${slug}/${file}.json`, "utf8"));
const catalog = CatalogSchema.parse(read("default", "catalog"));
const brand = BrandSchema.parse(read("default", "brand"));
beforeEach(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
      removeItem: (k: string) => data.delete(k),
    },
  });
});
describe("demo safety", () => {
  it("restores the last saved kind on a fresh summary and honors explicit kind", () => {
    const designs = examples(catalog);
    saveDesign(brand.slug, designs[0]);
    saveDesign(brand.slug, designs[3]);
    expect(restoreSummary(brand.slug, catalog)?.id).toBe(designs[3].id);
    expect(restoreSummary(brand.slug, catalog, "kitchen")?.id).toBe(
      designs[0].id,
    );
    expect(restoreSummary("other", catalog)).toBeNull();
  });
  it("skips corrupt saves without crashing", () => {
    saveDesign(brand.slug, examples(catalog)[0]);
    localStorage.setItem(`showroom-design-${brand.slug}-wardrobe`, "broken");
    localStorage.setItem(`showroom-recent-${brand.slug}`, "wardrobe");
    expect(restoreSummary(brand.slug, catalog)?.kind).toBe("kitchen");
  });
  it("uses demo fallback, preserves configured contacts and never invents a contact", () => {
    expect(withDemoContacts(brand, "+38344123456").contact.whatsapp).toBe(
      "+38344123456",
    );
    expect(
      withDemoContacts({ ...brand, demo: false }, "+38344123456").contact.phone,
    ).toBe("");
    expect(messageUrl("viber", brand, "hello")).toBe(
      "https://wa.me/?text=hello",
    );
    expect(
      messageUrl(
        "whatsapp",
        { ...brand, contact: { ...brand.contact, phone: "+383 44 123456" } },
        "hi",
      ),
    ).toBe("https://wa.me/38344123456?text=hi");
  });
  it("isolates product catalogs and requires sections for enabled tools", () => {
    for (const slug of ["default", "druri-design", "drita-home"]) {
      const c = CatalogSchema.parse(read(slug, "catalog")),
        b = BrandSchema.parse(read(slug, "brand"));
      expect(validateCatalogForBrand(c, b)).toBe(true);
      if (slug === "druri-design") expect(c.doors).toHaveLength(0);
      if (slug === "drita-home") {
        expect(c.modules).toHaveLength(0);
        expect(examples(c)).toEqual([]);
      }
    }
    expect(
      validateCatalogForBrand(
        CatalogSchema.parse({
          ...read("default", "catalog"),
          fronts: undefined,
          frontTiers: [],
        }),
        brand,
      ),
    ).toBe(false);
  });
});
