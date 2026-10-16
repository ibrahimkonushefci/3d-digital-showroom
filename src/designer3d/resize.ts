import type {
  Cabinet,
  Catalog,
  DesignDocument,
  Layout,
  Room,
  Wall,
} from "../catalog/types";
import { presetRoom, openingBlocked } from "../scene/rooms/resolveRoom";
import {
  generateLayout,
  hobCabinet,
  uid,
  validateDesign,
  wallOffset,
  wallPosition,
} from "./layout";

/**
 * Predictable room changes. The units stay, in their order, and each wall
 * run stays attached to the corner it starts from (the back-left corner).
 * Extra length is used by a new standard unit when there is room for one,
 * otherwise by widening flexible units near the open end of the run; less
 * length first uses the free space at the end of the run, then narrows
 * flexible units, and only then removes the least important units. The
 * sink, hob and hood, oven, fridge and corner unit always stay, and every
 * wall run keeps at least one unit: a room too small for them is rejected
 * (see smallestRoom for the size that works).
 */
export type ResizeResult = {
  design: DesignDocument;
  added: number;
  removed: number;
  resized: number;
  /** The layout needed its prepared room size instead of the current one. */
  roomChanged?: boolean;
};

const WALL_RUNS: Wall[] = ["back", "left", "right", "front"];
/** Appliances, sinks, corners and the hob keep their size. */
const FIXED_TYPES = ["sink", "dishwasher", "oven", "fridge", "corner", "hood"];
/** Never removed by a resize: a kitchen without them is not a kitchen. */
const ESSENTIAL_TYPES = ["sink", "oven", "fridge", "corner", "hood"];
const MIN_WIDTH = 40;

type Column = {
  floor: Cabinet;
  /** Wall cabinets exactly above this unit: they follow its width. */
  uppers: Cabinet[];
  flexible: boolean;
  /** Lower = removed first when space runs out; essential ones never are. */
  importance: number;
  essential: boolean;
  width: number;
  removed: boolean;
};

const wallLength = (wall: Wall, room: Room) =>
  wall === "left" || wall === "right" ? room.depth : room.width;

export function resizeRoom(
  design: DesignDocument,
  nextRoom: Pick<Room, "width" | "depth" | "height">,
  catalog: Catalog,
): ResizeResult | null {
  const room: Room = {
    ...design.room,
    width: nextRoom.width,
    depth: nextRoom.depth,
    height: nextRoom.height,
  };
  const kitchen = design.kind === "kitchen";
  const moduleOf = (c: Cabinet) =>
    catalog.modules.find((m) => m.id === c.moduleId);
  const hob = hobCabinet(design, catalog);
  let added = 0,
    removed = 0;
  const resizedIds = new Set<string>();
  const out: Cabinet[] = [];

  for (const wall of WALL_RUNS) {
    const onWall = design.cabinets.filter((c) => c.wall === wall);
    if (!onWall.length) continue;
    const floors = onWall
      .filter((c) => c.level !== "wall")
      .sort((a, b) => wallOffset(a) - wallOffset(b));
    const uppers = onWall.filter((c) => c.level === "wall");
    const aligned = new Set<string>();
    const columns: Column[] = floors.map((floor) => {
      const above = uppers.filter(
        (u) =>
          Math.abs(wallOffset(u) - wallOffset(floor)) < 1 &&
          u.width === floor.width,
      );
      above.forEach((u) => aligned.add(u.id));
      const type = moduleOf(floor)?.type ?? "";
      const fixed =
        FIXED_TYPES.includes(type) ||
        floor.id === hob?.id ||
        !!floor.interior ||
        above.some((u) => FIXED_TYPES.includes(moduleOf(u)?.type ?? ""));
      const essential =
        floor.id === hob?.id ||
        [floor, ...above].some((p) =>
          ESSENTIAL_TYPES.includes(moduleOf(p)?.type ?? ""),
        );
      return {
        floor,
        uppers: above,
        flexible: !fixed,
        importance: fixed ? 2 : type === "pantry" ? 1 : 0,
        essential,
        width: floor.width,
        removed: false,
      };
    });
    const freeUppers = uppers.filter((u) => !aligned.has(u.id));
    const oldLength = wallLength(wall, design.room),
      newLength = wallLength(wall, room);
    const runEnd = Math.max(...onWall.map((c) => wallOffset(c) + c.width));
    const gap = Math.max(0, oldLength - runEnd);
    const delta = newLength - oldLength;

    // A width every unit of the column supports, one step up or down.
    const step = (col: Column, dir: 1 | -1) => {
      const parts = [col.floor, ...col.uppers];
      const options = moduleOf(col.floor)!
        .widths.filter((w) =>
          parts.every((p) => moduleOf(p)!.widths.includes(w)),
        )
        .filter((w) =>
          dir > 0 ? w > col.width : w < col.width && w >= MIN_WIDTH,
        )
        .sort((a, b) => (dir > 0 ? a - b : b - a));
      return options[0];
    };
    const fromEnd = () =>
      columns.filter((c) => c.flexible && !c.removed).reverse();
    const appended: Column[] = [];
    const appendColumn = (width: number) => {
      const template = [...columns, ...appended]
        .reverse()
        .find((c) => c.flexible && !c.removed);
      if (!template) return false;
      const floorModule = moduleOf(template.floor)!;
      const next = nextModule(floorModule.id, kitchen);
      const m = catalog.modules.find((x) => x.id === next) ?? floorModule;
      if (!m.widths.includes(width)) return false;
      const floor: Cabinet = {
        ...template.floor,
        id: uid(),
        moduleId: m.id,
        width,
        depth: m.depth,
        height:
          m.level === "wardrobe"
            ? Math.min(m.height, Math.floor(room.height / 10) * 10)
            : m.height,
        level: m.level,
      };
      delete floor.interior;
      delete floor.finishOverride;
      const above = template.uppers
        .filter((u) => moduleOf(u)!.widths.includes(width))
        .slice(0, 1)
        .map((u) => {
          const copy: Cabinet = { ...u, id: uid(), width };
          delete copy.finishOverride;
          return copy;
        });
      appended.push({
        floor,
        uppers: above,
        flexible: true,
        importance: 0,
        essential: false,
        width,
        removed: false,
      });
      added += 1 + above.length;
      return true;
    };

    if (delta > 0) {
      let growth = delta;
      const standard = kitchen ? 60 : 80;
      while (growth >= standard && appendColumn(standard)) growth -= standard;
      for (let changed = true; changed && growth >= 5;) {
        changed = false;
        for (const col of fromEnd()) {
          const w = step(col, 1);
          if (w && w - col.width <= growth) {
            growth -= w - col.width;
            col.width = w;
            changed = true;
          }
        }
      }
      if (growth >= 30) {
        const m = moduleOf(
          [...columns].reverse().find((c) => c.flexible)?.floor ??
            columns[0].floor,
        );
        const w = m?.widths.filter((w) => w <= growth).sort((a, b) => b - a)[0];
        if (w) appendColumn(w);
      }
    } else if (delta < 0) {
      let need = -delta - gap;
      // A whole unit's worth: one unit fewer reads better than several
      // narrower ones (the mirror of adding a standard unit).
      const standard = kitchen ? 60 : 80;
      // A run always keeps at least one unit.
      const remaining = () => columns.filter((c) => !c.removed).length;
      while (need >= standard && remaining() > 1) {
        const pick = columns
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.flexible && !c.removed)
          .sort((a, b) => b.i - a.i)[0];
        if (!pick) break;
        pick.c.removed = true;
        removed += 1 + pick.c.uppers.length;
        need -= pick.c.width;
      }
      for (let changed = true; changed && need > 0;) {
        changed = false;
        for (const col of fromEnd()) {
          if (need <= 0) break;
          const w = step(col, -1);
          if (w) {
            need -= col.width - w;
            col.width = w;
            changed = true;
          }
        }
      }
      while (need > 0) {
        if (remaining() <= 1) return null;
        const candidates = columns
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => !c.removed && !c.essential)
          .sort((a, b) => a.c.importance - b.c.importance || b.i - a.i);
        const pick = candidates[0];
        if (!pick) return null;
        pick.c.removed = true;
        removed += 1 + pick.c.uppers.length;
        need -= pick.c.width;
      }
    }

    // Lay the run out again: the space between units stays as it was.
    let shift = 0;
    const columnShift = new Map<string, number>();
    let lastEnd = 0;
    for (const col of columns) {
      const offset = wallOffset(col.floor) + shift;
      columnShift.set(col.floor.id, shift);
      if (col.removed) {
        shift -= col.floor.width;
        continue;
      }
      if (col.width !== col.floor.width) resizedIds.add(col.floor.id);
      for (const part of [col.floor, ...col.uppers])
        out.push(place(part, wall, offset, col.width, room));
      shift += col.width - col.floor.width;
      lastEnd = offset + col.width;
    }
    for (const col of appended) {
      for (const part of [col.floor, ...col.uppers])
        out.push(place(part, wall, lastEnd, col.width, room));
      lastEnd += col.width;
    }
    for (const u of freeUppers) {
      // Follows the unit below its start, if any.
      const anchor = [...columns]
        .reverse()
        .find((c) => wallOffset(c.floor) <= wallOffset(u) + 1);
      const offset =
        wallOffset(u) + (anchor ? columnShift.get(anchor.floor.id)! : 0);
      if (offset + u.width > newLength) {
        if (ESSENTIAL_TYPES.includes(moduleOf(u)?.type ?? "")) return null;
        removed++;
        continue;
      }
      out.push(place(u, wall, offset, u.width, room));
    }
  }
  // The island stays in the middle of the room.
  for (const c of design.cabinets.filter((c) => c.wall === "island"))
    out.push(
      place(
        c,
        "island",
        wallOffset(c) + (room.width - design.room.width) / 2,
        c.width,
        room,
      ),
    );
  // Wardrobes stay full height; a lower custom height is kept.
  const limit = Math.floor(room.height / 10) * 10,
    oldLimit = Math.floor(design.room.height / 10) * 10;
  for (const c of out)
    if (c.level === "wardrobe") {
      const max = moduleOf(c)!.height;
      const wasFull = c.height >= Math.min(max, oldLimit);
      c.height = Math.min(max, wasFull ? limit : Math.min(c.height, limit));
    }
  const order = new Map(design.cabinets.map((c, i) => [c.id, i]));
  out.sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  const next: DesignDocument = {
    ...design,
    room: { ...room, openings: fitOpenings(design, room, out) },
    cabinets: out,
  };
  if (!validateDesign(next, catalog)) return null;
  return { design: next, added, removed, resized: resizedIds.size };
}

/**
 * The smallest room, from the requested size upwards in 10 cm steps, that
 * keeps the essential units: what to suggest when a size is rejected.
 */
export function smallestRoom(
  design: DesignDocument,
  requested: Pick<Room, "width" | "depth" | "height">,
  catalog: Catalog,
  max = 800,
): Pick<Room, "width" | "depth"> | null {
  const fits = (width: number, depth: number) =>
    !!resizeRoom(design, { ...requested, width, depth }, catalog);
  const safeDepth = Math.max(requested.depth, design.room.depth);
  let width = requested.width;
  while (width <= max && !fits(width, safeDepth)) width += 10;
  if (width > max) return null;
  let depth = requested.depth;
  while (depth < safeDepth && !fits(width, depth)) depth += 10;
  return { width, depth };
}

function place(
  c: Cabinet,
  wall: Wall,
  offset: number,
  width: number,
  room: Room,
): Cabinet {
  return {
    ...c,
    width,
    ...wallPosition(wall, offset, width, c.depth, room),
  };
}

/** The next unit type when a run gets longer, as the generator alternates. */
function nextModule(id: string, kitchen: boolean) {
  if (kitchen) return id === "base-drawers" ? "base-doors" : "base-drawers";
  const cycle = [
    "wardrobe-hanging",
    "wardrobe-shelves",
    "wardrobe-drawers",
    "wardrobe-sliding",
  ];
  const i = cycle.indexOf(id);
  return i < 0 ? id : cycle[(i + 1) % cycle.length];
}

/** Windows and doors stay where they are while they still fit; the staged
 * window of a prepared room moves to the next free place otherwise. */
function fitOpenings(design: DesignDocument, room: Room, cabinets: Cabinet[]) {
  const kept: Room["openings"] = [];
  let restage = false;
  for (const o of design.room.openings) {
    const length = wallLength(o.wall, room);
    const offset = Math.min(o.offset, length - o.width - 10);
    const moved = { ...o, offset };
    const fits =
      offset >= 0 &&
      o.sill + o.height <= room.height &&
      !openingBlocked(room, moved, cabinets);
    if (fits) kept.push(moved);
    else if (o.id.endsWith("-staged-window")) restage = true;
  }
  if (!restage) return kept;
  const staged = presetRoom({ ...room, openings: [] }, design.kind, cabinets);
  const window = staged.openings[0];
  return window && !kept.some((o) => o.wall === window.wall)
    ? [...kept, window]
    : kept;
}

/**
 * A layout button starts from that layout's prepared design (the same
 * units as on Home), fitted to the current room and keeping the current
 * finishes. Falls back to the prepared room size when the current room is
 * too small for the layout, and to the generator for brands without one.
 */
export function switchLayout(
  design: DesignDocument,
  layout: Layout,
  catalog: Catalog,
  prepared: DesignDocument | undefined,
): ResizeResult | null {
  if (!prepared) {
    const next = generateLayout({ ...design, layout }, catalog);
    return next ? { design: next, added: 0, removed: 0, resized: 0 } : null;
  }
  const island = design.cabinets.some((c) => c.wall === "island");
  const start: DesignDocument = {
    ...design,
    layout,
    room: prepared.room,
    cabinets: prepared.cabinets.map((c) => ({ ...c, id: uid() })),
    finishZones:
      layout === "island" || !island
        ? design.finishZones
        : withoutIsland(design.finishZones),
    worktopFinishes:
      layout === "island"
        ? design.worktopFinishes
        : mainOnly(design.worktopFinishes),
  };
  if (!validateDesign(start, catalog)) {
    // Finishes of the current design that the prepared one cannot carry.
    const plain = {
      ...start,
      finishZones: undefined,
      worktopFinishes: undefined,
    };
    if (!validateDesign(plain, catalog)) return null;
    Object.assign(start, plain);
  }
  const fitted = resizeRoom(start, design.room, catalog);
  const keepsShape =
    fitted &&
    (layout !== "island" ||
      fitted.design.cabinets.some((c) => c.wall === "island"));
  if (fitted && keepsShape) return { ...fitted, added: 0, removed: 0 };
  return { design: start, added: 0, removed: 0, resized: 0, roomChanged: true };
}
const withoutIsland = (zones: DesignDocument["finishZones"]) => {
  if (!zones?.island) return zones;
  const { island: _, ...rest } = zones;
  return Object.keys(rest).length ? rest : undefined;
};
const mainOnly = (tops: DesignDocument["worktopFinishes"]) =>
  tops?.main ? { main: tops.main } : undefined;
