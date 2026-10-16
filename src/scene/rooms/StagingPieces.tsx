import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from "three";
import type { Material } from "../../catalog/types";
import { Box } from "../Primitives";
import type { StagedBuilt } from "./staging";

/** Unpriced room pieces built from simple geometry (the GLB pieces are drawn
 * by ModelAsset): dining table, rug, open shelves with books, wall clock and
 * a leaning mirror. Instanced where a piece repeats (legs, books, ticks). */

const OAK: Material = {
  id: "staging-oak",
  name: { sq: "", en: "", de: "" },
  color: "#c29a6b",
  roughness: 0.6,
  multiplier: 1,
  perMeter: 0,
  texture: "shared/textures/veneer-color.webp",
  normalMap: "shared/textures/veneer-normal.webp",
  roughnessMap: "shared/textures/veneer-roughness.webp",
  mapping: {
    tileSizeCm: [120, 120],
    grain: "horizontal",
    variation: "none",
    scaleBasis: "authored-illustrative",
  },
  response: {
    roughness: 0.62,
    normalStrength: 0.08,
    clearcoat: 0.05,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.8,
  },
};
const rugMaterial = (color: string): Material => ({
  id: "staging-rug-" + color,
  name: { sq: "", en: "", de: "" },
  color,
  roughness: 1,
  multiplier: 1,
  perMeter: 0,
  normalMap: "shared/textures/plaster-normal.webp",
  roughnessMap: "shared/textures/plaster-roughness.webp",
  mapping: {
    tileSizeCm: [40, 40],
    grain: "none",
    variation: "none",
    scaleBasis: "authored-illustrative",
  },
  response: {
    roughness: 1,
    normalStrength: 0.9,
    clearcoat: 0,
    clearcoatRoughness: 1,
    envMapIntensity: 0.3,
  },
});

const unitBox = new BoxGeometry(1, 1, 1);
const black = new MeshStandardMaterial({
  color: "#1f2122",
  roughness: 0.45,
  metalness: 0.6,
});

type Instance = {
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
};
function Instances({
  items,
  material,
  castShadow = true,
}: {
  items: Instance[];
  material: MeshStandardMaterial;
  castShadow?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    items.forEach((it, i) => {
      o.position.set(...it.position);
      o.rotation.set(...(it.rotation ?? [0, 0, 0]));
      o.scale.set(...it.scale);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      if (it.color) mesh.setColorAt(i, new Color(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[unitBox, material, items.length]}
      castShadow={castShadow}
      receiveShadow
      raycast={() => {}}
      dispose={null}
    />
  );
}

function DiningTable({ size }: { size: [number, number, number] }) {
  const [l, d, h] = size,
    top = 0.032,
    leg = 0.045;
  const legs = useMemo<Instance[]>(
    () =>
      [-1, 1].flatMap((x) =>
        [-1, 1].map((z) => ({
          position: [x * (l / 2 - 0.09), (h - top) / 2, z * (d / 2 - 0.08)] as [
            number,
            number,
            number,
          ],
          scale: [leg, h - top, leg] as [number, number, number],
        })),
      ),
    [l, d, h],
  );
  return (
    <group>
      <Box
        decorative
        size={[l, top, d]}
        position={[0, h - top / 2, 0]}
        material={OAK}
        bevel={0.004}
      />
      {/* Slim black apron under the top, like a steel-framed table. */}
      <Box
        decorative
        size={[l - 0.16, 0.05, d - 0.14]}
        position={[0, h - top - 0.025, 0]}
        color="#1f2122"
        roughness={0.5}
      />
      <Instances items={legs} material={black} />
    </group>
  );
}

function Rug({ size, color }: { size: [number, number]; color: string }) {
  const [l, w] = size;
  const outer = useMemo(() => rugMaterial(color), [color]);
  const inner = useMemo(
    () => rugMaterial(new Color(color).offsetHSL(0, -0.03, 0.06).getStyle()),
    [color],
  );
  return (
    <group>
      <Box
        decorative
        castShadow={false}
        size={[l, 0.008, w]}
        position={[0, 0.004, 0]}
        material={outer}
      />
      <Box
        decorative
        castShadow={false}
        size={[l - 0.22, 0.009, w - 0.22]}
        position={[0, 0.0045, 0]}
        material={inner}
      />
    </group>
  );
}

const BOOK_COLOURS = [
  "#3d4a52",
  "#b9a88a",
  "#7a4d3a",
  "#d9d2c3",
  "#56614f",
  "#a3683f",
  "#2f3133",
  "#c9b79a",
];
const bookMaterial = new MeshStandardMaterial({ roughness: 0.8 });
function Shelves({ width, levels }: { width: number; levels: number[] }) {
  const books = useMemo<Instance[]>(() => {
    // A row of books leaning together at the left of the lower shelf and a
    // short stack lying flat on the upper one; sizes vary like a real shelf.
    const out: Instance[] = [];
    let x = -width / 2 + 0.08;
    for (let i = 0; i < 9; i++) {
      const t = 0.022 + ((i * 7) % 5) * 0.006,
        hgt = 0.19 + ((i * 5) % 4) * 0.025;
      out.push({
        position: [x + t / 2, levels[0] + 0.02 + hgt / 2, 0.12],
        scale: [t, hgt, 0.15 + ((i * 3) % 3) * 0.015],
        color: BOOK_COLOURS[i % BOOK_COLOURS.length],
      });
      x += t + 0.002;
    }
    for (let i = 0; i < 3; i++)
      out.push({
        position: [-0.08, levels[1] + 0.02 + 0.016 + i * 0.033, 0.12],
        scale: [0.24 - i * 0.02, 0.03, 0.17 - i * 0.01],
        rotation: [0, 0.08 * (i - 1), 0],
        color: BOOK_COLOURS[(i + 3) % BOOK_COLOURS.length],
      });
    return out;
  }, [width, levels]);
  return (
    <group>
      {levels.map((y) => (
        <Box
          key={y}
          decorative
          size={[width, 0.032, 0.24]}
          position={[0, y + 0.004, 0.12]}
          material={OAK}
          bevel={0.003}
        />
      ))}
      <Instances items={books} material={bookMaterial} />
    </group>
  );
}

const face = new CylinderGeometry(0.18, 0.18, 0.012, 48);
const rim = new CylinderGeometry(0.19, 0.19, 0.035, 48, 1, true);
const faceMaterial = new MeshStandardMaterial({
  color: "#f4f1ea",
  roughness: 0.7,
});
function Clock() {
  const ticks = useMemo<Instance[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const long = i % 3 === 0;
        return {
          position: [Math.sin(a) * 0.15, Math.cos(a) * 0.15, 0.022] as [
            number,
            number,
            number,
          ],
          scale: [0.008, long ? 0.034 : 0.018, 0.003] as [
            number,
            number,
            number,
          ],
          rotation: [0, 0, -a] as [number, number, number],
        };
      }),
    [],
  );
  // Ten past ten, the classic catalogue time.
  const hands: Instance[] = [
    {
      position: [Math.sin(-0.98) * 0.045, Math.cos(-0.98) * 0.045, 0.026],
      scale: [0.012, 0.095, 0.003],
      rotation: [0, 0, 0.98],
    },
    {
      position: [Math.sin(1.05) * 0.06, Math.cos(1.05) * 0.06, 0.028],
      scale: [0.008, 0.13, 0.003],
      rotation: [0, 0, -1.05],
    },
  ];
  return (
    <group>
      <mesh
        geometry={face}
        material={faceMaterial}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0.012]}
        raycast={() => {}}
        receiveShadow
      />
      <mesh
        geometry={rim}
        material={black}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0.018]}
        raycast={() => {}}
        castShadow
      />
      <Instances
        items={[...ticks, ...hands]}
        material={black}
        castShadow={false}
      />
    </group>
  );
}

// The room probe is low detail: a bright, slightly cool mirror reads as
// glass; a dark one reads as a grey board.
const glass = new MeshStandardMaterial({
  color: "#eef2f3",
  metalness: 1,
  roughness: 0.03,
  envMapIntensity: 1.7,
});
function Mirror() {
  const w = 0.62,
    h = 1.72,
    f = 0.03,
    tilt = 0.07;
  const frame = useMemo<Instance[]>(
    () => [
      { position: [0, h / 2, 0], scale: [w, f, 0.025] },
      { position: [0, -h / 2, 0], scale: [w, f, 0.025] },
      { position: [-w / 2, 0, 0], scale: [f, h + f, 0.025] },
      { position: [w / 2, 0, 0], scale: [f, h + f, 0.025] },
    ],
    [],
  );
  return (
    // Leaning: the foot stands out from the wall, the top rests against it.
    <group position={[0, 0.02 + h / 2, 0]} rotation={[-tilt, 0, 0]}>
      <mesh position={[0, 0, -0.004]} raycast={() => {}} material={glass}>
        <planeGeometry args={[w - f, h - f]} />
      </mesh>
      <Instances items={frame} material={black} />
    </group>
  );
}

export function StagingPiece({ piece }: { piece: StagedBuilt }) {
  return (
    <group position={piece.position} rotation={[0, piece.yaw, 0]}>
      {piece.type === "table" ? (
        <DiningTable size={piece.size} />
      ) : piece.type === "rug" ? (
        <Rug size={piece.size} color={piece.color} />
      ) : piece.type === "shelves" ? (
        <Shelves width={piece.width} levels={piece.levels} />
      ) : piece.type === "clock" ? (
        <Clock />
      ) : (
        <Mirror />
      )}
    </group>
  );
}
