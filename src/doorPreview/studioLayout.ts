import { Box3, MathUtils, Vector3 } from "three";
import type { Placement } from "./types";
import type { Catalog } from "../catalog/types";
import { hasGlazing } from "./configuration";
import type { WallRectangle } from "./houseLayout";
export type StudioCamera = "full" | "detail" | "glass" | "inside";
export const STUDIO_FOV = 35;
export function studioLayout(p: Placement) {
  const w = p.width / 100,
    h = p.height / 100;
  const bottom = p.kind === "door" ? 0.16 : 0.7;
  const left =
    -w / 2 - (p.kind === "door" && p.options.includes("side-left") ? 0.32 : 0);
  const right =
    w / 2 + (p.kind === "door" && p.options.includes("side-right") ? 0.32 : 0);
  const top =
    bottom +
    h +
    (p.kind === "door" && p.options.includes("transom")
      ? 0.32
      : p.options.some((o) => o.startsWith("shutter-"))
        ? 0.19
        : 0.025);
  return {
    w,
    h,
    bottom,
    left,
    right,
    top,
    wallWidth: Math.max(3.9, right - left + 2),
    wallHeight: Math.max(2.95, top + 0.5),
    centerX: (left + right) / 2,
  };
}
export function productStudioBounds(p: Placement) {
  const l = studioLayout(p);
  return new Box3(
    new Vector3(l.left - 0.07, l.bottom - 0.07, -0.1),
    new Vector3(l.right + 0.07, l.top + 0.03, 0.17),
  );
}
export function studioOpenings(p: Placement): WallRectangle[] {
  const l = studioLayout(p),
    bottom = l.bottom - 0.025,
    top = l.bottom + l.h + 0.02;
  const holes = [{ left: -l.w / 2 - 0.02, right: l.w / 2 + 0.02, bottom, top }];
  if (p.kind === "door") {
    if (p.options.includes("side-left"))
      holes.push({ left: l.left - 0.02, right: -l.w / 2, bottom, top });
    if (p.options.includes("side-right"))
      holes.push({ left: l.w / 2, right: l.right + 0.02, bottom, top });
    if (p.options.includes("transom"))
      holes.push({
        left: -l.w / 2 - 0.02,
        right: l.w / 2 + 0.02,
        bottom: l.bottom + l.h - 0.01,
        top: l.bottom + l.h + 0.315,
      });
  }
  return holes;
}
export function studioCamera(
  p: Placement,
  c: Catalog,
  preset: StudioCamera,
  aspect: number,
) {
  const l = studioLayout(p),
    full = productStudioBounds(p);
  let bounds = full.clone();
  if (preset === "detail") {
    const x = p.kind === "door" ? l.w * 0.32 : l.w / 2 - 0.06;
    const y = l.bottom + l.h * (p.kind === "door" ? 0.62 : 0.5);
    const height = p.kind === "door" ? Math.min(l.h, 1.7) : Math.min(l.h, 0.85);
    bounds = new Box3(
      new Vector3(x - 0.25, y - height / 2, -0.1),
      new Vector3(x + 0.25, y + height / 2, 0.17),
    );
  } else if (preset === "glass" && hasGlazing(p, c)) {
    const x =
      p.kind === "window"
        ? l.w / 2 - 0.09
        : p.options.includes("side-left")
          ? l.left + 0.16
          : p.options.includes("side-right")
            ? l.right - 0.16
            : -l.w * 0.21;
    const y =
      p.options.includes("transom") &&
      p.kind === "door" &&
      !p.options.some((o) => o.startsWith("side-")) &&
      ![2, 4, 6].includes(c.doors.find((d) => d.id === p.modelId)?.style ?? 0)
        ? l.bottom + l.h + 0.15
        : l.bottom + l.h * 0.6;
    bounds = new Box3(
      new Vector3(x - 0.35, y - 0.45, -0.1),
      new Vector3(x + 0.35, y + 0.45, 0.12),
    );
  } else if (preset === "full") {
    bounds.min.y = p.kind === "door" ? 0 : Math.max(0.15, l.bottom - 0.2);
    bounds.max.y = p.kind === "door" ? l.wallHeight + 0.04 : l.top + 0.3;
    bounds.min.x -= p.kind === "door" ? 0.35 : 0.18;
    bounds.max.x += p.kind === "door" ? 0.55 : 0.18;
  }
  const target = bounds.getCenter(new Vector3());
  const direction =
    preset === "inside"
      ? new Vector3(-0.15, 0.04, -1).normalize()
      : new Vector3(preset === "full" ? 0.18 : 0.38, 0.04, 1).normalize();
  const right = new Vector3()
      .crossVectors(new Vector3(0, 1, 0), direction)
      .normalize(),
    up = new Vector3().crossVectors(direction, right);
  const tanY = Math.tan(MathUtils.degToRad(STUDIO_FOV / 2)) / 1.12,
    tanX = tanY * Math.max(0.1, aspect);
  const corners = [bounds.min.x, bounds.max.x].flatMap((x) =>
    [bounds.min.y, bounds.max.y].flatMap((y) =>
      [bounds.min.z, bounds.max.z].map((z) => new Vector3(x, y, z)),
    ),
  );
  const distance = Math.max(
    0.8,
    ...corners.map((corner) => {
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
  return {
    position: target.clone().addScaledVector(direction, distance).toArray() as [
      number,
      number,
      number,
    ],
    target: target.toArray() as [number, number, number],
    bounds,
  };
}
