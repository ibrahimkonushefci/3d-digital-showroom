import { expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { CatalogSchema } from "../src/catalog/types";
it("keeps every catalog material local with existing normal and roughness maps", () => {
  for (const brand of ["default", "druri-design", "drita-home"]) {
    const c = CatalogSchema.parse(
      JSON.parse(readFileSync(`public/brands/${brand}/catalog.json`, "utf8")),
    );
    for (const m of [
      ...c.fronts,
      ...c.carcasses,
      ...c.countertops,
      ...c.backsplashes,
      ...c.plinths,
      ...c.productFinishes,
      ...c.laminates,
    ]) {
      expect(m.normalMap).toBeTruthy();
      expect(m.roughnessMap).toBeTruthy();
      for (const path of [m.texture, m.normalMap, m.roughnessMap].filter(
        Boolean,
      ) as string[])
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
it("ships scene-specific material paths and distinct legacy stone/marble files", () => {
  const source = readFileSync("src/doorPreview/House.tsx", "utf8");
  for (const path of source.matchAll(/shared\/textures\/[a-z0-9-]+\.webp/g))
    expect(existsSync(`public/${path[0]}`)).toBe(true);
  expect(
    readFileSync("public/shared/textures/stone.jpg").equals(
      readFileSync("public/shared/textures/marble.jpg"),
    ),
  ).toBe(false);
});
