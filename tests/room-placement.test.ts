import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CatalogSchema, DesignSchema } from "../src/catalog/types";
import { presentationPresets } from "../src/designer3d/presets";
import {
  generateLayout,
  newDesign,
  validateDesign,
} from "../src/designer3d/layout";
import {
  resolveRoom,
  presetRoom,
  openingBlocked,
} from "../src/scene/rooms/resolveRoom";
import {
  freePlacement,
  applianceFits,
  ovenSlot,
  overlaps,
} from "../src/scene/assets/placement";
import { storagePopulation } from "../src/scene/rooms/WardrobePopulation";
import { storageMeasurements } from "../src/designer3d/storage";
import { modelRecord } from "../src/scene/assets/manifest";
const catalog = CatalogSchema.parse(
  JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
);
it("stages only explicit presets, never changes customer openings or furniture/quotes", () => {
  const raw = DesignSchema.parse(
      JSON.parse(readFileSync("tests/fixtures/realism/default.json", "utf8"))
        .v2,
    ),
    before = JSON.stringify(raw);
  expect(resolveRoom(raw).room).toBe(raw.room);
  expect(resolveRoom(raw).room.openings).toEqual([]);
  for (const p of presentationPresets(catalog)) {
    expect(validateDesign(p.design, catalog)).toBe(true);
    for (const o of p.design.room.openings)
      expect(openingBlocked(p.design.room, o, p.design.cabinets)).toBe(false);
    expect(p.design.room.openings.length).toBe(1);
    expect(presetRoom(p.design.room, p.design.kind, p.design.cabinets)).toBe(
      p.design.room,
    );
  }
  expect(JSON.stringify(raw)).toBe(before);
});
it("keeps room props out of fronts, drawers, doors and each other across all layouts and room sizes", () => {
  for (const kind of ["kitchen", "wardrobe"] as const)
    for (const layout of kind === "kitchen"
      ? (["straight", "l", "u", "parallel", "island"] as const)
      : (["straight", "corner", "walkin"] as const))
      for (const size of [240, 420, 650, 900]) {
        const d = generateLayout(
          {
            ...newDesign(kind, layout),
            room: { width: size, depth: size, height: 270, openings: [] },
          },
          catalog,
        );
        if (!d) continue;
        const before = JSON.stringify(d),
          r = resolveRoom(d);
        for (const p of r.props)
          expect(
            freePlacement(
              p.volume,
              d,
              r.props.filter((q) => q !== p).map((q) => q.volume),
            ),
          ).toBe(true);
        expect(JSON.stringify(d)).toBe(before);
        if (size > 650) expect(r.props).toEqual([]);
      }
});
it("omits blocked dressing decor rather than moving customer cabinets and suppresses large-design cost", () => {
  const d = presentationPresets(catalog).find(
    (p) => p.id === "wardrobe-straight",
  )!.design;
  const tiny = {
    ...d,
    room: { width: 240, depth: 120, height: 230, openings: [] },
  };
  expect(resolveRoom(tiny).props).toEqual([]);
  expect(
    resolveRoom({
      ...d,
      cabinets: Array.from({ length: 200 }, (_, i) => ({
        ...d.cabinets[0],
        id: String(i),
      })),
    }).props,
  ).toEqual([]);
  const room = {
    width: 300,
    depth: 300,
    height: 270,
    openings: [
      {
        id: "door",
        wall: "left" as const,
        type: "door" as const,
        offset: 0,
        width: 100,
        height: 210,
        sill: 0,
      },
    ],
  };
  expect(
    freePlacement(
      { min: [0.1, 0, 0.1], max: [0.8, 0.5, 0.8] },
      { ...d, room, cabinets: [] },
    ),
  ).toBe(false);
});
it("fits rail/shelf populations at varied sizes and leaves unsupported narrow/shallow compartments empty", () => {
  const d = presentationPresets(catalog).find(
    (p) => p.id === "wardrobe-straight",
  )!.design;
  for (const original of d.cabinets)
    for (const width of [30, 40, 80, 100])
      for (const height of [180, 230, 260])
        for (const depth of [30, 60]) {
          const c = { ...original, width, height, depth },
            m = catalog.modules.find((m) => m.id === c.moduleId)!,
            s = storageMeasurements(c, m),
            items = storagePopulation(c, m, s);
          for (const p of items) {
            const b = modelRecord(p.id)!.bounds;
            expect(p.position[0] + b.min[0]).toBeGreaterThanOrEqual(
              -s.width / 2 + 0.018,
            );
            expect(p.position[0] + b.max[0]).toBeLessThanOrEqual(
              s.width / 2 - 0.018,
            );
            expect(p.position[2] + b.min[2]).toBeGreaterThanOrEqual(
              -s.depth / 2 + 0.015,
            );
            expect(p.position[2] + b.max[2]).toBeLessThanOrEqual(
              s.depth / 2 - 0.015,
            );
            expect(p.position[1] + b.min[1]).toBeGreaterThanOrEqual(0.018);
            for (const y of s.shelves) {
              const volume = {
                min: [
                  p.position[0] + b.min[0],
                  p.position[1] + b.min[1],
                  p.position[2] + b.min[2],
                ],
                max: [
                  p.position[0] + b.max[0],
                  p.position[1] + b.max[1],
                  p.position[2] + b.max[2],
                ],
              } as {
                min: [number, number, number];
                max: [number, number, number];
              };
              expect(
                overlaps(volume, {
                  min: [-s.width / 2, y - 0.009, -s.depth / 2],
                  max: [s.width / 2, y + 0.009, s.depth / 2],
                }),
              ).toBe(false);
            }
          }
        }
});
it("uses fixed appliance models only in supported slots; resize falls back instead of stretching", () => {
  expect(applianceFits("oven", 0.6, 0.72)).toBe(true);
  expect(applianceFits("oven", 0.4, 0.72)).toBe(false);
  expect(applianceFits("oven", 0.9, 0.72)).toBe(false);
  expect(applianceFits("fridge", 0.6, 2.1)).toBe(true);
  expect(applianceFits("fridge", 0.6, 1.8)).toBe(false);
});

it("keeps the upper tower front above the fixed oven fascia at edited heights", () => {
  for (const height of [1.8, 2.1, 2.4]) {
    const slot = ovenSlot(height);
    expect(slot.upperBottom).toBeGreaterThan(slot.centre + 0.59 / 2);
    expect(slot.upperCentre - slot.upperHeight / 2).toBeCloseTo(
      slot.upperBottom,
      6,
    );
    expect(slot.upperCentre + slot.upperHeight / 2).toBeCloseTo(
      height - 0.008,
      6,
    );
  }
});
