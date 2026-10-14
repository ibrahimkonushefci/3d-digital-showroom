import { describe, expect, it } from "vitest";
import { BoxGeometry, ExtrudeGeometry, Shape, Path, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { MaterialSchema } from "../src/catalog/types";
import {
  mapPanelGeometry,
  physicalUv,
  panelOffset,
  slabUvGenerator,
  type Mapping,
} from "../src/scene/materialMapping";
const mapping: Mapping = {
  tileSizeCm: [120, 80],
  grain: "vertical",
  sourceGrain: "horizontal",
  variation: "stable-offset",
};
const faceRange = (g: BoxGeometry, face: number) => {
  const group = g.groups[face],
    uv = g.getAttribute("uv");
  const ids = Array.from({ length: group.count }, (_, j) =>
    g.index ? g.index.getX(group.start + j) : group.start + j,
  );
  const us = ids.map((i) => uv.getX(i)),
    vs = ids.map((i) => uv.getY(i));
  return [Math.max(...us) - Math.min(...us), Math.max(...vs) - Math.min(...vs)];
};
it("keeps the same physical grain density on narrow, wide and tall panels, without changing geometry bounds", () => {
  for (const width of [0.4, 0.6, 0.9])
    for (const height of [0.72, 2.2]) {
      const g = new BoxGeometry(width, height, 0.02);
      const positions = Array.from(g.getAttribute("position").array);
      mapPanelGeometry(g, [width, height, 0.02], 0, mapping, [0, 0]);
      const [u, v] = faceRange(g, 4);
      expect(u / height).toBeCloseTo(1 / 1.2);
      expect(v / width).toBeCloseTo(1 / 0.8);
      expect(Array.from(g.getAttribute("position").array)).toEqual(positions);
      expect(faceRange(g, 0)[1]).toBeCloseTo(0.02 / 0.8);
      expect(faceRange(g, 2)[0]).toBeCloseTo(0.02 / 1.2);
      expect(Array.from(g.getAttribute("uv1").array)).toEqual(
        Array.from(g.getAttribute("uv").array),
      );
      g.dispose();
    }
});
it("maps rounded face arcs at physical density and retains a small bevel with fewer triangles", () => {
  const g = new RoundedBoxGeometry(0.6, 0.72, 0.02, 1, 0.0015);
  mapPanelGeometry(g, [0.6, 0.72, 0.02], 0.0015, mapping, [0, 0]);
  expect(Array.from(g.getAttribute("uv").array).every(Number.isFinite)).toBe(
    true,
  );
  const p = g.getAttribute("position"),
    uv = g.getAttribute("uv"),
    n = g.getAttribute("normal");
  const flat = Array.from({ length: p.count }, (_, i) => i).filter(
    (i) => n.getZ(i) > 0.999,
  );
  const width =
    Math.max(...flat.map((i) => p.getX(i))) -
    Math.min(...flat.map((i) => p.getX(i)));
  const uvWidth =
    Math.max(...flat.map((i) => uv.getY(i))) -
    Math.min(...flat.map((i) => uv.getY(i)));
  expect(uvWidth / width).toBeCloseTo(1 / 0.8, 4);
  expect(p.count / 3).toBeLessThan(250);
  g.dispose();
});
it("uses horizontal grain for drawers and shelves, with no random rotation", () => {
  const origin = physicalUv(0, 0, mapping);
  const door = physicalUv(0.4, 0, mapping);
  const drawer = physicalUv(0.4, 0, mapping, [0, 0], "horizontal");
  expect(door.x).toBe(origin.x);
  expect(door.y).not.toBe(origin.y);
  expect(drawer.x).not.toBe(origin.x);
  expect(drawer.y).toBe(origin.y);
});
it("varies repeated panels by stable cabinet/role identity independently of finish changes", () => {
  const a = panelOffset("fixed-cabinet", "door-left");
  expect(a).toEqual(panelOffset("fixed-cabinet", "door-left"));
  expect(a).not.toEqual(panelOffset("fixed-cabinet", "door-right"));
  expect(a).not.toEqual(panelOffset("next-cabinet", "door-left"));
  const origin = physicalUv(0, 0, mapping, a);
  expect(physicalUv(0, 0, { ...mapping, tileSizeCm: [240, 200] }, a)).toEqual(
    origin,
  );
  expect(a.every((n) => n >= 0 && n < 1)).toBe(true);
});
it("keeps slab cap coordinates continuous between connected pieces and gives vertical edges two UV dimensions", () => {
  const loop: [number, number][] = [
    [0, 0],
    [2, 0],
    [2, 1],
    [0, 1],
  ];
  const hole: [number, number][] = [
    [0.4, 0.3],
    [0.8, 0.3],
    [0.8, 0.6],
    [0.4, 0.6],
  ];
  const shape = new Shape();
  loop.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const path = new Path();
  [...hole]
    .reverse()
    .forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  shape.holes.push(path);
  const uvGen = slabUvGenerator([loop, hole], { ...mapping, grain: "none" });
  const g = new ExtrudeGeometry(shape, {
    depth: 0.038,
    bevelEnabled: true,
    bevelSize: 0.002,
    bevelThickness: 0.002,
    bevelSegments: 2,
    steps: 1,
    UVGenerator: uvGen,
  });
  const uv = g.getAttribute("uv"),
    p = g.getAttribute("position");
  for (const group of g.groups) {
    let area = 0;
    for (let i = group.start; i < group.start + group.count; i += 3) {
      const a = [uv.getX(i), uv.getY(i)],
        b = [uv.getX(i + 1), uv.getY(i + 1)],
        c = [uv.getX(i + 2), uv.getY(i + 2)];
      const uvArea = Math.abs(
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
      );
      expect(uvArea).toBeGreaterThan(1e-10);
      if (group.materialIndex === 0) {
        const centre = new Vector3()
          .fromBufferAttribute(p, i)
          .add(new Vector3().fromBufferAttribute(p, i + 1))
          .add(new Vector3().fromBufferAttribute(p, i + 2))
          .divideScalar(3);
        expect(
          centre.x > 0.402 &&
            centre.x < 0.798 &&
            centre.y > 0.302 &&
            centre.y < 0.598,
        ).toBe(false);
        area += uvArea / 2;
      }
    }
    if (group.materialIndex === 0) expect(area).toBeGreaterThan(3);
  }
  const cap = uvGen.generateTopUV(g, [2, 1, 0, 3, 1, 0, 2, 2, 0], 0, 1, 2);
  expect(cap[0]).toEqual(physicalUv(2, 1, { ...mapping, grain: "none" }));
  g.dispose();
});
describe("optional material metadata", () => {
  const base = {
    id: "legacy",
    name: { sq: "", en: "", de: "" },
    color: "#ffffff",
    roughness: 0.5,
  };
  it("accepts legacy catalogs and explicitly authored local maps", () => {
    expect(MaterialSchema.parse(base).mapping).toBeUndefined();
    expect(
      MaterialSchema.parse({
        ...base,
        mapping,
        aoMap: "shared/textures/smooth-roughness.webp",
      }).aoMap,
    ).toBeTruthy();
    expect(
      MaterialSchema.safeParse({
        ...base,
        aoMap: "https://example.com/map.webp",
      }).success,
    ).toBe(false);
  });
  it("rejects invalid physical units, unsupported orientation and unbounded responses", () => {
    for (const tileSizeCm of [
      [0, 120],
      [-1, 120],
      [Infinity, 120],
      [NaN, 120],
      [10001, 120],
    ])
      expect(
        MaterialSchema.safeParse({
          ...base,
          mapping: { ...mapping, tileSizeCm },
        }).success,
      ).toBe(false);
    for (const [key, value] of [
      ["roughness", 1.01],
      ["normalStrength", -1],
      ["normalStrength", 2.01],
      ["clearcoat", 2],
      ["clearcoatRoughness", -0.1],
      ["envMapIntensity", 4.01],
      ["envMapIntensity", Infinity],
    ])
      expect(
        MaterialSchema.safeParse({
          ...base,
          response: {
            roughness: 0.7,
            normalStrength: 0.1,
            clearcoat: 0.1,
            clearcoatRoughness: 0.5,
            envMapIntensity: 0.8,
            [key]: value,
          },
        }).success,
      ).toBe(false);
    expect(
      MaterialSchema.safeParse({
        ...base,
        mapping: { ...mapping, grain: "random" },
      }).success,
    ).toBe(false);
  });
});
