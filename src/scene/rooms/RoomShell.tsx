import { wallPieces, windowFittings } from "../lighting/lightingRecipe";
import { Fittings } from "../Fittings";
import { WindowBlind } from "./WindowBlind";
import {
  Suspense,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
} from "react";
import { applyShellBake, ShellBake, SHELL_BAKE_KEY } from "../bake/shellBake";
import { useFrame, useLoader } from "@react-three/fiber";
import {
  AlwaysStencilFunc,
  BackSide,
  BoxGeometry,
  Color,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  MathUtils,
  SphereGeometry,
  EqualStencilFunc,
  Group,
  DoubleSide,
  KeepStencilOp,
  ReplaceStencilOp,
  SRGBColorSpace,
  TextureLoader,
  type Camera,
  type WebGLProgramParametersWithUniforms,
} from "three";
import type { Room, DesignDocument, Material } from "../../catalog/types";
import { Box } from "../Primitives";
import { resolveRoom } from "./resolveRoom";
import type { Envelope, EnvelopeRoom } from "./envelope";
import {
  seesInterior,
  stanceWall,
  STANCE_EXTENSION,
  STANCE_MAX_HEIGHT,
  type RoomBox,
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
const EXTERIOR_VIEW = "/shared/textures/exterior-garden-pano.webp";
/** True when the camera stands on the room side of a wall's plane. Walls are
 * hidden only when the camera is beyond them, so an interior view keeps the
 * whole room while the overview still cuts away the walls facing it. */
export function insideWall(
  camera: { position: { x: number; z: number } },
  room: RoomBox,
  side: WallSide,
  margin = 0.02,
) {
  const halfW = room.width / 200,
    halfD = room.depth / 200,
    x = camera.position.x - (room.cx ?? 0),
    z = camera.position.z - (room.cz ?? 0);
  return side === "back"
    ? z > -halfD + margin
    : side === "front"
      ? z < halfD - margin
      : side === "left"
        ? x > -halfW + margin
        : x < halfW - margin;
}
export function insideRoom(camera: Camera, room: RoomBox) {
  return (
    (["back", "front", "left", "right"] as const).every((side) =>
      insideWall(camera, room, side, 0.05),
    ) && camera.position.y < room.height / 100 - 0.02
  );
}
/** Stencil value the window openings write; the garden draws only there. */
const WINDOW_STENCIL = 1;
/** Garden backdrop: one panorama sphere around the whole home (a CC0
 * Poly Haven garden, latitude band +38° to -48°), drawn only through the
 * window openings (stencil). Every camera that sees a window sees the
 * garden in the right direction, at any angle, and no camera ever sees the
 * backdrop itself beside a cut-away room. Centred at standing eye height so
 * the photo's horizon meets the room's. */
const GARDEN_RADIUS = 30;
/** Latitude band of the photo (degrees); the sphere reaches further and
 * repeats the photo's top and bottom rows there (sky, lawn). */
const GARDEN_TOP = 38,
  GARDEN_BOTTOM = -48,
  SPHERE_TOP = 70,
  SPHERE_BOTTOM = -75;
/** Daylight outside reads brighter than the room (linear multiplier). */
const GARDEN_EXPOSURE = new Color(1.05, 1.05, 1.05);
/** Turns the panorama so the lawn and hedge face the main windows. */
const GARDEN_YAW = 0;
export function ExteriorView({
  centre,
}: {
  /** Panorama centre (design-centred frame, metres). */
  centre: [number, number, number];
}) {
  const texture = useLoader(TextureLoader, EXTERIOR_VIEW);
  texture.colorSpace = SRGBColorSpace;
  const geometry = useMemo(() => {
    const top = MathUtils.degToRad(GARDEN_TOP),
      bottom = MathUtils.degToRad(GARDEN_BOTTOM),
      sphereTop = MathUtils.degToRad(SPHERE_TOP),
      sphereBottom = MathUtils.degToRad(SPHERE_BOTTOM);
    // Sphere band; theta from the +Y pole.
    const g = new SphereGeometry(
      GARDEN_RADIUS,
      96,
      40,
      0,
      Math.PI * 2,
      Math.PI / 2 - sphereTop,
      sphereTop - sphereBottom,
    );
    const uv = g.getAttribute("uv"),
      position = g.getAttribute("position");
    for (let i = 0; i < uv.count; i++) {
      const y = position.getY(i) / GARDEN_RADIUS;
      const lat = Math.asin(MathUtils.clamp(y, -1, 1));
      // Seen from inside: flip u so the panorama is not mirrored.
      uv.setXY(
        i,
        1 - uv.getX(i),
        MathUtils.clamp((lat - bottom) / (top - bottom), 0.002, 0.998),
      );
    }
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={centre}
      rotation={[0, GARDEN_YAW, 0]}
      renderOrder={2}
      raycast={() => {}}
      userData={{ bakeSkip: true, aoExclude: true }}
    >
      <meshBasicMaterial
        map={texture}
        color={GARDEN_EXPOSURE}
        side={BackSide}
        fog={false}
        depthWrite={false}
        stencilWrite
        stencilRef={WINDOW_STENCIL}
        stencilFunc={EqualStencilFunc}
        stencilFail={KeepStencilOp}
        stencilZFail={KeepStencilOp}
        stencilZPass={KeepStencilOp}
      />
    </mesh>
  );
}
/** The window opening, invisible: marks where the garden may draw. It tests
 * depth, so a cabinet or blind in front of the window keeps covering it. */
function WindowPortal({ w, h }: { w: number; h: number }) {
  return (
    <mesh
      position={[0, 0, -0.045]}
      renderOrder={1}
      raycast={() => {}}
      userData={{ bakeSkip: true }}
    >
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        colorWrite={false}
        depthWrite={false}
        side={DoubleSide}
        stencilWrite
        stencilRef={WINDOW_STENCIL}
        stencilFunc={AlwaysStencilFunc}
        stencilZPass={ReplaceStencilOp}
      />
    </mesh>
  );
}
function StudioWindow({
  w,
  h,
  blind = true,
}: {
  w: number;
  h: number;
  blind?: boolean;
}) {
  const sets = useMemo(() => {
    return windowFittings(w, h);
  }, [w, h]);
  return (
    <group userData={{ bakeKeep: true }}>
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
        color={FRAME_COLOR}
        roughness={0.45}
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
      {blind && <WindowBlind w={w} h={h} />}
      <WindowPortal w={w} h={h} />
    </group>
  );
}

/** Anthracite powder-coated frames (Schmidt's black-framed glazing). */
const FRAME_COLOR = "#2b2d2f";
/** Floor-to-ceiling glazed garden door with slim dark frames, a fixed side
 * light and a transom: the room's daylight and its view of the garden. */
function GardenDoor({ w, h }: { w: number; h: number }) {
  const parts = useMemo(() => {
    const fr = 0.05,
      dep = 0.07,
      bar = 0.035;
    const out: { size: [number, number, number]; position: [number, number, number] }[] = [
      { size: [w + 2 * fr, fr, dep], position: [0, h / 2 + fr / 2, 0.01] },
      { size: [w + 2 * fr, 0.03, dep + 0.03], position: [0, -h / 2 + 0.015, 0.02] },
      { size: [fr, h + 2 * fr, dep], position: [-w / 2 - fr / 2, 0, 0.01] },
      { size: [fr, h + 2 * fr, dep], position: [w / 2 + fr / 2, 0, 0.01] },
      // Transom at door height.
      { size: [w, bar, dep], position: [0, h / 2 - 0.38, 0.01] },
    ];
    const panes = Math.max(2, Math.round(w / 0.75));
    for (let i = 1; i < panes; i++)
      out.push({
        size: [bar, h, dep],
        position: [-w / 2 + (w * i) / panes, 0, 0.01],
      });
    return out;
  }, [w, h]);
  const reveal = useMemo(() => windowFittings(w, h).reveal, [w, h]);
  return (
    <group userData={{ bakeKeep: true }}>
      <Fittings
        parts={reveal}
        color="#d9d4ca"
        roughness={0.85}
        metalness={0}
        decorative
        castShadow={false}
      />
      <Fittings
        parts={parts}
        color={FRAME_COLOR}
        roughness={0.45}
        metalness={0.2}
        decorative
        castShadow={false}
      />
      <mesh position={[0, 0, -0.03]} raycast={() => {}}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          color="#dfe8ea"
          transparent
          opacity={0.08}
          roughness={0.05}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <WindowPortal w={w} h={h} />
    </group>
  );
}
/** Depth of the next room seen through the doorway, metres. */
const ANNEX_DEPTH = 2.2;
/** A doorway without a leaf, trimmed with an architrave, and a short lit
 * hallway behind it: the glimpse that the room belongs to a home. It only
 * shows from inside the room (never as a box beside a cut-away overview).
 * Local frame: the opening's centre, +Z into the room. */
function Passage({
  w,
  h,
  room,
  color,
  floor,
}: {
  w: number;
  h: number;
  room: EnvelopeRoom;
  color: string;
  floor: Material;
}) {
  const group = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (group.current) group.current.visible = seesInterior(camera, room);
  });
  const H = room.height / 100;
  const y0 = -h / 2;
  const width = w + 1.6;
  const hallColor = shade(color, 0.96);
  const frame = 0.07;
  return (
    <group>
      {/* Architrave on the room side. */}
      {[-1, 1].map((n) => (
        <Box
          key={n}
          castShadow={false}
          size={[frame, h + frame, 0.02]}
          position={[n * (w / 2 + frame / 2), frame / 2, 0.05]}
          color="#efece6"
          roughness={0.55}
        />
      ))}
      <Box
        castShadow={false}
        size={[w + 2 * frame, frame, 0.02]}
        position={[0, h / 2 + frame / 2, 0.05]}
        color="#efece6"
        roughness={0.55}
      />
      {/* Jambs through the wall thickness. */}
      {[-1, 1].map((n) => (
        <Box
          key={"j" + n}
          castShadow={false}
          size={[0.02, h, 0.1]}
          position={[n * (w / 2 - 0.01), 0, 0]}
          color="#e9e5de"
          roughness={0.6}
        />
      ))}
      <group ref={group} userData={{ bakeSkip: true }}>
        {/* The hallway gets no room light: its surfaces carry their own
            soft glow, so it reads as a lit corridor, never a dark hole. */}
        <group position={[0, y0, -0.04 - ANNEX_DEPTH / 2]}>
          <mesh position={[0, -0.03, 0]} raycast={() => {}}>
            <boxGeometry args={[width, 0.06, ANNEX_DEPTH]} />
            <meshStandardMaterial
              color="#a99a84"
              roughness={0.7}
              emissive="#a99a84"
              emissiveIntensity={0.55}
            />
          </mesh>
          <mesh position={[0, H + 0.02, 0]} raycast={() => {}}>
            <boxGeometry args={[width, 0.04, ANNEX_DEPTH]} />
            <meshStandardMaterial
              color="#f1eee8"
              roughness={0.95}
              emissive="#f1eee8"
              emissiveIntensity={0.75}
            />
          </mesh>
          {/* Far wall and side walls in the hallway's paint. */}
          {(
            [
              [[width, H, 0.06], [0, H / 2, -ANNEX_DEPTH / 2 - 0.03], 0.82],
              [[0.06, H, ANNEX_DEPTH], [-(width / 2 + 0.03), H / 2, 0], 0.7],
              [[0.06, H, ANNEX_DEPTH], [width / 2 + 0.03, H / 2, 0], 0.7],
            ] as const
          ).map(([size, position, glow], i) => (
            <mesh key={i} position={[...position]} raycast={() => {}}>
              <boxGeometry args={[...size]} />
              <meshStandardMaterial
                color={hallColor}
                roughness={0.9}
                emissive={hallColor}
                emissiveIntensity={glow}
              />
            </mesh>
          ))}
          {/* A framed print and a slim oak console on the far wall. */}
          <Box
            castShadow={false}
            size={[0.62, 0.82, 0.025]}
            position={[0.15, 1.5, -ANNEX_DEPTH / 2 + 0.015]}
            color="#2f2e2c"
            roughness={0.5}
          />
          <mesh position={[0.15, 1.5, -ANNEX_DEPTH / 2 + 0.03]} raycast={() => {}}>
            <boxGeometry args={[0.52, 0.72, 0.01]} />
            <meshStandardMaterial
              color="#c4ad8c"
              roughness={0.9}
              emissive="#c4ad8c"
              emissiveIntensity={0.5}
            />
          </mesh>
          <mesh position={[0.15, 0.82, -ANNEX_DEPTH / 2 + 0.16]} raycast={() => {}}>
            <boxGeometry args={[1.1, 0.04, 0.32]} />
            <meshStandardMaterial
              color="#9a7653"
              roughness={0.5}
              emissive="#9a7653"
              emissiveIntensity={0.35}
            />
          </mesh>
          {[-1, 1].map((n) => (
            <Box
              key={"l" + n}
              castShadow={false}
              size={[0.025, 0.8, 0.025]}
              position={[0.15 + n * 0.5, 0.4, -ANNEX_DEPTH / 2 + 0.16]}
              color="#2b2d2f"
              roughness={0.5}
            />
          ))}
          {/* Ceiling light of the hallway. */}
          <mesh position={[0, H - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => {}}>
            <circleGeometry args={[0.14, 24]} />
            <meshStandardMaterial
              color="#fff6e8"
              emissive="#fff1dc"
              emissiveIntensity={1.6}
              side={DoubleSide}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
/** Multiply a hex colour's channels (slightly darker hallway paint). */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(Math.min(255, v * k)),
  );
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
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
  floor,
}: {
  color: string;
  room: EnvelopeRoom;
  side: "back" | "left" | "right" | "front";
  floor: Material;
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
    <group
      ref={group}
      position={pos}
      rotation={[0, rot, 0]}
      userData={{ bakeIgnoreVisibility: true }}
    >
      {wallPieces(room, side).map((piece, i) => (
        <group key={i} userData={{ bakeSurface: "wall" }}>
          <Box
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
            baked
          />
        </group>
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
            baked
          />
        );
      })}
      {/* Shadow gap where the wall meets the ceiling. */}
      <Box
        size={[length, 0.016, 0.014]}
        position={[
          0,
          h - 0.008,
          side === "front" || side === "left" ? -0.047 : 0.047,
        ]}
        color="#77736c"
        roughness={0.9}
        castShadow={false}
      />
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
          {o.style === "garden-door" ? (
            <GardenDoor w={o.width / 100} h={o.height / 100} />
          ) : o.style === "passage" ? (
            <Passage
              w={o.width / 100}
              h={o.height / 100}
              room={room}
              color={color}
              floor={floor}
            />
          ) : o.type === "window" ? (
            <StudioWindow
              w={o.width / 100}
              h={o.height / 100}
              blind={!o.id.startsWith("envelope")}
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
  const { recipe, envelope } = resolveRoom(design);
  const room = envelope.room;
  const [ox, oz] = envelope.origin;
  const w = room.width / 100,
    d = room.depth / 100;
  const color = design.environment?.wallColor || recipe.finishes.wall;
  const floorKind = design.environment?.floor ?? "laminate";
  const floor = useMemo<Material>(
    () => ({
      id: "floor",
      name: { sq: "", en: "", de: "" },
      color: "#b0a288",
      roughness: 0.42,
      mapping: {
        tileSizeCm:
          floorKind === "tiles"
            ? [60, 60]
            : floorKind === "laminate"
              ? [180, 180]
              : [120, 120],
        grain: "none",
        variation: "none",
        scaleBasis: "authored-illustrative",
      },
      response: {
        roughness: floorKind === "laminate" ? 1 : 0.72,
        normalStrength: 0.12,
        clearcoat: 0.015,
        clearcoatRoughness: 0.6,
        envMapIntensity: 0.6,
      },
      multiplier: 1,
      perMeter: 0,
      texture: `shared/textures/${floorKind}-color.webp`,
      normalMap: `shared/textures/${floorKind}-normal.webp`,
      roughnessMap: `shared/textures/${floorKind}-roughness.webp`,
    }),
    [floorKind],
  );
  const plaster = useMemo(() => wallMaterial(color), [color]);
  return (
    <group userData={{ bakeShell: true }}>
      <group position={[ox, 0, oz]}>
        <group userData={{ bakeSurface: "floor" }}>
          <Box
            baked
            size={[w + 0.2, 0.06, d + 0.2]}
            position={[w / 2, -0.03, d / 2]}
            material={floor}
          />
        </group>
        <Ceiling room={room} />
        <StanceWalls room={room} color={color} />
        {(["back", "left", "right", "front"] as const).map((side) => (
          <WallMesh
            key={side}
            room={room}
            side={side}
            color={color}
            floor={floor}
          />
        ))}
      </group>
      <Suspense fallback={null}>
        <ExteriorView
          centre={[
            room.cx + design.room.width / 200,
            1.6,
            room.cz + design.room.depth / 200,
          ]}
        />
      </Suspense>
      {envelope.bulkhead && (
        <Bulkhead bulkhead={envelope.bulkhead} room={room} />
      )}
      {envelope.slats && (
        <Slats
          slats={envelope.slats}
          room={room}
          origin={envelope.origin}
        />
      )}
      {/* Return walls beside tall units whose side wall moved out. */}
      {envelope.returns.map((r) => (
        <ReturnWall key={r.side} wall={r} plaster={plaster} />
      ))}
    </group>
  );
}
/** Lowered ceiling over the kitchen run with its own downlights (corner
 * frame of the design room). Shown with the ceiling. */
function Bulkhead({
  bulkhead: b,
  room,
}: {
  bulkhead: NonNullable<Envelope["bulkhead"]>;
  room: EnvelopeRoom;
}) {
  const group = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (group.current) group.current.visible = seesInterior(camera, room);
  });
  const h = room.height / 100;
  const length = b.x1 - b.x0;
  const lights = Math.max(2, Math.round(length / 0.9));
  return (
    <group ref={group} userData={{ bakeKeep: true, bakeIgnoreVisibility: true }}>
      {/* Same fake bounce glow as the ceiling, so its underside never
          reads as a dark slab. */}
      <mesh
        position={[(b.x0 + b.x1) / 2, h - b.drop / 2 + 0.01, b.depth / 2]}
        raycast={() => {}}
        receiveShadow
      >
        <boxGeometry args={[length, b.drop, b.depth]} />
        <meshStandardMaterial
          color="#f3f1ec"
          roughness={0.95}
          emissive="#efe9df"
          emissiveIntensity={0.42}
        />
      </mesh>
      {/* Shadow gap along its front edge. */}
      <Box
        size={[length, 0.014, 0.02]}
        position={[(b.x0 + b.x1) / 2, h - b.drop + 0.007, b.depth + 0.005]}
        color="#8a867f"
        roughness={0.9}
        castShadow={false}
      />
      {Array.from({ length: lights }, (_, i) => (
        <mesh
          key={i}
          position={[
            b.x0 + ((i + 0.5) * length) / lights,
            h - b.drop - 0.002 + 0.01,
            b.depth * 0.5,
          ]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={() => {}}
        >
          <circleGeometry args={[0.04, 24]} />
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
const SLAT = { width: 0.042, gap: 0.022, depth: 0.026 };
const slatBox = new BoxGeometry(1, 1, 1);
const slatOak = new MeshStandardMaterial({ color: "#b98c5c", roughness: 0.55 });
/** Vertical oak slats on a dark backing: the feature wall by the dining
 * group. One instanced draw; hidden with its wall. */
function Slats({
  slats,
  room,
  origin,
}: {
  slats: NonNullable<Envelope["slats"]>;
  room: EnvelopeRoom;
  origin: [number, number];
}) {
  const group = useRef<Group>(null);
  const mesh = useRef<InstancedMesh>(null);
  const h = room.height / 100 - 0.02;
  const W = room.width / 100,
    D = room.depth / 100;
  const count = Math.floor((slats.b - slats.a) / (SLAT.width + SLAT.gap));
  useFrame(({ camera }) => {
    if (group.current)
      group.current.visible = insideWall(camera, room, slats.wall);
  });
  // Wall frame: local x runs along the wall (sign × along), local z points
  // into the room.
  const frame = useMemo(() => {
    const [ox, oz] = origin;
    return slats.wall === "back"
      ? { yaw: 0, start: [ox, 0, oz] as const, sign: 1 }
      : slats.wall === "right"
        ? { yaw: -Math.PI / 2, start: [ox + W, 0, oz] as const, sign: 1 }
        : slats.wall === "left"
          ? { yaw: Math.PI / 2, start: [ox, 0, oz] as const, sign: -1 }
          : { yaw: Math.PI, start: [ox, 0, oz + D] as const, sign: -1 };
  }, [slats.wall, origin, W, D]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const o = new Object3D();
    const span = slats.b - slats.a;
    const used = count * (SLAT.width + SLAT.gap) - SLAT.gap;
    const first = slats.a + (span - used) / 2 + SLAT.width / 2;
    for (let i = 0; i < count; i++) {
      const along = first + i * (SLAT.width + SLAT.gap);
      o.position.set(frame.sign * along, h / 2, 0.012 + SLAT.depth / 2);
      o.scale.set(SLAT.width, h, SLAT.depth);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [count, slats, h, frame]);
  const span = slats.b - slats.a;
  const mid = (slats.a + slats.b) / 2;
  return (
    <group ref={group}>
      <group position={[...frame.start]} rotation={[0, frame.yaw, 0]}>
        <Box
          size={[span, h, 0.012]}
          position={[frame.sign * mid, h / 2, 0.006]}
          color="#2e2b27"
          roughness={0.85}
          castShadow={false}
        />
        <instancedMesh
          key={count}
          ref={mesh}
          args={[slatBox, slatOak, count]}
          receiveShadow
          castShadow
          raycast={() => {}}
        />
      </group>
    </group>
  );
}
function ReturnWall({
  wall,
  plaster,
}: {
  wall: Envelope["returns"][number];
  plaster: Material;
}) {
  return (
    <Box
      size={wall.size}
      position={wall.position}
      material={plaster}
      castShadow={false}
    />
  );
}

/** Standing behind a hidden wall for the opening view, the two adjoining walls
 * continue a little behind the camera, as from a doorway, so the frame never
 * shows their cut ends. Only present in that stance; overviews never see it. */
function StanceWalls({ room, color }: { room: EnvelopeRoom; color: string }) {
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
                  baked
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
                  baked
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
function Ceiling({ room }: { room: EnvelopeRoom }) {
  const group = useRef<Group>(null);
  const bake = useContext(ShellBake);
  const bakeHooks = useMemo(
    () =>
      bake
        ? {
            onBeforeCompile: (shader: WebGLProgramParametersWithUniforms) =>
              applyShellBake(shader, bake),
            customProgramCacheKey: () => SHELL_BAKE_KEY,
          }
        : {},
    [bake],
  );
  const w = room.width / 100,
    d = room.depth / 100,
    h = room.height / 100;
  useFrame(({ camera }) => {
    if (group.current) group.current.visible = seesInterior(camera, room);
  });
  return (
    <group ref={group} userData={{ bakeIgnoreVisibility: true }}>
      {/* Floor/wall bounce keeps a real ceiling light rather than grey. */}
      <mesh
        position={[w / 2, h + 0.02, d / 2]}
        raycast={() => {}}
        receiveShadow
        userData={{ bakeSurface: "ceiling" }}
      >
        <boxGeometry args={[w + 0.16, 0.04, d + 0.16]} />
        <meshStandardMaterial
          color="#f3f1ec"
          roughness={0.95}
          emissive="#efe9df"
          emissiveIntensity={0.42}
          {...bakeHooks}
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
