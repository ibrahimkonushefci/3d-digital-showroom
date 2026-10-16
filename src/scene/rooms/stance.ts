import { Box3, Frustum, Matrix4, Vector3, type Camera } from "three";
import type { DesignDocument } from "../../catalog/types";
/** A room box: the design room (centred on the origin) or the presentation
 * envelope, whose centre (cx, cz) is offset in the same frame. */
export type RoomBox = Pick<DesignDocument["room"], "width" | "depth" | "height"> & {
  cx?: number;
  cz?: number;
};

export type WallSide = "back" | "front" | "left" | "right";
export const WALL_SIDES: WallSide[] = ["back", "front", "left", "right"];
/** How far the hero camera may stand behind one empty wall, which is then
 * hidden, as an architectural photographer removes the fourth wall. */
export const HERO_STANCE_MAX = 2;
/** While the camera stands behind a hidden wall, the two adjoining walls
 * continue this far behind it (like standing in a doorway), so their cut
 * ends are always behind the camera. */
export const STANCE_EXTENSION = HERO_STANCE_MAX + 0.5;
/** A stance is eye level; overviews (1.9 m and up) remain cut-away views. */
export const STANCE_MAX_HEIGHT = 1.8;

/** The wall a camera stands behind (null inside the room), or "invalid" when
 * it is behind two walls or further back than the stance allows. Positions
 * are in the centred scene frame. */
export function stanceWall(
  position: { x: number; z: number },
  room: RoomBox,
  limit = HERO_STANCE_MAX,
): WallSide | null | "invalid" {
  const halfW = room.width / 200,
    halfD = room.depth / 200,
    x = position.x - (room.cx ?? 0),
    z = position.z - (room.cz ?? 0);
  const beyond = {
    back: -halfD - z,
    front: z - halfD,
    left: -halfW - x,
    right: x - halfW,
  };
  const out = WALL_SIDES.filter((side) => beyond[side] > 0);
  if (!out.length) return null;
  if (out.length > 1 || beyond[out[0]] > limit) return "invalid";
  return out[0];
}

/** Thin boxes around the cut outline of a hidden wall that can face the
 * camera: floor-slab edge and ceiling edge (centred scene frame). */
export function cutBoxes(room: RoomBox, side: WallSide) {
  const halfW = room.width / 200,
    halfD = room.depth / 200,
    h = room.height / 100;
  const along = side === "back" || side === "front" ? halfW : halfD;
  const box = (s0: number, s1: number, y0: number, y1: number) => {
    const out = new Box3();
    for (const s of [s0, s1])
      for (const y of [y0, y1])
        for (const offset of [-0.02, 0.14]) {
          const p =
            side === "back"
              ? new Vector3(s, y, -halfD - offset)
              : side === "front"
                ? new Vector3(s, y, halfD + offset)
                : side === "left"
                  ? new Vector3(-halfW - offset, y, s)
                  : new Vector3(halfW + offset, y, s);
          out.expandByPoint(p);
        }
    return out;
  };
  const end = along + 0.14;
  // Floor-slab edge and ceiling edge. The adjoining walls' ends sit at the
  // stance extension, behind any camera in the stance band.
  const shift = new Vector3(room.cx ?? 0, 0, room.cz ?? 0);
  return [box(-end, end, -0.07, 0.02), box(-end, end, h - 0.02, h + 0.06)].map(
    (b) => b.translate(shift),
  );
}

const frustum = new Frustum(),
  matrix = new Matrix4();
/** True if any cut edge of `side` can appear in this camera's frame. */
export function cutInView(
  camera: Camera,
  room: RoomBox,
  side: WallSide,
) {
  camera.updateMatrixWorld();
  matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(matrix);
  return cutBoxes(room, side).some((b) => frustum.intersectsBox(b));
}

/** The room is seen from inside: either standing in it, or from the hero
 * stance behind one hidden wall while none of that wall's cut edges are in
 * view (an interior photograph, not a cut-away model). Ceiling, downlights
 * and window views show then; overviews keep them hidden. */
export function seesInterior(camera: Camera, room: RoomBox) {
  if (camera.position.y >= room.height / 100 - 0.02) return false;
  const behind = stanceWall(camera.position, room);
  if (behind === null) return true;
  // Only an eye-level stance; raised overviews stay cut-away models.
  if (behind === "invalid" || camera.position.y > STANCE_MAX_HEIGHT)
    return false;
  return !cutInView(camera, room, behind);
}
