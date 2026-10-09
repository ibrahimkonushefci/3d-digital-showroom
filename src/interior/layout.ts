import type { Catalog } from "../catalog/types";
import { uid } from "../designer3d/layout";
import type { InteriorDesign } from "./types";
export function newInterior(
  c: Catalog,
  preset: InteriorDesign["preset"] = "hallway",
): InteriorDesign {
  const room = {
    width: preset === "hallway" ? 220 : 420,
    depth: preset === "hallway" ? 600 : 480,
    height: 270,
    openings: [],
  };
  const walls =
    preset === "hallway"
      ? (["left", "left", "right", "right"] as const)
      : preset === "living"
        ? (["left", "back"] as const)
        : (["left"] as const);
  return {
    version: 1,
    kind: "interior",
    id: uid(),
    preset,
    room,
    laminateId: c.laminates[0].id,
    pattern: "straight",
    direction: false,
    doors: walls.map((wall, i) => ({
      id: uid(),
      modelId: c.interiorDoors[0].id,
      width: 80,
      wall,
      offset: wall === "back" ? 160 : i % 2 === 0 ? 100 : room.depth - 180,
      opening: "left",
      finishTier: "cpl",
      finishId: "white",
      handleId: c.interiorHandles[0].id,
      hiddenHinges: false,
    })),
    skirtingId: c.skirtings[0].id,
    skirtingHeight: 8,
    underlay: true,
    furniture: true,
    evening: false,
    installation: true,
    vat: false,
    exact: false,
  };
}
export function perimeter(d: InteriorDesign) {
  return Math.max(
    0,
    (2 * (d.room.width + d.room.depth)) / 100 -
      d.doors.reduce((n, p) => n + p.width / 100, 0),
  );
}
export function validInterior(d: InteriorDesign, c: Catalog) {
  if (!d.doors.length) return false;
  if (
    new Set(d.doors.map((p) => p.id)).size !== d.doors.length ||
    !c.skirtings
      .find((m) => m.id === d.skirtingId)
      ?.heightRates.some((h) => h.height === d.skirtingHeight)
  )
    return false;
  if (
    !c.laminates.some((m) => m.id === d.laminateId) ||
    !c.skirtings.some((m) => m.id === d.skirtingId)
  )
    return false;
  return d.doors.every(
    (p) =>
      c.interiorDoors.some((m) => m.id === p.modelId) &&
      c.productFinishes.some((f) => f.id === p.finishId) &&
      c.interiorFinishes.some((f) => f.id === p.finishTier) &&
      c.interiorHandles.some((h) => h.id === p.handleId) &&
      p.offset + p.width <=
        (["left", "right"].includes(p.wall) ? d.room.depth : d.room.width) &&
      !d.doors.some(
        (n) =>
          n.id !== p.id &&
          n.wall === p.wall &&
          p.offset < n.offset + n.width &&
          p.offset + p.width > n.offset,
      ),
  );
}
