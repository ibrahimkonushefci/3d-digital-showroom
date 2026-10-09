import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CatalogSchema } from "../src/catalog/types";
import {
  newDesign,
  generateLayout,
  hobCabinet,
  wallOffset,
} from "../src/designer3d/layout";
import { newFacade } from "../src/doorPreview/store";
import { facadePanels, openingPositions } from "../src/doorPreview/houseLayout";
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
it("keeps facade wall panels outside a resized door and sidelights", () => {
  const d = newFacade(c);
  d.items[0] = {
    ...d.items[0],
    width: 180,
    options: ["side-left", "side-right", "transom"],
  };
  const [x, y] = openingPositions.entry;
  for (const p of facadePanels(d)) {
    const [px, py] = p.position;
    expect(
      px > x - 1.22 && px < x + 1.22 && py > y - 0.025 && py < y + 2.445,
    ).toBe(false);
  }
});
