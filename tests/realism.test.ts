import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CatalogSchema } from "../src/catalog/types";
import {
  newDesign,
  generateLayout,
  hobCabinet,
  wallOffset,
} from "../src/designer3d/layout";
const c = CatalogSchema.parse(
  JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
);
it("places a hood over a hob with cabinets on both sides and avoids a window", () => {
  const d = generateLayout(newDesign("kitchen", "l"), c)!;
  const hob = hobCabinet(d, c)!;
  expect(hob).toBeDefined();
  expect(
    d.cabinets.some(
      (p) =>
        p.moduleId === "wall-hood" &&
        p.wall === hob.wall &&
        Math.abs(wallOffset(p) - wallOffset(hob)) < 1,
    ),
  ).toBe(true);
  d.room.openings = [
    {
      id: "window",
      wall: hob.wall as "back",
      type: "window",
      offset: wallOffset(hob),
      width: hob.width,
      height: 90,
      sill: 110,
    },
  ];
  expect(hobCabinet(d, c)?.id).not.toBe(hob.id);
});
import { storageMeasurements } from "../src/designer3d/storage";
import {
  countertopThickness,
  furnitureResponse,
} from "../src/scene/furnitureMaterials";
import { presentationPresets } from "../src/designer3d/presets";
it("shares safe storage measurements at changed wardrobe heights", () => {
  for (const p of presentationPresets(c).filter(
    (p) => p.design.kind === "wardrobe",
  ))
    for (const cabinet of p.design.cabinets) {
      const m = c.modules.find((m) => m.id === cabinet.moduleId)!;
      const s = storageMeasurements({ ...cabinet, height: 180 }, m);
      expect(s.width).toBeCloseTo(cabinet.width / 100 - 0.036);
      expect(s.depth).toBeCloseTo(cabinet.depth / 100 - 0.035);
      expect(s.shelves.every((y) => y < 1.8)).toBe(true);
      expect(s.clearances.every((y) => y > 0)).toBe(true);
    }
});
it("renders catalog thickness and visibly differentiated furniture responses", () => {
  const d = presentationPresets(c)[0].design;
  for (const [id, metres] of [
    ["marble", 0.038],
    ["travertine", 0.012],
    ["quartz", 0.02],
    ["granite", 0.02],
  ] as const)
    expect(
      countertopThickness({ ...d, style: { ...d.style, countertop: id } }, c),
    ).toBe(metres);
  const matte = c.fronts.find((m) => m.tier === "fenix")!,
    gloss = c.fronts.find((m) => m.tier === "acrylic")!;
  expect(
    furnitureResponse(matte).roughness - furnitureResponse(gloss).roughness,
  ).toBeGreaterThan(0.5);
});
