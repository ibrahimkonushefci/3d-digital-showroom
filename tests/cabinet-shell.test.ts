import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CatalogSchema } from "../src/catalog/types";
import { shellPanels, shellGeometry } from "../src/scene/CabinetShell";
import { construction } from "../src/scene/construction";
const catalog = CatalogSchema.parse(
  JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
);
it("batches without changing carcass bounds, back recess, UV variation or AO channel", () => {
  const material = catalog.carcasses.find((m) => m.id === "oak")!;
  for (const [w, h, d] of [
    [0.4, 0.72, 0.6],
    [0.9, 0.72, 0.6],
    [0.8, 2.3, 0.6],
  ]) {
    const panels = shellPanels(w, h, d),
      g = shellGeometry(panels, material, "fixed-cabinet");
    g.computeBoundingBox();
    expect(g.boundingBox!.min.x).toBeCloseTo(-w / 2, 6);
    expect(g.boundingBox!.max.x).toBeCloseTo(w / 2, 6);
    expect(g.boundingBox!.min.y).toBeCloseTo(0, 6);
    expect(g.boundingBox!.max.y).toBeCloseTo(h, 6);
    const back = panels.find((p) => p.role === "back")!;
    expect(back.size[2]).toBe(construction.back);
    expect(back.position[2]).toBe(-d / 2 + construction.backInset);
    expect(g.groups).toEqual([]);
    expect(Array.from(g.getAttribute("uv1").array)).toEqual(
      Array.from(g.getAttribute("uv").array),
    );
    const again = shellGeometry(panels, material, "fixed-cabinet"),
      other = shellGeometry(panels, material, "other-cabinet");
    expect(Array.from(again.getAttribute("uv").array)).toEqual(
      Array.from(g.getAttribute("uv").array),
    );
    expect(Array.from(other.getAttribute("uv").array)).not.toEqual(
      Array.from(g.getAttribute("uv").array),
    );
    expect(Array.from(other.getAttribute("position").array)).toEqual(
      Array.from(g.getAttribute("position").array),
    );
    g.dispose();
    again.dispose();
    other.dispose();
  }
  expect(shellPanels(0.6, 0.72, 0.6, true).map((p) => p.role)).not.toContain(
    "top",
  );
});
