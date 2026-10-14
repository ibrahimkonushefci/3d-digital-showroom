import { wallPieces, windowFittings } from "../lighting/lightingRecipe";
import { Fittings } from "../Fittings";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, DoubleSide } from "three";
import type { Room, DesignDocument } from "../../catalog/types";
import { Box } from "../Primitives";
import { resolveRoom } from "./resolveRoom";
function StudioWindow({ w, h }: { w: number; h: number }) {
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
          color="#d4e3e7"
          emissive="#bfd2d7"
          emissiveIntensity={0.3}
          roughness={0.18}
          side={DoubleSide}
        />
      </mesh>
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
    if (!group.current) return;
    group.current.visible =
      side === "back"
        ? camera.position.z > -0.1
        : side === "front"
          ? camera.position.z < -0.1
          : side === "left"
            ? camera.position.x > -0.1
            : camera.position.x < -0.1;
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
          color={color}
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
            <StudioWindow w={o.width / 100} h={o.height / 100} />
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
              design.environment?.floor === "tiles" ? [60, 60] : [120, 120],
            grain: "none",
            variation: "none",
            scaleBasis: "authored-illustrative",
          },
          response: {
            roughness: 0.72,
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
