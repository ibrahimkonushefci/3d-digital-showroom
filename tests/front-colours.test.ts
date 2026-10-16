import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CatalogSchema } from "../src/catalog/types";
import { colourGroups } from "../src/designer3d/frontColours";

for (const brand of ["default", "druri-design"]) {
  const catalog = CatalogSchema.parse(
    JSON.parse(readFileSync(`public/brands/${brand}/catalog.json`, "utf8")),
  );
  describe(`${brand} front colours`, () => {
    it("offers every finish once, grouped by how it looks", () => {
      const groups = colourGroups(catalog, "en");
      const ids = groups.flatMap((g) => g.items.map((i) => i.front.id));
      expect(ids.sort()).toEqual(catalog.fronts.map((f) => f.id).sort());
      // Fewer colour choices than finishes; each colour looks the same in
      // every material it comes in.
      expect(groups.length).toBeLessThan(catalog.fronts.length);
      for (const g of groups)
        expect(
          new Set(g.items.map((i) => i.front.color.toLowerCase())).size,
        ).toBe(1);
      // The five solid colours each come in all five materials, cheapest first.
      const cashmere = groups.find((g) => g.name === "Cashmere")!;
      expect(cashmere.items.map((i) => i.tier?.id)).toEqual([
        "iverall",
        "foil",
        "lacquer",
        "acrylic",
        "fenix",
      ]);
      // Supplier codes stay out of colour names.
      expect(groups.every((g) => !/^[A-Z]\d{3}/.test(g.name))).toBe(true);
    });
  });
}
