import type {
  Cabinet,
  Catalog,
  DesignDocument,
  Module,
  Wall,
} from "../catalog/types";
import { countertopThickness } from "../scene/furnitureMaterials";
import {
  bounds,
  hobCabinet,
  uid,
  validateDesign,
  wallOffset,
  wallPosition,
} from "./layout";

/**
 * Where a unit fits. Every answer is checked with validateDesign, so "where
 * does it fit" and "is this design valid" can never disagree. Pure: used by
 * the Units panel (picture cards, tap to place, suggestions when the room is
 * full) and by the 3D view (highlighted places, dropping a dragged card).
 */
export type SpotOption = { width: number; offset: number };
export type Spot = {
  wall: Wall;
  /** The free stretch along the wall, in cm from the wall's start. */
  gap: [number, number];
  /** Every width that fits, largest first, each with where it starts. */
  options: SpotOption[];
  /** Units touching the free stretch, along the wall. */
  before?: string;
  after?: string;
};
/** Narrow one unit to make room: what to offer when nothing fits. */
export type MakeRoom = {
  cabinetId: string;
  width: number;
  spot: Spot;
};

const wallLength = (wall: Wall, design: DesignDocument) =>
  wall === "left" || wall === "right" ? design.room.depth : design.room.width;
const along = (wall: Wall, b: ReturnType<typeof bounds>): [number, number] =>
  wall === "left" || wall === "right" ? [b.z0, b.z1] : [b.x0, b.x1];
const overlaps = (a0: number, a1: number, b0: number, b1: number) =>
  a0 < b1 - 0.1 && a1 > b0 + 0.1;

/** The walls a unit of this level can go on in this layout. */
export function spotWalls(design: DesignDocument, module: Module): Wall[] {
  const walls: Wall[] = ["back"];
  if (design.layout === "l" || design.layout === "corner") walls.push("left");
  for (const c of design.cabinets)
    if (!walls.includes(c.wall) && c.wall !== "island") walls.push(c.wall);
  // The island takes base units only.
  if (design.layout === "island" && module.level === "base")
    walls.push("island");
  return walls;
}

export function newCabinet(
  module: Module,
  wall: Wall,
  offset: number,
  width: number,
  design: DesignDocument,
): Cabinet {
  return {
    id: uid(),
    moduleId: module.id,
    width,
    height:
      module.level === "wardrobe"
        ? Math.min(module.height, Math.floor(design.room.height / 10) * 10)
        : module.height,
    depth: module.depth,
    level: module.level,
    wall,
    ...wallPosition(wall, offset, width, module.depth, design.room),
  };
}

const withCabinet = (design: DesignDocument, c: Cabinet): DesignDocument => ({
  ...design,
  cabinets: [...design.cabinets, c],
});

/** Free stretches along one wall at the height and depth of this unit. */
function freeGaps(
  design: DesignDocument,
  catalog: Catalog,
  m: Module,
  wall: Wall,
) {
  const length = wallLength(wall, design);
  const probe = newCabinet(m, wall, 0, length, design);
  const p = bounds(probe, countertopThickness(design, catalog, wall));
  const blocked: Array<{ range: [number, number]; id?: string }> = [];
  for (const c of design.cabinets) {
    const b = bounds(c, countertopThickness(design, catalog, c.wall));
    if (
      overlaps(p.x0, p.x1, b.x0, b.x1) &&
      overlaps(p.z0, p.z1, b.z0, b.z1) &&
      overlaps(p.y0, p.y1, b.y0, b.y1)
    )
      blocked.push({ range: along(wall, b), id: c.id });
  }
  if (wall !== "island")
    for (const o of design.room.openings)
      if (o.wall === wall && overlaps(p.y0, p.y1, o.sill, o.sill + o.height))
        blocked.push({ range: [o.offset, o.offset + o.width] });
  blocked.sort((a, b) => a.range[0] - b.range[0]);
  const gaps: Array<{
    gap: [number, number];
    before?: string;
    after?: string;
  }> = [];
  let start = 0,
    before: string | undefined;
  for (const b of blocked) {
    if (b.range[0] > start + 0.5)
      gaps.push({ gap: [start, b.range[0]], before, after: b.id });
    if (b.range[1] >= start) {
      start = b.range[1];
      before = b.id;
    }
  }
  if (length > start + 0.5) gaps.push({ gap: [start, length], before });
  return gaps;
}

/** The corner of an L belongs to both walls: offer it once. */
function sharesSpace(
  design: DesignDocument,
  catalog: Catalog,
  m: Module,
  spots: Spot[],
  wall: Wall,
  option: SpotOption,
) {
  const box = (w: Wall, o: SpotOption) =>
    bounds(
      newCabinet(m, w, o.offset, o.width, design),
      countertopThickness(design, catalog, w),
    );
  const a = box(wall, option);
  return spots.some((s) => {
    const b = box(s.wall, s.options[0]);
    return (
      overlaps(a.x0, a.x1, b.x0, b.x1) &&
      overlaps(a.z0, a.z1, b.z0, b.z1) &&
      overlaps(a.y0, a.y1, b.y0, b.y1)
    );
  });
}

const cache = new WeakMap<DesignDocument, Map<string, Spot[]>>();

/**
 * Every free stretch where a unit of this type fits, with the widths that
 * fit there. A unit goes next to its neighbour: at the start of the stretch,
 * or at its end when only the end touches a unit. Where the aisle or the
 * room's rules forbid that position, positions along the stretch are tried
 * in 10 cm steps.
 */
export function findSpots(
  design: DesignDocument,
  catalog: Catalog,
  moduleId: string,
  only?: Wall,
): Spot[] {
  const key = moduleId + ":" + (only ?? "");
  const known = cache.get(design)?.get(key);
  if (known) return known;
  const m = catalog.modules.find((x) => x.id === moduleId);
  const spots: Spot[] = [];
  if (m && m.kind === design.kind)
    for (const wall of spotWalls(design, m)) {
      if (only && wall !== only) continue;
      // A corner carousel only belongs in a corner.
      if (wall === "island" && m.type === "corner") continue;
      for (const { gap, before, after } of freeGaps(design, catalog, m, wall)) {
        const room = gap[1] - gap[0];
        const atEnd = !before && !!after;
        const options: SpotOption[] = [];
        for (const width of [...m.widths]
          .filter((w) => w <= room + 0.01)
          .sort((a, b) => b - a)) {
          const aligned = atEnd ? gap[1] - width : gap[0];
          const tries = [aligned];
          for (let o = gap[0]; o + width <= gap[1] + 0.01; o += 10)
            if (Math.abs(o - aligned) > 0.5) tries.push(o);
          for (const offset of tries) {
            if (
              validateDesign(
                withCabinet(design, newCabinet(m, wall, offset, width, design)),
                catalog,
              )
            ) {
              options.push({ width, offset });
              break;
            }
          }
        }
        if (
          options.length &&
          !sharesSpace(design, catalog, m, spots, wall, options[0])
        )
          spots.push({ wall, gap, options, before, after });
      }
    }
  if (!cache.has(design)) cache.set(design, new Map());
  cache.get(design)!.set(key, spots);
  return spots;
}

/** The design with a new unit at this spot, or null if it does not fit. */
export function placeUnit(
  design: DesignDocument,
  catalog: Catalog,
  moduleId: string,
  spot: Spot,
  width = spot.options[0]?.width,
): { design: DesignDocument; id: string } | null {
  const m = catalog.modules.find((x) => x.id === moduleId);
  const option = spot.options.find((o) => o.width === width);
  if (!m || !option) return null;
  const c = newCabinet(m, spot.wall, option.offset, option.width, design);
  const next = withCabinet(design, c);
  return validateDesign(next, catalog) ? { design: next, id: c.id } : null;
}

function swapped(
  design: DesignDocument,
  catalog: Catalog,
  c: Cabinet,
  m: Module,
  width: number,
  keepEnd = false,
): DesignDocument | null {
  const offset = keepEnd ? wallOffset(c) + c.width - width : wallOffset(c);
  const next: Cabinet = {
    ...c,
    moduleId: m.id,
    width,
    depth: m.depth,
    level: m.level,
    height:
      m.level === "wardrobe"
        ? Math.min(c.height, m.height)
        : c.moduleId === m.id
          ? c.height
          : m.height,
    ...wallPosition(c.wall, offset, width, m.depth, design.room),
  };
  if (c.wall === "island") next.z = c.z;
  const d = {
    ...design,
    cabinets: design.cabinets.map((x) => (x.id === c.id ? next : x)),
  };
  if (validateDesign(d, catalog)) return d;
  // A different interior may not fit the new unit; the included one does.
  if (next.interior) {
    delete next.interior;
    if (validateDesign(d, catalog)) return d;
  }
  return null;
}

/** The same unit at another width: keeps its start, else its end. */
export function resizeUnit(
  design: DesignDocument,
  catalog: Catalog,
  cabinetId: string,
  width: number,
): DesignDocument | null {
  const c = design.cabinets.find((x) => x.id === cabinetId);
  const m = catalog.modules.find((x) => x.id === c?.moduleId);
  if (!c || !m || !m.widths.includes(width)) return null;
  return (
    swapped(design, catalog, c, m, width) ??
    swapped(design, catalog, c, m, width, true)
  );
}

/**
 * Another unit type in the same place: the same width when the new type
 * comes in it, otherwise the nearest narrower width (then wider).
 */
export function replaceUnit(
  design: DesignDocument,
  catalog: Catalog,
  cabinetId: string,
  moduleId: string,
): DesignDocument | null {
  const c = design.cabinets.find((x) => x.id === cabinetId);
  const m = catalog.modules.find((x) => x.id === moduleId);
  if (!c || !m || m.kind !== design.kind || m.level !== c.level) return null;
  if (m.type === "corner" && c.wall === "island") return null;
  const widths = [
    ...m.widths.filter((w) => w <= c.width).sort((a, b) => b - a),
    ...m.widths.filter((w) => w > c.width).sort((a, b) => a - b),
  ];
  for (const width of widths) {
    const d =
      swapped(design, catalog, c, m, width) ??
      swapped(design, catalog, c, m, width, true);
    if (d) return d;
  }
  return null;
}

/** Sink, hob and hood, oven, fridge and corner: never suggested for
 * replacing or narrowing (the customer can still change them directly). */
const ESSENTIAL_TYPES = ["sink", "oven", "fridge", "corner", "hood"];
function essential(design: DesignDocument, catalog: Catalog, c: Cabinet) {
  const type = catalog.modules.find((m) => m.id === c.moduleId)?.type ?? "";
  return (
    ESSENTIAL_TYPES.includes(type) || c.id === hobCabinet(design, catalog)?.id
  );
}

/** Units this type could replace when there is no free space for it. */
export function replaceable(
  design: DesignDocument,
  catalog: Catalog,
  moduleId: string,
): Array<{ cabinetId: string; width: number }> {
  const out: Array<{ cabinetId: string; width: number; same: boolean }> = [];
  for (const c of design.cabinets) {
    if (c.moduleId === moduleId || essential(design, catalog, c)) continue;
    const d = replaceUnit(design, catalog, c.id, moduleId);
    const width = d?.cabinets.find((x) => x.id === c.id)?.width;
    if (width) out.push({ cabinetId: c.id, width, same: width === c.width });
  }
  return out.sort((a, b) => Number(b.same) - Number(a.same));
}

/**
 * Narrowing one unit beside free space so that this type fits: "make the
 * 80 cm unit 60 cm". The smallest change per unit, at most `limit`.
 */
export function makeRoom(
  design: DesignDocument,
  catalog: Catalog,
  moduleId: string,
  limit = 3,
): MakeRoom[] {
  const m = catalog.modules.find((x) => x.id === moduleId);
  if (!m) return [];
  const out: MakeRoom[] = [];
  for (const c of design.cabinets) {
    if (out.length >= limit) break;
    const own = catalog.modules.find((x) => x.id === c.moduleId);
    if (
      !own ||
      c.level !== m.level ||
      c.interior ||
      essential(design, catalog, c)
    )
      continue;
    found: for (const width of own.widths
      .filter((w) => w < c.width)
      .sort((a, b) => b - a))
      for (const keepEnd of [false, true]) {
        const d = swapped(design, catalog, c, own, width, keepEnd);
        if (!d) continue;
        const freed: [number, number] = keepEnd
          ? [wallOffset(c), wallOffset(c) + c.width - width]
          : [wallOffset(c) + width, wallOffset(c) + c.width];
        const spot = findSpots(d, catalog, moduleId, c.wall).find(
          (s) => s.gap[0] <= freed[0] + 0.5 && s.gap[1] >= freed[1] - 0.5,
        );
        if (spot) {
          out.push({ cabinetId: c.id, width, spot });
          break found;
        }
      }
  }
  return out;
}

/** Applies a MakeRoom suggestion and adds the unit, as one edit. */
export function makeRoomAndPlace(
  design: DesignDocument,
  catalog: Catalog,
  moduleId: string,
  suggestion: MakeRoom,
): { design: DesignDocument; id: string } | null {
  const narrowed = resizeUnit(
    design,
    catalog,
    suggestion.cabinetId,
    suggestion.width,
  );
  if (!narrowed) return null;
  const spot = findSpots(
    narrowed,
    catalog,
    moduleId,
    suggestion.spot.wall,
  ).find(
    (s) =>
      Math.abs(s.gap[0] - suggestion.spot.gap[0]) < 0.5 &&
      Math.abs(s.gap[1] - suggestion.spot.gap[1]) < 0.5,
  );
  return spot ? placeUnit(narrowed, catalog, moduleId, spot) : null;
}
