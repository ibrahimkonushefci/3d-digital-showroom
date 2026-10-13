import { Box3, MathUtils, Vector3 } from "three";
import type { DesignDocument } from "../catalog/types";

export type CameraView = {
  position: [number, number, number];
  target: [number, number, number];
};
export type CameraPreset = "perspective" | "front" | "top";
export const CABINET_FOV = 35;

/** Furniture bounds in the centered scene, including fronts, plinth and worktop. */
export function cabinetBounds(design: DesignDocument) {
  const bounds = new Box3();
  for (const c of design.cabinets) {
    const bottom = c.level === "wall" ? 1.4 : 0;
    const top =
      (c.level === "wall" ? 1.4 : c.level === "wardrobe" ? 0 : 0.1) +
      c.height / 100 +
      (c.level === "base" ? 0.06 : 0.02);
    for (const x of [-c.width / 200 - 0.02, c.width / 200 + 0.02])
      for (const z of [-c.depth / 200 - 0.02, c.depth / 200 + 0.055])
        for (const y of [bottom, top])
          bounds.expandByPoint(
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
  if (bounds.isEmpty())
    bounds.set(new Vector3(-1, 0, -0.5), new Vector3(1, 2.2, 0.5));
  return bounds;
}

export function boundsCorners(bounds: Box3) {
  return [bounds.min.x, bounds.max.x].flatMap((x) =>
    [bounds.min.y, bounds.max.y].flatMap((y) =>
      [bounds.min.z, bounds.max.z].map((z) => new Vector3(x, y, z)),
    ),
  );
}

/** The plan preset retains the whole room, including the height of tall units. */
export function cameraBounds(design: DesignDocument, preset: CameraPreset) {
  return preset === "top"
    ? new Box3(
        new Vector3(-design.room.width / 200, 0, -design.room.depth / 200),
        new Vector3(
          design.room.width / 200,
          design.room.height / 100,
          design.room.depth / 200,
        ),
      )
    : cabinetBounds(design);
}

/** Solve the perspective fit against every corner; room size is not the subject. */
export function cabinetCamera(
  bounds: Box3,
  preset: CameraPreset,
  aspect: number,
  authoredView?: CameraView,
): CameraView {
  const target = bounds.getCenter(new Vector3());
  const heading =
    preset === "front"
      ? new Vector3(0, 0, 1)
      : authoredView
        ? new Vector3(...authoredView.position)
            .sub(new Vector3(...authoredView.target))
            .setY(0)
            .normalize()
        : new Vector3(0.48, 0, 1).normalize();
  if (heading.lengthSq() === 0) heading.set(0, 0, 1);
  const tanY = Math.tan(MathUtils.degToRad(CABINET_FOV / 2)) / 1.1;
  const tanX = tanY * Math.max(aspect, 0.1);
  const eyeY = preset === "front" ? 1.4 : (authoredView?.position[1] ?? 2.4);
  let distance = 5;
  let direction = new Vector3();
  for (let iteration = 0; iteration < 24; iteration++) {
    direction =
      preset === "top"
        ? new Vector3(0, 1, 0.001).normalize()
        : heading
            .clone()
            .multiplyScalar(
              Math.sqrt(
                Math.max(0.01, distance * distance - (eyeY - target.y) ** 2),
              ),
            )
            .setY(eyeY - target.y)
            .normalize();
    const right = new Vector3()
      .crossVectors(new Vector3(0, 1, 0), direction)
      .normalize();
    const up = new Vector3().crossVectors(direction, right);
    distance = Math.max(
      2,
      ...boundsCorners(bounds).map((corner) => {
        const delta = corner.sub(target);
        return (
          delta.dot(direction) +
          Math.max(
            Math.abs(delta.dot(right)) / tanX,
            Math.abs(delta.dot(up)) / tanY,
          )
        );
      }),
    );
  }
  const position = target.clone().addScaledVector(direction, distance);
  return { position: position.toArray(), target: target.toArray() };
}

export type OrbitLimits = {
  minAzimuth: number;
  maxAzimuth: number;
  minDistance: number;
  maxDistance: number;
};
const DEG = Math.PI / 180;
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Orbit stays within this angle of at least one run's front… */
export const FRONT_SPAN = 85 * DEG;
/** …and never further than this from any run, so backs stay hidden. */
export const BEHIND_LIMIT = 105 * DEG;

/** Azimuth as camera-controls measures it: atan2(x, z) of position − target. */
export function viewAzimuth(view: CameraView) {
  return Math.atan2(
    view.position[0] - view.target[0],
    view.position[2] - view.target[2],
  );
}

/** Camera-to-target distance of a solved view. */
export function viewDistance(view: CameraView) {
  return new Vector3(...view.position).distanceTo(new Vector3(...view.target));
}

/**
 * Keep orbiting on the side the furniture faces: the camera must face at
 * least one run head-on and may never swing round to look at the back of
 * any run. An L-shape can therefore be seen square-on from either wing.
 * Limits are expressed around the view's own azimuth because
 * camera-controls clamps without wrapping.
 */
export function orbitLimits(
  design: DesignDocument,
  view: CameraView,
  focusId?: string | null,
  overviewDistance = 15,
): OrbitLimits {
  const start = viewAzimuth(view);
  const focus = focusId
    ? design.cabinets.find((c) => c.id === focusId)
    : undefined;
  const normals = [
    ...new Set(
      design.cabinets
        .filter((c) => c.wall !== "island")
        .map((c) => Math.round(wrapAngle(c.rotation) / DEG)),
    ),
  ].map((n) => n * DEG);
  const within = (a: number, normal: number, span: number) =>
    Math.abs(wrapAngle(a - normal)) <= span + 1e-6;
  const allowed = (a: number) =>
    normals.every((n) => within(a, n, BEHIND_LIMIT)) &&
    (focus
      ? within(a, focus.rotation, 70 * DEG)
      : !normals.length || normals.some((n) => within(a, n, FRONT_SPAN)));
  const reach = (direction: 1 | -1) => {
    let steps = 0;
    while (steps < 179 && allowed(start + direction * (steps + 1) * DEG))
      steps++;
    return steps * DEG;
  };
  let minAzimuth = start - reach(-1),
    maxAzimuth = start + reach(1);
  // U-shapes, parallel runs and walk-ins face each other: no angle sees every
  // front, so allow a comfortable swing around the authored view instead.
  if (maxAzimuth - minAzimuth < 60 * DEG) {
    minAzimuth = start - 40 * DEG;
    maxAzimuth = start + 40 * DEG;
  }
  return {
    minAzimuth,
    maxAzimuth,
    minDistance: focus ? 1.2 : 1.6,
    // Zooming out always reaches past the whole-furniture view, focused or not.
    maxDistance: Math.max(6, overviewDistance * 1.35),
  };
}
/**
 * Pull the orbit point back toward the overview center as the user zooms
 * out, reaching it exactly when the camera is back at the overview
 * distance. Zooming in leaves the (cursor-following) target untouched.
 */
export function recenterTarget(
  target: Vector3,
  home: Vector3,
  previousDistance: number,
  distance: number,
  homeDistance: number,
) {
  if (distance <= previousDistance + 1e-6) return target.clone();
  if (previousDistance >= homeDistance || distance >= homeDistance)
    return home.clone();
  const keep = (homeDistance - distance) / (homeDistance - previousDistance);
  return home.clone().add(target.clone().sub(home).multiplyScalar(keep));
}

/** Front-facing inspection heading, with the rendered camera fitting open clearance. */
export function inspectionCamera(
  design: DesignDocument,
  id: string,
): CameraView | null {
  const c = design.cabinets.find((c) => c.id === id);
  if (!c) return null;
  const target: [number, number, number] = [
    c.x / 100 - design.room.width / 200,
    c.height / 200,
    c.z / 100 - design.room.depth / 200,
  ];
  return {
    target,
    position: [
      target[0] + Math.sin(c.rotation) * 4,
      1.55,
      target[2] + Math.cos(c.rotation) * 4,
    ],
  };
}
