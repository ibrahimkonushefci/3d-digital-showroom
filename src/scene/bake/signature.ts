import type { DesignDocument } from "../../catalog/types";
import { resolveRoom } from "../rooms/resolveRoom";

/** Bumped whenever the bake scene (lights, occluders, shell layout) changes. */
export const BAKE_REVISION = "room-bake-v2";

/**
 * What a room-shell lightmap depends on: the room, its openings and where the
 * furniture stands. Finishes (fronts, worktop, walls, floor), handles, open
 * fronts and cabinet ids do not: a finish swap keeps the bake,
 * as albedo is applied over the same light. Cabinet ids are regenerated on
 * every load, so cabinets are sorted by position instead.
 */
export function bakeKey(design: DesignDocument): string {
  const room = design.room;
  return JSON.stringify([
    BAKE_REVISION,
    design.kind,
    resolveRoom(design).recipe.id,
    [room.width, room.depth, room.height],
    // Under-cabinet / wardrobe LEDs light the wall behind them.
    design.kind === "wardrobe"
      ? !!design.environment?.internalLed
      : !!design.style.led,
    room.openings
      .map((o) => [o.wall, o.type, o.offset, o.width, o.height, o.sill])
      .sort(),
    design.cabinets
      .map((c) => [
        c.moduleId,
        c.level,
        c.wall,
        c.x,
        c.z,
        c.rotation,
        c.width,
        c.height,
        c.depth,
      ])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  ]);
}

/** Short, stable id for file names (FNV-1a, 32 bit). */
export function bakeSignature(design: DesignDocument): string {
  const key = bakeKey(design);
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
