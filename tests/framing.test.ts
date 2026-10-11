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
