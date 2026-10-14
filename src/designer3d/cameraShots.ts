import { Box3, Vector3 } from "three";
import type { Catalog, DesignDocument } from "../catalog/types";
import {
  cabinetBounds,
  cabinetCamera,
  cameraBounds,
  inspectionCamera,
  type CameraPreset,
  type CameraView,
} from "./framing";

export const CAMERA_REVISION = "room-shots-v1";
export const SHOT_DURATION_MS = 600;

/** Conservative swept volume, including an open leaf or extended pull-out.
 * Presentation only: never changes furniture, storage or pricing. */
export function furnitureEnvelope(
  design: DesignDocument,
  catalog: Catalog,
  ids: readonly string[] = [],
) {
  const result = cabinetBounds(design, catalog);
  for (const c of design.cabinets.filter((c) => ids.includes(c.id))) {
    const bottom = c.level === "wall" ? 1.4 : 0;
    const reach = Math.max(c.width / 100, c.depth / 100) + 0.08;
    for (const x of [-c.width / 200 - 0.04, c.width / 200 + 0.04])
      for (const z of [-c.depth / 200, c.depth / 200 + reach])
        for (const y of [bottom, bottom + c.height / 100 + 0.12])
          result.expandByPoint(
            new Vector3(
              c.x / 100 -
                design.room.width / 200 +
                x * Math.cos(c.rotation) +
                z * Math.sin(c.rotation),
              y,
              c.z / 100 -
                design.room.depth / 200 -
                x * Math.sin(c.rotation) +
                z * Math.cos(c.rotation),
            ),
          );
  }
  return result;
}

/** Only geometry and explicit shot requests recompose a view; finish/storage
 * edits and viewport resize preserve the camera the customer chose. */
export function cameraStructureKey(design: DesignDocument) {
  return JSON.stringify([
    design.id,
    design.room.width,
    design.room.depth,
    design.room.height,
    design.cabinets.map((c) => [
      c.id,
      c.x,
      c.z,
      c.rotation,
      c.width,
      c.height,
      c.depth,
      c.level,
    ]),
  ]);
}

export function roomShot(
  design: DesignDocument,
  catalog: Catalog,
  shot: CameraPreset,
  aspect: number,
  options: {
    focus?: string | null;
    authored?: CameraView;
    opened?: readonly string[];
  } = {},
) {
  const focused = design.cabinets.find((c) => c.id === options.focus);
  const subject = focused ? { ...design, cabinets: [focused] } : design;
  const bounds =
    shot === "top"
      ? cameraBounds(design, "top", catalog)
      : furnitureEnvelope(
          subject,
          catalog,
          focused ? [focused.id] : options.opened,
        );
  if (focused) bounds.expandByScalar(0.08);
  const heading = focused
    ? inspectionCamera(design, focused.id)!
    : (options.authored ??
      ({
        // Warm kitchen: slightly oblique across the worktop. Dressing room:
        // shallower angle keeps tall fronts and internal storage legible.
        position: [
          design.layout === "l" || design.layout === "corner" ? 3.4 : 1.8,
          design.kind === "wardrobe" ? 1.9 : 2.4,
          5,
        ],
        target: [0, 1, 0],
      } as CameraView));
  return cabinetCamera(
    bounds,
    shot,
    aspect,
    heading,
    focused ? 0.84 : shot === "hero" ? 0.92 : 0.86,
  );
}

/** Slab segment test includes endpoints, with no sampling gaps. */
export function segmentHitsBox(a: Vector3, b: Vector3, box: Box3) {
  let lo = 0,
    hi = 1;
  for (const axis of ["x", "y", "z"] as const) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-9) {
      if (a[axis] < box.min[axis] || a[axis] > box.max[axis]) return false;
    } else {
      const t0 = (box.min[axis] - a[axis]) / delta,
        t1 = (box.max[axis] - a[axis]) / delta;
      lo = Math.max(lo, Math.min(t0, t1));
      hi = Math.min(hi, Math.max(t0, t1));
      if (lo > hi) return false;
    }
  }
  return true;
}

export function cameraObstacles(design: DesignDocument, catalog: Catalog) {
  const furniture = design.cabinets.map((c) =>
    furnitureEnvelope({ ...design, cabinets: [c] }, catalog, [
      c.id,
    ]).expandByScalar(0.08),
  );
  const w = design.room.width / 200,
    d = design.room.depth / 200,
    h = design.room.height / 100;
  // Conservative whole walls, including apertures: snapping is preferable to
  // guessing that a camera fits through an architectural opening.
  return [
    ...furniture,
    new Box3(
      new Vector3(-w - 0.12, 0, -d - 0.12),
      new Vector3(w + 0.12, h + 0.12, -d + 0.12),
    ),
    new Box3(
      new Vector3(-w - 0.12, 0, d - 0.12),
      new Vector3(w + 0.12, h + 0.12, d + 0.12),
    ),
    new Box3(
      new Vector3(-w - 0.12, 0, -d),
      new Vector3(-w + 0.12, h + 0.12, d),
    ),
    new Box3(new Vector3(w - 0.12, 0, -d), new Vector3(w + 0.12, h + 0.12, d)),
  ];
}

/** Clear direct travel, or retreat above the room, cross, then approach.
 * If a manual starting/ending view cannot safely retreat, snap instead. */
export function cameraPath(
  from: CameraView,
  to: CameraView,
  obstacles: Box3[],
  reducedMotion = false,
): CameraView[] {
  if (reducedMotion) return [];
  const a = new Vector3(...from.position),
    b = new Vector3(...to.position);
  const clear = (p: Vector3, q: Vector3) =>
    !obstacles.some((box) => segmentHitsBox(p, q, box));
  if (clear(a, b)) return [from, to];
  const height = Math.max(a.y, b.y, ...obstacles.map((box) => box.max.y)) + 0.6;
  const retreat = new Vector3(a.x, height, a.z),
    approach = new Vector3(b.x, height, b.z);
  if (!clear(a, retreat) || !clear(retreat, approach) || !clear(approach, b))
    return [];
  return [
    from,
    { position: retreat.toArray(), target: from.target },
    { position: approach.toArray(), target: to.target },
    to,
  ];
}

export function sampleCameraPath(
  path: CameraView[],
  progress: number,
): CameraView {
  const t = Math.min(1, Math.max(0, progress));
  const ease = t * t * (3 - 2 * t);
  const part = ease * (path.length - 1),
    index = Math.min(path.length - 2, Math.floor(part));
  const mix = part - index;
  return {
    position: new Vector3(...path[index].position)
      .lerp(new Vector3(...path[index + 1].position), mix)
      .toArray(),
    target: new Vector3(...path[index].target)
      .lerp(new Vector3(...path[index + 1].target), mix)
      .toArray(),
  };
}
