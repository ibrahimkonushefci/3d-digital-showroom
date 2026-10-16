import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Box3, Vector3 } from "three";
import { CatalogSchema } from "../src/catalog/types";
import { presentationPresets } from "../src/designer3d/presets";
import { generateLayout, newDesign } from "../src/designer3d/layout";
import { resizeRoom } from "../src/designer3d/resize";
import {
  frontSamples,
  interiorHero,
  frustumCoverage,
  segmentHitsBox,
} from "../src/designer3d/cameraShots";
import { presentationEnvelope } from "../src/scene/rooms/envelope";
import { stagedGroup } from "../src/scene/rooms/staging";
import { calculatePrice } from "../src/pricing";

const catalog = CatalogSchema.parse(
  JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
);
const presets = presentationPresets(catalog);

it("draws a larger room around every prepared design without touching the furniture", () => {
  for (const { id, design } of presets) {
    const before = JSON.stringify(design);
    const price = calculatePrice(design, catalog, "en").total;
    const e = presentationEnvelope(design);
    const w = design.room.width / 100,
      d = design.room.depth / 100;
    // Contains the design room and is clearly larger than it.
    expect(e.origin[0], id).toBeLessThanOrEqual(0);
    expect(e.origin[1], id).toBeLessThanOrEqual(0);
    expect(e.origin[0] + e.room.width / 100, id).toBeGreaterThanOrEqual(w);
    expect(e.origin[1] + e.room.depth / 100, id).toBeGreaterThanOrEqual(d);
    expect(
      (e.room.width * e.room.depth) / (design.room.width * design.room.depth),
      id,
    ).toBeGreaterThan(1.8);
    // Walls that carry units stay where they are.
    for (const c of design.cabinets)
      if (c.wall !== "island") expect(e.moved[c.wall], id).toBe(0);
    // A garden door or window and a doorway belong to the home.
    expect(e.room.openings.some((o) => o.id === "envelope-garden"), id).toBe(
      true,
    );
    expect(e.room.openings.some((o) => o.style === "passage"), id).toBe(true);
    // The design itself (units, room, price) is unchanged.
    expect(JSON.stringify(design), id).toBe(before);
    expect(calculatePrice(design, catalog, "en").total, id).toBe(price);
  }
});

it("keeps the kitchen size and unit count when the presentation room grows", () => {
  const design = presets.find((p) => p.design.layout === "l")!.design;
  const units = design.cabinets.length;
  const e = presentationEnvelope(design);
  expect(e.room.width).toBeGreaterThan(design.room.width);
  expect(design.cabinets.length).toBe(units);
  // A resized kitchen gets its own envelope; the house follows the kitchen.
  const resized = resizeRoom(
    design,
    { ...design.room, width: design.room.width + 40 },
    catalog,
  );
  if (resized && "design" in resized && resized.design) {
    const e2 = presentationEnvelope(resized.design);
    expect(e2.room.width).toBeGreaterThanOrEqual(resized.design.room.width);
  }
});

it("builds an envelope for every layout and custom size without errors", () => {
  for (const [kind, layouts] of [
    ["kitchen", ["straight", "l", "island"]],
    ["wardrobe", ["straight", "corner"]],
  ] as const)
    for (const layout of layouts)
      for (const [width, depth, height] of [
        [260, 240, 230],
        [420, 360, 270],
        [640, 640, 320],
      ]) {
        const base = newDesign(kind, layout);
        const design = generateLayout(
          { ...base, room: { ...base.room, width, depth, height } },
          catalog,
        );
        if (!design) continue;
        const e = presentationEnvelope(design);
        expect(e.room.width).toBeGreaterThanOrEqual(width);
        expect(e.room.depth).toBeGreaterThanOrEqual(depth);
        for (const o of e.room.openings) {
          const length =
            o.wall === "back" || o.wall === "front"
              ? e.room.width
              : e.room.depth;
          expect(o.offset).toBeGreaterThanOrEqual(0);
          expect(o.offset + o.width).toBeLessThanOrEqual(length);
        }
      }
});

it("composes the dining or reading group beside the furniture: never hiding fronts, whole or out of the main view", () => {
  for (const { id, design } of presets) {
    const group = stagedGroup(design, catalog);
    expect(group, id).not.toBeNull();
    const shift = new Vector3(
      design.room.width / 200,
      0,
      design.room.depth / 200,
    );
    const boxes = group!.parts.map(
      (v) =>
        new Box3(
          new Vector3(...v.min).sub(shift),
          new Vector3(...v.max).sub(shift),
        ),
    );
    // Outside the design room: never between a viewer and the fronts.
    for (const v of group!.parts)
      expect(
        v.min[0] >= design.room.width / 100 ||
          v.max[0] <= 0 ||
          v.min[2] >= design.room.depth / 100,
        id,
      ).toBe(true);
    for (const aspect of [1.666, 1.9]) {
      const view = interiorHero(design, catalog, aspect)!;
      expect(view, id).not.toBeNull();
      const eye = new Vector3(...view.position),
        target = new Vector3(...view.target);
      const fronts = frontSamples(design);
      const hidden = fronts.filter((p) =>
        boxes.some((b) => segmentHitsBox(eye, p, b)),
      ).length;
      expect(hidden / fronts.length, `${id} hides fronts`).toBeLessThanOrEqual(
        0.02,
      );
      const corners = boxes.flatMap((b) =>
        [b.min.x, b.max.x].flatMap((x) =>
          [b.min.z, b.max.z].map((z) => new Vector3(x, 0.05, z)),
        ),
      );
      const shown = frustumCoverage(eye, target, corners, view.fov!, aspect);
      expect(shown > 0.98 || shown < 0.02, `${id} group cut (${shown})`).toBe(
        true,
      );
    }
  }
});
