import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PerspectiveCamera, Vector3 } from "three";
import { CatalogSchema } from "../src/catalog/types";
import { generateLayout, newDesign } from "../src/designer3d/layout";
import {
  cabinetBounds,
  cameraBounds,
  cabinetCamera,
  boundsCorners,
  CABINET_FOV,
} from "../src/designer3d/framing";

const catalog = CatalogSchema.parse(
  JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
);

it("frames every cabinet at desktop and portrait aspect ratios for all layouts and views", () => {
  for (const layout of ["straight", "l", "u", "parallel", "island"] as const) {
    const design = generateLayout(newDesign("kitchen", layout), catalog)!;
    expect(design).toBeTruthy();
    for (const aspect of [0.55, 1.4, 2.2]) {
      for (const preset of ["front", "perspective", "top"] as const) {
        const bounds = cameraBounds(design, preset);
        const view = cabinetCamera(bounds, preset, aspect);
        const camera = new PerspectiveCamera(CABINET_FOV, aspect, 0.1, 100);
        camera.position.set(...view.position);
        camera.lookAt(new Vector3(...view.target));
        camera.updateMatrixWorld();
        const projected = boundsCorners(bounds).map((corner) =>
          corner.project(camera),
        );
        for (const point of projected) {
          expect(Math.abs(point.x)).toBeLessThanOrEqual(0.92);
          expect(Math.abs(point.y)).toBeLessThanOrEqual(0.92);
          expect(point.z).toBeLessThan(1);
        }
        // At least one axis fills the viewport instead of leaving the run distant.
        expect(
          Math.max(...projected.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)])),
        ).toBeGreaterThan(0.85);
        if (preset === "perspective")
          expect(view.position[1]).toBeCloseTo(2.4, 2);
      }
    }
  }
});

it("keeps a straight run tightly framed when only empty room depth increases", () => {
  const design = generateLayout(newDesign("kitchen", "straight"), catalog)!;
  const deeper = { ...design, room: { ...design.room, depth: 800 } };
  const distance = (d: typeof design) => {
    const view = cabinetCamera(cabinetBounds(d), "front", 1.4);
    return new Vector3(...view.position).distanceTo(
      new Vector3(...view.target),
    );
  };
  expect(distance(deeper)).toBeCloseTo(distance(design), 6);
});

it("fits wardrobes, authored perspective headings and empty designs without invalid coordinates", () => {
  for (const design of [
    generateLayout(newDesign("wardrobe", "corner"), catalog)!,
    newDesign(),
  ]) {
    const view = cabinetCamera(cabinetBounds(design), "perspective", 0.6, {
      position: [3.7, 2.45, 4.7],
      target: [0, 1.1, -0.4],
    });
    expect([...view.position, ...view.target].every(Number.isFinite)).toBe(
      true,
    );
  }
});
import { inspectionCamera } from "../src/designer3d/framing";
it("fits a selected wardrobe compartment with open-door clearance at tablet and phone aspect ratios", () => {
  const d = generateLayout(newDesign("wardrobe", "corner"), catalog)!;
  for (const c of d.cabinets)
    for (const aspect of [0.55, 1.4]) {
      const bounds = cabinetBounds({ ...d, cabinets: [c] }).expandByScalar(
          0.35,
        ),
        view = cabinetCamera(
          bounds,
          "perspective",
          aspect,
          inspectionCamera(d, c.id)!,
        );
      const camera = new PerspectiveCamera(CABINET_FOV, aspect, 0.1, 100);
      camera.position.set(...view.position);
      camera.lookAt(new Vector3(...view.target));
      camera.updateMatrixWorld();
      for (const point of boundsCorners(bounds).map((p) => p.project(camera))) {
        expect(Math.abs(point.x)).toBeLessThanOrEqual(0.92);
        expect(Math.abs(point.y)).toBeLessThanOrEqual(0.92);
      }
    }
});
import {
  orbitLimits,
  recenterTarget,
  viewAzimuth,
  viewDistance,
} from "../src/designer3d/framing";
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const deg = (d: number) => (d * Math.PI) / 180;
it("keeps the authored view inside the orbit limits for every layout and preset", () => {
  const layouts = [
    ["kitchen", ["straight", "l", "u", "parallel", "island"]],
    ["wardrobe", ["straight", "corner", "walkin"]],
  ] as const;
  for (const [kind, names] of layouts)
    for (const layout of names) {
      const d = generateLayout(newDesign(kind, layout), catalog)!;
      for (const preset of ["front", "perspective", "top"] as const) {
        const view = cabinetCamera(cameraBounds(d, preset), preset, 1.4);
        const limits = orbitLimits(d, view);
        const start = viewAzimuth(view);
        expect(limits.minAzimuth).toBeLessThanOrEqual(start + 1e-9);
        expect(limits.maxAzimuth).toBeGreaterThanOrEqual(start - 1e-9);
        expect(limits.maxAzimuth - limits.minAzimuth).toBeGreaterThanOrEqual(
          deg(59),
        );
      }
    }
});
it("never lets the camera look at the back of a run, while facing at least one front", () => {
  for (const [kind, layout] of [
    ["kitchen", "straight"],
    ["kitchen", "l"],
    ["kitchen", "island"],
    ["wardrobe", "straight"],
    ["wardrobe", "corner"],
  ] as const) {
    const d = generateLayout(newDesign(kind, layout), catalog)!;
    const view = cabinetCamera(
      cameraBounds(d, "perspective"),
      "perspective",
      1.4,
    );
    const { minAzimuth, maxAzimuth } = orbitLimits(d, view);
    const runs = d.cabinets.filter((c) => c.wall !== "island");
    for (const azimuth of [minAzimuth, maxAzimuth]) {
      for (const c of runs)
        expect(Math.abs(wrap(azimuth - c.rotation))).toBeLessThanOrEqual(
          deg(105) + 1e-6,
        );
      expect(
        Math.min(...runs.map((c) => Math.abs(wrap(azimuth - c.rotation)))),
      ).toBeLessThanOrEqual(deg(85) + 1e-6);
    }
  }
});
it("lets L-shaped kitchens and corner wardrobes face either wing square-on", () => {
  for (const [kind, layout] of [
    ["kitchen", "l"],
    ["wardrobe", "corner"],
  ] as const) {
    const d = generateLayout(newDesign(kind, layout), catalog)!;
    const view = cabinetCamera(
      cameraBounds(d, "perspective"),
      "perspective",
      0.55,
    );
    const { minAzimuth, maxAzimuth } = orbitLimits(d, view);
    const normals = new Set(d.cabinets.map((c) => wrap(c.rotation)));
    expect(normals.size).toBeGreaterThan(1);
    for (const normal of normals) {
      // Express the wing's normal on the limits' continuous branch.
      const a = viewAzimuth(view) + wrap(normal - viewAzimuth(view));
      expect(a).toBeGreaterThanOrEqual(minAzimuth - 1e-6);
      expect(a).toBeLessThanOrEqual(maxAzimuth + 1e-6);
    }
  }
});
it("always zooms out past the whole-furniture view, even while inspecting one unit", () => {
  const layouts = [
    ["kitchen", ["straight", "l", "u", "parallel", "island"]],
    ["wardrobe", ["straight", "corner", "walkin"]],
  ] as const;
  for (const [kind, names] of layouts)
    for (const layout of names) {
      const d = generateLayout(newDesign(kind, layout), catalog)!;
      for (const aspect of [0.46, 0.55, 1.4, 2.2]) {
        const overview = cabinetCamera(
          cameraBounds(d, "perspective"),
          "perspective",
          aspect,
        );
        const c = d.cabinets[0];
        const focused = cabinetCamera(
          cabinetBounds({ ...d, cabinets: [c] }).expandByScalar(0.35),
          "perspective",
          aspect,
          inspectionCamera(d, c.id)!,
        );
        const limits = orbitLimits(d, focused, c.id, viewDistance(overview));
        expect(limits.maxDistance).toBeGreaterThan(viewDistance(overview));
        expect(limits.minDistance).toBeLessThan(viewDistance(focused));
      }
    }
});
it("re-centers the orbit point as the camera zooms back out", () => {
  const home = new Vector3(0, 1, 0),
    drifted = new Vector3(2, 0.4, -1);
  // Zooming in leaves the cursor-chosen target alone.
  expect(recenterTarget(drifted, home, 5, 4, 10).equals(drifted)).toBe(true);
  // Reaching the overview distance lands exactly on the overview center.
  expect(recenterTarget(drifted, home, 5, 10, 10).distanceTo(home)).toBeCloseTo(
    0,
  );
  expect(recenterTarget(drifted, home, 5, 14, 10).distanceTo(home)).toBeCloseTo(
    0,
  );
  // Halfway out, halfway back; repeated steps converge monotonically.
  expect(recenterTarget(drifted, home, 4, 7, 10).distanceTo(home)).toBeCloseTo(
    drifted.distanceTo(home) / 2,
  );
  let target = drifted.clone(),
    previous = Infinity;
  for (let d = 3; d < 10; d += 0.5) {
    target = recenterTarget(target, home, d, d + 0.5, 10);
    const gap = target.distanceTo(home);
    expect(gap).toBeLessThanOrEqual(previous + 1e-9);
    previous = gap;
  }
  expect(previous).toBeCloseTo(0);
});
it("limits inspection to the selected cabinet's front, including front-wall runs across ±π", () => {
  for (const layout of ["l", "parallel", "u"] as const) {
    const d = generateLayout(newDesign("kitchen", layout), catalog)!;
    for (const c of d.cabinets) {
      const view = cabinetCamera(
        cabinetBounds({ ...d, cabinets: [c] }).expandByScalar(0.35),
        "perspective",
        1.4,
        inspectionCamera(d, c.id)!,
      );
      const start = viewAzimuth(view);
      const limits = orbitLimits(d, view, c.id);
      expect(Math.abs(wrap(start - c.rotation))).toBeLessThan(deg(1));
      expect(limits.minAzimuth).toBeLessThanOrEqual(start + 1e-9);
      expect(limits.maxAzimuth).toBeGreaterThanOrEqual(start - 1e-9);
      // Limits are continuous around the start even when it sits near ±π.
      expect(limits.maxAzimuth - limits.minAzimuth).toBeLessThanOrEqual(
        deg(110) + 1e-6,
      );
      expect(limits.minDistance).toBeLessThan(2);
    }
  }
});
