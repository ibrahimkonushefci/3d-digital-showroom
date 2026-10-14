import { Vector2, type BufferGeometry } from "three";
import type { Material } from "../catalog/types";
export type Mapping = NonNullable<Material["mapping"]>;
export type Grain = Mapping["grain"];

/** Identity only: switching decor never changes a panel's cut from the sheet. */
export function panelOffset(cabinetId: string, role: string): [number, number] {
  const hash = (value: string) => {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++)
      h = Math.imul(h ^ value.charCodeAt(i), 16777619);
    return (h >>> 0) / 4294967296;
  };
  return [hash(`${cabinetId}:${role}:u`), hash(`${cabinetId}:${role}:v`)];
}
export function physicalUv(
  uMetres: number,
  vMetres: number,
  mapping: Mapping,
  offset: [number, number] = [0, 0],
  grain = mapping.grain,
) {
  const rotate =
    grain !== "none" && grain !== (mapping.sourceGrain || "horizontal");
  return new Vector2(
    (rotate ? vMetres : uMetres) / (mapping.tileSizeCm[0] / 100) + offset[0],
    (rotate ? -uMetres : vMetres) / (mapping.tileSizeCm[1] / 100) + offset[1],
  );
}

/** Box/RoundedBox groups share face order: ±X, ±Y, ±Z. Rounded UVs include arcs. */
export function mapPanelGeometry(
  geometry: BufferGeometry,
  size: [number, number, number],
  radius: number,
  mapping: Mapping,
  offset: [number, number],
  grain?: Grain,
) {
  const [x, y, z] = size;
  const arcSpan = (length: number) =>
    length - 2 * radius + (Math.PI * radius) / 2;
  const spans = [
    [z, y],
    [z, y],
    [x, z],
    [x, z],
    [x, y],
    [x, y],
  ];
  const uv = geometry.getAttribute("uv"),
    index = geometry.index;
  for (const group of geometry.groups) {
    const [w, h] = spans[group.materialIndex || 0];
    const visited = new Set<number>();
    for (let j = group.start; j < group.start + group.count; j++) {
      const i = index ? index.getX(j) : j;
      if (visited.has(i)) continue;
      visited.add(i);
      const mapped = physicalUv(
        uv.getX(i) * arcSpan(w),
        uv.getY(i) * arcSpan(h),
        mapping,
        offset,
        grain,
      );
      uv.setXY(i, mapped.x, mapped.y);
    }
  }
  uv.needsUpdate = true;
  // Three r180 channel=1 selects uv1, not uv2. No baked occlusion is added here.
  geometry.setAttribute("uv1", uv.clone());
  return geometry;
}

/** Caps share world plan coordinates; edges wrap each outline (and cutout) by perimeter. */
export function slabUvGenerator(
  loops: readonly (readonly [number, number][])[],
  mapping: Mapping,
) {
  const segments = loops.flatMap((loop) => {
    let along = 0;
    return loop.map(([ax, ay], i) => {
      const [bx, by] = loop[(i + 1) % loop.length];
      const dx = bx - ax,
        dy = by - ay,
        length = Math.hypot(dx, dy);
      const segment = { ax, ay, dx, dy, length, along };
      along += length;
      return segment;
    });
  });
  return {
    generateTopUV(
      _geometry: BufferGeometry,
      vertices: number[],
      a: number,
      b: number,
      c: number,
    ) {
      return [a, b, c].map((i) =>
        physicalUv(vertices[i * 3], vertices[i * 3 + 1], mapping),
      );
    },
    generateSideWallUV(
      _geometry: BufferGeometry,
      vertices: number[],
      a: number,
      b: number,
      c: number,
      d: number,
    ) {
      const ids = [a, b, c, d];
      const x = ids.reduce((sum, i) => sum + vertices[i * 3], 0) / 4;
      const y = ids.reduce((sum, i) => sum + vertices[i * 3 + 1], 0) / 4;
      // One segment for the entire quad: corners cannot select opposite ends of a wrap.
      let best = segments[0],
        nearest = Infinity;
      for (const segment of segments) {
        const { ax, ay, dx, dy, length } = segment;
        const t = Math.max(
          0,
          Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (length * length)),
        );
        const error = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
        if (error < nearest) {
          nearest = error;
          best = segment;
        }
      }
      return ids.map((i) => {
        const along =
          best.along +
          ((vertices[i * 3] - best.ax) * best.dx +
            (vertices[i * 3 + 1] - best.ay) * best.dy) /
            best.length;
        return physicalUv(along, vertices[i * 3 + 2], mapping, [0, 0], "none");
      });
    },
  };
}
