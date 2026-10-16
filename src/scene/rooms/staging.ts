import { Box3, PerspectiveCamera, Vector3 } from "three";
import type { Catalog, DesignDocument } from "../../catalog/types";
import {
  frontSamples,
  interiorHero,
  roomShot,
  segmentHitsBox,
} from "../../designer3d/cameraShots";
import type { CameraView } from "../../designer3d/framing";
import {
  cabinetExclusion,
  doorExclusions,
  overlaps,
  transformedVolume,
  type Volume,
} from "../assets/placement";
import { modelRecord } from "../assets/manifest";
import { presentationEnvelope, type Envelope } from "./envelope";
import { stanceWall, type WallSide } from "./stance";

/**
 * Room staging: the unpriced furniture that makes a prepared design read as
 * part of a home. It lives in the presentation envelope (envelope.ts), in
 * the space the envelope adds beside and in front of the furniture:
 *
 * - kitchens: a dining group (table, four chairs, pendant) beside the run,
 *   in front of the garden door; island kitchens a reading corner instead
 *   (the island seats people); a sideboard with a print above it, a tall
 *   plant, a wall clock and open shelves where wall space allows;
 * - dressing rooms: a rug in front of the wardrobes, an armchair with a
 *   side table, a leaning mirror, a chest of drawers with a print, a plant
 *   and a pendant.
 *
 * Every piece clears the furniture with its opening fronts and doors
 * (`cabinetExclusion`), the doorway and the garden door. Floor pieces stand
 * outside the design room itself (never between a viewer and the fronts)
 * and are scored against the Main view and the Front view: a piece that
 * would hide fronts, or show only as a sliver at the edge of the picture, is
 * moved or left out. Custom rooms simply get fewer pieces. Nothing here is
 * selectable or priced.
 */

/** Laptop canvas beside the settings panel (1440 × 900 window). */
export const STAGING_ASPECT = 1.666;

export type StagedModel = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
  /** Hangs on this wall: hidden whenever the wall is cut away. */
  wall?: WallSide;
};
export type StagedBuilt =
  | {
      type: "table";
      position: [number, number, number];
      yaw: number;
      size: [number, number, number];
    }
  | {
      type: "rug";
      position: [number, number, number];
      yaw: number;
      size: [number, number];
      color: string;
    }
  | {
      type: "shelves";
      position: [number, number, number];
      yaw: number;
      width: number;
      levels: number[];
      wall: WallSide;
    }
  | {
      type: "clock";
      position: [number, number, number];
      yaw: number;
      wall: WallSide;
    }
  | {
      type: "mirror";
      position: [number, number, number];
      yaw: number;
      wall: WallSide;
    };
export type Staging = {
  models: StagedModel[];
  built: StagedBuilt[];
  /** Solid volumes cameras must not stand in or look through. */
  solids: Volume[];
};

const EMPTY: Staging = { models: [], built: [], solids: [] };
const cache = new Map<string, Staging>();

function stagingKey(design: DesignDocument) {
  return JSON.stringify([
    design.kind,
    design.layout,
    design.room,
    design.cabinets.map((c) => [
      c.moduleId,
      c.x,
      c.z,
      c.rotation,
      c.width,
      c.height,
      c.depth,
      c.level,
      c.wall,
    ]),
  ]);
}

export function roomStaging(design: DesignDocument, catalog: Catalog): Staging {
  if (design.cabinets.length >= 24) return EMPTY;
  const key = stagingKey(design);
  const hit = cache.get(key);
  if (hit) return hit;
  // Placeholder while composing: the camera searches consult staging.
  cache.set(key, EMPTY);
  const result = stage(design, catalog);
  if (cache.size > 32) cache.clear();
  cache.set(key, result);
  return result;
}

/** A view a piece is composed for. */
type Lens = {
  camera: PerspectiveCamera;
  eye: Vector3;
  behind: WallSide | null;
};

function lensFor(
  envelope: Envelope,
  view: CameraView | null,
): Lens | null {
  if (!view) return null;
  const camera = new PerspectiveCamera(
    view.fov ?? 50,
    STAGING_ASPECT,
    0.05,
    60,
  );
  camera.position.set(...view.position);
  camera.lookAt(new Vector3(...view.target));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const behind = stanceWall(camera.position, envelope.room);
  return {
    camera,
    eye: camera.position.clone(),
    behind: behind === "invalid" ? null : behind,
  };
}

/** Room-corner frame → centred scene frame. */
const centred = (design: DesignDocument, x: number, y: number, z: number) =>
  new Vector3(x - design.room.width / 200, y, z - design.room.depth / 200);

/** Corners, edge midpoints and centre of a volume (27 points). */
function lattice(v: Volume) {
  const out: [number, number, number][] = [];
  const steps = (i: number) => [v.min[i], (v.min[i] + v.max[i]) / 2, v.max[i]];
  for (const x of steps(0))
    for (const y of steps(1)) for (const z of steps(2)) out.push([x, y, z]);
  return out;
}

/** Share of a volume inside the frame (with a small margin). */
function inFrame(design: DesignDocument, lens: Lens, v: Volume, margin = 0.95) {
  const points = lattice(v);
  let inside = 0;
  for (const [x, y, z] of points) {
    const p = centred(design, x, y, z).project(lens.camera);
    if (p.z < 1 && Math.abs(p.x) <= margin && Math.abs(p.y) <= margin) inside++;
  }
  return inside / points.length;
}

function toBox(design: DesignDocument, v: Volume) {
  return new Box3(centred(design, ...v.min), centred(design, ...v.max));
}

/** Share of furniture front samples a set of volumes hides from the lens. */
function hides(
  design: DesignDocument,
  lens: Lens,
  samples: Vector3[],
  volumes: Volume[],
) {
  if (!samples.length) return 0;
  const boxes = volumes.map((v) => toBox(design, v));
  let hidden = 0;
  for (const s of samples)
    if (boxes.some((b) => segmentHitsBox(lens.eye, s, b))) hidden++;
  return hidden / samples.length;
}

function distanceToEye(design: DesignDocument, lens: Lens, v: Volume) {
  const box = toBox(design, v);
  return box.distanceToPoint(
    new Vector3(
      lens.eye.x,
      Math.min(Math.max(lens.eye.y, box.min.y), box.max.y),
      lens.eye.z,
    ),
  );
}

/** Volume of a model placed on the floor (or wall) in the corner frame. */
function modelVolume(
  id: string,
  position: [number, number, number],
  yaw: number,
  scale = 1,
): Volume | null {
  const record = modelRecord(id);
  if (!record) return null;
  const s = (v: number[]) => v.map((n) => n * scale);
  return transformedVolume(
    s(record.bounds.min),
    s(record.bounds.max),
    position,
    yaw,
  );
}

/** Rotate a local offset by yaw (three's Y rotation) and add it to a point. */
function at(
  origin: [number, number, number],
  yaw: number,
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  return [
    origin[0] + x * Math.cos(yaw) + z * Math.sin(yaw),
    origin[1] + y,
    origin[2] - x * Math.sin(yaw) + z * Math.cos(yaw),
  ];
}

/** Facing into the room from each wall. */
const WALL_YAW: Record<WallSide, number> = {
  back: 0,
  front: Math.PI,
  left: Math.PI / 2,
  right: -Math.PI / 2,
};
const WALLS: WallSide[] = ["right", "back", "left", "front"];

function grow(v: Volume, by: number): Volume {
  return {
    min: [v.min[0] - by, v.min[1], v.min[2] - by],
    max: [v.max[0] + by, v.max[1], v.max[2] + by],
  };
}

export type StagedGroup = {
  kind: "dining" | "reading";
  centre: [number, number, number];
  yaw: number;
  /** Dining table length. */
  length: number;
  /** Reading / dressing-room chair model. */
  chair: string;
  /** Volumes of the whole group (corner frame), for camera composition. */
  parts: Volume[];
};
const groupCache = new Map<string, StagedGroup | null>();

/**
 * The one furniture group beside the run, placed from the room alone (no
 * camera): kitchens without an island get a dining table with four chairs,
 * island kitchens and dressing rooms an armchair with a side table. It
 * stands in the space the envelope adds, as near as possible to the floor in
 * front of the garden door or window, clear of fronts, doorway and walls.
 */
export function stagedGroup(
  design: DesignDocument,
  catalog: Catalog,
): StagedGroup | null {
  if (design.cabinets.length >= 24) return null;
  const key = stagingKey(design);
  if (groupCache.has(key)) return groupCache.get(key)!;
  const result = placeGroup(design, catalog);
  if (groupCache.size > 32) groupCache.clear();
  groupCache.set(key, result);
  return result;
}

function placeGroup(
  design: DesignDocument,
  catalog: Catalog,
): StagedGroup | null {
  const { w, d, grid, clearFloor, wallGap, onWall, envelope } =
    roomFrame(design, catalog);
  // Where the group would ideally stand: in front of the garden door (or
  // window), otherwise in the middle of the added side area.
  const garden = envelope.room.openings.find((o) => o.id === "envelope-garden");
  const ideal: [number, number, number] = garden
    ? onWall(
        garden.wall,
        (garden.offset + garden.width / 2) / 100,
        0,
        design.kind === "kitchen" ? 1.45 : 1.0,
      )
    : [w + envelope.moved.right / 2, 0, d * 0.6];
  const dist = (p: [number, number, number]) =>
    Math.hypot(p[0] - ideal[0], p[2] - ideal[2]);
  const island = design.cabinets.some((c) => c.wall === "island");
  if (design.kind === "kitchen" && !island && modelRecord("dining-chair")) {
    let best: (StagedGroup & { cost: number }) | null = null;
    for (const length of [1.6, 1.4])
      for (const yaw of [0, Math.PI / 2])
        for (const [x, z] of grid(0.1)) {
          const centre: [number, number, number] = [x, 0, z];
          if (dist(centre) > 2) continue;
          const tableVol = transformedVolume(
            [-length / 2, 0, -0.45],
            [length / 2, 0.76, 0.45],
            centre,
            yaw,
          );
          const chairVols = [-1, 1].flatMap((side) =>
            [-0.36, 0.36].map(
              (along) =>
                modelVolume(
                  "dining-chair",
                  at(centre, yaw, along * (length / 1.6), 0, side * 0.7),
                  yaw + (side < 0 ? 0 : Math.PI),
                )!,
            ),
          );
          const parts = [tableVol, ...chairVols];
          // Room to walk round and pull the chairs out.
          if (!clearFloor(parts.map((v) => grow(v, 0.2)))) continue;
          const cost =
            dist(centre) * 10 +
            (length < 1.6 ? 4 : 0) +
            // The long side faces the room (chairs either side of the view).
            (yaw === 0 ? 0 : 2) +
            Math.max(0, 0.5 - Math.min(...parts.map(wallGap))) * 20;
          if (!best || cost < best.cost)
            best = {
              cost,
              kind: "dining",
              centre,
              yaw,
              length,
              chair: "dining-chair",
              parts,
            };
        }
    if (best) {
      const { cost: _cost, ...group } = best;
      return group;
    }
    return null;
  }
  const chair = "armchair";
  if (!modelRecord(chair)) return null;
  let best: (StagedGroup & { cost: number }) | null = null;
  for (const [x, z] of grid(0.1))
    for (const turn of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const centre: [number, number, number] = [x, 0, z];
      if (dist(centre) > 2.2) continue;
      // Facing the furniture, angled like a reading chair.
      const yaw = Math.atan2(w / 2 - x, d / 2 + 0.4 - z) + turn;
      const chairVol = modelVolume(chair, centre, yaw)!;
      const side = modelVolume("side-table", at(centre, yaw, 0.72, 0, -0.05), yaw);
      const parts = side ? [chairVol, side] : [chairVol];
      if (!clearFloor(parts.map((v) => grow(v, 0.12)))) continue;
      const gap = Math.min(...parts.map(wallGap));
      const cost =
        dist(centre) * 8 +
        Math.abs(turn) * 3 +
        Math.abs(gap - 0.35) * 10;
      if (!best || cost < best.cost)
        best = {
          cost,
          kind: "reading",
          centre,
          yaw,
          length: 0,
          chair,
          parts,
        };
    }
  if (!best) return null;
  const { cost: _cost, ...group } = best;
  return group;
}

/** The envelope in the design room's corner frame, with the clearance
 * tests every staged piece shares. Independent of any camera. */
function roomFrame(design: DesignDocument, catalog: Catalog) {
  const envelope = presentationEnvelope(design);
  // Where the Front and Overview cameras stand (corner frame): floor pieces
  // keep clear of them, so those views never start inside a chair or chest.
  const cameraSpots = (["front", "overall"] as const).map((shot) => {
    const view = roomShot(design, catalog, shot, STAGING_ASPECT);
    return [
      view.position[0] + design.room.width / 200,
      view.position[2] + design.room.depth / 200,
    ] as const;
  });
  const w = design.room.width / 100,
    d = design.room.depth / 100,
    h = design.room.height / 100;
  // Envelope bounds in the design room's corner frame.
  const [ox, oz] = envelope.origin;
  const W = envelope.room.width / 100,
    D = envelope.room.depth / 100;
  const x0 = ox,
    x1 = ox + W,
    z0 = oz,
    z1 = oz + D;
  const wallLength = (wall: WallSide) =>
    wall === "back" || wall === "front" ? W : D;
  /** A point on an envelope wall's room face: `along` from the wall's start
   * (left end of back/front walls, back end of side walls), `out` metres
   * into the room. */
  const onWall = (
    wall: WallSide,
    along: number,
    y: number,
    out: number,
  ): [number, number, number] =>
    wall === "back"
      ? [x0 + along, y, z0 + out]
      : wall === "front"
        ? [x0 + along, y, z1 - out]
        : wall === "left"
          ? [x0 + out, y, z0 + along]
          : [x1 - out, y, z0 + along];
  const swept = [
    ...design.cabinets.map(cabinetExclusion),
    ...doorExclusions(design),
  ];
  const out: Staging = { models: [], built: [], solids: [] };
  /** Floor and wall volumes already taken by staging. */
  const taken: Volume[] = [];
  /** Openings of the envelope, with the floor in front of doors kept clear
   * (a walking path through the doorway, the garden door's threshold). */
  const openings = envelope.room.openings.map((o) => {
    const a = o.offset / 100,
      b = (o.offset + o.width) / 100,
      y0 = o.sill / 100 - 0.08,
      y1 = (o.sill + o.height) / 100 + 0.1;
    const reach = o.style === "passage" ? 1.1 : o.sill === 0 ? 0.6 : 0.3;
    const lo = onWall(o.wall, a - 0.1, y0, 0),
      hi = onWall(o.wall, b + 0.1, y1, reach);
    return {
      wall: o.wall,
      floor: o.sill === 0,
      v: {
        min: [Math.min(lo[0], hi[0]), Math.max(0, y0), Math.min(lo[2], hi[2])],
        max: [Math.max(lo[0], hi[0]), y1, Math.max(lo[2], hi[2])],
      } as Volume,
    };
  });
  // Return walls are solid.
  const returns = envelope.returns.map(
    (r) =>
      ({
        min: [
          r.position[0] - r.size[0] / 2,
          0,
          r.position[2] - r.size[2] / 2,
        ],
        max: [r.position[0] + r.size[0] / 2, h, r.position[2] + r.size[2] / 2],
      }) as Volume,
  );
  // The slatted feature wall takes its wall area (no art or shelves on it).
  if (envelope.slats) {
    const { wall, a, b } = envelope.slats;
    const lo = onWall(wall, a, 0, 0),
      hi = onWall(wall, b, h, 0.06);
    returns.push({
      min: [Math.min(lo[0], hi[0]), 0, Math.min(lo[2], hi[2])],
      max: [Math.max(lo[0], hi[0]), h, Math.max(lo[2], hi[2])],
    });
  }
  const insideEnvelope = (v: Volume, margin = 0.02) =>
    v.min[0] >= x0 + margin &&
    v.min[2] >= z0 + margin &&
    v.max[0] <= x1 - margin &&
    v.max[2] <= z1 - margin &&
    v.max[1] <= h - 0.05;
  /** Floor pieces stand in the space the envelope adds, never in the design
   * room in front of the furniture. */
  const designRoom: Volume = {
    min: [-0.05, 0, -0.05],
    max: [w + 0.05, h, d + 0.05],
  };
  const clearFloor = (parts: Volume[], allowDesignRoom = false, margin = 0.04) =>
    parts.every(
      (v) =>
        insideEnvelope(v, margin) &&
        (allowDesignRoom || !overlaps(designRoom, v)) &&
        !swept.some((s) => overlaps(s, v)) &&
        !taken.some((t) => overlaps(t, v)) &&
        !returns.some((r) => overlaps(r, v)) &&
        !openings.some((o) => overlaps(o.v, v)) &&
        !cameraSpots.some(
          ([x, z]) =>
            Math.max(v.min[0] - x, 0, x - v.max[0]) ** 2 +
              Math.max(v.min[2] - z, 0, z - v.max[2]) ** 2 <
            1.1 ** 2,
        ),
    );
  const clearWall = (v: Volume) =>
    insideEnvelope(v, 0) &&
    !swept.some((s) => overlaps(s, v)) &&
    !taken.some((t) => overlaps(t, v)) &&
    !returns.some((r) => overlaps(r, v)) &&
    !openings.some((o) => overlaps(o.v, v));
  const grid = (step: number) => {
    const cells: [number, number][] = [];
    for (let x = x0 + step / 2; x < x1; x += step)
      for (let z = z0 + step / 2; z < z1; z += step) cells.push([x, z]);
    return cells;
  };
  const wallGap = (v: Volume) =>
    Math.min(v.min[0] - x0, v.min[2] - z0, x1 - v.max[0], z1 - v.max[2]);
  const garden = envelope.room.openings.find((o) => o.id === "envelope-garden");
  const gardenAt = garden
    ? onWall(garden.wall, (garden.offset + garden.width / 2) / 100, 0, 0)
    : null;
  return {
    envelope,
    w,
    d,
    h,
    x0,
    x1,
    z0,
    z1,
    wallLength,
    onWall,
    out,
    taken,
    openings,
    insideEnvelope,
    clearFloor,
    clearWall,
    wallGap,
    grid,
    gardenAt,
  };
}

function stage(design: DesignDocument, catalog: Catalog): Staging {
  const envelope = presentationEnvelope(design);
  const hero = lensFor(
    envelope,
    interiorHero(design, catalog, STAGING_ASPECT),
  );
  if (!hero) return EMPTY;
  const front = lensFor(
    envelope,
    roomShot(design, catalog, "front", STAGING_ASPECT),
  );
  const overview = lensFor(
    envelope,
    roomShot(design, catalog, "overall", STAGING_ASPECT),
  );
  // Main view first (it decides cropping); Front and Overview only count
  // the fronts a piece would hide.
  const lenses = [hero, ...[front, overview].filter((l): l is Lens => !!l)];
  const frame = roomFrame(design, catalog);
  const {
    w,
    h,
    x0,
    x1,
    z0,
    z1,
    wallLength,
    onWall,
    out,
    taken,
    insideEnvelope,
    clearFloor,
    clearWall,
    wallGap,
    grid,
    gardenAt,
  } = frame;
  const samples = frontSamples(design);
  /** How a group of floor pieces composes in the views: null when a piece
   * shows only as a sliver at a frame edge, stands too close to the eye, or
   * hides more than a trace of the fronts in the Main view. */
  /** Front and Overview views: a floor piece is never a sliver at the frame
   * edge or a looming shape right in front of the lens. */
  const otherViewsOk = (v: Volume) =>
    lenses.slice(1).every((lens) => {
      if (distanceToEye(design, lens, v) < 1.3) return false;
      // Whole (with a little margin) or not in the picture at all.
      const share = inFrame(design, lens, v, 0.97);
      return share < 0.02 || (share >= 0.98 && inFrame(design, lens, v, 1.1) >= 0.98);
    });
  const viewCost = (parts: Volume[], eyeClearance = 1.3, minShare = 0.5) => {
    if (!parts.every(otherViewsOk)) return null;
    let cropped = 0,
      seen = false,
      hidden = 0;
    for (const [i, lens] of lenses.entries()) {
      for (const v of parts) {
        if (i === 0 && distanceToEye(design, lens, v) < eyeClearance)
          return null;
        const share = inFrame(design, lens, v);
        if (i === 0) {
          if (share > 0 && share < minShare) return null;
          if (share >= minShare) seen = true;
          cropped += share > 0 ? 1 - share : 0;
        }
      }
      const hid = hides(design, lens, samples, parts);
      if (i === 0 && hid > 0.02) return null;
      hidden += hid * (i === 0 ? 1 : 0.6);
    }
    return { seen, hidden, cropped: cropped / parts.length };
  };
  /** 0 when a wall piece is wholly in the Main view, a small cost when it
   * is wholly outside it (seen when orbiting), null when it would be cut by
   * the frame edge or hang on a hidden wall. */
  const wallView = (wall: WallSide, v: Volume, margin = 0.9) => {
    if (hero.behind === wall) return null;
    if (inFrame(design, hero, v, margin) === 1) return 0;
    // Wholly outside, with a margin beyond the frame edge.
    return inFrame(design, hero, v, 1.08) === 0 ? 1 : null;
  };
  /** A free spot on a wall for a piece `width` wide spanning y0..y1 and
   * `deep` into the room, fully in the Main view; lowest `prefer` wins. */
  const wallSpot = (
    width: number,
    y0: number,
    y1: number,
    deep: number,
    prefer: (wall: WallSide, along: number) => number,
    floor = false,
  ) => {
    let best: {
      cost: number;
      wall: WallSide;
      along: number;
      v: Volume;
    } | null = null;
    for (const wall of WALLS) {
      const length = wallLength(wall);
      for (
        let along = width / 2 + 0.15;
        along <= length - width / 2 - 0.15;
        along += 0.05
      ) {
        const p = onWall(wall, along, 0, 0);
        const v = transformedVolume(
          [-width / 2, y0, 0],
          [width / 2, y1, deep],
          p,
          WALL_YAW[wall],
        );
        if (!clearWall(v)) continue;
        const outside = wallView(wall, v);
        if (outside === null) continue;
        // Against the wall: no wall margin, a little room at the sides.
        if (floor && !clearFloor([grow(v, 0.03)], false, -0.04)) continue;
        if (floor && hides(design, hero, samples, [v]) > 0) continue;
        if (floor && !otherViewsOk(v)) continue;
        const cost = prefer(wall, along) + outside * 12;
        if (!best || cost < best.cost) best = { cost, wall, along, v };
      }
    }
    return best;
  };
  const near = (p: [number, number, number] | null, q: [number, number, number]) =>
    p ? Math.hypot(p[0] - q[0], p[2] - q[2]) : 0;
  const addModel = (
    id: string,
    position: [number, number, number],
    yaw: number,
    scale?: number,
    wall?: WallSide,
    solid = true,
  ) => {
    out.models.push({
      id,
      position,
      rotation: [0, yaw, 0],
      ...(scale ? { scale } : {}),
      ...(wall ? { wall } : {}),
    });
    const v = modelVolume(id, position, yaw, scale);
    if (v) {
      if (solid) out.solids.push(v);
      taken.push(grow(v, 0.06));
    }
    return v;
  };

  /** The group's centre for decor that gathers around it (art, clock). */
  let focus: [number, number, number] | null = gardenAt;

  // The furniture group beside the run (dining, reading corner or the
  // dressing room's armchair), placed from the room alone; the main view is
  // composed to include it (cameraShots.heroContext).
  const group = stagedGroup(design, catalog);
  if (group) {
    const { centre, yaw } = group;
    if (group.kind === "dining") {
      const length = group.length;
      out.built.push({
        type: "table",
        position: centre,
        yaw,
        size: [length, 0.9, 0.75],
      });
      const tableVol = transformedVolume(
        [-length / 2, 0, -0.45],
        [length / 2, 0.76, 0.45],
        centre,
        yaw,
      );
      out.solids.push(tableVol);
      taken.push(grow(tableVol, 0.15));
      [-1, 1].forEach((side, s) =>
        [-0.36, 0.36].forEach((along, a) => {
          const i = s * 2 + a;
          // Chairs left slightly differently, as people leave them.
          const pull = [0.02, 0.07, 0.04, 0.0][i];
          const turn = [0.05, -0.04, -0.06, 0.03][i];
          const p = at(
            centre,
            yaw,
            along * (length / 1.6),
            0,
            side * (0.7 + pull),
          );
          addModel("dining-chair", p, yaw + (side < 0 ? 0 : Math.PI) + turn);
        }),
      );
      if (modelRecord("pendant-globe"))
        out.models.push({
          id: "pendant-globe",
          position: [centre[0], h, centre[2]],
          rotation: [0, 0, 0],
        });
    } else {
      addModel(group.chair, centre, yaw);
      const sp = at(centre, yaw, 0.72, 0, -0.05);
      const side = addModel("side-table", sp, yaw);
      if (side && modelRecord("vase-round"))
        out.models.push({
          id: "vase-round",
          position: at(sp, yaw, 0.08, side.max[1] - side.min[1], 0),
          rotation: [0, yaw, 0],
        });
    }
    focus = centre;
  }
  if (design.kind === "wardrobe") {
    // Dressing room: rug centred in front of the wardrobes, as large as the
    // floor allows; it may run under the fronts (flat).
    const run = design.cabinets.filter((c) => c.wall === "back");
    if (run.length) {
      const rx0 = Math.min(...run.map((c) => c.x / 100 - c.width / 200)),
        rx1 = Math.max(...run.map((c) => c.x / 100 + c.width / 200));
      const depth = Math.max(...run.map((c) => c.depth / 100));
      for (const [rl, rw] of [
        [2.6, 1.8],
        [2.2, 1.6],
        [1.8, 1.3],
      ]) {
        const centre: [number, number, number] = [
          Math.min(Math.max((rx0 + rx1) / 2, x0 + rl / 2 + 0.3), x1 - rl / 2 - 0.3),
          0,
          depth + 0.55 + rw / 2,
        ];
        const v = transformedVolume(
          [-rl / 2, 0, -rw / 2],
          [rl / 2, 0.01, rw / 2],
          centre,
          0,
        );
        if (
          insideEnvelope(v, 0.2) &&
          !taken.some((t) => overlaps(t, v)) &&
          distanceToEye(design, hero, v) > 0.5
        ) {
          out.built.push({
            type: "rug",
            position: centre,
            yaw: 0,
            size: [rl, rw],
            color: "#cbbfac",
          });
          break;
        }
      }
    }
    // Full-length mirror leaning on a free wall.
    const mirror = wallSpot(
      0.7,
      0,
      1.82,
      0.14,
      (wall, along) => {
        const p = onWall(wall, along, 0, 0.3);
        return Math.abs(near(focus, p) - 1.6) * 4;
      },
      true,
    );
    if (mirror) {
      const p = onWall(mirror.wall, mirror.along, 0, 0.11);
      out.built.push({
        type: "mirror",
        position: p,
        yaw: WALL_YAW[mirror.wall],
        wall: mirror.wall,
      });
      out.solids.push(mirror.v);
      taken.push(grow(mirror.v, 0.15));
    }
  }

  // A low sideboard (kitchens) or chest of drawers (dressing rooms) against a
  // free wall, with a print above it.
  const chestId = design.kind === "kitchen" ? "sideboard" : "dresser";
  const chest = modelRecord(chestId);
  let chestAt: { wall: WallSide; along: number; top: number } | null = null;
  if (chest) {
    const scale = design.kind === "kitchen" ? 0.72 : 0.9;
    const [cw, ch, cd] = chest.nativeDimensions.map((n) => n * scale);
    const spot = wallSpot(
      cw,
      0,
      ch,
      cd + 0.02,
      (wall, along) => {
        const p = onWall(wall, along, 0, 0.4);
        return near(focus, p) * 3 + (wall === "front" ? 6 : 0);
      },
      true,
    );
    if (spot) {
      const yaw = WALL_YAW[spot.wall];
      const p = onWall(spot.wall, spot.along, 0, cd / 2 + 0.02);
      addModel(chestId, p, yaw, scale);
      chestAt = { wall: spot.wall, along: spot.along, top: ch };
      taken.push(grow(spot.v, 0.1));
      if (design.kind === "kitchen") {
        // Ceramics on top.
        for (const [id, x] of [
          ["vase-tall", -cw * 0.3],
          ["vase-round", cw * 0.28],
        ] as const)
          if (modelRecord(id))
            out.models.push({
              id,
              position: at(onWall(spot.wall, spot.along, ch, cd / 2), yaw, x, 0, 0),
              rotation: [0, yaw + x, 0],
            });
      } else if (modelRecord("basket")) {
        const bp = at(p, yaw, cw / 2 + 0.3, 0, 0);
        const bv = modelVolume("basket", bp, yaw);
        if (bv && clearFloor([bv])) addModel("basket", bp, yaw);
      }
    }
  }

  // A print: above the chest, otherwise on visible free wall near the group.
  const artId =
    design.kind === "wardrobe" || (chestAt && chestAt.top < 0.8)
      ? "wall-art-tall"
      : "wall-art";
  const art = modelRecord(artId) ?? modelRecord("wall-art");
  if (art) {
    const [aw, ah] = art.nativeDimensions;
    const centreY = chestAt
      ? Math.min(h - 0.35 - ah / 2, chestAt.top + 0.3 + ah / 2)
      : 1.5;
    const spot = chestAt
      ? (() => {
          const p = onWall(chestAt.wall, chestAt.along, 0, 0);
          const v = transformedVolume(
            [-aw / 2, centreY - ah / 2, 0],
            [aw / 2, centreY + ah / 2, 0.06],
            p,
            WALL_YAW[chestAt.wall],
          );
          return clearWall(v) ? { wall: chestAt.wall, along: chestAt.along, v } : null;
        })()
      : wallSpot(aw, centreY - ah / 2, centreY + ah / 2, 0.06, (wall, along) =>
          near(focus, onWall(wall, along, 0, 0.6)) * 4,
        );
    if (spot) {
      const p = onWall(
        spot.wall,
        spot.along,
        centreY - (art.bounds.min[1] + art.bounds.max[1]) / 2,
        0.004,
      );
      out.models.push({
        id: art.id,
        position: p,
        rotation: [0, WALL_YAW[spot.wall], 0],
        wall: spot.wall,
      });
      taken.push(grow(spot.v, 0.2));
    }
  }

  // A tall plant in a corner or beside the garden door.
  const plantId = "plant-tree";
  if (modelRecord(plantId)) {
    const scale = 0.85;
    let best: {
      cost: number;
      p: [number, number, number];
      yaw: number;
    } | null = null;
    for (const [x, z] of grid(0.1)) {
      const p: [number, number, number] = [x, 0, z];
      const yaw = (x * 7.3 + z * 3.1) % (Math.PI * 2);
      const v = modelVolume(plantId, p, yaw, scale)!;
      if (!clearFloor([grow(v, 0.04)])) continue;
      const gap = wallGap(v);
      if (gap > 0.35) continue;
      const view = viewCost([v], 1.3);
      if (!view) continue;
      const corner = [Math.min(x - x0, x1 - x), Math.min(z - z0, z1 - z)].sort(
        (a, b) => a - b,
      )[1];
      const cost =
        view.hidden * 900 +
        view.cropped * 60 +
        gap * 20 +
        corner * 4 +
        near(gardenAt, p) * 3 +
        (view.seen ? 0 : 10);
      if (!best || cost < best.cost) best = { cost, p, yaw };
    }
    if (best) addModel(plantId, best.p, best.yaw, scale);
  }

  if (design.kind === "kitchen") {
    // Open shelves with books and ceramics on visible free wall, near the
    // kitchen run (back wall first).
    const shelfWidth = 1.0;
    const spot = wallSpot(shelfWidth, 1.3, 2.0, 0.26, (wall, along) => {
      const p = onWall(wall, along, 0, 0.3);
      return (
        Math.hypot(p[0] - w / 2, p[2]) * 2 + (wall === "back" ? 0 : 6)
      );
    });
    if (spot) {
      const p = onWall(spot.wall, spot.along, 0, 0);
      out.built.push({
        type: "shelves",
        position: p,
        yaw: WALL_YAW[spot.wall],
        width: shelfWidth,
        levels: [1.34, 1.72],
        wall: spot.wall,
      });
      taken.push(grow(spot.v, 0.25));
      const items: [string, number, number][] = [
        ["vase-tall", 0.3, 1.72],
        ["plant-small", -0.32, 1.34],
        ["vase", 0.28, 1.34],
      ];
      for (const [id, x, y] of items)
        if (modelRecord(id))
          out.models.push({
            id,
            position: at(p, WALL_YAW[spot.wall], x, y + 0.02, 0.13),
            rotation: [0, WALL_YAW[spot.wall] + x, 0],
            wall: spot.wall,
          });
    }
    // Wall clock near the dining group or the run.
    const y = Math.min(2.05, h - 0.45);
    const clock = wallSpot(0.4, y - 0.2, y + 0.2, 0.05, (wall, along) =>
      near(focus, onWall(wall, along, 0, 0)) * 2 + (wall === "front" ? 10 : 0),
    );
    if (clock) {
      out.built.push({
        type: "clock",
        position: onWall(clock.wall, clock.along, y, 0),
        yaw: WALL_YAW[clock.wall],
        wall: clock.wall,
      });
    }
  }
  return out;
}
