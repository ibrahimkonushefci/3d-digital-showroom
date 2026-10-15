import { Box3, Vector3 } from "three";
import type { Catalog, DesignDocument, Room } from "../../catalog/types";
import { cabinetBounds, boundsCorners } from "../../designer3d/framing";
import { resolveRoom } from "../rooms/resolveRoom";
import { heroHeading } from "../../designer3d/cameraShots";
import { roomQuality, type Quality } from "../quality";

export const LIGHTING_REVISION = "room-lighting-v3";
export const MAX_LED_FILLS = 3;
export type WallSide = Room["openings"][number]["wall"];
export type WallPiece = {
  size: [number, number, number];
  position: [number, number, number];
  rotation: [number, number, number];
};
/** Room-corner coordinates, metres. One segmentation for visible and shadow walls. */
export function wallPieces(room: Room, side: WallSide): WallPiece[] {
  const length =
    (side === "back" || side === "front" ? room.width : room.depth) / 100;
  const h = room.height / 100;
  const openings = room.openings.filter((o) => o.wall === side);
  const cuts = [
    ...new Set([
      0,
      length,
      ...openings.flatMap((o) => [
        Math.max(0, Math.min(length, o.offset / 100)),
        Math.max(0, Math.min(length, (o.offset + o.width) / 100)),
      ]),
    ]),
  ].sort((a, b) => a - b);
  return cuts.slice(0, -1).flatMap((start, i) => {
    const end = cuts[i + 1],
      middle = (start + end) / 2;
    const holes = openings
      .filter(
        (o) => middle > o.offset / 100 && middle < (o.offset + o.width) / 100,
      )
      .map((o) => [
        Math.max(0, o.sill / 100),
        Math.min(h, (o.sill + o.height) / 100),
      ])
      .sort((a, b) => a[0] - b[0]);
    let bottom = 0;
    const spans: number[][] = [];
    for (const [a, b] of holes) {
      if (a > bottom) spans.push([bottom, a]);
      bottom = Math.max(bottom, b);
    }
    if (bottom < h) spans.push([bottom, h]);
    return spans
      .filter(([a, b]) => b > a)
      .map(([a, b]) => ({
        size: [end - start, b - a, 0.08],
        position:
          side === "back"
            ? [middle, (a + b) / 2, -0.04]
            : side === "front"
              ? [middle, (a + b) / 2, room.depth / 100 + 0.04]
              : side === "left"
                ? [-0.04, (a + b) / 2, middle]
                : [room.width / 100 + 0.04, (a + b) / 2, middle],
        rotation: [
          0,
          side === "left" || side === "right" ? -Math.PI / 2 : 0,
          0,
        ],
      }));
  });
}
export function openingPosition(
  room: Room,
  o: Room["openings"][number],
): Vector3 {
  const a = (o.offset + o.width / 2) / 100;
  const y = (o.sill + o.height / 2) / 100;
  return new Vector3(
    o.wall === "left" ? 0 : o.wall === "right" ? room.width / 100 : a,
    y,
    o.wall === "back" ? 0 : o.wall === "front" ? room.depth / 100 : a,
  ).sub(new Vector3(room.width / 200, 0, room.depth / 200));
}
/** Furniture structure only: finish hover, LED, orbit and opening progress never refresh a probe. */
export function lightingSignature(design: DesignDocument): string {
  return JSON.stringify([
    LIGHTING_REVISION,
    design.kind,
    design.room,
    design.cabinets.map((c) => [
      c.id,
      c.moduleId,
      c.level,
      c.wall,
      c.x,
      c.z,
      c.rotation,
      c.width,
      c.height,
      c.depth,
    ]),
  ]);
}
export function resolveLighting(
  design: DesignDocument,
  catalog: Catalog,
  quality: Quality,
) {
  const recipe = resolveRoom(design).recipe;
  const window = [...design.room.openings]
    .filter((o) => o.type === "window")
    .sort(
      (a, b) =>
        b.width * b.height - a.width * a.height || a.id.localeCompare(b.id),
    )[0];
  const target = new Vector3(
    0,
    window ? Math.min(0.65, window.sill / 100) : 0.8,
    0,
  );
  const aperture = window ? openingPosition(design.room, window) : null;
  const direction = aperture
    ? aperture.clone().sub(target).normalize()
    : new Vector3(-0.35, 1, 0.25).normalize();
  const roomSize = new Vector3(
    design.room.width / 100,
    design.room.height / 100,
    design.room.depth / 100,
  );
  const position = target
    .clone()
    .addScaledVector(direction, Math.max(6, roomSize.length() * 1.5));
  const bounds = cabinetBounds(design, catalog).union(
    new Box3(
      new Vector3(-roomSize.x / 2 - 0.1, 0, -roomSize.z / 2 - 0.1),
      new Vector3(roomSize.x / 2 + 0.1, roomSize.y, roomSize.z / 2 + 0.1),
    ),
  );
  const right = new Vector3()
    .crossVectors(new Vector3(0, 1, 0), direction)
    .normalize();
  const up = new Vector3().crossVectors(direction, right);
  const corners = boundsCorners(bounds).map((p) => p.sub(target));
  // Soft key inside the room, near the ceiling on the viewer's side: models
  // the fronts and drops soft shadows behind the furniture, IKEA-style.
  const furniture = cabinetBounds(design, catalog);
  const keyTarget = furniture.getCenter(new Vector3()).setY(0.9);
  const heading = heroHeading(design);
  const halfW = roomSize.x / 2 - 0.35,
    halfD = roomSize.z / 2 - 0.35;
  const reach = Math.min(
    2.6,
    heading.x > 1e-6
      ? (halfW - keyTarget.x) / heading.x
      : heading.x < -1e-6
        ? (-halfW - keyTarget.x) / heading.x
        : Infinity,
    heading.z > 1e-6
      ? (halfD - keyTarget.z) / heading.z
      : heading.z < -1e-6
        ? (-halfD - keyTarget.z) / heading.z
        : Infinity,
  );
  const side = new Vector3(-heading.z, 0, heading.x).multiplyScalar(1.1);
  const keyPosition = keyTarget
    .clone()
    .addScaledVector(heading, Math.max(1.2, reach))
    .add(side)
    .setY(roomSize.y - 0.15);
  keyPosition.x = Math.max(-halfW, Math.min(halfW, keyPosition.x));
  keyPosition.z = Math.max(-halfD, Math.min(halfD, keyPosition.z));
  return {
    interiorKey: {
      position: keyPosition,
      target: keyTarget,
      intensity: recipe.lightRecipe.interiorKeyIntensity ?? 0,
    },
    environmentIntensity: recipe.lightRecipe.environmentIntensity ?? 1,
    window,
    aperture,
    direction,
    target,
    position,
    keyIntensity: window
      ? recipe.lightRecipe.daylightIntensity
      : recipe.lightRecipe.ceilingIntensity,
    fillIntensity: recipe.lightRecipe.fillIntensity,
    color: window ? "#fff3e2" : "#fff0dc",
    shadowSize: roomQuality(quality).shadowSize,
    bounds: {
      left: Math.min(...corners.map((p) => p.dot(right))) - 0.12,
      right: Math.max(...corners.map((p) => p.dot(right))) + 0.12,
      top: Math.max(...corners.map((p) => p.dot(up))) + 0.12,
      bottom: Math.min(...corners.map((p) => p.dot(up))) - 0.12,
      far: position.distanceTo(target) + roomSize.length() + 1,
    },
  };
}

/** Exact static window fittings shared by the visible room and shadow shell. */
export function windowFittings(w: number, h: number) {
  const fr = 0.055,
    dep = 0.11;
  const reveal = [-1, 1].flatMap((n) => [
    {
      size: [0.025, h, 0.16] as [number, number, number],
      position: [n * (w / 2 - 0.0125), 0, 0] as [number, number, number],
    },
    {
      size: [w, 0.025, 0.16] as [number, number, number],
      position: [0, n * (h / 2 - 0.0125), 0] as [number, number, number],
    },
  ]);
  const trim = [-1, 1].flatMap((n) => [
    {
      size: [w + 2 * fr + 0.03, 0.024, 0.025] as [number, number, number],
      position: [0, n * (h / 2 + fr + 0.008), 0.01] as [number, number, number],
    },
    {
      size: [0.024, h + 2 * fr + 0.03, 0.025] as [number, number, number],
      position: [n * (w / 2 + fr + 0.008), 0, 0.01] as [number, number, number],
    },
  ]);
  const frame = [-1, 1].flatMap((n) => [
    {
      size: [w + 2 * fr, fr, dep] as [number, number, number],
      position: [0, n * (h / 2 + fr / 2), dep / 2 - 0.025] as [
        number,
        number,
        number,
      ],
    },
    {
      size: [fr, h + 2 * fr, dep] as [number, number, number],
      position: [n * (w / 2 + fr / 2), 0, dep / 2 - 0.025] as [
        number,
        number,
        number,
      ],
    },
  ]);
  frame.push(
    { size: [0.024, h, 0.03], position: [0, 0, 0.015] },
    {
      size: [w + 2 * fr + 0.07, 0.038, 0.13],
      position: [0, -h / 2 - fr, 0.05],
    },
  );
  return { reveal, trim, frame };
}

/** Window reveals/mullions and the static closed architectural door keep
 * casting when the camera hides the visible wall. Furniture motion is separate. */
export function openingShadowPieces(room: Room): WallPiece[] {
  return room.openings.flatMap((o) => {
    const w = o.width / 100,
      h = o.height / 100,
      fr = 0.055,
      dep = 0.09;
    const yaw =
      o.wall === "left"
        ? Math.PI / 2
        : o.wall === "right"
          ? -Math.PI / 2
          : o.wall === "front"
            ? Math.PI
            : 0;
    const centre = openingPosition(room, o).add(
      new Vector3(room.width / 200, 0, room.depth / 200),
    );
    if (o.wall === "back") centre.z = -0.04;
    if (o.wall === "front") centre.z = room.depth / 100 + 0.04;
    if (o.wall === "left") centre.x = -0.04;
    if (o.wall === "right") centre.x = room.width / 100 + 0.04;
    const window = windowFittings(w, h);
    const parts =
      o.type === "window"
        ? [...window.reveal, ...window.trim, ...window.frame]
        : [
            {
              size: [fr, h + fr, dep],
              position: [-w / 2 - fr / 2, fr / 2, dep / 2 - 0.025],
            },
            {
              size: [fr, h + fr, dep],
              position: [w / 2 + fr / 2, fr / 2, dep / 2 - 0.025],
            },
            {
              size: [w + 2 * fr, fr, dep],
              position: [0, h / 2 + fr / 2, dep / 2 - 0.025],
            },
            {
              size: [w - 0.02, h - 0.015, 0.044],
              position: [0, -0.007, 0.028],
            },
            {
              size: [0.032, 0.032, 0.022],
              position: [w / 2 - 0.07, -0.02, 0.056],
            },
            {
              size: [0.13, 0.024, 0.022],
              position: [w / 2 - 0.13, -0.02, 0.06],
            },
          ];
    return parts.map((p) => ({
      size: p.size as [number, number, number],
      position: new Vector3(...p.position)
        .applyAxisAngle(new Vector3(0, 1, 0), yaw)
        .add(centre)
        .toArray(),
      rotation: [0, yaw, 0],
    }));
  });
}
