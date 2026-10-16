import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CatalogSchema, type DesignDocument } from "../src/catalog/types";
import { presentationPresets } from "../src/designer3d/presets";
import { validateDesign, wallOffset } from "../src/designer3d/layout";
import {
  resizeRoom,
  smallestRoom,
  switchLayout,
} from "../src/designer3d/resize";

for (const brand of ["default", "druri-design"]) {
  const catalog = CatalogSchema.parse(
    JSON.parse(readFileSync(`public/brands/${brand}/catalog.json`, "utf8")),
  );
  const presets = presentationPresets(catalog);
  const preset = (layout: string, kind = "kitchen") =>
    presets.find((p) => p.design.layout === layout && p.design.kind === kind)!
      .design;
  const size = (d: DesignDocument) => ({
    width: d.room.width,
    depth: d.room.depth,
    height: d.room.height,
  });
  describe(`${brand} room resizing`, () => {
    it("keeps the L kitchen's 15 units at 440 × 360 × 280 cm", () => {
      const l = preset("l");
      expect(l.cabinets).toHaveLength(15);
      const r = resizeRoom(
        l,
        { width: 440, depth: 360, height: 280 },
        catalog,
      )!;
      expect(r).not.toBeNull();
      expect(r.design.cabinets).toHaveLength(15);
      expect(r.added + r.removed).toBe(0);
      expect(validateDesign(r.design, catalog)).toBe(true);
      // Same units in the same order, same ids: nothing was rebuilt.
      expect(r.design.cabinets.map((c) => c.id)).toEqual(
        l.cabinets.map((c) => c.id),
      );
      // The corner stays in the corner.
      const corner = r.design.cabinets.find((c) => c.moduleId === "corner")!;
      expect(wallOffset(corner)).toBe(0);
    });
    it("changes the unit count only by what the extra or missing space needs", () => {
      for (const [layout, kind] of [
        ["l", "kitchen"],
        ["straight", "kitchen"],
        ["island", "kitchen"],
        ["straight", "wardrobe"],
        ["corner", "wardrobe"],
      ] as const) {
        const d = preset(layout, kind);
        let previous = d.cabinets.length;
        for (
          let width = d.room.width;
          width <= d.room.width + 200;
          width += 10
        ) {
          const r = resizeRoom(d, { ...size(d), width }, catalog);
          expect(r, `${layout} ${width}`).not.toBeNull();
          expect(validateDesign(r!.design, catalog)).toBe(true);
          const n = r!.design.cabinets.length;
          // Growing never removes units; at most one column (two units) per 60 cm.
          expect(n).toBeGreaterThanOrEqual(previous);
          expect(n - d.cabinets.length).toBeLessThanOrEqual(
            2 * Math.ceil((width - d.room.width) / 60),
          );
          previous = n;
        }
        // Slightly smaller rooms first use the free space, then narrow units.
        const smaller = resizeRoom(
          d,
          { ...size(d), width: d.room.width - 20 },
          catalog,
        );
        expect(smaller, `${layout} −20`).not.toBeNull();
        expect(smaller!.removed).toBe(0);
        expect(smaller!.design.cabinets).toHaveLength(d.cabinets.length);
      }
    });
    it("keeps appliances, sink, hob and corner when a room gets much smaller", () => {
      const l = preset("l");
      const r = resizeRoom(l, { width: 320, depth: 260, height: 270 }, catalog);
      expect(r).not.toBeNull();
      const types = (d: DesignDocument) =>
        d.cabinets
          .map((c) => catalog.modules.find((m) => m.id === c.moduleId)!.type)
          .filter((t) =>
            ["sink", "dishwasher", "oven", "fridge", "corner", "hood"].includes(
              t,
            ),
          )
          .sort();
      expect(types(r!.design)).toEqual(types(l));
      expect(r!.removed).toBeGreaterThan(0);
      expect(validateDesign(r!.design, catalog)).toBe(true);
    });
    it("never removes sink, hob, hood, oven, fridge or corner: too small is rejected", () => {
      const essentials = (d: DesignDocument) =>
        d.cabinets
          .map((c) => catalog.modules.find((m) => m.id === c.moduleId)!.type)
          .filter((t) =>
            ["sink", "oven", "fridge", "corner", "hood"].includes(t),
          )
          .sort();
      // The reported case: Cashmere L → Compact → 200 × 200 cm.
      const compact = resizeRoom(
        preset("l"),
        { width: 320, depth: 260, height: 270 },
        catalog,
      )!.design;
      const tiny = { width: 200, depth: 200, height: 270 };
      expect(resizeRoom(compact, tiny, catalog)).toBeNull();
      const smallest = smallestRoom(compact, tiny, catalog)!;
      expect(smallest).not.toBeNull();
      const fitted = resizeRoom(compact, { ...tiny, ...smallest }, catalog)!;
      expect(essentials(fitted.design)).toEqual(essentials(compact));
      expect(
        resizeRoom(
          compact,
          { ...tiny, width: smallest.width - 10, depth: smallest.depth },
          catalog,
        ),
      ).toBeNull();
      // Every accepted size of every prepared design keeps them all, and
      // every wall run keeps at least one unit.
      for (const [layout, kind] of [
        ["l", "kitchen"],
        ["straight", "kitchen"],
        ["island", "kitchen"],
        ["straight", "wardrobe"],
        ["corner", "wardrobe"],
      ] as const) {
        const d = preset(layout, kind);
        const walls = new Set(d.cabinets.map((c) => c.wall));
        for (let width = 200; width <= d.room.width; width += 20)
          for (let depth = 200; depth <= d.room.depth; depth += 40) {
            const r = resizeRoom(d, { width, depth, height: 270 }, catalog);
            if (!r) continue;
            expect(essentials(r.design), `${layout} ${width}×${depth}`).toEqual(
              essentials(d),
            );
            expect(new Set(r.design.cabinets.map((c) => c.wall))).toEqual(
              walls,
            );
          }
      }
    });
    it("follows the room height with wardrobes and keeps a staged window valid", () => {
      const w = preset("straight", "wardrobe");
      const low = resizeRoom(w, { ...size(w), height: 240 }, catalog)!;
      expect(low.design.cabinets.every((c) => c.height <= 240)).toBe(true);
      const high = resizeRoom(
        low.design,
        { ...size(w), height: 280 },
        catalog,
      )!;
      const max = (id: string) =>
        catalog.modules.find((m) => m.id === id)!.height;
      expect(
        high.design.cabinets.every(
          (c) => c.height === Math.min(max(c.moduleId), 280),
        ),
      ).toBe(true);
      const narrow = resizeRoom(
        preset("l"),
        { width: 420, depth: 250, height: 270 },
        catalog,
      )!;
      expect(narrow).not.toBeNull();
      expect(validateDesign(narrow.design, catalog)).toBe(true);
    });
    it("switches layouts to the prepared arrangement in the current room, keeping finishes", () => {
      const l = preset("l");
      const styled = {
        ...l,
        style: { ...l.style, front: "sage", handle: "bar" },
      };
      for (const layout of ["straight", "island", "l"] as const) {
        const r = switchLayout(styled, layout, catalog, preset(layout))!;
        expect(r, layout).not.toBeNull();
        expect(r.design.layout).toBe(layout);
        expect(r.design.style.front).toBe("sage");
        expect(validateDesign(r.design, catalog)).toBe(true);
        if (!r.roomChanged) expect(size(r.design)).toEqual(size(l));
        if (layout === "island")
          expect(r.design.cabinets.some((c) => c.wall === "island")).toBe(true);
      }
      // Back to L: the same 15 units as the prepared design.
      expect(
        switchLayout(styled, "l", catalog, l)!.design.cabinets,
      ).toHaveLength(15);
    });
  });
}
