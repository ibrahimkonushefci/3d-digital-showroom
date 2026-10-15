import type { Cabinet, Catalog } from "../catalog/types";
import { bounds } from "../designer3d/layout";
export type Point2 = [number, number];
/** Trace the union of axis-aligned cabinet footprints; shared cell edges disappear. */
export function worktopOutlines(cabinets: Cabinet[]): Point2[][] {
  const rects = cabinets.map((c) => {
    const b = bounds(c);
    let x0 = b.x0 / 100 - 0.004;
    let x1 = b.x1 / 100 + 0.004;
    let z0 = b.z0 / 100 - 0.004;
    let z1 = b.z1 / 100 + 0.004;
    if (c.wall === "back") z1 += 0.028;
    else if (c.wall === "left") x1 += 0.028;
    else if (c.wall === "right") x0 -= 0.028;
    else if (c.wall === "front") z0 -= 0.028;
    else if (c.wall === "island") {
      z1 += 0.028;
      z0 -= 0.028;
    }
    return { x0, x1, z0, z1 };
  });
  const xs = [...new Set(rects.flatMap((r) => [r.x0, r.x1]))].sort(
      (a, b) => a - b,
    ),
    zs = [...new Set(rects.flatMap((r) => [r.z0, r.z1]))].sort((a, b) => a - b);
  const inside = (x: number, z: number) =>
    x >= 0 &&
    z >= 0 &&
    x < xs.length - 1 &&
    z < zs.length - 1 &&
    rects.some(
      (r) =>
        (xs[x] + xs[x + 1]) / 2 > r.x0 &&
        (xs[x] + xs[x + 1]) / 2 < r.x1 &&
        (zs[z] + zs[z + 1]) / 2 > r.z0 &&
        (zs[z] + zs[z + 1]) / 2 < r.z1,
    );
  const edges = new Map<string, [number, number]>();
  const add = (x: number, z: number, a: number, b: number) =>
    edges.set(`${x},${z}`, [a, b]);
  for (let x = 0; x < xs.length - 1; x++)
    for (let z = 0; z < zs.length - 1; z++)
      if (inside(x, z)) {
        if (!inside(x, z - 1)) add(x, z, x + 1, z);
        if (!inside(x + 1, z)) add(x + 1, z, x + 1, z + 1);
        if (!inside(x, z + 1)) add(x + 1, z + 1, x, z + 1);
        if (!inside(x - 1, z)) add(x, z + 1, x, z);
      }
  const loops: Point2[][] = [];
  while (edges.size) {
    const start = edges.keys().next().value!,
      loop: Point2[] = [];
    let key = start;
    do {
      const [x, z] = key.split(",").map(Number);
      loop.push([xs[x], zs[z]]);
      const next = edges.get(key);
      edges.delete(key);
      if (!next) break;
      key = next.join(",");
    } while (key !== start);
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}
/** Inner bowl of the sink in a cabinet `width` metres wide. 60 cm and wider
 * cabinets take the fixed 44 × 36 cm inset sink model; narrower ones keep a
 * proportional procedural bowl. Worktop cutout, model and fallback agree. */
export function sinkBowl(width: number) {
  return width >= 0.598
    ? { w: 0.44, d: 0.36, model: true }
    : { w: width * 0.61, d: 0.31, model: false };
}
export function sinkCutout(c: Cabinet): Point2[] {
  const bowl = sinkBowl(c.width / 100),
    w = bowl.w + 0.008,
    d = bowl.d + 0.008;
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([x, z]) => [
    c.x / 100 + x * Math.cos(c.rotation) + (z + 0.025) * Math.sin(c.rotation),
    c.z / 100 - x * Math.sin(c.rotation) + (z + 0.025) * Math.cos(c.rotation),
  ]);
}
export function worktopRuns(cabinets: Cabinet[], catalog: Catalog) {
  const bases = cabinets.filter((c) => c.level === "base");
  // Main corners stay a single union; islands are a separate disconnected slab.
  return (["main", "island"] as const).flatMap((zone) => {
    const members = bases.filter(
      (c) => (c.wall === "island" ? "island" : "main") === zone,
    );
    return [...new Set(members.map((c) => c.height))].map((height) => ({
      zone,
      height,
      cabinets: members.filter((c) => c.height === height),
      outlines: worktopOutlines(members.filter((c) => c.height === height)),
      holes: members
        .filter(
          (c) =>
            c.height === height &&
            catalog.modules.find((m) => m.id === c.moduleId)?.type === "sink",
        )
        .map(sinkCutout),
    }));
  });
}
export function pointInPolygon(p: Point2, polygon: Point2[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
