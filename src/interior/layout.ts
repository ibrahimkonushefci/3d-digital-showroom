import type { Catalog } from "../catalog/types";
import { uid } from "../designer3d/layout";
import {
  InteriorSchema,
  type DoorStyle,
  type InteriorDesign,
  type InteriorDoor,
} from "./types";
export const doorWidths = { living: 90, bedroom: 80, bathroom: 70 } as const;
export function newQuoteDoor(
  style: DoorStyle,
  roomType: InteriorDoor["roomType"] = "bedroom",
): InteriorDoor {
  return {
    ...style,
    id: uid(),
    roomType,
    width: doorWidths[roomType],
    height: 200,
    frameHeight: 205,
    frameDepth: 15,
    wall: "left",
    offset: 0,
    opening: "left",
  };
}
export function newInterior(
  c: Catalog,
  preset: InteriorDesign["preset"] = "hallway",
): InteriorDesign {
  const style: DoorStyle = {
    modelId: (
      c.interiorDoors.find((p) => p.style === "glass") || c.interiorDoors[0]
    ).id,
    finishId:
      c.productFinishes.find((f) => f.id === "white")?.id ||
      c.productFinishes[0].id,
    finishTier:
      c.interiorFinishes.find((f) => f.id === "paint")?.id ||
      c.interiorFinishes[0].id,
    handleId: c.interiorHandles[0].id,
    hiddenHinges: false,
  };
  return InteriorSchema.parse({
    version: 2,
    kind: "interior",
    id: uid(),
    preset,
    room: { width: 220, depth: 600, height: 270, openings: [] },
    laminateId:
      c.laminates.find((f) => f.id === "dark-oak")?.id || c.laminates[0].id,
    pattern: "straight",
    direction: false,
    doors: ["living", "bedroom", "bedroom", "bathroom"].map((role) =>
      newQuoteDoor(style, role as InteriorDoor["roomType"]),
    ),
    doorStyle: style,
    skirtingId: c.skirtings[0].id,
    skirtingHeight: 8,
    underlay: true,
    furniture: true,
    evening: false,
    installation: true,
    vat: false,
    exact: false,
  });
}
export function changeDoorStyle(
  d: InteriorDesign,
  changes: Partial<DoorStyle>,
): InteriorDesign {
  const doorStyle = { ...d.doorStyle, ...changes };
  return {
    ...d,
    doorStyle,
    legacyMixed: false,
    doors: d.doors.map((p) => ({ ...p, ...doorStyle })),
  };
}
export function switchInteriorRoom(
  d: InteriorDesign,
  preset: InteriorDesign["preset"],
): InteriorDesign {
  return { ...d, preset };
}
export function perimeter(d: InteriorDesign) {
  return Math.max(
    0,
    (2 * (d.room.width + d.room.depth)) / 100 -
      d.doors.reduce((n, p) => n + p.width / 100, 0),
  );
}
export function validInterior(d: InteriorDesign, c: Catalog) {
  if (
    !InteriorSchema.safeParse(d).success ||
    new Set(d.doors.map((p) => p.id)).size !== d.doors.length
  )
    return false;
  if (
    !c.laminates.some((m) => m.id === d.laminateId) ||
    !c.skirtings
      .find((m) => m.id === d.skirtingId)
      ?.heightRates.some((h) => h.height === d.skirtingHeight)
  )
    return false;
  const validStyle = (p: DoorStyle) =>
    c.interiorDoors.some((m) => m.id === p.modelId) &&
    c.productFinishes.some((f) => f.id === p.finishId) &&
    c.interiorFinishes.some((f) => f.id === p.finishTier) &&
    c.interiorHandles.some((h) => h.id === p.handleId);
  return (
    validStyle(d.doorStyle) &&
    d.doors.every(
      (p) =>
        validStyle(p) &&
        p.frameHeight >= p.height &&
        (d.legacyMixed ||
          Object.keys(d.doorStyle).every(
            (k) =>
              p[k as keyof DoorStyle] === d.doorStyle[k as keyof DoorStyle],
          )),
    )
  );
}
