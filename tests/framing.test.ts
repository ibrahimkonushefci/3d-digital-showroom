import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PerspectiveCamera, Vector3 } from "three";
import { CatalogSchema } from "../src/catalog/types";
import { presentationPresets } from "../src/designer3d/presets";
import {
  seesInterior,
  cutInView,
  type WallSide,
} from "../src/scene/rooms/stance";
import { generateLayout, newDesign } from "../src/designer3d/layout";
import { bounds, validateDesign, wallPosition } from "../src/designer3d/layout";
import { countertopThickness } from "../src/scene/furnitureMaterials";
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
it("uses the selected worktop thickness in both clearance validation and camera bounds", () => {
  const original = newDesign("kitchen", "straight");
  const module = catalog.modules.find((m) => m.id === "base-doors")!;
  const c = {
    id: "thickness-fit",
    moduleId: module.id,
    width: 60,
    height: module.height,
    depth: module.depth,
    level: module.level,
    wall: "back" as const,
    ...wallPosition("back", 100, 60, module.depth, original.room),
  };
  const d = { ...original, cabinets: [c] };
  for (const [id, expected] of [
    ["travertine", 0.012],
    ["marble", 0.038],
    ["quartz", 0.02],
  ] as const) {
    const design = { ...d, style: { ...d.style, countertop: id } };
    const top = 0.1 + c.height / 100 + expected;
    expect(
      bounds(c, countertopThickness(design, catalog)).y1 / 100,
    ).toBeCloseTo(top);
    expect(cabinetBounds(design, catalog).max.y).toBeCloseTo(top + 0.02);
    expect(
      validateDesign(
        { ...design, room: { ...design.room, height: top * 100 - 0.2 } },
        catalog,
      ),
    ).toBe(false);
  }
  // A synthetic tall base module exercises a ceiling boundary within valid room dimensions.
  const boundaryCatalog = {
    ...catalog,
    modules: catalog.modules.map((m) =>
      m.id === module.id ? { ...m, height: 190 } : m,
    ),
  };
  const boundaryDesign = {
    ...d,
    cabinets: [{ ...c, height: 190 }],
    room: { ...d.room, height: 202, openings: [] },
  };
  expect(
    validateDesign(
      { ...boundaryDesign, style: { ...d.style, countertop: "travertine" } },
      boundaryCatalog,
    ),
  ).toBe(true);
  expect(
    validateDesign(
      { ...boundaryDesign, style: { ...d.style, countertop: "marble" } },
      boundaryCatalog,
    ),
  ).toBe(false);
});

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

import { Box3 } from "three";
import {
  cameraObstacles,
  cameraPath,
  cameraStructureKey,
  frontSamples,
  frustumCoverage,
  furnitureEnvelope,
  HERO_FOV,
  HERO_MAX_FOV,
  HERO_MIN_COVERAGE,
  HERO_OCCUPANCY,
  heroFitPoints,
  frameFill,
  stanceWall,
  roomShot,
  sampleCameraPath,
  segmentHitsBox,
} from "../src/designer3d/cameraShots";
it("fits room shots including swept open fronts without framing decorative room objects", () => {
  for (const [kind, layouts] of [
    ["kitchen", ["straight", "l", "u", "parallel", "island"]],
    ["wardrobe", ["straight", "corner", "walkin"]],
  ] as const)
    for (const layout of layouts) {
      const design = generateLayout(newDesign(kind, layout), catalog)!;
      for (const aspect of [0.46, 0.7, 1.4, 2.4])
        for (const shot of ["hero", "overall", "front"] as const) {
          const opened = design.cabinets.map((c) => c.id);
          const view = roomShot(design, catalog, shot, aspect, { opened });
          // Wide canvases get the interior photograph when the room allows
          // it; that contract is tested separately.
          if (shot === "hero" && view.fov !== undefined) continue;
          const camera = new PerspectiveCamera(CABINET_FOV, aspect, 0.1, 100);
          camera.position.set(...view.position);
          camera.lookAt(new Vector3(...view.target));
          camera.updateMatrixWorld();
          for (const p of boundsCorners(
            furnitureEnvelope(design, catalog, opened),
          ).map((p) => p.project(camera))) {
            expect(Math.abs(p.x)).toBeLessThanOrEqual(0.93);
            expect(Math.abs(p.y)).toBeLessThanOrEqual(0.93);
            expect(p.z).toBeLessThan(1);
          }
        }
    }
});
it("retreats above obstacles and never interpolates through a cabinet or wall", () => {
  const obstacle = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 3, 1));
  const from = { position: [-3, 1, 0], target: [0, 1, 0] } as const;
  const to = { position: [3, 1, 0], target: [0, 1, 0] } as const;
  const a = {
    position: [...from.position],
    target: [...from.target],
  } as import("../src/designer3d/framing").CameraView;
  const b = {
    position: [...to.position],
    target: [...to.target],
  } as import("../src/designer3d/framing").CameraView;
  const path = cameraPath(a, b, [obstacle]);
  expect(path).toHaveLength(4);
  for (let i = 1; i < path.length; i++)
    expect(
      segmentHitsBox(
        new Vector3(...path[i - 1].position),
        new Vector3(...path[i].position),
        obstacle,
      ),
    ).toBe(false);
  for (let t = 0; t <= 1; t += 0.01)
    expect(
      obstacle.containsPoint(
        new Vector3(...sampleCameraPath(path, t).position),
      ),
    ).toBe(false);
  expect(sampleCameraPath(path, 0)).toEqual(a);
  expect(sampleCameraPath(path, 1)).toEqual(b);
  expect(cameraPath(a, b, [obstacle], true)).toEqual([]);
  // An unsafe manual start cannot retreat through the object: use a snap.
  expect(cameraPath({ ...a, position: [0, 1, 0] }, b, [obstacle])).toEqual([]);
});
it("all planned hero/front/top/inspection transition segments are safe or use the bounded snap fallback", () => {
  for (const [kind, layouts] of [
    ["kitchen", ["straight", "l", "u", "parallel", "island"]],
    ["wardrobe", ["straight", "corner", "walkin"]],
  ] as const)
    for (const layout of layouts) {
      const design = generateLayout(newDesign(kind, layout), catalog)!;
      const obstacles = cameraObstacles(design, catalog);
      const shots = ["hero", "front", "top", "overall"].map((shot) =>
        roomShot(
          design,
          catalog,
          shot as import("../src/designer3d/framing").CameraPreset,
          1.4,
        ),
      );
      shots.push(
        ...design.cabinets.map((c) =>
          roomShot(design, catalog, "hero", 1.4, { focus: c.id }),
        ),
      );
      for (let i = 1; i < shots.length; i++) {
        const path = cameraPath(shots[i - 1], shots[i], obstacles);
        for (let step = 1; step < path.length; step++)
          expect(
            obstacles.some((box) =>
              segmentHitsBox(
                new Vector3(...path[step - 1].position),
                new Vector3(...path[step].position),
                box,
              ),
            ),
          ).toBe(false);
      }
    }
});
it("camera composition ignores finish and component placement changes but tracks real furniture geometry", () => {
  const d = generateLayout(newDesign("wardrobe", "straight"), catalog)!;
  const key = cameraStructureKey(d);
  expect(
    cameraStructureKey({
      ...d,
      style: { ...d.style, front: "walnut" },
      cabinets: d.cabinets.map((c) => ({
        ...c,
        interior: { version: 1, components: [] },
      })),
    }),
  ).toBe(key);
  expect(
    cameraStructureKey({
      ...d,
      cabinets: d.cabinets.map((c, i) =>
        i ? c : { ...c, width: c.width + 10 },
      ),
    }),
  ).not.toBe(key);
});

function shotCamera(
  view: import("../src/designer3d/framing").CameraView,
  aspect: number,
) {
  const camera = new PerspectiveCamera(
    view.fov ?? CABINET_FOV,
    aspect,
    0.05,
    100,
  );
  camera.position.set(...view.position);
  camera.lookAt(new Vector3(...view.target));
  camera.updateMatrixWorld();
  return camera;
}
it("stands inside the room, or just behind one empty hidden wall, at eye level for the interior hero", () => {
  for (const [kind, layouts] of [
    ["kitchen", ["straight", "l", "u", "parallel", "island"]],
    ["wardrobe", ["straight", "corner", "walkin"]],
  ] as const)
    for (const layout of layouts) {
      const design = generateLayout(newDesign(kind, layout), catalog)!;
      for (const aspect of [0.88, 1.0, 1.4, 1.73, 2.4]) {
        const view = roomShot(design, catalog, "hero", aspect);
        // Enclosed layouts may keep the fitted overview (covered above).
        if (view.fov === undefined) {
          expect(["u", "parallel", "walkin"]).toContain(layout);
          continue;
        }
        const [x, y, z] = view.position;
        const behind = stanceWall({ x, z }, design.room);
        expect(behind).not.toBe("invalid");
        if (behind) {
          // Only an empty wall is stepped behind, and its cut outline (slab
          // edge, wall ends, ceiling edge) never enters the frame.
          expect(design.cabinets.some((c) => c.wall === behind)).toBe(false);
          expect(
            cutInView(
              shotCamera(view, aspect),
              design.room,
              behind as WallSide,
            ),
          ).toBe(false);
        }
        expect(seesInterior(shotCamera(view, aspect), design.room)).toBe(true);
        expect(y).toBeGreaterThan(1.4);
        expect(y).toBeLessThan(design.room.height / 100 - 0.25);
        expect(view.fov).toBeGreaterThanOrEqual(HERO_FOV);
        expect(view.fov).toBeLessThanOrEqual(HERO_MAX_FOV);
        const eye = new Vector3(...view.position),
          target = new Vector3(...view.target);
        const pitch = Math.atan2(
          eye.y - target.y,
          Math.hypot(eye.x - target.x, eye.z - target.z),
        );
        // Eye-level shots stay nearly level; raised corner views look down.
        if (y < 1.6)
          expect((pitch * 180) / Math.PI).toBeLessThanOrEqual(8 + 1e-6);
        for (const c of design.cabinets)
          expect(
            furnitureEnvelope(
              { ...design, cabinets: [c] },
              catalog,
            ).containsPoint(eye),
          ).toBe(false);
        expect(
          frustumCoverage(eye, target, frontSamples(design), view.fov!, aspect),
        ).toBeGreaterThanOrEqual(HERO_MIN_COVERAGE);
      }
    }
});

it("shows each whole prepared proposal with breathing room, never a cropped end", () => {
  for (const preset of presentationPresets(catalog))
    // Laptop window, Full screen, and a desktop window whose settings panel
    // narrows the canvas (1030×1025 → 645×733).
    for (const aspect of [1048 / 608, 1440 / 760, 645 / 733]) {
      const design = preset.design;
      const view = roomShot(design, catalog, "hero", aspect);
      expect(view.fov, preset.id).toBeDefined();
      const eye = new Vector3(...view.position),
        target = new Vector3(...view.target);
      const outline = heroFitPoints(design);
      expect(
        frustumCoverage(eye, target, outline, view.fov!, aspect),
        `${preset.id} @${aspect.toFixed(2)}`,
        // Laptop/Full screen: the whole proposal. A window narrowed by the
        // settings panel stays inside the room; long runs may lose a sliver.
      ).toBeGreaterThanOrEqual(aspect > 1 ? 1 : 0.94);
      const fill = frameFill(eye, target, outline, view.fov!, aspect);
      expect(fill, preset.id).toBeGreaterThan(0.55);
      if (aspect > 1)
        expect(fill, preset.id).toBeLessThanOrEqual(HERO_OCCUPANCY.x + 0.01);
    }
});

it("never shows the ceiling or garden view from the cut-away overview or top shots", () => {
  // Top always looks down from above; the overview does at laptop, window and
  // phone aspects. (An ultra-wide overview may come close enough to read as
  // an interior; it then still shows no cut edge, by the same test.)
  const check = (
    design: import("../src/catalog/types").DesignDocument,
    label: string,
  ) => {
    for (const aspect of [0.46, 0.88, 1.4, 1.73, 2.4])
      for (const shot of ["overall", "top"] as const) {
        if (shot === "overall" && aspect > 1.8) continue;
        const view = roomShot(design, catalog, shot, aspect);
        expect(
          seesInterior(shotCamera(view, aspect), design.room),
          `${label} ${shot} ${aspect}`,
        ).toBe(false);
      }
  };
  for (const [kind, layouts] of [
    ["kitchen", ["straight", "l", "u", "parallel", "island"]],
    ["wardrobe", ["straight", "corner", "walkin"]],
  ] as const)
    for (const layout of layouts)
      check(generateLayout(newDesign(kind, layout), catalog)!, layout);
  for (const preset of presentationPresets(catalog))
    check(preset.design, preset.id);
});
