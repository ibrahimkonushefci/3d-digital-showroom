import { Box3, MathUtils, PerspectiveCamera, Ray, Vector3 } from "three";
import type { Catalog, DesignDocument } from "../catalog/types";
import {
  cabinetBounds,
  cabinetCamera,
  cameraBounds,
  inspectionCamera,
  type CameraPreset,
  type CameraView,
} from "./framing";
import {
  cutInView,
  HERO_STANCE_MAX,
  STANCE_MAX_HEIGHT,
  stanceWall,
  WALL_SIDES,
  type WallSide,
} from "../scene/rooms/stance";
import { resolveRoom } from "../scene/rooms/resolveRoom";
export { HERO_STANCE_MAX, stanceWall };

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

export const HERO_FOV = 50;
export const HERO_MAX_FOV = 62;
/** Gentle downward look; verticals stay close to vertical. */
export const HERO_PITCH_DEG = 6;
/** The eye-level shot may look down up to this much to centre the furniture. */
export const HERO_PITCH_MAX_DEG = 8;
/** Portrait phones keep the whole-furniture view. Desktop windows whose
 * settings panel narrows the canvas still get the room view, from further
 * back if needed. */
export const HERO_MIN_ASPECT = 0.62;
/** Below this share of fronts in view, an interior shot is not worth it. */
export const HERO_MIN_COVERAGE = 0.6;
/** Breathing room: the whole proposal stays inside this share of the frame. */
export const HERO_OCCUPANCY = { x: 0.86, y: 0.92 };
/** Furniture should span roughly this share of the frame width. */
export const HERO_TARGET_FILL = 0.74;
const HERO_WALL_MARGIN = 0.3;
type Side = WallSide;
const SIDES = WALL_SIDES;

/** Direction from the furniture towards a viewer standing in the room. */
export function heroHeading(design: DesignDocument) {
  const runs = design.cabinets.filter((c) => c.wall !== "island");
  if (!runs.length) return new Vector3(0, 0, 1);
  let x = 0,
    z = 0,
    total = 0;
  for (const c of runs) {
    x += Math.sin(c.rotation) * c.width;
    z += Math.cos(c.rotation) * c.width;
    total += c.width;
  }
  return new Vector3(x, 0, z).normalize();
}

/** Vertical FOV needed to keep every corner in frame from `eye`, looking at
 * `target`; Infinity if a corner falls behind the camera. */
export function requiredFov(
  eye: Vector3,
  target: Vector3,
  corners: Vector3[],
  aspect: number,
  occupancy = 0.94,
) {
  const forward = target.clone().sub(eye).normalize();
  const right = new Vector3()
    .crossVectors(forward, new Vector3(0, 1, 0))
    .normalize();
  const up = new Vector3().crossVectors(right, forward);
  let tan = 0;
  for (const corner of corners) {
    const delta = corner.clone().sub(eye);
    const depth = delta.dot(forward);
    if (depth < 0.2) return Infinity;
    tan = Math.max(
      tan,
      Math.abs(delta.dot(up)) / depth,
      Math.abs(delta.dot(right)) / depth / Math.max(aspect, 0.1),
    );
  }
  return MathUtils.radToDeg(2 * Math.atan(tan / occupancy));
}

/** Points across every cabinet front (and the worktop line) in scene metres. */
export function frontSamples(design: DesignDocument) {
  const points: Vector3[] = [];
  for (const c of design.cabinets) {
    const bottom = c.level === "wall" ? 1.4 : c.level === "wardrobe" ? 0 : 0.1;
    const top = bottom + c.height / 100;
    for (const u of [-0.42, 0, 0.42])
      for (const y of [bottom + 0.1, (bottom + top) / 2, top - 0.05]) {
        const x = (u * c.width) / 100,
          z = c.depth / 200 + 0.02;
        points.push(
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
  }
  return points;
}

/** Horizontal share of the frame spanned by the visible furniture samples. */
export function frameFill(
  eye: Vector3,
  target: Vector3,
  points: Vector3[],
  fov: number,
  aspect: number,
) {
  const forward = target.clone().sub(eye).normalize();
  const right = new Vector3()
    .crossVectors(forward, new Vector3(0, 1, 0))
    .normalize();
  const tanX = Math.tan(MathUtils.degToRad(fov / 2)) * aspect;
  let lo = Infinity,
    hi = -Infinity;
  for (const p of points) {
    const delta = p.clone().sub(eye);
    const depth = delta.dot(forward);
    if (depth < 0.7) continue;
    const x = MathUtils.clamp(delta.dot(right) / depth / tanX, -1, 1);
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  return hi > lo ? (hi - lo) / 2 : 0;
}

/** Fraction of `points` inside a symmetric frustum (and not uncomfortably near). */
export function frustumCoverage(
  eye: Vector3,
  target: Vector3,
  points: Vector3[],
  fov: number,
  aspect: number,
) {
  const forward = target.clone().sub(eye).normalize();
  const right = new Vector3()
    .crossVectors(forward, new Vector3(0, 1, 0))
    .normalize();
  const up = new Vector3().crossVectors(right, forward);
  const tanY = Math.tan(MathUtils.degToRad(fov / 2)) * 0.97,
    tanX = tanY * aspect;
  let inside = 0;
  for (const p of points) {
    const delta = p.clone().sub(eye);
    const depth = delta.dot(forward);
    if (depth < 0.7) continue;
    if (
      Math.abs(delta.dot(right)) <= tanX * depth &&
      Math.abs(delta.dot(up)) <= tanY * depth
    )
      inside++;
  }
  return points.length ? inside / points.length : 0;
}

/** Outer corners of every cabinet front, floor to top, in scene metres: the
 * whole proposal, including the outer edges of the end units. */
export function compositionPoints(design: DesignDocument) {
  const points: Vector3[] = [];
  for (const c of design.cabinets) {
    const bottom = c.level === "wall" ? 1.4 : 0;
    const top =
      (c.level === "wall" ? 1.4 : c.level === "wardrobe" ? 0 : 0.1) +
      c.height / 100;
    for (const u of [-0.5, 0, 0.5])
      for (const y of [bottom, (bottom + top) / 2, top]) {
        const x = (u * c.width) / 100,
          z = c.depth / 200 + 0.02;
        points.push(
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
  }
  return points;
}

/** What the opening view must keep in frame: every cabinet body to its top
 * and outer edges. Only the plinth line at the floor may run out at the
 * bottom edge, as in an interior photograph; otherwise a near tall unit
 * forces the camera far back and the kitchen ends up small in the frame. */
export function heroFitPoints(design: DesignDocument) {
  return compositionPoints(design).map((p) =>
    p.y === 0 ? p.clone().setY(0.1) : p,
  );
}

/** Horizontal frame positions (−1…1) of `points` for a level-ish view. */
function horizontalSpan(eye: Vector3, target: Vector3, points: Vector3[]) {
  const forward = target.clone().sub(eye).normalize();
  const right = new Vector3()
    .crossVectors(forward, new Vector3(0, 1, 0))
    .normalize();
  let lo = Infinity,
    hi = -Infinity;
  for (const p of points) {
    const delta = p.clone().sub(eye);
    const depth = delta.dot(forward);
    if (depth < 0.2) return null;
    const x = delta.dot(right) / depth;
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  return { lo, hi };
}

const heroCache = new Map<string, CameraView | null>();

/**
 * Eye-level shot from inside the room, like a photographer showing the whole
 * proposal. Candidate spots are scored first on fitting every cabinet with
 * breathing room, then on a natural lens, a furniture span near
 * HERO_TARGET_FILL and a square view of the runs. The view is turned so the
 * furniture sits centred, never leaving one side to an empty wall. In small
 * rooms the camera may step back behind one empty wall (hidden, see
 * HERO_STANCE_MAX); it never stands inside a cabinet.
 */
export function interiorHero(
  design: DesignDocument,
  catalog: Catalog,
  aspect: number,
  opened: readonly string[] = [],
): CameraView | null {
  const key = [
    cameraStructureKey(design),
    aspect.toFixed(3),
    opened.join(","),
  ].join("|");
  if (heroCache.has(key)) return heroCache.get(key)!;
  const view = searchInteriorHero(design, catalog, aspect, opened);
  if (heroCache.size > 64) heroCache.clear();
  heroCache.set(key, view);
  return view;
}

function searchInteriorHero(
  design: DesignDocument,
  catalog: Catalog,
  aspect: number,
  opened: readonly string[],
): CameraView | null {
  const bounds = furnitureEnvelope(design, catalog, opened);
  const centre = bounds.getCenter(new Vector3());
  const points = frontSamples(design);
  const outline = compositionPoints(design);
  const fitOutline = heroFitPoints(design);
  const tilt = Math.tan(MathUtils.degToRad(HERO_PITCH_DEG));
  const heading = heroHeading(design);
  const room = design.room;
  const halfW = room.width / 200,
    halfD = room.depth / 200,
    h = room.height / 100;
  const eye = Math.min(design.kind === "wardrobe" ? 1.5 : 1.55, h - 0.4);
  const furniture = design.cabinets.map((c) =>
    furnitureEnvelope({ ...design, cabinets: [c] }, catalog).expandByScalar(
      0.3,
    ),
  );
  // Only an empty wall may be stepped behind: furniture on it would stand
  // between the camera and the room.
  const empty = new Set(
    SIDES.filter((side) => !design.cabinets.some((c) => c.wall === side)),
  );
  const extent = (side: Side) =>
    empty.has(side) ? HERO_STANCE_MAX : -HERO_WALL_MARGIN;
  const x0 = -halfW - extent("left"),
    x1 = halfW + extent("right"),
    z0 = -halfD - extent("back"),
    z1 = halfD + extent("front");
  const nx = Math.max(8, Math.round((x1 - x0) / 0.2)),
    nz = Math.max(8, Math.round((z1 - z0) / 0.2));
  const lens = new PerspectiveCamera(HERO_FOV, aspect, 0.05, 100);
  // A window with its garden view helps the picture read as a real room.
  const windows = room.openings
    .filter((o) => o.type === "window")
    .map((o) => {
      const s = (o.offset + o.width / 2) / 100,
        y = (o.sill + o.height / 2) / 100;
      const centre =
        o.wall === "back"
          ? new Vector3(s - halfW, y, -halfD)
          : o.wall === "front"
            ? new Vector3(s - halfW, y, halfD)
            : o.wall === "left"
              ? new Vector3(-halfW, y, s - halfD)
              : new Vector3(halfW, y, s - halfD);
      return { wall: o.wall, centre };
    });
  // Staged floor props (stools) are either wholly in the picture or out of
  // it; a half-cropped stool at the bottom edge looks like a mistake.
  const props = resolveRoom(design)
    .props.filter((p) => p.id !== "pendant")
    .map(({ volume }) => {
      const corners: Vector3[] = [];
      for (const x of [volume.min[0], volume.max[0]])
        for (const y of [volume.min[1], volume.max[1]])
          for (const z of [volume.min[2], volume.max[2]])
            corners.push(new Vector3(x - halfW, y, z - halfD));
      return corners;
    });
  type Candidate = {
    score: number;
    coverage: number;
    position: Vector3;
    fov: number;
    target: Vector3;
  };
  const search = (height: number, level: boolean) => {
    let best: Candidate | null = null;
    for (let i = 0; i <= nx; i++)
      for (let j = 0; j <= nz; j++) {
        const position = new Vector3(
          x0 + ((x1 - x0) * i) / nx,
          height,
          z0 + ((z1 - z0) * j) / nz,
        );
        const behind = stanceWall(position, room);
        if (behind === "invalid") continue;
        // Raised corner views stay inside the room.
        if (behind && (!level || !empty.has(behind))) continue;
        if (furniture.some((box) => box.containsPoint(position))) continue;
        const toward = position.clone().sub(centre).setY(0);
        const distance = toward.length();
        if (distance < 1.2) continue;
        const facing = toward.clone().normalize().dot(heading);
        if (facing < 0.3) continue;
        // Aim at the furniture centre, then turn so the whole proposal sits
        // centred left-to-right instead of leaving one side to a bare wall.
        const target = level
          ? centre.clone().setY(height - distance * tilt)
          : centre.clone();
        for (let k = 0; k < 2; k++) {
          const span = horizontalSpan(position, target, outline);
          if (!span) break;
          const yaw = -Math.atan((span.lo + span.hi) / 2);
          const offset = target.clone().sub(position);
          offset.applyAxisAngle(new Vector3(0, 1, 0), yaw);
          target.copy(position).add(offset);
        }
        // Eye level: centre floor-to-top in the frame too, looking down by
        // 0–HERO_PITCH_MAX_DEG so verticals stay vertical.
        if (level) {
          const flat = target.clone().sub(position).setY(0);
          const reach = flat.length();
          flat.normalize();
          let lo = Infinity,
            hi = -Infinity;
          for (const p of outline) {
            const delta = p.clone().sub(position);
            const along = delta.dot(flat);
            if (along < 0.2) continue;
            const angle = Math.atan2(delta.y, along);
            lo = Math.min(lo, angle);
            hi = Math.max(hi, angle);
          }
          if (hi > lo) {
            const pitch = MathUtils.clamp(
              (lo + hi) / 2,
              -MathUtils.degToRad(HERO_PITCH_MAX_DEG),
              0,
            );
            target.y = height + Math.tan(pitch) * reach;
          }
        }
        // Separate horizontal/vertical breathing room via the aspect.
        const needed = requiredFov(
          position,
          target,
          fitOutline,
          (aspect * HERO_OCCUPANCY.x) / HERO_OCCUPANCY.y,
          HERO_OCCUPANCY.y,
        );
        const fits = needed <= HERO_MAX_FOV;
        const fov = fits ? Math.max(HERO_FOV, needed) : HERO_MAX_FOV;
        if (behind) {
          // The same test the room uses to show its ceiling: no cut edge of
          // the hidden wall may enter the frame.
          lens.fov = fov;
          lens.aspect = aspect;
          lens.updateProjectionMatrix();
          lens.position.copy(position);
          lens.lookAt(target);
          if (cutInView(lens, room, behind)) continue;
        }
        const cropped = props.some((corners) => {
          const inside = frustumCoverage(
            position,
            target,
            corners,
            fov,
            aspect,
          );
          return inside > 0 && inside < 1;
        });
        const coverage = frustumCoverage(position, target, points, fov, aspect);
        const fill = frameFill(position, target, outline, fov, aspect);
        const stance = behind
          ? Math.abs(
              behind === "front" || behind === "back"
                ? Math.abs(position.z) - halfD
                : Math.abs(position.x) - halfW,
            )
          : 0;
        // A window on the hidden wall is hidden with it.
        const garden = windows.some(
          ({ wall, centre }) =>
            wall !== behind &&
            frustumCoverage(position, target, [centre], fov, aspect) > 0,
        );
        const score =
          (fits ? 200 : coverage * 100) +
          (garden ? 6 : 0) -
          (fov - HERO_FOV) * 1.2 -
          Math.abs(fill - HERO_TARGET_FILL) * 60 +
          facing * 10 -
          stance * 4 -
          (cropped ? 40 : 0);
        if (!best || score > best.score)
          best = { score, coverage, position, fov, target };
      }
    return best;
  };
  let best = search(eye, true);
  // U-shapes, galleys and walk-ins: three facing runs cannot all be seen at
  // eye height, so step up to a raised corner view, still inside the room.
  for (const raised of [1.95, 2.2])
    if ((!best || best.coverage < 0.75) && raised <= h - 0.3) {
      const higher = search(raised, false);
      if (higher && (!best || higher.coverage > best.coverage + 0.08))
        best = higher;
    }
  // Too enclosed to photograph from inside: the caller keeps the overview.
  if (!best || best.coverage < HERO_MIN_COVERAGE) return null;
  return {
    position: best.position.toArray(),
    target: best.target.toArray(),
    fov: best.fov,
  };
}

/** Points just in front of a unit's front face (centred scene frame), on a
 * 5 × 2 grid inside its edges. */
export function frontFacePoints(
  design: DesignDocument,
  catalog: Catalog,
  id: string,
) {
  const c = design.cabinets.find((c) => c.id === id);
  if (!c) return [];
  const box = cabinetBounds({ ...design, cabinets: [c] }, catalog);
  const y0 = box.min.y,
    h = box.max.y - box.min.y,
    w = c.width / 100,
    z = c.depth / 200 + 0.03;
  return [-0.4, -0.2, 0, 0.2, 0.4].flatMap((u) =>
    [0.3, 0.7].map(
      (v) =>
        new Vector3(
          c.x / 100 -
            design.room.width / 200 +
            u * w * Math.cos(c.rotation) +
            z * Math.sin(c.rotation),
          y0 + v * h,
          c.z / 100 -
            design.room.depth / 200 -
            u * w * Math.sin(c.rotation) +
            z * Math.cos(c.rotation),
        ),
    ),
  );
}

/** How much of a unit's front `position` sees past the other furniture.
 * Front parts that a neighbour stands against (the blind side of a corner
 * unit) are not counted; `middle` is the exposed point nearest the centre
 * of the exposed front. */
export function frontVisibility(
  design: DesignDocument,
  catalog: Catalog,
  id: string,
  position: Vector3,
) {
  const others = design.cabinets
    .filter((c) => c.id !== id)
    .map((c) =>
      cabinetBounds({ ...design, cabinets: [c] }, catalog).expandByScalar(
        -0.01,
      ),
    );
  const exposed = frontFacePoints(design, catalog, id).filter(
    (p) => !others.some((box) => box.containsPoint(p)),
  );
  if (!exposed.length) return { middle: false, share: 0 };
  const centre = exposed
    .reduce((sum, p) => sum.add(p), new Vector3())
    .divideScalar(exposed.length);
  const seen = exposed.map(
    (p) => !others.some((box) => segmentHitsBox(position, p, box)),
  );
  const middle = exposed.reduce(
    (best, p, i) =>
      p.distanceTo(centre) < exposed[best].distanceTo(centre) ? i : best,
    0,
  );
  return {
    middle: seen[middle],
    share: seen.filter(Boolean).length / exposed.length,
  };
}

/** Share of the frame covered by other furniture standing much nearer the
 * camera than the subject (an oven filling half of a corner close-up). */
export function foregroundClutter(
  view: CameraView,
  aspect: number,
  obstacles: Box3[],
) {
  const lens = new PerspectiveCamera(view.fov ?? 35, aspect, 0.05, 50);
  lens.position.set(...view.position);
  lens.lookAt(new Vector3(...view.target));
  lens.updateMatrixWorld();
  const near = 0.6 * lens.position.distanceTo(new Vector3(...view.target));
  const ray = new Ray(),
    hit = new Vector3();
  let blocked = 0,
    total = 0;
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 5; j++) {
      const u = -0.85 + (1.7 * i) / 5,
        v = -0.8 + (1.6 * j) / 4;
      ray.origin.copy(lens.position);
      ray.direction
        .set(u, v, 0.5)
        .unproject(lens)
        .sub(lens.position)
        .normalize();
      total++;
      if (
        obstacles.some(
          (box) =>
            ray.intersectBox(box, hit) && hit.distanceTo(lens.position) < near,
        )
      )
        blocked++;
    }
  return blocked / total;
}

/** Order of the wall boxes at the end of cameraObstacles(). */
const WALL_ORDER: WallSide[] = ["back", "front", "left", "right"];
const INSPECT_ANGLES = [0, 15, -15, 30, -30, 45, -45, 60, -60];
const INSPECT_FOVS = [35, 45, 55, 65];
/**
 * Close-up of one unit. Searches viewing angles (straight on first, then up
 * to 60° to either side), eye heights and lens widths for a camera that
 * stands in the room (or at eye level just behind one hidden wall), is not
 * inside other furniture, and sees the unit's front past everything else,
 * e.g. a corner carousel next to a tall fridge.
 */
export function inspectionShot(
  design: DesignDocument,
  catalog: Catalog,
  id: string,
  aspect: number,
  opened?: readonly string[],
): CameraView | null {
  const c = design.cabinets.find((c) => c.id === id);
  if (!c) return null;
  const straight = inspectionCamera(design, id, catalog)!;
  const others = design.cabinets
    .filter((o) => o.id !== id)
    .map((o) => cabinetBounds({ ...design, cabinets: [o] }, catalog));
  // Frame the part of the front a customer can see (a corner unit's door,
  // not the blind part behind its neighbour); an open unit keeps the room
  // its doors swing into.
  const own = cabinetBounds({ ...design, cabinets: [c] }, catalog);
  const exposed = frontFacePoints(design, catalog, id).filter(
    (p) => !others.some((box) => box.containsPoint(p)),
  );
  const bounds = opened?.includes(id)
    ? furnitureEnvelope({ ...design, cabinets: [c] }, catalog, [id])
    : new Box3().setFromPoints(
        exposed.length ? exposed : [own.getCenter(new Vector3())],
      );
  bounds.min.y = Math.min(bounds.min.y, own.min.y);
  bounds.max.y = Math.max(bounds.max.y, own.max.y);
  bounds.expandByVector(new Vector3(0.14, 0.06, 0.14));
  const solids = design.cabinets
    .filter((o) => o.id !== id)
    .map((o) =>
      cabinetBounds({ ...design, cabinets: [o] }, catalog).expandByScalar(0.15),
    );
  const roomWalls = cameraObstacles(design, catalog).slice(-4);
  const ceiling = design.room.height / 100 - 0.15;
  const eyes = [straight.position[1], 1.85, 2.1].filter((y) => y <= ceiling);
  const forward = new Vector3(
    straight.position[0] - straight.target[0],
    0,
    straight.position[2] - straight.target[2],
  ).normalize();
  let best: { view: CameraView; cost: number } | null = null;
  for (const [ei, eye] of eyes.entries())
    for (const fov of INSPECT_FOVS)
      for (const angle of INSPECT_ANGLES) {
        const heading = forward
          .clone()
          .applyAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(angle));
        const target = new Vector3(...straight.target);
        const view = cabinetCamera(
          bounds,
          "perspective",
          aspect,
          {
            target: target.toArray(),
            position: target.clone().add(heading).setY(eye).toArray(),
          },
          0.84,
          fov,
        );
        const p = new Vector3(...view.position);
        const behind = stanceWall(p, design.room);
        if (behind === "invalid" || p.y > ceiling) continue;
        if (solids.some((box) => box.containsPoint(p))) continue;
        // Behind a hidden wall only as an eye-level photograph: none of the
        // wall's cut edges (and the dark outside) may show.
        if (behind) {
          if (p.y > STANCE_MAX_HEIGHT) continue;
          const lens = new PerspectiveCamera(fov, aspect, 0.05, 50);
          lens.position.copy(p);
          lens.lookAt(new Vector3(...view.target));
          lens.updateProjectionMatrix();
          if (cutInView(lens, design.room, behind)) continue;
        }
        const seen = frontVisibility(design, catalog, id, p);
        if (!seen.middle) continue;
        // Walls count too, except one the camera stands behind (hidden).
        const walls = roomWalls.filter((_, i) => WALL_ORDER[i] !== behind);
        const clutter = foregroundClutter({ ...view, fov }, aspect, [
          ...others,
          ...walls,
        ]);
        if (clutter > 0.3) continue;
        const cost =
          clutter * 160 +
          Math.abs(angle) +
          (fov - 35) * 0.9 +
          ei * 14 +
          (behind ? (p.y > STANCE_MAX_HEIGHT ? 60 : 18) : 0) +
          (1 - seen.share) * 120;
        if (!best || cost < best.cost) best = { view: { ...view, fov }, cost };
      }
  return best?.view ?? null;
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
  if (focused) {
    const close = inspectionShot(
      design,
      catalog,
      focused.id,
      aspect,
      options.opened,
    );
    if (close) return close;
  }
  // A view the customer had before inspecting: restored exactly.
  if (!focused && options.authored?.exact) return options.authored;
  const interior =
    shot === "hero" && !focused && aspect >= HERO_MIN_ASPECT
      ? interiorHero(design, catalog, aspect, options.opened)
      : null;
  if (interior) return interior;
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
    ? inspectionCamera(design, focused.id, catalog)!
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
