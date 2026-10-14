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
  matchingAppearance,
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
      expect(s.depth).toBeCloseTo(cabinet.depth / 100 - 0.075);
      expect(s.shelves.every((y) => y < 1.8)).toBe(true);
      expect(s.clearances.every((y) => y > 0)).toBe(true);
    }
});
import { drawerConstruction, construction } from "../src/scene/construction";
import { resolveFurnitureStyle } from "../src/scene/renderInput";
it("keeps drawer bodies, backs and moving extensions within their procedural cabinet clearances", () => {
  for (const w of [0.4, 0.6, 0.9])
    for (const h of [0.22, 0.24])
      for (const d of [0.35, 0.56, 0.6]) {
        const b = drawerConstruction(w, h, d);
        expect(b.outerWidth / 2).toBeLessThan(w / 2 - construction.panel);
        expect(d / 2 + 0.012 + b.backZ - b.side / 2).toBeGreaterThan(
          -d / 2 + construction.backInset + construction.back / 2,
        );
        expect(b.bottomY - b.bottom / 2 + h / 2).toBeGreaterThan(
          construction.panel,
        );
        expect(b.sideY + b.sideHeight / 2).toBeLessThan(h / 2);
        expect(b.extension).toBeLessThan(b.bodyDepth);
      }
});
it("resolves matching appearances while retaining separate priced records and deliberate matt/gloss responses", () => {
  const d = presentationPresets(c)[0].design;
  const style = resolveFurnitureStyle(
    {
      ...d,
      style: {
        ...d.style,
        front: "oak",
        plinth: "matching",
        backsplash: "stone",
      },
    },
    c,
  );
  expect(style.plinth.id).toBe("matching");
  expect(style.plinthAppearance).toBe(style.front);
  expect(style.backsplash.id).toBe("stone");
  expect(style.backsplashAppearance).toBe(style.countertop);
  const black = c.plinths.find((m) => m.id === "black")!;
  expect(matchingAppearance(black, style.front, style.countertop)).toBe(black);
  const matt = furnitureResponse(
    c.fronts.find((m) => m.id === "lacquer-white")!,
  );
  const acrylic = furnitureResponse(
    c.fronts.find((m) => m.id === "acrylic-white")!,
  );
  expect(matt.roughness).toBeGreaterThan(0.7);
  expect(matt.clearcoat).toBeLessThan(0.05);
  expect(acrylic.roughness).toBeLessThan(0.25);
  expect(acrylic.clearcoat).toBeGreaterThan(0.5);
});
it("preserves the response of a metadata-less older material", () => {
  const lacquer = c.fronts.find((m) => m.id === "lacquer-white")!;
  const { response: _response, mapping: _mapping, ...legacy } = lacquer;
  expect(furnitureResponse(legacy)).toMatchObject({
    roughness: 0.32,
    clearcoat: 0.85,
    normalStrength: 0.25,
  });
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
