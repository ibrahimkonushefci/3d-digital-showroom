import kitchen from "../../../public/shared/rooms/kitchen-warm-v3.json";
import wardrobe from "../../../public/shared/rooms/wardrobe-warm-v3.json";
import type { DesignDocument, Room } from "../../catalog/types";
import { RoomRecipeSchema } from "./types";
import {
  overlaps,
  freePlacement,
  transformedVolume,
  type Volume,
} from "../assets/placement";
import { modelRecord } from "../assets/manifest";
const recipes = [
  RoomRecipeSchema.parse(kitchen),
  RoomRecipeSchema.parse(wardrobe),
];
export type RoomProp = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  volume: Volume;
};
/** Recipe inference is presentation-only; legacy designs are never rewritten. */
export function resolveRoom(design: DesignDocument) {
  const recipe =
    recipes.find(
      (r) =>
        r.id === design.presentation?.roomSceneId &&
        r.compatibleKinds.includes(design.kind),
    ) ?? recipes.find((r) => r.compatibleKinds.includes(design.kind))!;
  const sizes = [design.room.width, design.room.depth, design.room.height];
  const furnished =
    design.cabinets.length < 24 &&
    sizes.every(
      (n, i) =>
        n >= recipe.supportedRoomCm.min[i] &&
        n <= recipe.supportedRoomCm.max[i],
    );
  const props: RoomProp[] = [];
  const place = (id: string, position: RoomProp["position"], yaw = 0) => {
    const record = modelRecord(id)!;
    const volume = transformedVolume(
      record.bounds.min,
      record.bounds.max,
      position,
      yaw,
    );
    if (
      freePlacement(
        volume,
        design,
        props.map((p) => p.volume),
      )
    )
      props.push({ id, position, rotation: [0, yaw, 0], volume });
  };
  if (furnished && design.kind === "wardrobe") {
    // Search predictable free zones; omit when drawer/door clearance is unavailable.
    for (const [x, z] of [
      [0.64, 0.68],
      [design.room.width / 200, design.room.depth / 200 + 0.22],
      [design.room.width / 100 - 0.64, design.room.depth / 100 - 0.68],
    ]) {
      place("bench", [x, 0, z]);
      if (props.length) break;
    }
  }
  if (furnished && design.kind === "kitchen") {
    const island = design.cabinets.filter((c) => c.wall === "island");
    for (const c of island.filter((_, i) => i % 2 === 0).slice(0, 2)) {
      const yaw = c.rotation,
        back = -c.depth / 200 - 0.25;
      place(
        "stool",
        [c.x / 100 + Math.sin(yaw) * back, 0, c.z / 100 + Math.cos(yaw) * back],
        yaw,
      );
      place("pendant", [c.x / 100, design.room.height / 100, c.z / 100], yaw);
    }
  }
  return { recipe, room: design.room, furnished, props };
}
/** Only explicit authored presets receive staging; any customer openings win. */
export function presetRoom(
  room: Room,
  kind: DesignDocument["kind"],
  cabinets: DesignDocument["cabinets"],
): Room {
  if (room.openings.length) return room;
  const recipe = recipes.find((r) => r.compatibleKinds.includes(kind))!,
    s = recipe.stagedOpening;
  if (!s) return room;
  const sides = [s.wall, "left", "back", "right", "front"] as const;
  for (const side of [...new Set(sides)]) {
    const length =
      side === "back" || side === "front" ? room.width : room.depth;
    if (length < s.width + 40 || room.height < s.sill + s.height + 10) continue;
    for (const offset of [
      (length - s.width) / 2,
      90,
      length - s.width - 20,
      20,
    ]) {
      if (offset < 20 || offset + s.width > length - 20) continue;
      const opening = {
        id: `${recipe.id}-staged-window`,
        wall: side,
        type: "window" as const,
        offset,
        width: s.width,
        height: s.height,
        sill: s.sill,
      };
      if (!openingBlocked(room, opening, cabinets))
        return { ...room, openings: [opening] };
    }
  }
  return room;
}
export function openingBlocked(
  room: Room,
  o: Room["openings"][number],
  cabinets: DesignDocument["cabinets"],
) {
  const a = o.offset / 100,
    b = (o.offset + o.width) / 100,
    y = o.sill / 100,
    h = (o.sill + o.height) / 100,
    w = room.width / 100,
    d = room.depth / 100;
  const v: Volume =
    o.wall === "back"
      ? { min: [a, y, -0.01], max: [b, h, 0.1] }
      : o.wall === "front"
        ? { min: [a, y, d - 0.1], max: [b, h, d + 0.01] }
        : o.wall === "left"
          ? { min: [-0.01, y, a], max: [0.1, h, b] }
          : { min: [w - 0.1, y, a], max: [w + 0.01, h, b] };
  return cabinets.some((c) => {
    const base = c.level === "wall" ? 1.4 : c.level === "wardrobe" ? 0 : 0.1;
    return overlaps(
      v,
      transformedVolume(
        [-c.width / 200, base, -c.depth / 200],
        [c.width / 200, base + c.height / 100, c.depth / 200],
        [c.x / 100, 0, c.z / 100],
        c.rotation,
      ),
    );
  });
}
