import type { Cabinet, Catalog, DesignDocument } from "../../catalog/types";
import { hobCabinet, wallOffset } from "../../designer3d/layout";
import { countertopThickness } from "../furnitureMaterials";
import { modelRecord } from "../assets/manifest";

export type DecorItem = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  /** Hangs on this wall, so it hides whenever the wall is cut away. */
  wall?: Side;
};
type Side = "back" | "left" | "right" | "front";

const moduleType = (c: Cabinet, catalog: Catalog) =>
  catalog.modules.find((m) => m.id === c.moduleId)?.type ?? "";

/** Room-corner coordinates of a point given in a cabinet's own frame. */
function onCabinet(
  c: Cabinet,
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  return [
    c.x / 100 + x * Math.cos(c.rotation) + z * Math.sin(c.rotation),
    y,
    c.z / 100 - x * Math.sin(c.rotation) + z * Math.cos(c.rotation),
  ];
}

/**
 * A few restrained, unpriced objects on free worktop: a plant near the
 * window end, a vase at the far end, a board beside the hob and fruit on
 * the island. Never on the sink, hob or corner. A cabinet holds one object,
 * except that a short run's board may share a ≥ 60 cm top with one slim one.
 * Wall-cabinet clearance (≥45 cm) covers the tallest piece (40 cm vase).
 */
export function worktopDecor(
  design: DesignDocument,
  catalog: Catalog,
  taken: readonly string[] = [],
): DecorItem[] {
  if (design.kind !== "kitchen" || design.cabinets.length >= 24) return [];
  const hob = hobCabinet(design, catalog);
  const worktop = (types: string[]) =>
    design.cabinets.filter(
      (c) =>
        c.level === "base" &&
        c.wall !== "island" &&
        c.width >= 40 &&
        types.includes(moduleType(c, catalog)) &&
        c.id !== hob?.id &&
        !taken.includes(c.id),
    );
  let candidates = worktop(["doors", "drawers"]);
  // A short run has little plain worktop: the dishwasher's top is plain
  // worktop too (no cutout), so it may be dressed when space runs out.
  if (candidates.length < 3)
    candidates = [...candidates, ...worktop(["dishwasher"])];
  const free = candidates.sort(
    (a, b) =>
      ["back", "left", "right", "front"].indexOf(a.wall) -
        ["back", "left", "right", "front"].indexOf(b.wall) ||
      wallOffset(a) - wallOffset(b),
  );
  const top = (c: Cabinet) =>
    0.1 + c.height / 100 + countertopThickness(design, catalog, c.wall);
  const items: DecorItem[] = [];
  const used = new Set<string>();
  /** The single slim object standing on a cabinet, by cabinet id. */
  const holds = new Map<string, number>();
  const put = (
    c: Cabinet | undefined,
    id: string,
    x: number,
    depth: number,
    yaw = 0,
  ) => {
    if (!c || used.has(c.id) || !modelRecord(id)) return;
    used.add(c.id);
    holds.set(c.id, items.length);
    // Set back against the wall with a hand's width of margin.
    const z = -c.depth / 200 + depth / 2 + 0.07;
    items.push({
      id,
      position: onCabinet(c, x, top(c), z),
      rotation: [0, c.rotation + yaw, 0],
    });
  };
  const window = design.room.openings.find((o) => o.type === "window");
  const nearWindow = window
    ? [...free].sort(
        (a, b) =>
          Math.abs(
            wallOffset(a) + a.width / 2 - window.offset - window.width / 2,
          ) -
          Math.abs(
            wallOffset(b) + b.width / 2 - window.offset - window.width / 2,
          ),
      )[0]
    : free[0];
  put(
    nearWindow,
    "plant-small",
    -0.12 * Math.sign(nearWindow?.width ?? 1),
    0.19,
  );
  put(free.at(-1), "vase", 0.1, 0.21);
  const besideHob = hob
    ? free
        .filter((c) => !used.has(c.id) && c.wall === hob.wall)
        .sort(
          (a, b) =>
            Math.abs(wallOffset(a) - wallOffset(hob)) -
            Math.abs(wallOffset(b) - wallOffset(hob)),
        )[0]
    : free.find((c) => !used.has(c.id));
  if (besideHob) put(besideHob, "cutting-board", 0, 0.25, 0.12);
  else if (hob && modelRecord("cutting-board")) {
    // No free cabinet left beside the hob: share the nearest ≥ 60 cm one on
    // its run that holds one slim object (plant or vase, ≤ 21 cm). The object
    // moves to the far end, the board lies lengthways on the hob side; both
    // keep a 7 cm wall margin and several centimetres between them.
    const host = free
      .filter((c) => holds.has(c.id) && c.wall === hob.wall && c.width >= 60)
      .sort(
        (a, b) =>
          Math.abs(wallOffset(a) - wallOffset(hob)) -
          Math.abs(wallOffset(b) - wallOffset(hob)),
      )[0];
    if (host) {
      const along = [Math.cos(host.rotation), -Math.sin(host.rotation)];
      const toward =
        Math.sign((hob.x - host.x) * along[0] + (hob.z - host.z) * along[1]) ||
        1;
      const half = host.width / 200;
      const back = -host.depth / 200 + 0.07;
      const held = items[holds.get(host.id)!];
      held.position = onCabinet(
        host,
        -toward * (half - 0.13),
        top(host),
        back + 0.11,
      );
      items.push({
        id: "cutting-board",
        position: onCabinet(
          host,
          toward * (half - 0.15),
          top(host),
          back + 0.23,
        ),
        rotation: [0, host.rotation + Math.PI / 2 + 0.06, 0],
      });
    }
  }
  const island = design.cabinets.filter(
    (c) => c.wall === "island" && c.level === "base",
  );
  if (island.length && modelRecord("fruit-bowl")) {
    const anchor = island[Math.floor((island.length - 1) / 2)];
    items.push({
      id: "fruit-bowl",
      position: onCabinet(
        anchor,
        island.length % 2 ? 0 : anchor.width / 200,
        top(anchor),
        0,
      ),
      rotation: [0, anchor.rotation + 0.5, 0],
    });
  } else {
    const middle = free.filter((c) => !used.has(c.id));
    put(middle[Math.floor(middle.length / 2)], "fruit-bowl", 0, 0.31, 0.5);
  }
  return items;
}
