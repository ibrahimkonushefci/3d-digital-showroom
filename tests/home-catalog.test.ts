import { expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { CatalogSchema, DesignSchema } from "../src/catalog/types";
import { homeCatalog, applyCatalogLook } from "../src/app/homeCatalog";
import { presentationPresets } from "../src/designer3d/presets";
import { KITCHEN_THEMES } from "../src/designer3d/looks";
import { validateDesign } from "../src/designer3d/layout";
import { validateFinishReferences } from "../src/designer3d/finishes";
import { calculatePrice } from "../src/pricing";

for (const slug of ["default", "druri-design"]) {
  const catalog = CatalogSchema.parse(
    JSON.parse(readFileSync(`public/brands/${slug}/catalog.json`, "utf8")),
  );
  it(`${slug}: all nine catalog looks are valid, priced configurations with local pictures`, () => {
    const entries = homeCatalog(catalog);
    expect(entries.filter((p) => p.design.kind === "kitchen")).toHaveLength(6);
    expect(entries.filter((p) => p.design.kind === "wardrobe")).toHaveLength(3);
    for (const entry of entries) {
      expect(DesignSchema.safeParse(entry.design).success).toBe(true);
      expect(validateDesign(entry.design, catalog)).toBe(true);
      expect(validateFinishReferences(entry.design, catalog)).toEqual([]);
      expect(calculatePrice(entry.design, catalog, "en").total).toBeGreaterThan(
        0,
      );
      expect(existsSync(`public/${entry.thumbnail}`)).toBe(true);
    }
  });
  it(`${slug}: finish editions retain the prepared furniture and leave their source intact`, () => {
    const source = presentationPresets(catalog)[0].design;
    const before = JSON.stringify(source);
    const result = applyCatalogLook(
      source,
      KITCHEN_THEMES.find((l) => l.id === "sage")!,
    );
    expect(result.cabinets).toEqual(source.cabinets);
    expect(result.room).toEqual(source.room);
    expect(result.presentation).toEqual(source.presentation);
    expect(result.style.front).toBe("sage");
    expect(result.finishZones).toBeUndefined();
    expect(result.worktopFinishes).toBeUndefined();
    expect(JSON.stringify(source)).toBe(before);
  });
  it(`${slug}: an unavailable decor omits its finish edition`, () => {
    const limited = {
      ...catalog,
      fronts: catalog.fronts.filter((f) => f.id !== "sage"),
    };
    expect(homeCatalog(limited).some((p) => p.id === "home-sage")).toBe(false);
  });
}
