import { wallPieces, windowFittings } from "../lighting/lightingRecipe";
import { Fittings } from "../Fittings";
import { Suspense, useRef, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import {
  Group,
  DoubleSide,
  SRGBColorSpace,
  TextureLoader,
  type Camera,
} from "three";
import type { Room, DesignDocument, Material } from "../../catalog/types";
import { Box } from "../Primitives";
import { resolveRoom } from "./resolveRoom";
import {
  seesInterior,
  stanceWall,
  STANCE_EXTENSION,
  STANCE_MAX_HEIGHT,
} from "./stance";
export type WallSide = "back" | "left" | "right" | "front";
/** Painted plaster: the paint colour stays a parameter (customer wall
 * colours keep working); CC0 relief/sheen maps add the surface. */
export function wallMaterial(color: string): Material {
  return {
    id: "wall-plaster",
    name: { sq: "", en: "", de: "" },
    color,
    roughness: 0.9,
    multiplier: 1,
    perMeter: 0,
    normalMap: "shared/textures/plaster-normal.webp",
    roughnessMap: "shared/textures/plaster-roughness.webp",
    mapping: {
      tileSizeCm: [160, 160],
      grain: "none",
      variation: "none",
      scaleBasis: "authored-illustrative",
    },
    response: {
      roughness: 1,
      normalStrength: 0.22,
      clearcoat: 0,
      clearcoatRoughness: 1,
      envMapIntensity: 0.5,
    },
  };
}
const EXTERIOR_VIEW = "/shared/textures/exterior-garden.webp";
/** True when the camera stands on the room side of a wall's plane. Walls are
 * hidden only when the camera is beyond them, so an interior view keeps the
 * whole room while the overview still cuts away the walls facing it. */
export function insideWall(
  camera: { position: { x: number; z: number } },
  room: Room,
  side: WallSide,
  margin = 0.02,
) {
  const halfW = room.width / 200,
    halfD = room.depth / 200,
    { x, z } = camera.position;
  return side === "back"
    ? z > -halfD + margin
    : side === "front"
      ? z < halfD - margin
      : side === "left"
        ? x > -halfW + margin
        : x < halfW - margin;
}
export function insideRoom(camera: Camera, room: Room) {
  return (
    (["back", "front", "left", "right"] as const).every((side) =>
      insideWall(camera, room, side, 0.05),
    ) && camera.position.y < room.height / 100 - 0.02
  );
}
function ExteriorView({
  room,
  w,
  centre,
}: {
  room: Room;
  w: number;
  /** Window centre height above the floor, metres. */
  centre: number;
}) {
  const texture = useLoader(TextureLoader, EXTERIOR_VIEW);
  texture.colorSpace = SRGBColorSpace;
  const view = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (view.current) view.current.visible = seesInterior(camera, room);
  });
  // A distant, fixed garden: real parallax through the glass, never seen
  // from the cut-away overview.
  const width = Math.max(9, w * 5),
    height = (width * 9) / 16;
  // The photo's horizon sits 68% of its half-height below the centre; put it
  // at standing eye height so the view lines up with the room.
  const y = 1.5 - centre + 0.68 * (height / 2);
  return (
    <group ref={view}>
      <mesh position={[0, y, -3.2]} raycast={() => {}}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
          color="#c9c9c9"
          side={DoubleSide}
          fog={false}
        />
      </mesh>
    </group>
  );
}
function StudioWindow({
  w,
  h,
  room,
  centre,
}: {
  w: number;
  h: number;
  room: Room;
  centre: number;
}) {
  const sets = useMemo(() => {
    return windowFittings(w, h);
  }, [w, h]);
  return (
    <group>
      <Fittings
        parts={sets.reveal}
        color="#d6d0c5"
        roughness={0.8}
        metalness={0}
        decorative
        castShadow={false}
      />
      <Fittings
        parts={sets.trim}
        color="#c8ccd4"
        roughness={0.7}
        metalness={0}
        decorative
        castShadow={false}
      />
      <Fittings
        parts={sets.frame}
        color="#f4f6f9"
        roughness={0.5}
        metalness={0}
        decorative
        castShadow={false}
      />
      <mesh position={[0, 0, -0.045]} raycast={() => {}}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          color="#dfe8ea"
          transparent
          opacity={0.1}
          roughness={0.05}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <Suspense fallback={null}>
        <ExteriorView room={room} w={w} centre={centre} />
      </Suspense>
    </group>
  );
}

function StudioDoor({ w, h }: { w: number; h: number }) {
  const fr = 0.055;
  const dep = 0.09;
  return (
    <group>
      <Box
        castShadow={false}
        size={[fr, h + fr, dep]}
        position={[-w / 2 - fr / 2, fr / 2, dep / 2 - 0.025]}
        color="#eceae5"
        roughness={0.6}
      />
      <Box
        castShadow={false}
        size={[fr, h + fr, dep]}
        position={[w / 2 + fr / 2, fr / 2, dep / 2 - 0.025]}
        color="#eceae5"
        roughness={0.6}
      />
      <Box
        castShadow={false}
        size={[w + 2 * fr, fr, dep]}
        position={[0, h / 2 + fr / 2, dep / 2 - 0.025]}
        color="#eceae5"
        roughness={0.6}
      />
      <Box
        castShadow={false}
        size={[w - 0.02, h - 0.015, 0.044]}
        position={[0, -0.007, 0.028]}
        color="#b5855a"
        roughness={0.45}
      />
      <Box
        castShadow={false}
        size={[0.032, 0.032, 0.022]}
        position={[w / 2 - 0.07, -0.02, 0.056]}
        color="#c9ced5"
        metal={1}
        roughness={0.3}
      />
      <Box
        castShadow={false}
        size={[0.13, 0.024, 0.022]}
        position={[w / 2 - 0.13, -0.02, 0.06]}
        color="#c9ced5"
        metal={1}
        roughness={0.3}
      />
    </group>
  );
}
function WallMesh({
  room,
  side,
  color,
}: {
  color: string;
  room: Room;
  side: "back" | "left" | "right" | "front";
}) {
  const group = useRef<Group>(null);
  const length =
      (side === "back" || side === "front" ? room.width : room.depth) / 100,
    h = room.height / 100;
  const openings = room.openings.filter((o) => o.wall === side);
  const cuts = Array.from(
    new Set([
      0,
      length,
      ...openings.flatMap((o) => [o.offset / 100, (o.offset + o.width) / 100]),
    ]),
  ).sort((a, b) => a - b);
  useFrame(({ camera }) => {
    if (group.current) group.current.visible = insideWall(camera, room, side);
  });
  const pos: [number, number, number] =
    side === "back"
      ? [room.width / 200, 0, -0.04]
      : side === "front"
        ? [room.width / 200, 0, room.depth / 100 + 0.04]
        : side === "left"
          ? [-0.04, 0, room.depth / 200]
          : [room.width / 100 + 0.04, 0, room.depth / 200];
  const rot = side === "left" || side === "right" ? -Math.PI / 2 : 0;
  const plaster = useMemo(() => wallMaterial(color), [color]);
  return (
    <group ref={group} position={pos} rotation={[0, rot, 0]}>
      {wallPieces(room, side).map((piece, i) => (
        <Box
          key={i}
          size={piece.size}
          position={[
            side === "left" || side === "right"
              ? piece.position[2] - pos[2]
              : piece.position[0] - pos[0],
            piece.position[1],
            0,
          ]}
          material={plaster}
          castShadow={false}
        />
      ))}
      {cuts.slice(0, -1).map((start, i) => {
        const end = cuts[i + 1],
          middle = (start + end) / 2;
        if (
          openings.some(
            (o) =>
              o.type === "door" &&
              middle > o.offset / 100 &&
              middle < (o.offset + o.width) / 100,
          )
        )
          return null;
        return (
          <Box
            key={"skirting-" + start}
            size={[end - start, 0.08, 0.018]}
            position={[
              middle - length / 2,
              0.04,
              side === "front" || side === "left" ? -0.053 : 0.053,
            ]}
            color="#c3baaa"
            castShadow={false}
          />
        );
      })}
      {openings.map((o) => (
        <group
          key={o.id}
          rotation={[0, side === "left" || side === "front" ? Math.PI : 0, 0]}
          position={[
            (o.offset + o.width / 2) / 100 - length / 2,
            (o.sill + o.height / 2) / 100,
            0,
          ]}
        >
          {o.type === "window" ? (
            <StudioWindow
              w={o.width / 100}
              h={o.height / 100}
              room={room}
              centre={(o.sill + o.height / 2) / 100}
            />
          ) : (
            <StudioDoor w={o.width / 100} h={o.height / 100} />
          )}
        </group>
      ))}
    </group>
  );
}
export function RoomShell({ design }: { design: DesignDocument }) {
  const { recipe, room } = resolveRoom(design);
  const w = room.width / 100,
    d = room.depth / 100;
  return (
    <group>
      <Box
        size={[w + 0.2, 0.06, d + 0.2]}
        position={[w / 2, -0.03, d / 2]}
        material={{
          id: "floor",
          name: { sq: "", en: "", de: "" },
          color: "#b0a288",
          roughness: 0.42,
          mapping: {
            tileSizeCm:
              design.environment?.floor === "tiles"
                ? [60, 60]
                : (design.environment?.floor ?? "laminate") === "laminate"
                  ? [180, 180]
                  : [120, 120],
            grain: "none",
            variation: "none",
            scaleBasis: "authored-illustrative",
          },
          response: {
            roughness:
              (design.environment?.floor ?? "laminate") === "laminate"
                ? 1
                : 0.72,
            normalStrength: 0.12,
            clearcoat: 0.015,
            clearcoatRoughness: 0.6,
            envMapIntensity: 0.6,
          },
          multiplier: 1,
          perMeter: 0,
          texture: `shared/textures/${design.environment?.floor || "laminate"}-color.webp`,
          normalMap: `shared/textures/${design.environment?.floor || "laminate"}-normal.webp`,
          roughnessMap: `shared/textures/${design.environment?.floor || "laminate"}-roughness.webp`,
        }}
      />

      <Ceiling room={room} />
      <StanceWalls
        room={room}
        color={design.environment?.wallColor || recipe.finishes.wall}
      />
      {(["back", "left", "right", "front"] as const).map((side) => (
        <WallMesh
          key={side}
          room={room}
          side={side}
          color={design.environment?.wallColor || recipe.finishes.wall}
        />
      ))}
    </group>
  );
}

/** Standing behind a hidden wall for the opening view, the two adjoining walls
 * continue a little behind the camera, as from a doorway, so the frame never
 * shows their cut ends. Only present in that stance; overviews never see it. */
function StanceWalls({ room, color }: { room: Room; color: string }) {
  const groups = useRef<Record<string, Group | null>>({});
  const w = room.width / 100,
    d = room.depth / 100,
    h = room.height / 100,
    e = STANCE_EXTENSION;
  const plaster = useMemo(() => wallMaterial(color), [color]);
  useFrame(({ camera }) => {
    const behind =
      camera.position.y <= STANCE_MAX_HEIGHT
        ? stanceWall(camera.position, room)
        : null;
    for (const [side, group] of Object.entries(groups.current))
      if (group) group.visible = behind === side;
  });
  // [hidden side, wall boxes (centre, size)] in the room-corner frame.
  const pieces: Array<
    [string, Array<[[number, number, number], [number, number, number]]>]
  > = [
    [
      "front",
      [
        [
          [-0.04, h / 2, d + e / 2],
          [0.08, h, e],
        ],
        [
          [w + 0.04, h / 2, d + e / 2],
          [0.08, h, e],
        ],
      ],
    ],
    [
      "back",
      [
        [
          [-0.04, h / 2, -e / 2],
          [0.08, h, e],
        ],
        [
          [w + 0.04, h / 2, -e / 2],
          [0.08, h, e],
        ],
      ],
    ],
    [
      "left",
      [
        [
          [-e / 2, h / 2, -0.04],
          [e, h, 0.08],
        ],
        [
          [-e / 2, h / 2, d + 0.04],
          [e, h, 0.08],
        ],
      ],
    ],
    [
      "right",
      [
        [
          [w + e / 2, h / 2, -0.04],
          [e, h, 0.08],
        ],
        [
          [w + e / 2, h / 2, d + 0.04],
          [e, h, 0.08],
        ],
      ],
    ],
  ];
  return (
    <>
      {pieces.map(([side, walls]) => (
        <group
          key={side}
          ref={(g) => {
            groups.current[side] = g;
          }}
          visible={false}
        >
          {walls.map(([position, size], i) => {
            const alongX = size[0] > size[2];
            // Skirting on the room-facing face, matching the real walls.
            const inward = alongX
              ? position[2] < d / 2
                ? 0.053
                : -0.053
              : position[0] < w / 2
                ? 0.053
                : -0.053;
            return (
              <group key={i}>
                <Box
                  size={size}
                  position={position}
                  material={plaster}
                  castShadow={false}
                />
                <Box
                  size={
                    alongX ? [size[0], 0.08, 0.018] : [0.018, 0.08, size[2]]
                  }
                  position={
                    alongX
                      ? [position[0], 0.04, position[2] + inward]
                      : [position[0] + inward, 0.04, position[2]]
                  }
                  color="#c3baaa"
                  castShadow={false}
                />
              </group>
            );
          })}
        </group>
      ))}
    </>
  );
}

/** Downlight grid, roughly one per 2.2 m, inset from the walls. */
export function downlights(room: Room): Array<[number, number]> {
  const w = room.width / 100,
    d = room.depth / 100;
  const nx = Math.max(2, Math.round(w / 2.2)),
    nz = Math.max(2, Math.round(d / 2.2));
  const spots: Array<[number, number]> = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++)
      spots.push([((i + 0.5) * w) / nx, ((j + 0.5) * d) / nz]);
  return spots;
}
/** Seen only from inside the room (or the hero stance behind one hidden
 * wall); the overview looks in from above. */
function Ceiling({ room }: { room: Room }) {
  const group = useRef<Group>(null);
  const w = room.width / 100,
    d = room.depth / 100,
    h = room.height / 100;
  useFrame(({ camera }) => {
    if (group.current) group.current.visible = seesInterior(camera, room);
  });
  return (
    <group ref={group}>
      {/* Floor/wall bounce keeps a real ceiling light rather than grey. */}
      <mesh
        position={[w / 2, h + 0.02, d / 2]}
        raycast={() => {}}
        receiveShadow
      >
        <boxGeometry args={[w + 0.16, 0.04, d + 0.16]} />
        <meshStandardMaterial
          color="#f3f1ec"
          roughness={0.95}
          emissive="#efe9df"
          emissiveIntensity={0.42}
        />
      </mesh>
      {downlights(room).map(([x, z]) => (
        <mesh
          key={`${x},${z}`}
          position={[x, h - 0.002, z]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={() => {}}
        >
          <circleGeometry args={[0.045, 24]} />
          <meshStandardMaterial
            color="#fff6e8"
            emissive="#fff1dc"
            emissiveIntensity={2.2}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
