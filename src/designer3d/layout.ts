import type {
  Cabinet,
  Catalog,
  DesignDocument,
  Layout,
  Room,
  Wall,
} from "../catalog/types";
export function uid() {
  return (
    globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
  );
}
export function bounds(c: Cabinet) {
  const turned = Math.abs(Math.sin(c.rotation)) > 0.5;
  const w = turned ? c.depth : c.width,
    d = turned ? c.width : c.depth;
  return {
    x0: c.x - w / 2,
    x1: c.x + w / 2,
    z0: c.z - d / 2,
    z1: c.z + d / 2,
    y0: c.level === "wall" ? 140 : c.level === "wardrobe" ? 0 : 10,
    y1:
      (c.level === "wall" ? 140 : c.level === "wardrobe" ? 0 : 10) +
      c.height +
      (c.level === "base" ? 4 : 0),
  };
}
export function wallPosition(
  wall: Wall,
  offset: number,
  width: number,
  depth: number,
  room: Room,
) {
  switch (wall) {
    case "left":
      return { x: depth / 2, z: offset + width / 2, rotation: Math.PI / 2 };
    case "right":
      return {
        x: room.width - depth / 2,
        z: offset + width / 2,
        rotation: -Math.PI / 2,
      };
    case "front":
      return {
        x: offset + width / 2,
        z: room.depth - depth / 2,
        rotation: Math.PI,
      };
    case "island":
      return { x: offset + width / 2, z: room.depth / 2, rotation: 0 };
    default:
      return { x: offset + width / 2, z: depth / 2, rotation: 0 };
  }
}
export function wallOffset(c: Cabinet) {
  return (c.wall === "left" || c.wall === "right" ? c.z : c.x) - c.width / 2;
}
const intersects = (a0: number, a1: number, b0: number, b1: number) =>
  a0 < b1 - 0.1 && a1 > b0 + 0.1;
export function validateDesign(
  design: DesignDocument,
  catalog: Catalog,
): boolean {
  const { room, cabinets } = design;
  if (
    !Number.isFinite(room.width) ||
    !Number.isFinite(room.depth) ||
    !Number.isFinite(room.height) ||
    room.width < 120 ||
    room.depth < 120 ||
    room.height < 180 ||
    room.width > 2000 ||
    room.depth > 2000 ||
    room.height > 600
  )
    return false;
  if (
    (design.kind === "kitchen" &&
      ["corner", "walkin"].includes(design.layout)) ||
    (design.kind === "wardrobe" &&
      ["l", "u", "parallel", "island"].includes(design.layout))
  )
    return false;
  if (
    !catalog.fronts.some((m) => m.id === design.style.front) ||
    !catalog.carcasses.some((m) => m.id === design.style.carcass) ||
    !catalog.countertops.some((m) => m.id === design.style.countertop) ||
    !catalog.handles.some((m) => m.id === design.style.handle) ||
    !catalog.backsplashes.some((m) => m.id === design.style.backsplash) ||
    !catalog.plinths.some((m) => m.id === design.style.plinth)
  )
    return false;
  const ids = new Set<string>();
  for (const o of room.openings) {
    const length = ["left", "right"].includes(o.wall) ? room.depth : room.width;
    if (
      o.offset < 0 ||
      o.width <= 0 ||
      o.offset + o.width > length ||
      o.sill < 0 ||
      o.height <= 0 ||
      o.sill + o.height > room.height
    )
      return false;
  }
  for (const c of cabinets) {
    const m = catalog.modules.find((m) => m.id === c.moduleId);
    if (
      !m ||
      m.kind !== design.kind ||
      !m.widths.includes(c.width) ||
      m.level !== c.level ||
      c.depth !== m.depth ||
      c.height < 30 ||
      c.height > m.height + (m.level === "wall" ? 18 : 0) ||
      ids.has(c.id)
    )
      return false;
    ids.add(c.id);
    const expected = wallPosition(
      c.wall,
      wallOffset(c),
      c.width,
      c.depth,
      room,
    );
    if (
      Math.abs(c.rotation - expected.rotation) > 0.001 ||
      (c.wall !== "island" &&
        (Math.abs(c.x - expected.x) > 0.01 ||
          Math.abs(c.z - expected.z) > 0.01))
    )
      return false;
    const b = bounds(c);
    if (
      b.x0 < -0.1 ||
      b.z0 < -0.1 ||
      b.x1 > room.width + 0.1 ||
      b.z1 > room.depth + 0.1 ||
      b.y1 > room.height + 0.1
    )
      return false;
    for (const o of room.openings) {
      let touch = false,
        start = 0,
        end = 0;
      switch (o.wall) {
        case "back":
          touch = b.z0 < 5;
          start = b.x0;
          end = b.x1;
          break;
        case "front":
          touch = b.z1 > room.depth - 5;
          start = b.x0;
          end = b.x1;
          break;
        case "left":
          touch = b.x0 < 5;
          start = b.z0;
          end = b.z1;
          break;
        case "right":
          touch = b.x1 > room.width - 5;
          start = b.z0;
          end = b.z1;
          break;
      }
      if (
        touch &&
        intersects(start, end, o.offset, o.offset + o.width) &&
        intersects(b.y0, b.y1, o.sill, o.sill + o.height)
      )
        return false;
    }
  }
  for (let i = 0; i < cabinets.length; i++)
    for (let j = i + 1; j < cabinets.length; j++) {
      const a = bounds(cabinets[i]),
        b = bounds(cabinets[j]);
      if (
        intersects(a.x0, a.x1, b.x0, b.x1) &&
        intersects(a.z0, a.z1, b.z0, b.z1) &&
        intersects(a.y0, a.y1, b.y0, b.y1)
      )
        return false;
      if (
        (cabinets[i].wall === "island") !== (cabinets[j].wall === "island") &&
        cabinets[i].level !== "wall" &&
        cabinets[j].level !== "wall"
      ) {
        const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1),
          dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1);
        if (Math.hypot(dx, dz) < catalog.pricing.minimumAisle - 0.1)
          return false;
      }
    }
  return true;
}
export function newDesign(
  kind: DesignDocument["kind"] = "kitchen",
  layout: Layout = "l",
): DesignDocument {
  return {
    version: 2,
    id: uid(),
    kind,
    layout,
    room: { width: 420, depth: 360, height: 270, openings: [] },
    cabinets: [],
    style: {
      front: "cashmere",
      carcass: "white",
      countertop: "travertine",
      handle: "none",
      backsplash: "none",
      plinth: "matching",
      led: true,
      profile: "flat",
    },
    installation: true,
    vat: false,
    exact: false,
  };
}
export function generateLayout(
  design: DesignDocument,
  catalog: Catalog,
): DesignDocument | null {
  const d = structuredClone(design);
  d.cabinets = [];
  const { kind, layout, room } = d;
  const kitchen = kind === "kitchen";
  const cornerDepth = kitchen ? 90 : 60;
  const hasLeft = ["l", "u", "corner", "walkin"].includes(layout),
    hasRight = ["u", "walkin"].includes(layout);
  if (
    kitchen &&
    layout === "parallel" &&
    room.depth < 120 + catalog.pricing.minimumAisle
  )
    return null;
  if (hasLeft && hasRight && room.width < 120 + catalog.pricing.minimumAisle)
    return null;
  const push = (
    moduleId: string,
    wall: Wall,
    offset: number,
    width: number,
  ) => {
    const m = catalog.modules.find((m) => m.id === moduleId);
    if (!m) return false;
    const c: Cabinet = {
      id: uid(),
      moduleId,
      width,
      height:
        m.level === "wardrobe"
          ? Math.min(m.height, Math.floor(room.height / 10) * 10)
          : m.height,
      depth: m.depth,
      level: m.level,
      wall,
      ...wallPosition(wall, offset, width, m.depth, room),
    };
    d.cabinets.push(c);
    if (!validateDesign(d, catalog)) {
      d.cabinets.pop();
      return false;
    }
    return true;
  };
  if (kitchen && hasLeft) push("corner", "back", 0, 90);
  if (kitchen && hasRight) push("corner", "back", room.width - 90, 90);
  const runs: Array<[Wall, number, number]> = [
    [
      "back",
      hasLeft && kitchen ? cornerDepth : 0,
      room.width - (hasRight && kitchen ? cornerDepth : 0),
    ],
  ];
  if (hasLeft) runs.push(["left", cornerDepth, room.depth]);
  if (hasRight) runs.push(["right", cornerDepth, room.depth]);
  if (layout === "parallel") runs.push(["front", 0, room.width]);
  let count = 0;
  for (const [wall, start, end] of runs) {
    let offset = start;
    while (offset + 30 <= end) {
      const available = end - offset;
      let candidate = kitchen
        ? count === 0
          ? "oven"
          : count === 1
            ? "sink"
            : count === 2
              ? "dishwasher"
              : count === 3
                ? "fridge"
                : count % 2
                  ? "base-doors"
                  : "base-drawers"
        : (layout === "walkin"
            ? [
                "wardrobe-hanging",
                "wardrobe-open",
                "wardrobe-drawers",
                "wardrobe-open",
              ]
            : [
                "wardrobe-hanging",
                "wardrobe-shelves",
                "wardrobe-drawers",
                "wardrobe-sliding",
              ])[count % 4];
      let added = false;
      for (const id of [candidate, kitchen ? "base-doors" : "wardrobe-open"]) {
        const m = catalog.modules.find((m) => m.id === id);
        if (!m) continue;
        for (const width of [...m.widths]
          .filter((w) => w <= available && w <= (kitchen ? 60 : 80))
          .sort((a, b) => b - a)) {
          if (push(id, wall, offset, width)) {
            offset += width;
            added = true;
            count++;
            break;
          }
        }
        if (added) break;
      }
      if (!added) offset += 10;
    }
  }
  if (kitchen) {
    const bases = [...d.cabinets].filter(
      (c) => c.level === "base" && c.moduleId !== "corner",
    );
    const hob = hobCabinet(d, catalog);
    for (const c of bases)
      push(
        c.id === hob?.id ? "wall-hood" : "wall-doors",
        c.wall,
        wallOffset(c),
        c.width,
      );
  }
  if (layout === "island") {
    const length = Math.min(240, Math.floor((room.width - 120) / 60) * 60);
    if (length < 120) return null;
    for (
      let x = (room.width - length) / 2;
      x < (room.width + length) / 2;
      x += 60
    ) {
      if (!push("base-drawers", "island", x, 60)) return null;
    }
  }
  return d.cabinets.length && validateDesign(d, catalog) ? d : null;
}
export function examples(catalog: Catalog): DesignDocument[] {
  if (!catalog.modules.length) return [];
  return [
    Object.assign(newDesign("kitchen", "l"), {
      style: {
        front: "anthracite",
        carcass: "oak",
        countertop: "oak",
        handle: "none",
        backsplash: "none",
        plinth: "black",
        led: true,
        profile: "flat",
      },
    }),
    Object.assign(newDesign("kitchen", "u"), {
      style: {
        front: "white",
        carcass: "white",
        countertop: "marble",
        handle: "knob",
        backsplash: "none",
        plinth: "matching",
        led: true,
        profile: "panel",
      },
    }),
    Object.assign(newDesign("kitchen", "island"), {
      room: { width: 480, depth: 420, height: 270, openings: [] },
      style: {
        front: "sage",
        carcass: "white",
        countertop: "travertine",
        handle: "none",
        backsplash: "none",
        plinth: "matching",
        led: true,
        profile: "flat",
      },
    }),
    newDesign("wardrobe", "corner"),
  ]
    .map((d) => generateLayout(d, catalog)!)
    .filter(Boolean);
}

export function hobCabinet(design: DesignDocument, catalog: Catalog) {
  if (design.kind !== "kitchen") return undefined;
  const bases = design.cabinets.filter((c) => c.level === "base");
  return bases
    .filter(
      (c) =>
        !["corner", "sink", "dishwasher"].includes(
          catalog.modules.find((m) => m.id === c.moduleId)?.type || "",
        ) && c.wall !== "island",
    )
    .find((c) => {
      const offset = wallOffset(c);
      return (
        bases.some(
          (n) =>
            n.wall === c.wall && Math.abs(wallOffset(n) + n.width - offset) < 1,
        ) &&
        bases.some(
          (n) =>
            n.wall === c.wall && Math.abs(offset + c.width - wallOffset(n)) < 1,
        ) &&
        !design.room.openings.some(
          (o) =>
            o.wall === c.wall &&
            offset < o.offset + o.width &&
            offset + c.width > o.offset,
        )
      );
    });
}
