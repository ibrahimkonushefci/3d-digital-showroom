import type { Catalog, DesignDocument } from "../../catalog/types";
import { roomStaging } from "../rooms/staging";
import { resolveRoom } from "../rooms/resolveRoom";

/** Bumped whenever the bake scene (lights, occluders, shell layout) changes. */
export const BAKE_REVISION = "room-bake-v4-staging";

/**
 * What a room-shell lightmap depends on: the room, its openings, where the
 * furniture stands and where the staged room furniture stands (its shadows
 * are in the bake: a moved chair or chest must never leave its old shadow
 * on a wall). Finishes (fronts, worktop, walls, floor), handles, open
 * fronts and cabinet ids do not: a finish swap keeps the bake,
 * as albedo is applied over the same light. Cabinet ids are regenerated on
 * every load, so cabinets are sorted by position instead.
 */
export function bakeKey(design: DesignDocument, catalog: Catalog): string {
  const room = design.room;
  const envelope = resolveRoom(design).envelope.room;
  return JSON.stringify([
    BAKE_REVISION,
    design.kind,
    resolveRoom(design).recipe.id,
    [room.width, room.depth, room.height],
    [envelope.width, envelope.depth, envelope.cx, envelope.cz],
    envelope.openings
      .filter((o) => o.id.startsWith("envelope"))
      .map((o) => [o.wall, o.offset, o.width, o.height, o.sill]),
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
    stagingKey(design, catalog),
  ]);
}

/** Staged pieces, rounded to the centimetre. */
function stagingKey(design: DesignDocument, catalog: Catalog) {
  const r = (n: number) => Math.round(n * 100);
  const staging = roomStaging(design, catalog);
  return [
    ...staging.models.map((m) => [m.id, ...m.position.map(r), r(m.rotation[1])]),
    ...staging.built.map((b) => [b.type, ...b.position.map(r), r(b.yaw)]),
  ]
    .map((x) => x.join(","))
    .sort();
}

/** Short, stable id for file names (FNV-1a, 32 bit). */
export function bakeSignature(design: DesignDocument, catalog: Catalog): string {
  const key = bakeKey(design, catalog);
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
