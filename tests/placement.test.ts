import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CatalogSchema, type DesignDocument } from "../src/catalog/types";
import { presentationPresets } from "../src/designer3d/presets";
import { validateDesign, wallOffset } from "../src/designer3d/layout";
import {
  findSpots,
  makeRoom,
  makeRoomAndPlace,
  placeUnit,
  replaceable,
  replaceUnit,
  resizeUnit,
} from "../src/designer3d/placement";
import {
  interiorPositions,
  preferredPosition,
  pullOutBlocked,
} from "../src/designer3d/interiorValidation";
import { resolveInterior, withInterior } from "../src/designer3d/interiors";

for (const brand of ["default", "druri-design"]) {
  const catalog = CatalogSchema.parse(
    JSON.parse(readFileSync(`public/brands/${brand}/catalog.json`, "utf8")),
  );
  const presets = presentationPresets(catalog);
  const preset = (layout: string, kind = "kitchen") =>
    presets.find((p) => p.design.layout === layout && p.design.kind === kind)!
      .design;
  const typeOf = (d: DesignDocument, id: string) =>
    catalog.modules.find(
      (m) => m.id === d.cabinets.find((c) => c.id === id)?.moduleId,
    )?.type;
  const without = (d: DesignDocument, id: string): DesignDocument => ({
    ...d,
    cabinets: d.cabinets.filter((c) => c.id !== id),
  });

  describe(`${brand} free-space finder`, () => {
    it("offers only places that pass the layout rules, in every prepared design", () => {
      for (const { design } of presets)
        for (const m of catalog.modules.filter((m) => m.kind === design.kind))
          for (const spot of findSpots(design, catalog, m.id))
            for (const option of spot.options) {
              const placed = placeUnit(
                design,
                catalog,
                m.id,
                spot,
                option.width,
              );
              expect(placed).not.toBeNull();
              expect(validateDesign(placed!.design, catalog)).toBe(true);
              expect(placed!.design.cabinets).toHaveLength(
                design.cabinets.length + 1,
              );
            }
    });

    it("fills the gap a deleted wall cabinet leaves at its width", () => {
      const l = preset("l");
      const gone = l.cabinets.find(
        (c) => c.level === "wall" && typeOf(l, c.id) === "doors",
      )!;
      const spots = findSpots(without(l, gone.id), catalog, "wall-open");
      const spot = spots.find(
        (s) =>
          s.wall === gone.wall &&
          s.gap[0] <= wallOffset(gone) + 0.5 &&
          s.gap[1] >= wallOffset(gone) + gone.width - 0.5,
      )!;
      expect(spot).toBeTruthy();
      // The largest width that fits the stretch, placed against a neighbour.
      expect(spot.options[0].width).toBeGreaterThanOrEqual(gone.width);
      expect(spot.options.map((o) => o.width)).toContain(gone.width);
    });

    it("finds nothing in a full straight kitchen and offers replacements and narrowing instead", () => {
      const straight = preset("straight");
      expect(findSpots(straight, catalog, "wall-open")).toEqual([]);
      expect(findSpots(straight, catalog, "base-drawers")).toEqual([]);
      const swaps = replaceable(straight, catalog, "wall-open");
      expect(swaps.length).toBeGreaterThan(0);
      for (const s of swaps)
        expect(
          replaceUnit(straight, catalog, s.cabinetId, "wall-open"),
        ).not.toBeNull();
      const room = makeRoom(straight, catalog, "base-drawers");
      expect(room.length).toBeGreaterThan(0);
      const done = makeRoomAndPlace(
        straight,
        catalog,
        "base-drawers",
        room[0],
      )!;
      expect(done).not.toBeNull();
      expect(validateDesign(done.design, catalog)).toBe(true);
      expect(done.design.cabinets).toHaveLength(straight.cabinets.length + 1);
      expect(
        done.design.cabinets.find((c) => c.id === room[0].cabinetId)!.width,
      ).toBe(room[0].width);
    });

    it("places units along an empty kitchen wall at the largest width", () => {
      const empty = { ...preset("straight"), cabinets: [] };
      const spots = findSpots(empty, catalog, "base-doors");
      expect(spots).toHaveLength(1);
      expect(spots[0].options[0]).toEqual({ width: 100, offset: 0 });
    });

    it("keeps the island for base units and never offers a corner carousel there", () => {
      const island = preset("island");
      expect(
        findSpots(island, catalog, "base-doors").some(
          (s) => s.wall === "island",
        ),
      ).toBe(true);
      expect(
        findSpots(island, catalog, "corner").some((s) => s.wall === "island"),
      ).toBe(false);
      expect(
        findSpots(island, catalog, "wall-open").some(
          (s) => s.wall === "island",
        ),
      ).toBe(false);
      for (const c of island.cabinets.filter((c) => c.wall === "island"))
        expect(replaceUnit(island, catalog, c.id, "corner")).toBeNull();
    });

    it("offers the corner of an L once, not once per wall", () => {
      const l = preset("l");
      const corner = findSpots(l, catalog, "wall-doors").filter(
        (s) => s.gap[0] < 1,
      );
      expect(corner).toHaveLength(1);
    });

    it("replaces a base cabinet with drawers of the same width, in place", () => {
      const l = preset("l");
      const doors = l.cabinets.find((c) => c.moduleId === "base-doors")!;
      const next = replaceUnit(l, catalog, doors.id, "base-drawers")!;
      const swapped = next.cabinets.find((c) => c.id === doors.id)!;
      expect(swapped.moduleId).toBe("base-drawers");
      expect(swapped.width).toBe(doors.width);
      expect(wallOffset(swapped)).toBe(wallOffset(doors));
      expect(validateDesign(next, catalog)).toBe(true);
    });

    it("changes a width only where it fits", () => {
      const straight = preset("straight");
      const flexible = straight.cabinets.find(
        (c) => c.moduleId === "base-doors" || c.moduleId === "base-drawers",
      )!;
      expect(resizeUnit(straight, catalog, flexible.id, 100)).toBeNull();
      const narrower = resizeUnit(straight, catalog, flexible.id, 40)!;
      expect(narrower.cabinets.find((c) => c.id === flexible.id)!.width).toBe(
        40,
      );
      expect(validateDesign(narrower, catalog)).toBe(true);
    });

    it("adds a wardrobe unit into the corner wardrobe's free wall and makes room in the full straight one", () => {
      const corner = preset("corner", "wardrobe");
      const spots = findSpots(corner, catalog, "wardrobe-drawers");
      expect(spots.length).toBeGreaterThan(0);
      expect(
        placeUnit(corner, catalog, "wardrobe-drawers", spots[0]),
      ).not.toBeNull();
      const straight = preset("straight", "wardrobe");
      expect(findSpots(straight, catalog, "wardrobe-open")).toEqual([]);
      const room = makeRoom(straight, catalog, "wardrobe-open");
      expect(room.length).toBeGreaterThan(0);
      expect(
        makeRoomAndPlace(straight, catalog, "wardrobe-open", room[0]),
      ).not.toBeNull();
    });

    it("never suggests replacing or narrowing the sink, hob, hood, oven, fridge or corner", () => {
      const essential = ["sink", "oven", "fridge", "corner", "hood"];
      for (const { design } of presets.filter(
        (p) => p.design.kind === "kitchen",
      ))
        for (const m of catalog.modules.filter((m) => m.kind === "kitchen")) {
          for (const s of replaceable(design, catalog, m.id))
            expect(essential).not.toContain(typeOf(design, s.cabinetId));
          for (const s of makeRoom(design, catalog, m.id))
            expect(essential).not.toContain(typeOf(design, s.cabinetId));
        }
    });

    it("finds interior heights that the interior rules accept, drawers low and rails high", () => {
      const straight = preset("straight", "wardrobe");
      const c = straight.cabinets.find(
        (c) => c.moduleId === "wardrobe-shelves",
      )!;
      const m = catalog.modules.find((x) => x.id === c.moduleId)!;
      const drawer = catalog.interiorItems!.find((i) => i.kind === "drawer")!;
      const positions = interiorPositions(c, m, catalog, drawer.id);
      expect(positions.length).toBeGreaterThan(0);
      const taken = resolveInterior(c, m, catalog).map((p) => p.yCm);
      const y = preferredPosition(positions, "drawer", taken, c.height - 3.6)!;
      expect(y).toBe(positions[0]);
      const parts = resolveInterior(c, m, catalog).map(
        ({ id, productId, yCm }) => ({ id, productId, yCm }),
      );
      const next = withInterior(c, [
        ...parts,
        { id: c.id + ":new", productId: drawer.id, yCm: y },
      ]);
      expect(
        validateDesign(
          {
            ...straight,
            cabinets: straight.cabinets.map((x) => (x.id === c.id ? next : x)),
          },
          catalog,
        ),
      ).toBe(true);
      expect(pullOutBlocked(straight, c, m, catalog, drawer.id, y)).toBe(false);
    });

    it("knows when a unit in front blocks a drawer's pull-out", () => {
      const corner = preset("corner", "wardrobe");
      const spot = findSpots(corner, catalog, "wardrobe-hanging")[0];
      const added = placeUnit(
        corner,
        catalog,
        "wardrobe-hanging",
        spot,
      )!.design;
      const drawer = catalog.interiorItems!.find((i) => i.kind === "drawer")!;
      const blocked = added.cabinets.some((c) => {
        const m = catalog.modules.find((x) => x.id === c.moduleId)!;
        const ys = interiorPositions(c, m, catalog, drawer.id);
        return (
          ys.length > 0 &&
          pullOutBlocked(added, c, m, catalog, drawer.id, ys[0])
        );
      });
      expect(blocked).toBe(true);
    });
  });
}
