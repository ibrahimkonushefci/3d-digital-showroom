import type { DesignDocument, Room } from "../../catalog/types";
import type { WallSide } from "./stance";

/**
 * The presentation room: the larger space of the home the furniture stands
 * in. `design.room` stays the editable kitchen or wardrobe space (fitting,
 * resizing, prices and the Room tab never see the envelope); the envelope
 * only decides what is drawn around it and where cameras and staged objects
 * may go.
 *
 * Walls that carry units stay where they are. The other walls move outwards,
 * so the kitchen gets a dining area and the wardrobe a dressing area beside
 * and in front of it. A tall unit standing against a wall that moves keeps a
 * short return wall beside it (the run reads as built into a recess, never
 * as a cut end). The envelope adds its own architecture: a tall garden
 * window or glazed door on the back wall beside the run and a doorway with a
 * glimpse of the next room.
 */

/** Openings of the presentation room. Design openings keep their type;
 * the envelope's own ones carry a `style`. */
export type EnvelopeOpening = Room["openings"][number] & {
  style?: "garden-door" | "passage";
};
/** The envelope as a Room (cm), plus its centre in the design's centred
 * scene frame (metres), which the camera/wall tests need. */
export type EnvelopeRoom = Omit<Room, "openings"> & {
  openings: EnvelopeOpening[];
  cx: number;
  cz: number;
};
export type ReturnWall = {
  /** Room-corner frame of the design room, metres. */
  position: [number, number, number];
  size: [number, number, number];
  side: WallSide;
};
/** Built-in architecture of the presentation room. */
export type Bulkhead = {
  /** Corner frame of the design room, metres: span along the back wall. */
  x0: number;
  x1: number;
  depth: number;
  drop: number;
};
export type SlatWall = {
  wall: WallSide;
  /** Along the envelope wall from its start, metres. */
  a: number;
  b: number;
};
export type Envelope = {
  room: EnvelopeRoom;
  /** Lowered ceiling over the kitchen's back run, with downlights. */
  bulkhead: Bulkhead | null;
  /** Oak slatted feature wall beside the dining or reading group. */
  slats: SlatWall | null;
  /** Envelope corner in the design room's corner frame, metres. */
  origin: [number, number];
  /** How far each wall moved out, metres. */
  moved: Record<WallSide, number>;
  returns: ReturnWall[];
};

/** Target presentation sizes (metres). */
const TARGET = {
  kitchen: { width: 7.0, depth: 6.4 },
  island: { width: 6.8, depth: 6.8 },
  wardrobe: { width: 5.6, depth: 5.8 },
};
const MAX_EXTRA = 3;
/** Share of the extra width a free left side gets when both sides are free;
 * the rest goes right (the dining or dressing area). */
const LEFT_SHARE = 0.3;

const cache = new Map<string, Envelope>();

function tallTouches(design: DesignDocument, side: "left" | "right") {
  const w = design.room.width / 100;
  return design.cabinets.filter((c) => {
    if (c.level !== "tall" && c.level !== "wardrobe") return false;
    const half =
      (Math.abs(Math.cos(c.rotation)) * c.width +
        Math.abs(Math.sin(c.rotation)) * c.depth) /
      200;
    const x = c.x / 100;
    return side === "left" ? x - half < 0.05 : x + half > w - 0.05;
  });
}

export function presentationEnvelope(design: DesignDocument): Envelope {
  const key = JSON.stringify([
    design.kind,
    design.layout,
    design.room,
    design.cabinets.map((c) => [c.wall, c.level, c.x, c.z, c.width, c.depth]),
  ]);
  const hit = cache.get(key);
  if (hit) return hit;
  const result = build(design);
  if (cache.size > 32) cache.clear();
  cache.set(key, result);
  return result;
}

function build(design: DesignDocument): Envelope {
  const w = design.room.width / 100,
    d = design.room.depth / 100;
  const held = new Set<WallSide>(
    design.cabinets
      .map((c) => c.wall)
      .filter((wall): wall is WallSide => wall !== "island"),
  );
  // The back wall carries the run in every layout; it never moves.
  held.add("back");
  // A tall unit standing against a side keeps that wall (a tall column
  // ending in open space looks unfinished), unless tall units close both
  // sides: then the right wall still moves and the run keeps a short return
  // wall there, as if built into a recess.
  const tallLeft = tallTouches(design, "left").length > 0,
    tallRight = tallTouches(design, "right").length > 0;
  if (tallLeft) held.add("left");
  if (tallRight && !tallLeft) held.add("right");
  const target =
    design.kind === "wardrobe"
      ? TARGET.wardrobe
      : design.cabinets.some((c) => c.wall === "island")
        ? TARGET.island
        : TARGET.kitchen;
  const extraX = Math.min(MAX_EXTRA * 1.4, Math.max(1.2, target.width - w));
  const freeLeft = !held.has("left"),
    freeRight = !held.has("right");
  const moved: Record<WallSide, number> = {
    back: 0,
    front: held.has("front")
      ? 0
      : Math.min(MAX_EXTRA, Math.max(1.2, target.depth - d)),
    left: 0,
    right: 0,
  };
  if (freeLeft && freeRight) {
    moved.left = Math.min(MAX_EXTRA, extraX * LEFT_SHARE);
    moved.right = Math.min(MAX_EXTRA, extraX - moved.left);
  } else if (freeRight) moved.right = Math.min(MAX_EXTRA, extraX);
  else if (freeLeft) moved.left = Math.min(MAX_EXTRA, extraX);
  const ox = -moved.left,
    oz = -moved.back;
  const W = w + moved.left + moved.right,
    D = d + moved.back + moved.front,
    h = design.room.height / 100;
  // Design openings keep their wall; their offsets are re-measured from the
  // envelope's corner.
  const openings: EnvelopeOpening[] = design.room.openings.map((o) => ({
    ...o,
    offset:
      o.offset +
      Math.round(
        (o.wall === "back" || o.wall === "front" ? -ox : -oz) * 100,
      ),
  }));
  const returns: ReturnWall[] = [];
  for (const side of ["left", "right"] as const) {
    if (!moved[side]) continue;
    const tall = tallTouches(design, side);
    if (!tall.length) continue;
    const reach = Math.max(
      ...tall.map((c) => {
        const half =
          (Math.abs(Math.sin(c.rotation)) * c.width +
            Math.abs(Math.cos(c.rotation)) * c.depth) /
          200;
        return c.z / 100 + half;
      }),
    );
    const depth = Math.min(d, reach + 0.06);
    const t = 0.12;
    returns.push({
      side,
      size: [t, h, depth],
      position: [side === "left" ? -t / 2 : w + t / 2, h / 2, depth / 2],
    });
  }
  // Architecture of the envelope (cm along each envelope wall).
  const cm = (m: number) => Math.round(m * 100);
  const H = design.room.height;
  // Daylight beside the run, in the added width of the back wall: a glazed
  // garden door for kitchens (Schmidt-like), a tall window for dressing
  // rooms (beside any window the design itself has).
  const backFree = (side: "left" | "right") => moved[side] - 0.25;
  const gardenSide: "left" | "right" | null =
    backFree("right") >= 1.3 ? "right" : backFree("left") >= 1.3 ? "left" : null;
  if (gardenSide) {
    const span = Math.min(design.kind === "kitchen" ? 2.2 : 1.4, backFree(gardenSide) - 0.15);
    const start =
      gardenSide === "right"
        ? w + moved.left + (moved.right - span) / 2 + 0.1
        : (moved.left - span) / 2 - 0.1;
    const sill = design.kind === "kitchen" ? 0 : 45;
    openings.push({
      id: "envelope-garden",
      wall: "back",
      type: "window",
      style: design.kind === "kitchen" ? "garden-door" : undefined,
      offset: cm(Math.max(0.2, start)),
      width: cm(span),
      height: Math.min(H - 25, 235) - sill,
      sill,
    });
  }
  // Doorway to the next room: on the moved side wall, near the front, so
  // the main view looks through it at an angle.
  const passageSide: "left" | "right" | null =
    moved.right > 0 ? "right" : moved.left > 0 ? "left" : null;
  if (passageSide && D > 3.4) {
    const width = 1.1;
    openings.push({
      id: "envelope-passage",
      wall: passageSide,
      type: "door",
      style: "passage",
      // Mid-wall, past the dining area: in view from the main stance.
      offset: cm(Math.min(D - width - 0.6, Math.max(3.0, D * 0.5))),
      width: cm(width),
      height: Math.min(H - 35, 215),
      sill: 0,
    });
  }
  // Lowered ceiling over the back run (kitchens), clear of the tallest unit.
  let bulkhead: Bulkhead | null = null;
  const back = design.cabinets.filter((c) => c.wall === "back");
  if (design.kind === "kitchen" && back.length) {
    const top = Math.max(
      ...design.cabinets.map(
        (c) =>
          (c.level === "wall" ? 1.4 : c.level === "base" ? 0.1 : 0.1) +
          c.height / 100,
      ),
    );
    const drop = 0.24;
    if (h - drop >= top + 0.18) {
      const bx0 = Math.min(...back.map((c) => c.x / 100 - c.width / 200)),
        bx1 = Math.max(...back.map((c) => c.x / 100 + c.width / 200));
      bulkhead = {
        x0: Math.max(ox, bx0 - 0.15),
        x1: Math.min(ox + W, bx1 + 0.15),
        depth: 0.8,
        drop,
      };
    }
  }
  // Slatted oak on the side wall the dining/reading group stands by, from
  // the back corner to the doorway.
  let slats: SlatWall | null = null;
  const passage = openings.find((o) => o.style === "passage");
  if (passage && design.kind === "kitchen") {
    const b = passage.offset / 100 - 0.25;
    if (b > 1.4) slats = { wall: passage.wall, a: 0.12, b };
  }
  const room: EnvelopeRoom = {
    width: cm(W),
    depth: cm(D),
    height: H,
    openings,
    // Envelope centre in the design's centred frame.
    cx: ox + W / 2 - w / 2,
    cz: oz + D / 2 - d / 2,
  };
  return { room, origin: [ox, oz], moved, returns, bulkhead, slats };
}

/** Envelope bounds in the design's centred scene frame (metres). */
export function envelopeBounds(room: { width: number; depth: number; cx?: number; cz?: number }) {
  const halfW = room.width / 200,
    halfD = room.depth / 200,
    cx = room.cx ?? 0,
    cz = room.cz ?? 0;
  return {
    minX: cx - halfW,
    maxX: cx + halfW,
    minZ: cz - halfD,
    maxZ: cz + halfD,
  };
}
