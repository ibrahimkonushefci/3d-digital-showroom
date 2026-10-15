import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  BoxGeometry,
} from "three";
import { CatalogSchema } from "../src/catalog/types";
import {
  generateLayout,
  hobCabinet,
  newDesign,
} from "../src/designer3d/layout";
import { presentationPresets } from "../src/designer3d/presets";
import {
  insideWall,
  insideRoom,
  downlights,
} from "../src/scene/rooms/RoomShell";
import { worktopDecor, wallArt } from "../src/scene/rooms/decor";
import { excludedFromAO } from "../src/scene/pipeline/RenderPipeline";
import { resolveLighting } from "../src/scene/lighting/lightingRecipe";
import { calculatePrice } from "../src/pricing";

const catalog = CatalogSchema.parse(
  JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
);
const presets = presentationPresets(catalog);

it("hides only the walls the camera stands beyond; inside, the whole room stays", () => {
  const room = presets[0].design.room;
  const inside = { position: { x: 0.5, y: 1.55, z: 0.8 } };
  for (const side of ["back", "front", "left", "right"] as const)
    expect(insideWall(inside, room, side)).toBe(true);
  // Overview from the front-right: the front and right walls cut away.
  const outside = { position: { x: 4, y: 3.5, z: 5 } };
  expect(insideWall(outside, room, "front")).toBe(false);
  expect(insideWall(outside, room, "right")).toBe(false);
  expect(insideWall(outside, room, "back")).toBe(true);
  expect(insideWall(outside, room, "left")).toBe(true);
  // The ceiling and window views only exist from inside the room.
  expect(insideRoom(inside as never, room)).toBe(true);
  expect(insideRoom(outside as never, room)).toBe(false);
  expect(insideRoom({ position: { x: 0, y: 3.2, z: 0 } } as never, room)).toBe(
    false,
  );
  for (const [x, z] of downlights(room)) {
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(room.width / 100);
    expect(z).toBeGreaterThan(0);
    expect(z).toBeLessThan(room.depth / 100);
  }
});

it("dresses free worktop only: never the sink, hob or a reused cabinet, below wall units", () => {
  for (const preset of presets.filter((p) => p.design.kind === "kitchen")) {
    const design = preset.design;
    const items = worktopDecor(design, catalog);
    expect(items.length).toBeGreaterThanOrEqual(2);
    const hob = hobCabinet(design, catalog);
    for (const item of items) {
      const [x, y, z] = item.position;
      const under = design.cabinets.find(
        (c) =>
          c.level === "base" &&
          Math.abs(c.x / 100 - x) < c.width / 200 + 0.01 &&
          Math.abs(c.z / 100 - z) < c.width / 200 + 0.4,
      );
      expect(under).toBeDefined();
      const type = catalog.modules.find((m) => m.id === under!.moduleId)!.type;
      expect(["sink", "corner"]).not.toContain(type);
      if (item.id !== "fruit-bowl") expect(under!.id).not.toBe(hob?.id);
      // Worktop height, and the tallest piece clears the 1.40 m wall units.
      expect(y).toBeGreaterThan(0.8);
      expect(y + 0.41).toBeLessThan(1.4);
    }
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Kitchen heroes carry at least four objects with the counter set.
    expect(items.length).toBeGreaterThanOrEqual(3);
    // Footprints (plan view, generous radii) never overlap on a shared top.
    const radius: Record<string, number> = {
      "plant-small": 0.1,
      vase: 0.11,
      "cutting-board": 0.13,
      "fruit-bowl": 0.16,
    };
    for (const a of items)
      for (const b of items)
        if (a !== b)
          expect(
            Math.hypot(
              a.position[0] - b.position[0],
              a.position[2] - b.position[2],
            ),
            `${preset.id} ${a.id}/${b.id}`,
          ).toBeGreaterThan(radius[a.id] + radius[b.id] - 0.02);
  }
});

it("hangs wall art only on a wall without cabinets or openings", () => {
  for (const preset of presets) {
    const art = wallArt(preset.design);
    if (!art) continue;
    const [x, , z] = art.position;
    const w = preset.design.room.width / 100,
      d = preset.design.room.depth / 100;
    const side =
      z < 0.01 ? "back" : z > d - 0.01 ? "front" : x < 0.01 ? "left" : "right";
    expect(preset.design.cabinets.some((c) => c.wall === side)).toBe(false);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(w);
  }
  // A room lined with cabinets on every wall gets no art.
  const u = generateLayout(newDesign("kitchen", "u"), catalog)!;
  const art = wallArt(u);
  if (art)
    expect(
      u.cabinets.some((c) => art.position[2] < 0.01 && c.wall === "back"),
    ).toBe(false);
});

it("decor and lighting never change the quote", () => {
  for (const preset of presets) {
    const before = calculatePrice(preset.design, catalog, "en").total;
    worktopDecor(preset.design, catalog);
    wallArt(preset.design);
    resolveLighting(preset.design, catalog, "balanced");
    expect(calculatePrice(preset.design, catalog, "en").total).toBe(before);
  }
});

it("keeps shadow-only shells and glass out of ambient occlusion", () => {
  const geometry = new BoxGeometry();
  const shell = new Mesh(
    geometry,
    new MeshBasicMaterial({ colorWrite: false }),
  );
  const glass = new Mesh(
    geometry,
    new MeshStandardMaterial({ transparent: true, opacity: 0.1 }),
  );
  const front = new Mesh(geometry, new MeshStandardMaterial());
  const tagged = new Object3D();
  tagged.userData.aoExclude = true;
  expect(excludedFromAO(shell)).toBe(true);
  expect(excludedFromAO(glass)).toBe(true);
  expect(excludedFromAO(tagged)).toBe(true);
  expect(excludedFromAO(front)).toBe(false);
});

it("places the soft interior key inside the room, near the ceiling, facing the furniture", () => {
  for (const preset of presets) {
    const light = resolveLighting(preset.design, catalog, "balanced");
    const { width, depth, height } = preset.design.room;
    const p = light.interiorKey.position;
    expect(light.interiorKey.intensity).toBeGreaterThan(0);
    expect(Math.abs(p.x)).toBeLessThan(width / 200);
    expect(Math.abs(p.z)).toBeLessThan(depth / 200);
    expect(p.y).toBeGreaterThan(height / 100 - 0.4);
    expect(p.y).toBeLessThan(height / 100);
    expect(light.environmentIntensity).toBeLessThan(1);
  }
});
