import { beforeEach, expect, it } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { CatalogSchema } from "../src/catalog/types";
import {
  newDesign,
  generateLayout,
  wallPosition,
  wallOffset,
  validateDesign,
} from "../src/designer3d/layout";
import { movedCabinet } from "../src/designer3d/drag";
import { useDesigner } from "../src/designer3d/store";
import { presentationPresets } from "../src/designer3d/presets";
import {
  worktopOutlines,
  sinkCutout,
  pointInPolygon,
  worktopRuns,
} from "../src/scene/countertopGeometry";
import { qualityForFrames } from "../src/scene/quality";
import { PhotoSceneSchema } from "../src/doorPreview/types";
import { validCorners } from "../src/doorPreview/homography";
import { calculatePrice } from "../src/pricing";
const catalog = CatalogSchema.parse(
  JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
);
const design = () => generateLayout(newDesign("kitchen", "straight"), catalog)!;
beforeEach(() => {
  useDesigner.getState().setDesign(design());
  useDesigner.getState().setInteractionMode("showroom");
});
it("snaps all wall drags and preserves the island row", () => {
  const d = design(),
    original = d.cabinets.find((c) => c.level === "base")!;
  for (const wall of ["back", "left", "right", "front", "island"] as const) {
    const c = {
      ...original,
      wall,
      ...wallPosition(wall, 100, original.width, original.depth, d.room),
    };
    if (wall === "island") c.z = 220;
    const result = movedCabinet({ ...d, cabinets: [c] }, c.id, 26).cabinets[0];
    expect(wallOffset(result)).toBe(130);
    if (wall === "island") expect(result.z).toBe(220);
    expect(result.rotation).toBe(c.rotation);
  }
});
it("commits a valid drag once and restores it with undo/redo", () => {
  const d = design(),
    c = d.cabinets.find((c) => c.level === "base")!;
  useDesigner
    .getState()
    .setDesign({ ...d, cabinets: [c], room: { ...d.room, openings: [] } });
  const original = useDesigner.getState().design!;
  for (let n = 10; n <= 50; n += 10)
    useDesigner.getState().previewDrag(movedCabinet(original, c.id, n));
  expect(useDesigner.getState().past).toHaveLength(0);
  expect(useDesigner.getState().design).toBe(original);
  expect(useDesigner.getState().finishDrag(catalog)).toBe(true);
  expect(useDesigner.getState().past).toHaveLength(1);
  const moved = useDesigner.getState().design;
  useDesigner.getState().undo();
  expect(useDesigner.getState().design).toEqual(original);
  useDesigner.getState().redo();
  expect(useDesigner.getState().design).toEqual(moved);
});
it("invalid drops, cancellation and mode changes never save a preview", () => {
  const s = useDesigner.getState(),
    d = s.design!,
    id = d.cabinets[0].id;
  s.previewDrag(movedCabinet(d, id, -10000));
  expect(s.finishDrag(catalog)).toBe(false);
  expect(useDesigner.getState().design).toBe(d);
  expect(useDesigner.getState().past).toHaveLength(0);
  s.previewDrag(movedCabinet(d, id, 10));
  s.cancelDrag();
  expect(useDesigner.getState().dragPreview).toBeNull();
  s.previewDrag(movedCabinet(d, id, 10));
  s.setInteractionMode("edit");
  expect(useDesigner.getState().dragging).toBe(false);
  expect(useDesigner.getState().design).toBe(d);
});
it("drag candidates retain collision and opening validation", () => {
  const d = design(),
    c = d.cabinets.find((c) => c.level === "base")!;
  expect(validateDesign(movedCabinet(d, c.id, 10), catalog)).toBe(false);
  const alone = {
    ...d,
    cabinets: [c],
    room: {
      ...d.room,
      openings: [
        {
          id: "opening",
          wall: "back" as const,
          type: "door" as const,
          offset: wallOffset(c) + c.width,
          width: 60,
          height: 210,
          sill: 0,
        },
      ],
    },
  };
  expect(validateDesign(movedCabinet(alone, c.id, c.width), catalog)).toBe(
    false,
  );
});
it("merges adjacent worktops into one outline with a true sink opening", () => {
  const d = design(),
    c = d.cabinets.find((c) => c.level === "base")!;
  const a = { ...c, ...wallPosition("back", 0, c.width, c.depth, d.room) },
    b = {
      ...c,
      id: "next",
      ...wallPosition("back", c.width, c.width, c.depth, d.room),
    };
  const outlines = worktopOutlines([a, b]);
  expect(outlines).toHaveLength(1);
  const hole = sinkCutout(a);
  for (const p of hole) expect(pointInPolygon(p, outlines[0])).toBe(true);
  const runs = worktopRuns(d.cabinets, catalog);
  expect(runs.flatMap((r) => r.holes).length).toBeGreaterThan(0);
});
it("keeps separated worktops separate across supported layouts", () => {
  for (const layout of ["straight", "l", "u", "parallel", "island"] as const) {
    const d = generateLayout(newDesign("kitchen", layout), catalog)!;
    expect(d).toBeTruthy();
    const runs = worktopRuns(d.cabinets, catalog);
    for (const r of runs) {
      expect(r.outlines.length).toBeGreaterThan(0);
      for (const p of r.outlines.flat())
        expect(p.every(Number.isFinite)).toBe(true);
    }
  }
});
it("validates curated presets and filters unavailable catalog finishes", () => {
  const presets = presentationPresets(catalog);
  expect(presets).toHaveLength(4);
  for (const p of presets) {
    expect(validateDesign(p.design, catalog)).toBe(true);
    expect(p.camera.position.length).toBe(3);
  }
  const missing = {
    ...catalog,
    fronts: catalog.fronts.filter((m) => m.id !== "cashmere"),
  };
  expect(presentationPresets(missing).map((p) => p.id)).toEqual([
    "modern",
    "classic",
  ]);
});
it("keeps legacy catalogs usable without presentation metadata", () => {
  const { presentationPresets: _, ...legacy } = catalog;
  expect(
    presentationPresets(CatalogSchema.parse(legacy)).length,
  ).toBeGreaterThan(0);
});
it("quality measurement ignores idle gaps and degrades slow active frames", () => {
  expect(qualityForFrames("high", Array(150).fill(500))).toBe("high");
  expect(qualityForFrames("high", Array(120).fill(25))).toBe("balanced");
  expect(qualityForFrames("balanced", Array(120).fill(35))).toBe("lightweight");
  expect(qualityForFrames("balanced", Array(120).fill(12))).toBe("high");
});
it("quality and transient opening states cannot change prices", () => {
  const d = design(),
    before = calculatePrice(d, catalog, "en");
  useDesigner.getState().toggleOpen(d.cabinets[0].id);
  useDesigner.getState().setInteractionMode("edit");
  expect(calculatePrice(d, catalog, "en")).toEqual(before);
});
it("ships independently calibrated real photographs below the photo budget", () => {
  const corners: string[] = [];
  let bytes = 0;
  for (const i of [1, 2, 3]) {
    const scene = PhotoSceneSchema.parse(
      JSON.parse(readFileSync(`public/shared/scenes/house-${i}.json`, "utf8")),
    );
    expect(scene.photo.endsWith(".webp")).toBe(true);
    expect(existsSync("public/" + scene.photo)).toBe(true);
    bytes += statSync("public/" + scene.photo).size;
    for (const p of scene.placements)
      expect(validCorners(p.corners)).toBe(true);
    corners.push(JSON.stringify(scene.placements[0].corners));
  }
  expect(new Set(corners).size).toBe(3);
  expect(bytes).toBeLessThan(1_500_000);
});

it("hides incompatible presets when a brand lacks a required module", () => {
  const partial = {
    ...catalog,
    modules: catalog.modules.filter((m) => m.id !== "sink"),
  };
  expect(
    presentationPresets(partial).every((p) => p.design.kind === "wardrobe"),
  ).toBe(true);
});
it("does not create history for a drag that returns to its original snapped position", () => {
  const d = design();
  useDesigner.getState().setDesign(d);
  useDesigner.getState().previewDrag(structuredClone(d));
  expect(useDesigner.getState().finishDrag(catalog)).toBe(false);
  expect(useDesigner.getState().past).toHaveLength(0);
});
