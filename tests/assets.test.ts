import { expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { CatalogSchema } from "../src/catalog/types";
it("retains all furniture environment maps and presentation thumbnails", () => {
  for (const surface of ["laminate", "tiles", "concrete"])
    for (const map of ["color", "normal", "roughness"])
      expect(existsSync(`public/shared/textures/${surface}-${map}.webp`)).toBe(
        true,
      );
  for (const slug of ["default", "druri-design"]) {
    const c = CatalogSchema.parse(
      JSON.parse(readFileSync(`public/brands/${slug}/catalog.json`, "utf8")),
    );
    for (const preset of c.presentationPresets || [])
      expect(existsSync(`public/${preset.thumbnail}`)).toBe(true);
  }
});
it("keeps every catalog material local with existing normal and roughness maps", () => {
  for (const brand of ["default", "druri-design"]) {
    const c = CatalogSchema.parse(
      JSON.parse(readFileSync(`public/brands/${brand}/catalog.json`, "utf8")),
    );
    for (const m of [
      ...c.fronts,
      ...c.carcasses,
      ...c.countertops,
      ...c.backsplashes,
      ...c.plinths,
    ]) {
      expect(m.normalMap).toBeTruthy();
      expect(m.roughnessMap).toBeTruthy();
      for (const path of [
        m.texture,
        m.normalMap,
        m.roughnessMap,
        m.aoMap,
      ].filter(Boolean) as string[])
        expect(
          existsSync(
            path.startsWith("shared/")
              ? `public/${path}`
              : `public/brands/${brand}/${path}`,
          ),
        ).toBe(true);
    }
  }
});
it("declares authored physical scales, response and matching relationships for both illustrative catalogs", () => {
  for (const brand of ["default", "druri-design"]) {
    const c = CatalogSchema.parse(
      JSON.parse(readFileSync(`public/brands/${brand}/catalog.json`, "utf8")),
    );
    for (const m of [
      ...c.fronts,
      ...c.carcasses,
      ...c.countertops,
      ...c.plinths,
      ...c.backsplashes,
    ]) {
      expect(m.mapping?.scaleBasis).toBe("authored-illustrative");
      expect(m.response).toBeDefined();
      if (m.supplier) expect(m.supplier.appearance).toBe("illustrative");
    }
    expect(c.plinths.find((m) => m.id === "matching")?.matches).toBe("front");
    expect(c.fronts.find((m) => m.id === "oak")?.mapping?.sourceGrain).toBe(
      "horizontal",
    );
    expect(c.fronts.find((m) => m.id === "walnut")?.mapping?.sourceGrain).toBe(
      "vertical",
    );
    expect(c.backsplashes.find((m) => m.id === "stone")?.matches).toBe(
      "countertop",
    );
  }
});
