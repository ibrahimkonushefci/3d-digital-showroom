import { useCabinetInteraction } from "./useCabinetInteraction";
import { StorageDetails } from "../scene/StorageDetails";
import { RunLights } from "../scene/RunLights";
import { Worktops } from "../scene/Worktops";
import {
  Rendering,
  RefreshShadows,
  showroomGL,
  type RegisterCapture,
} from "../scene/Rendering";
import { useQuality } from "../scene/quality";
import { Suspense, useEffect, useRef, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  CameraControls,
  ContactShadows,
  Environment,
  Lightformer,
  AdaptiveDpr,
} from "@react-three/drei";
import { Group, MathUtils } from "three";
import type {
  Cabinet,
  Catalog,
  DesignDocument,
  Material,
  Room,
} from "../catalog/types";
import { hobCabinet, wallOffset } from "./layout";
import {
  Hob,
  Hood,
  Sink,
  Garment,
  Oven,
  Fridge,
  Plant,
} from "../scene/Appliances";
import { Box } from "../scene/Primitives";
import { useDesigner } from "./store";
import { useT } from "../i18n";
export type CameraView = {
  position: [number, number, number];
  target: [number, number, number];
};
export type CameraPreset = "perspective" | "front" | "top";
function Handle({
  kind,
  color,
  w,
  h,
}: {
  kind: string;
  color: string;
  w: number;
  h: number;
}) {
  if (kind === "none") return null;
  return (
    <>
      <Box
        bevel={0.003}
        size={[
          kind === "profile" ? w - 0.025 : Math.min(0.23, w * 0.5),
          0.016,
          0.02,
        ]}
        position={[0, h / 2 - (kind === "profile" ? 0.014 : 0.06), 0.031]}
        color={color}
        metal={0.65}
      />
      {kind === "bar" &&
        [-1, 1].map((n) => (
          <Box
            key={n}
            size={[0.015, 0.015, 0.028]}
            position={[n * Math.min(0.1, w * 0.2), h / 2 - 0.06, 0.015]}
            color={color}
            metal={0.6}
          />
        ))}
    </>
  );
}
function DoorPanel({
  w,
  h,
  side,
  front,
  handle,
  glass,
  open,
  selected,
  profile,
}: {
  w: number;
  h: number;
  side: number;
  front: Material;
  handle: Catalog["handles"][number];
  glass: boolean;
  open: boolean;
  selected: boolean;
  profile?: string;
}) {
  const pivot = useRef<Group>(null);
  const { invalidate } = useThree();
  useFrame((_, dt) => {
    if (!pivot.current) return;
    const target = open ? -side * 1.35 : 0;
    const a = MathUtils.damp(pivot.current.rotation.y, target, 8, dt);
    if (Math.abs(a - target) > 0.001) {
      pivot.current.rotation.y = a;
      invalidate();
    } else pivot.current.rotation.y = target;
  });
  return (
    <group ref={pivot} position={[(side * w) / 2, 0, 0]}>
      <group position={[(-side * w) / 2, 0, 0]}>
        {glass ? (
          <>
            <Box
              size={[w - 0.007, h - 0.007, 0.018]}
              color="#9db4b1"
              transparent
            />
            <Box
              size={[0.035, h, 0.025]}
              position={[-w / 2 + 0.015, 0, 0]}
              material={front}
            />
            <Box
              size={[0.035, h, 0.025]}
              position={[w / 2 - 0.015, 0, 0]}
              material={front}
            />
            <Box
              size={[w, 0.035, 0.025]}
              position={[0, h / 2 - 0.015, 0]}
              material={front}
            />
            <Box
              size={[w, 0.035, 0.025]}
              position={[0, -h / 2 + 0.015, 0]}
              material={front}
            />
          </>
        ) : (
          <Box
            bevel={0.002}
            size={[w - 0.005, h - 0.005, 0.02]}
            material={front}
            selected={selected}
          />
        )}
        {profile === "panel" && !glass && (
          <>
            <Box
              size={[0.04, h - 0.06, 0.014]}
              position={[-w / 2 + 0.035, 0, 0.014]}
              material={front}
            />
            <Box
              size={[0.04, h - 0.06, 0.014]}
              position={[w / 2 - 0.035, 0, 0.014]}
              material={front}
            />
            <Box
              size={[w - 0.06, 0.04, 0.014]}
              position={[0, h / 2 - 0.035, 0.014]}
              material={front}
            />
            <Box
              size={[w - 0.06, 0.04, 0.014]}
              position={[0, -h / 2 + 0.035, 0.014]}
              material={front}
            />
          </>
        )}
        <Handle kind={handle.id} color={handle.color} w={w} h={h} />
      </group>
    </group>
  );
}
function Drawer({
  w,
  h,
  z,
  y,
  front,
  handle,
  open,
  organizer,
}: {
  w: number;
  h: number;
  z: number;
  y: number;
  front: Material;
  handle: Catalog["handles"][number];
  open: boolean;
  organizer: boolean;
}) {
  const group = useRef<Group>(null);
  const { invalidate } = useThree();
  useFrame((_, dt) => {
    if (group.current) {
      const target = z + (open ? 0.38 : 0),
        next = MathUtils.damp(group.current.position.z, target, 8, dt);
      group.current.position.z = next;
      if (Math.abs(next - target) > 0.001) invalidate();
    }
  });
  return (
    <group ref={group} position={[0, y, z]}>
      <Box bevel={0.002} size={[w - 0.007, h - 0.006, 0.02]} material={front} />
      <Handle kind={handle.id} color={handle.color} w={w} h={h} />
      <Box
        size={[w - 0.05, 0.014, 0.45]}
        position={[0, -h / 2 + 0.02, -0.23]}
        color="#747e81"
        metal={0.65}
        bevel={0.002}
      />
      {[-1, 1].map((n) => (
        <Box
          key={n}
          size={[0.012, h * 0.65, 0.44]}
          position={[n * (w / 2 - 0.032), -h * 0.1, -0.23]}
          color="#747e81"
          metal={0.65}
          bevel={0.002}
        />
      ))}
      {organizer &&
        [-0.12, 0, 0.12].map((x) => (
          <Box
            key={x}
            size={[0.009, 0.045, 0.38]}
            position={[x, -h / 2 + 0.05, -0.23]}
            color="#76684e"
          />
        ))}
    </group>
  );
}
function CabinetMesh({
  cabinet: c,
  design,
  catalog,
  interactive,
}: {
  cabinet: Cabinet;
  design: DesignDocument;
  catalog: Catalog;
  interactive: boolean;
}) {
  const selected = useDesigner((s) => s.selected === c.id),
    open = useDesigner((s) => s.opened.includes(c.id));
  const m = catalog.modules.find((m) => m.id === c.moduleId)!;
  const interaction = useCabinetInteraction(
    c,
    catalog,
    interactive,
    !["hood", "open", "oven", "fridge"].includes(m.type),
  );
  const front = catalog.fronts.find((m) => m.id === design.style.front)!;
  const carcass = catalog.carcasses.find((m) => m.id === design.style.carcass)!;
  const counter = catalog.countertops.find(
    (m) => m.id === design.style.countertop,
  )!;
  const handle = catalog.handles.find((m) => m.id === design.style.handle)!;
  const w = c.width / 100,
    h = c.height / 100,
    d = c.depth / 100;
  const y = c.level === "wall" ? 1.4 : c.level === "wardrobe" ? 0 : 0.1;
  const sliding = useRef<Group>(null),
    pantryFront = useRef<Group>(null);
  const { invalidate } = useThree();
  useFrame((_, dt) => {
    if (pantryFront.current) {
      const target = open ? 0.38 : 0;
      pantryFront.current.position.z = MathUtils.damp(
        pantryFront.current.position.z,
        target,
        7,
        dt,
      );
      if (Math.abs(pantryFront.current.position.z - target) > 0.001)
        invalidate();
    }
    if (sliding.current) {
      const target = open ? w * 0.4 : 0;
      sliding.current.position.x = MathUtils.damp(
        sliding.current.position.x,
        target,
        8,
        dt,
      );
      if (Math.abs(sliding.current.position.x - target) > 0.001) invalidate();
    }
  });
  if (m.type === "hood")
    return (
      <group
        position={[c.x / 100, 1.4, c.z / 100]}
        rotation={[0, c.rotation, 0]}
        {...interaction}
      >
        <group position={[0, 0, 0.125]}>
          <Hood width={w} />
        </group>
      </group>
    );
  return (
    <group
      position={[c.x / 100, y, c.z / 100]}
      rotation={[0, c.rotation, 0]}
      {...interaction}
    >
      <Box
        size={[w, 0.018, d - 0.025]}
        position={[0, 0.009, 0]}
        material={carcass}
      />
      {m.type !== "sink" && (
        <Box
          size={[w, 0.018, d - 0.025]}
          position={[0, h - 0.009, 0]}
          material={carcass}
        />
      )}
      <Box
        size={[w, h, 0.016]}
        position={[0, h / 2, -d / 2 + 0.01]}
        material={carcass}
      />
      {[-1, 1].map((n) => (
        <Box
          key={n}
          size={[0.018, h, d - 0.018]}
          position={[n * (w / 2 - 0.009), h / 2, 0]}
          material={carcass}
        />
      ))}
      {m.type === "hanging" || m.type === "sliding" ? (
        <>
          <mesh position={[0, h - 0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.008, 0.008, w - 0.05, 12]} />
            <meshStandardMaterial
              color="#aaa"
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * (w / 2 - 0.027), h - 0.32, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.021, 0.021, 0.016, 16]} />
              <meshStandardMaterial
                color="#adb5b4"
                metalness={0.85}
                roughness={0.25}
              />
            </mesh>
          ))}
          {[-0.18, 0, 0.18]
            .filter((x) => Math.abs(x) < w / 2 - 0.08)
            .map((x, i) => (
              <group key={x} position={[x, h - 0.7, 0]}>
                <Garment color={["#b7b1a3", "#809185", "#44595e"][i % 3]} />
              </group>
            ))}
        </>
      ) : (
        m.type !== "drawers" &&
        m.type !== "sink" &&
        m.type !== "pantry" &&
        m.type !== "corner" &&
        [0.32, 0.62, 0.82]
          .filter((r) => h * r < h - 0.12)
          .map((r) => (
            <Box
              key={r}
              bevel={0.0015}
              size={[w - 0.035, 0.018, d - 0.035]}
              position={[0, h * r, 0]}
              material={carcass}
            />
          ))
      )}
      <StorageDetails kind={m.type} w={w} h={h} d={d} open={open} />
      {m.type === "pantry" ? (
        <group position={[0, h / 2, d / 2]}>
          <group ref={pantryFront}>
            <Box
              bevel={0.002}
              size={[w - 0.007, h - 0.006, 0.02]}
              material={front}
              selected={selected}
            />
            <Handle kind={handle.id} color={handle.color} w={w} h={h} />
          </group>
        </group>
      ) : m.type === "drawers" ? (
        [0, 1, 2].map((i) => (
          <Drawer
            key={i}
            w={w}
            h={c.level === "wardrobe" ? 0.22 : h / 3}
            y={c.level === "wardrobe" ? 0.22 * (i + 0.5) : (h * (i + 0.5)) / 3}
            z={d / 2}
            front={front}
            handle={handle}
            open={open}
            organizer={i === 0}
          />
        ))
      ) : m.type === "sliding" ? (
        <group position={[0, h / 2, d / 2]}>
          {[-1, 1].map((side) => (
            <Box
              key={side}
              size={[w - 0.025, 0.012, 0.065]}
              position={[0, side * (h / 2 - 0.018), 0]}
              color="#818a8a"
              metal={0.8}
              bevel={0.002}
            />
          ))}
          <group ref={sliding}>
            <Box
              size={[0.014, 0.2, 0.012]}
              position={[-0.025, 0, 0.034]}
              color="#7f8989"
              metal={0.8}
              bevel={0.002}
            />
            <Box
              bevel={0.002}
              size={[w / 2 + 0.016, h - 0.008, 0.025]}
              position={[-w / 4, 0, 0.016]}
              material={front}
            />
          </group>
          <Box
            bevel={0.002}
            size={[w / 2 + 0.016, h - 0.008, 0.025]}
            position={[w / 4, 0, -0.02]}
            material={front}
          />
        </group>
      ) : m.type !== "open" &&
        m.type !== "oven" &&
        m.type !== "fridge" &&
        !(design.layout === "walkin" && m.type === "hanging") ? (
        <group position={[0, h / 2, d / 2]}>
          {w > 0.55 ? (
            [-1, 1].map((side) => (
              <group key={side} position={[(side * w) / 4, 0, 0]}>
                <DoorPanel
                  profile={design.style.profile}
                  w={w / 2}
                  h={h}
                  side={side}
                  front={front}
                  handle={handle}
                  open={open}
                  selected={selected}
                  glass={m.type === "glass"}
                />
              </group>
            ))
          ) : (
            <DoorPanel
              profile={design.style.profile}
              w={w}
              h={h}
              side={-1}
              front={front}
              handle={handle}
              open={open}
              selected={selected}
              glass={m.type === "glass"}
            />
          )}
        </group>
      ) : m.type === "oven" ? (
        <>
          <group position={[0, h * 0.78, d / 2]}>
            <DoorPanel
              profile={design.style.profile}
              w={w}
              h={h * 0.43}
              side={-1}
              front={front}
              handle={handle}
              open={open}
              selected={selected}
              glass={false}
            />
          </group>
          <group position={[0, 0.94, d / 2]}>
            <Oven width={w} />
          </group>
          <Box
            size={[w - 0.007, 0.62, 0.022]}
            position={[0, 0.32, d / 2]}
            material={front}
          />
        </>
      ) : null}
      {c.level === "wardrobe" && m.type === "drawers" && (
        <>
          <Box
            bevel={0.0015}
            size={[w - 0.035, 0.018, d - 0.035]}
            position={[0, 0.68, 0]}
            material={carcass}
          />
          {[1.3, 1.9].map((v) => (
            <Box
              key={v}
              bevel={0.0015}
              size={[w - 0.035, 0.018, d - 0.035]}
              position={[0, v, 0]}
              material={carcass}
            />
          ))}
          {design.layout !== "walkin" && (
            <group position={[0, (h + 0.68) / 2, d / 2]}>
              <DoorPanel
                profile={design.style.profile}
                w={w}
                h={h - 0.68}
                side={-1}
                front={front}
                handle={handle}
                open={open}
                selected={selected}
                glass={false}
              />
            </group>
          )}
        </>
      )}
      {c.level === "base" && (
        <>
          {m.type === "sink" && (
            <group position={[0, h + 0.043, 0.025]}>
              <Sink width={w} />
            </group>
          )}
          {hobCabinet(design, catalog)?.id === c.id && (
            <>
              <group position={[0, h + 0.05, 0.01]}>
                <Hob width={w} />
              </group>
              {!design.cabinets.some(
                (n) =>
                  n.moduleId === "wall-hood" &&
                  n.wall === c.wall &&
                  Math.abs(wallOffset(n) - wallOffset(c)) < 1,
              ) && (
                <group position={[0, 1.47, 0.02]}>
                  <Hood width={w} builtIn />
                </group>
              )}
            </>
          )}
        </>
      )}
      {m.type === "dishwasher" && (
        <Box
          size={[w - 0.04, 0.04, 0.024]}
          position={[0, h - 0.025, d / 2 + 0.02]}
          color="#474d4f"
          metal={0.7}
        />
      )}
      {m.type === "fridge" && (
        <group position={[0, 0, d / 2]}>
          <Fridge width={w} height={h} />
        </group>
      )}
      {c.level === "wardrobe" && design.environment?.internalLed && (
        <Box
          size={[w - 0.07, 0.008, 0.016]}
          position={[0, h - 0.045, d / 2 - 0.045]}
          color="#fff0ce"
          emissive="#ffda9b"
        />
      )}
      {c.level !== "wall" && c.level !== "wardrobe" && (
        <Box
          size={[w, 0.099, d - 0.08]}
          position={[0, -0.05, -0.02]}
          color={design.style.plinth === "matching" ? front.color : "#252c2a"}
        />
      )}
      {c.level === "wall" && design.style.led && (
        <Box
          size={[w - 0.04, 0.005, 0.015]}
          position={[0, -0.006, d / 2 - 0.025]}
          color="#fff0c9"
          emissive="#ffd29a"
        />
      )}
      {design.style.backsplash !== "none" &&
        c.level === "base" &&
        c.wall !== "island" && (
          <Box
            size={[w, 0.5, 0.018]}
            position={[0, h + 0.29, -d / 2 - 0.01]}
            material={counter}
          />
        )}
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
      {cuts.slice(0, -1).flatMap((start, i) => {
        const end = cuts[i + 1],
          middle = (start + end) / 2;
        const holes = openings
          .filter(
            (o) =>
              middle > o.offset / 100 && middle < (o.offset + o.width) / 100,
          )
          .map((o) => [o.sill / 100, (o.sill + o.height) / 100])
          .sort((a, b) => a[0] - b[0]);
        let bottom = 0;
        const spans: number[][] = [];
        holes.forEach(([s, e]) => {
          if (s > bottom) spans.push([bottom, s]);
          bottom = Math.max(bottom, e);
        });
        if (bottom < h) spans.push([bottom, h]);
        return spans.map(([a, b]) => (
          <Box
            key={`${start}-${a}`}
            size={[end - start, b - a, 0.08]}
            position={[middle - length / 2, (a + b) / 2, 0]}
            color={color}
          />
        ));
      })}
      {openings.map((o) => (
        <group
          key={o.id}
          position={[
            (o.offset + o.width / 2) / 100 - length / 2,
            (o.sill + o.height / 2) / 100,
            0,
          ]}
        >
          <Box
            size={[o.width / 100, o.height / 100, 0.015]}
            color={o.type === "window" ? "#d0e3e0" : "#c4b9a1"}
          />
          {o.type === "window" && (
            <>
              <Box size={[0.04, o.height / 100, 0.04]} color="#f4f0e7" />
              <Box size={[o.width / 100, 0.04, 0.04]} color="#f4f0e7" />
            </>
          )}
        </group>
      ))}
    </group>
  );
}
function Decor({ design }: { design: DesignDocument }) {
  if (design.kind !== "kitchen") return null;
  const base = design.cabinets.find(
    (c) => c.level === "base" && c.moduleId === "base-doors",
  );
  if (!base) return null;
  return (
    <group
      position={[base.x / 100, (10 + base.height + 4) / 100, base.z / 100]}
      rotation={[0, base.rotation, 0]}
    >
      <group position={[0, 0, -0.1]}>
        <Plant />
      </group>
      <Box
        size={[0.21, 0.015, 0.25]}
        position={[0.17, 0.01, 0.08]}
        color="#9e7853"
      />
    </group>
  );
}
function RoomDetails({ design }: { design: DesignDocument }) {
  const w = design.room.width / 100,
    d = design.room.depth / 100,
    h = design.room.height / 100;
  return (
    <group>
      <Box
        size={[w, 0.08, 0.018]}
        position={[w / 2, 0.04, 0.01]}
        color="#faf8ef"
      />
      <Box
        size={[0.018, 0.08, d]}
        position={[0.01, 0.04, d / 2]}
        color="#faf8ef"
      />
      <Box
        size={[w, 0.025, 0.22]}
        position={[w / 2, h, 0.07]}
        color="#faf8ef"
      />
      {[0.22, 0.5, 0.78].map((x) => (
        <group key={x} position={[w * x, h - 0.03, 0.32]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.014, 16]} />
            <meshStandardMaterial
              color="#fff0cc"
              emissive="#f7d493"
              emissiveIntensity={0.5}
            />
          </mesh>
          <pointLight intensity={0.15} distance={2} color="#ffefd4" />
        </group>
      ))}

      {design.cabinets
        .filter((c) => c.wall === "island")
        .filter((_, i) => i % 2 === 0)
        .map((c) => (
          <group key={c.id} position={[c.x / 100, 0, c.z / 100 + 0.85]}>
            <Box
              size={[0.4, 0.06, 0.36]}
              position={[0, 0.66, 0]}
              color="#bdad94"
            />
            {[-1, 1].flatMap((x) =>
              [-1, 1].map((z) => (
                <Box
                  key={`${x}-${z}`}
                  size={[0.025, 0.64, 0.025]}
                  position={[x * 0.16, 0.32, z * 0.14]}
                  color="#2d3535"
                />
              )),
            )}
            <Box
              size={[0.4, 0.25, 0.04]}
              position={[0, 0.78, 0.16]}
              color="#bdad94"
            />
            <mesh position={[0, h - 0.48, -0.85]}>
              <cylinderGeometry args={[0.03, 0.18, 0.22, 24]} />
              <meshStandardMaterial color="#293230" metalness={0.5} />
            </mesh>
            <Box
              size={[0.008, 0.32, 0.008]}
              position={[0, h - 0.19, -0.85]}
              color="#2d3535"
            />
          </group>
        ))}
    </group>
  );
}
function Controls({
  preset,
  design,
  cameraView,
}: {
  cameraView?: CameraView;
  preset: CameraPreset;
  design: DesignDocument;
}) {
  const ref = useRef<CameraControls>(null);
  const dragging = useDesigner((s) => s.dragging);
  const { size } = useThree();
  useEffect(() => {
    if (cameraView && preset === "perspective") {
      const fit = Math.max(1, 1.3 / (size.width / size.height));
      const p = cameraView.position,
        t = cameraView.target;
      ref.current?.setLookAt(
        t[0] + (p[0] - t[0]) * fit,
        t[1] + (p[1] - t[1]) * fit,
        t[2] + (p[2] - t[2]) * fit,
        ...t,
        true,
      );
      return;
    }
    const span = Math.max(design.room.width, design.room.depth) / 100;
    const targetY = design.kind === "wardrobe" ? 1.15 : 0.9;
    const pos =
      preset === "front"
        ? [0, 1.4, span * 1.35]
        : preset === "top"
          ? [0, span * 1.5, 0.01]
          : [span * 0.7, 2.55, span * 0.85];
    const fit = Math.max(1, 1.3 / (size.width / size.height));
    ref.current?.setLookAt(
      pos[0] * fit,
      targetY + (pos[1] - targetY) * fit,
      pos[2] * fit,
      0,
      targetY,
      0,
      true,
    );
  }, [
    preset,
    cameraView,
    design.room.width,
    design.room.depth,
    design.kind,
    size.width,
    size.height,
  ]);
  return (
    <CameraControls
      ref={ref}
      makeDefault
      enabled={!dragging}
      minDistance={2}
      maxDistance={20}
      minPolarAngle={0.02}
      maxPolarAngle={Math.PI / 2 - 0.04}
      dollyToCursor
      smoothTime={0.2}
    />
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function Scene({
  design: committedDesign,
  catalog,
  preset = "perspective",
  interactive = false,
  capture,
  cameraView,
}: {
  cameraView?: CameraView;
  design: DesignDocument;
  catalog: Catalog;
  preset?: CameraPreset;
  interactive?: boolean;
  capture?: RegisterCapture;
}) {
  const preview = useDesigner((s) => s.dragPreview);
  const opened = useDesigner((s) => s.opened);
  const design = interactive && preview ? preview : committedDesign;
  const performance = useQuality() === "lightweight";
  const t = useT();
  const w = design.room.width / 100,
    d = design.room.depth / 100;
  return (
    <SceneBoundary
      fallback={<div className="scene-fallback">{t("webglError")}</div>}
    >
      <Canvas
        role="img"
        aria-label={t("sceneLabel")}
        frameloop="demand"
        dpr={performance ? 1 : [1, 1.75]}
        shadows={!performance}
        gl={showroomGL}
        camera={{ position: [5, 4, 6], fov: 40 }}
        fallback={<div className="scene-fallback">{t("webglError")}</div>}
        onPointerMissed={() =>
          interactive && useDesigner.getState().select(null)
        }
      >
        <color attach="background" args={["#ece9df"]} />
        <ambientLight intensity={0.16} />
        <hemisphereLight args={["#fff8e8", "#a1aca7", 0.3]} />
        <directionalLight
          position={[1, 5, 3]}
          intensity={2.5}
          castShadow={!performance}
          shadow-mapSize={performance ? 512 : 1024}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
          shadow-bias={-0.0003}
          shadow-normalBias={0.018}
        />
        <Environment resolution={128} frames={1}>
          <Lightformer
            intensity={3}
            position={[0, 5, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[8, 8, 1]}
          />
          <Lightformer
            intensity={2}
            position={[4, 2, 1]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[3, 5, 1]}
          />
        </Environment>
        <group position={[-w / 2, 0, -d / 2]}>
          <Box
            size={[w + 0.2, 0.06, d + 0.2]}
            position={[w / 2, -0.05, d / 2]}
            material={{
              id: "floor",
              name: { sq: "", en: "", de: "" },
              color: "#d6cfbd",
              roughness: 0.8,
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
              room={
                design.room.openings.length
                  ? design.room
                  : {
                      ...design.room,
                      openings: ![...design.cabinets].some(
                        (c) => c.wall === side,
                      )
                        ? [
                            {
                              id: "daylight",
                              wall: side,
                              type: "window",
                              offset:
                                (side === "back" || side === "front"
                                  ? design.room.width
                                  : design.room.depth) /
                                  2 -
                                60,
                              width: 120,
                              height: 110,
                              sill: 115,
                            },
                          ]
                        : [],
                    }
              }
              side={side}
              color={design.environment?.wallColor || "#e4e0d4"}
            />
          ))}
          {design.cabinets.map((c) => (
            <CabinetMesh
              key={c.id}
              cabinet={c}
              design={design}
              catalog={catalog}
              interactive={interactive}
            />
          ))}
          <Worktops design={design} catalog={catalog} />
          <Decor design={design} />
          <RoomDetails design={design} />
          <RunLights design={design} />
        </group>
        <RefreshShadows revision={[design, opened]} />
        <Controls preset={preset} design={design} cameraView={cameraView} />
        <AdaptiveDpr pixelated />
        <Rendering capture={capture} />
      </Canvas>
    </SceneBoundary>
  );
}
