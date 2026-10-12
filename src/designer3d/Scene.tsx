import { storageMeasurements } from "./storage";
import { countertopThickness } from "../scene/furnitureMaterials";
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
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  CameraControls,
  Environment,
  Lightformer,
} from "@react-three/drei";
import {
  Group,
  MathUtils,
  Object3D,
  Vector3,
  Color,
  PMREMGenerator,
  Scene as SceneObject,
  MeshBasicMaterial,
  Mesh,
  BoxGeometry,
  BackSide,
  DoubleSide,
} from "three";
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
import {
  cabinetBounds,
  cameraBounds,
  cabinetCamera,
  boundsCorners,
  orbitLimits,
  CABINET_FOV,
} from "./framing";
import type { CameraView, CameraPreset } from "./framing";
export type { CameraView, CameraPreset } from "./framing";

function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const envScene = new SceneObject();
    const panel = (
      v: number,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      side?: import("three").Side,
    ) => {
      const m = new MeshBasicMaterial();
      m.color.setScalar(v);
      if (side) m.side = side;
      const b = new Mesh(new BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      envScene.add(b);
    };
    panel(0.42, 62, 34, 62, 0, 10, 0, BackSide);
    panel(3.4, 34, 0.4, 34, 0, 25.6, 0);
    panel(2.1, 0.4, 20, 34, -29.6, 9, 0);
    panel(0.85, 0.4, 20, 34, 29.6, 9, 0);
    panel(1.35, 34, 20, 0.4, 0, 9, -29.6);
    panel(0.25, 34, 20, 0.4, 0, 9, 29.6);
    panel(5, 5, 17, 0.5, -12, 10, 29.2);
    panel(3, 3, 17, 0.5, 7, 10, 29.2);
    panel(0.2, 62, 0.4, 62, 0, -6.2, 0);
    const rt = pmrem.fromScene(envScene, 0.02);
    pmrem.dispose();
    envScene.traverse((o) => {
      if ((o as Mesh).geometry) (o as Mesh).geometry.dispose();
      if ((o as Mesh).material)
        ((o as Mesh).material as import("three").Material).dispose();
    });
    scene.environment = rt.texture;
    return () => {
      rt.texture.dispose();
      scene.environment = null;
    };
  }, [gl, scene]);
  return null;
}

function StudioWindow({ w, h }: { w: number; h: number }) {
  const fr = 0.055;
  const dep = 0.11;
  return (
    <group>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial
          color="#aed4f0"
          emissive="#9ec6ea"
          emissiveIntensity={0.65}
          roughness={0.05}
          metalness={0}
          transparent
          opacity={0.92}
          side={DoubleSide}
        />
      </mesh>
      <Box
        size={[w + 2 * fr + 0.03, 0.024, 0.025]}
        position={[0, h / 2 + fr + 0.008, 0.01]}
        color="#c8ccd4"
        roughness={0.7}
      />
      <Box
        size={[w + 2 * fr + 0.03, 0.024, 0.025]}
        position={[0, -h / 2 - fr - 0.008, 0.01]}
        color="#c8ccd4"
        roughness={0.7}
      />
      <Box
        size={[0.024, h + 2 * fr + 0.03, 0.025]}
        position={[-w / 2 - fr - 0.008, 0, 0.01]}
        color="#c8ccd4"
        roughness={0.7}
      />
      <Box
        size={[0.024, h + 2 * fr + 0.03, 0.025]}
        position={[w / 2 + fr + 0.008, 0, 0.01]}
        color="#c8ccd4"
        roughness={0.7}
      />
      <Box
        size={[w + 2 * fr, fr, dep]}
        position={[0, h / 2 + fr / 2, dep / 2 - 0.025]}
        color="#f4f6f9"
        roughness={0.5}
      />
      <Box
        size={[w + 2 * fr, fr, dep]}
        position={[0, -h / 2 - fr / 2, dep / 2 - 0.025]}
        color="#f4f6f9"
        roughness={0.5}
      />
      <Box
        size={[fr, h + 2 * fr, dep]}
        position={[-w / 2 - fr / 2, 0, dep / 2 - 0.025]}
        color="#f4f6f9"
        roughness={0.5}
      />
      <Box
        size={[fr, h + 2 * fr, dep]}
        position={[w / 2 + fr / 2, 0, dep / 2 - 0.025]}
        color="#f4f6f9"
        roughness={0.5}
      />
      <Box
        size={[0.024, h, 0.03]}
        position={[0, 0, 0.015]}
        color="#f4f6f9"
        roughness={0.5}
      />
      <Box
        size={[w + 2 * fr + 0.07, 0.038, 0.13]}
        position={[0, -h / 2 - fr, 0.05]}
        color="#f4f6f9"
        roughness={0.5}
        castShadow
      />
    </group>
  );
}

function StudioDoor({ w, h }: { w: number; h: number }) {
  const fr = 0.055;
  const dep = 0.09;
  return (
    <group>
      <Box
        size={[fr, h + fr, dep]}
        position={[-w / 2 - fr / 2, fr / 2, dep / 2 - 0.025]}
        color="#eceae5"
        roughness={0.6}
      />
      <Box
        size={[fr, h + fr, dep]}
        position={[w / 2 + fr / 2, fr / 2, dep / 2 - 0.025]}
        color="#eceae5"
        roughness={0.6}
      />
      <Box
        size={[w + 2 * fr, fr, dep]}
        position={[0, h / 2 + fr / 2, dep / 2 - 0.025]}
        color="#eceae5"
        roughness={0.6}
      />
      <Box
        size={[w - 0.02, h - 0.015, 0.044]}
        position={[0, -0.007, 0.028]}
        color="#b5855a"
        roughness={0.45}
        castShadow
      />
      <Box
        size={[0.032, 0.032, 0.022]}
        position={[w / 2 - 0.07, -0.02, 0.056]}
        color="#c9ced5"
        metal={1}
        roughness={0.3}
      />
      <Box
        size={[0.13, 0.024, 0.022]}
        position={[w / 2 - 0.13, -0.02, 0.06]}
        color="#c9ced5"
        metal={1}
        roughness={0.3}
      />
    </group>
  );
}
function Handle({
  kind,
  color,
  w,
  h,
  side = 0,
}: {
  kind: string;
  color: string;
  w: number;
  h: number;
  side?: number;
}) {
  if (kind === "none") return null;

  // Tall wardrobe doors (h > 1.4m)
  if (h > 1.4) {
    const edgeX = side !== 0 ? -side * (w / 2 - 0.042) : w / 2 - 0.042;
    const barLen = Math.min(0.75, h * 0.35);
    const centerY = -h * 0.05; // ergonomic ~1.1m from floor

    if (kind === "profile") {
      return (
        <Box
          size={[0.014, h - 0.06, 0.02]}
          position={[edgeX, 0, 0.016]}
          color={color}
          metal={0.92}
          roughness={0.25}
          castShadow
        />
      );
    }

    // Default vertical bar pull
    return (
      <group position={[edgeX, centerY, 0.024]}>
        <Box
          size={[0.014, barLen, 0.018]}
          color={color}
          metal={0.92}
          roughness={0.3}
          castShadow
        />
        {[-1, 1].map((n) => (
          <Box
            key={n}
            size={[0.012, 0.012, 0.022]}
            position={[0, n * (barLen * 0.38), -0.01]}
            color={color}
            metal={0.92}
            roughness={0.3}
            castShadow
          />
        ))}
      </group>
    );
  }

  // Kitchen base and wall doors
  return (
    <>
      <Box
        size={[
          kind === "profile" ? w - 0.025 : Math.min(0.22, w * 0.55),
          0.014,
          0.018,
        ]}
        position={[0, h / 2 - (kind === "profile" ? 0.014 : 0.06), 0.028]}
        color={color}
        metal={0.92}
        roughness={0.3}
        castShadow
      />
      {kind === "bar" &&
        [-1, 1].map((n) => (
          <Box
            key={n}
            size={[0.012, 0.012, 0.024]}
            position={[n * Math.min(0.09, w * 0.22), h / 2 - 0.06, 0.014]}
            color={color}
            metal={0.92}
            roughness={0.3}
            castShadow
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
              lacquer
            />
            <Box
              size={[0.035, h, 0.025]}
              position={[w / 2 - 0.015, 0, 0]}
              material={front}
              lacquer
            />
            <Box
              size={[w, 0.035, 0.025]}
              position={[0, h / 2 - 0.015, 0]}
              material={front}
              lacquer
            />
            <Box
              size={[w, 0.035, 0.025]}
              position={[0, -h / 2 + 0.015, 0]}
              material={front}
              lacquer
            />
          </>
        ) : (
          <Box
            size={[w - 0.006, h - 0.006, 0.02]}
            material={front}
            lacquer
            selected={selected}
          />
        )}
        {profile === "panel" && !glass && (
          <>
            <Box
              size={[0.04, h - 0.06, 0.014]}
              position={[-w / 2 + 0.035, 0, 0.014]}
              material={front}
              lacquer
            />
            <Box
              size={[0.04, h - 0.06, 0.014]}
              position={[w / 2 - 0.035, 0, 0.014]}
              material={front}
              lacquer
            />
            <Box
              size={[w - 0.06, 0.04, 0.014]}
              position={[0, h / 2 - 0.035, 0.014]}
              material={front}
              lacquer
            />
            <Box
              size={[w - 0.06, 0.04, 0.014]}
              position={[0, -h / 2 + 0.035, 0.014]}
              material={front}
              lacquer
            />
          </>
        )}
        <Handle color={handle.color} kind={handle.id} w={w} h={h} side={side} />
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
      <Box size={[w - 0.006, h - 0.006, 0.02]} material={front} lacquer />
      <Handle color={handle.color} kind={handle.id} w={w} h={h} />
      <Box
        size={[w - 0.05, 0.014, 0.45]}
        position={[0, -h / 2 + 0.02, -0.23]}
        color="#747e81"
        metal={0.65}
      />
      {[-1, 1].map((n) => (
        <Box
          key={n}
          size={[0.012, h * 0.65, 0.44]}
          position={[n * (w / 2 - 0.032), -h * 0.1, -0.23]}
          color="#747e81"
          metal={0.65}
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
  const selected = useDesigner((s) => interactive && s.selected === c.id),
    open = useDesigner((s) => interactive && s.opened.includes(c.id));
  const interior = useDesigner(
    (s) => interactive && s.interior && design.kind === "wardrobe",
  );
  const m = catalog.modules.find((m) => m.id === c.moduleId)!;
  const interaction = useCabinetInteraction(
    c,
    catalog,
    interactive,
    !["hood", "open", "oven", "fridge"].includes(m.type),
  );
  const front = catalog.fronts.find((m) => m.id === design.style.front)!;
  const carcass = catalog.carcasses.find((m) => m.id === design.style.carcass)!;
  const carcassReveal = carcass;
  const storage = storageMeasurements(c, m);
  const thickness = countertopThickness(design, catalog);
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
        material={carcassReveal}
      />
      {m.type !== "sink" && (
        <Box
          size={[w, 0.018, d - 0.025]}
          position={[0, h - 0.009, 0]}
          material={carcassReveal}
        />
      )}
      <Box
        size={[w, h, 0.016]}
        position={[0, h / 2, -d / 2 + 0.01]}
        material={carcassReveal}
      />
      {[-1, 1].map((n) => (
        <Box
          key={n}
          size={[0.018, h, d - 0.018]}
          position={[n * (w / 2 - 0.009), h / 2, 0]}
          material={carcassReveal}
        />
      ))}
      {m.type === "hanging" || m.type === "sliding" ? (
        <>
          <mesh
            position={[0, storage.rail ?? h - 0.32, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
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
              position={[side * (w / 2 - 0.027), storage.rail ?? h - 0.32, 0]}
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
        storage.shelves.map((r) => (
          <Box
            key={r}
            bevel={0.0015}
            size={[w - 0.035, 0.018, d - 0.035]}
            position={[0, r, 0]}
            material={carcass}
          />
        ))
      )}
      <StorageDetails kind={m.type} w={w} h={h} d={d} open={open} />
      {m.type === "pantry" ? (
        <group position={[0, h / 2, d / 2 + 0.012]}>
          <group ref={pantryFront}>
            <Box
              size={[w - 0.006, h - 0.006, 0.02]}
              material={front}
              lacquer
              selected={selected}
            />
            <Handle color={handle.color} kind={handle.id} w={w} h={h} />
          </group>
        </group>
      ) : m.type === "drawers" ? (
        [0, 1, 2].map((i) => (
          <Drawer
            key={i}
            w={w}
            h={c.level === "wardrobe" ? storage.drawerHeight : h / 3}
            y={
              c.level === "wardrobe"
                ? storage.drawerHeight * (i + 0.5)
                : (h * (i + 0.5)) / 3
            }
            z={d / 2 + 0.012}
            front={front}
            handle={handle}
            open={open}
            organizer={i === 0}
          />
        ))
      ) : interior ? null : m.type === "sliding" ? (
        <group position={[0, h / 2, d / 2 + 0.012]}>
          {[-1, 1].map((side) => (
            <Box
              key={side}
              size={[w - 0.025, 0.014, 0.065]}
              position={[0, side * (h / 2 - 0.018), 0]}
              color="#1a1c20"
              metal={0.92}
              roughness={0.25}
            />
          ))}
          <group ref={sliding}>
            <Box
              size={[0.014, 0.28, 0.014]}
              position={[-0.025, 0, 0.034]}
              color="#1a1c20"
              metal={0.92}
              roughness={0.25}
            />
            <Box
              size={[w / 2 + 0.016, h - 0.008, 0.025]}
              position={[-w / 4, 0, 0.016]}
              material={front}
              lacquer
            />
            <Box
              size={[0.012, h - 0.01, 0.028]}
              position={[-0.004, 0, 0.016]}
              color="#1a1c20"
              metal={0.9}
              roughness={0.3}
            />
          </group>
          <Box
            size={[w / 2 + 0.016, h - 0.008, 0.025]}
            position={[w / 4, 0, -0.02]}
            material={front}
            lacquer
          />
          <Box
            size={[0.012, h - 0.01, 0.028]}
            position={[0.004, 0, -0.02]}
            color="#1a1c20"
            metal={0.9}
            roughness={0.3}
          />
        </group>
      ) : m.type !== "open" &&
        m.type !== "oven" &&
        m.type !== "fridge" &&
        !(design.layout === "walkin" && m.type === "hanging") ? (
        <group position={[0, h / 2, d / 2 + 0.012]}>
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
          <group position={[0, h * 0.78, d / 2 + 0.012]}>
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
          <group position={[0, 0.94, d / 2 + 0.012]}>
            <Oven width={w} />
          </group>
          <Box
            size={[w - 0.007, 0.62, 0.022]}
            position={[0, 0.32, d / 2 + 0.012]}
            material={front}
            lacquer
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
          {storage.shelves.slice(1).map((v) => (
            <Box
              key={v}
              bevel={0.0015}
              size={[w - 0.035, 0.018, d - 0.035]}
              position={[0, v, 0]}
              material={carcass}
            />
          ))}
          {design.layout !== "walkin" && !interior && (
            <group position={[0, (h + 0.68) / 2, d / 2 + 0.012]}>
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
            <group position={[0, h + thickness + 0.005, 0.025]}>
              <Sink width={w} />
            </group>
          )}
          {hobCabinet(design, catalog)?.id === c.id && (
            <>
              <group position={[0, h + thickness + 0.012, 0.01]}>
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
        <group position={[0, 0, d / 2 + 0.012]}>
          <Fridge width={w} height={h} />
        </group>
      )}
      {c.level === "wardrobe" && design.environment?.internalLed && (
        <>
          <Box
            size={[w - 0.07, 0.008, 0.016]}
            position={[0, h - 0.045, d / 2 - 0.045]}
            color="#fff0ce"
            emissive="#ffda9b"
          />
          <pointLight
            position={[0, h * 0.75, 0]}
            color="#ffe4b8"
            intensity={0.65}
            distance={2.2}
            decay={2}
          />
        </>
      )}
      {c.level === "wardrobe" && (
        <Box
          size={[w, 0.05, d - 0.05]}
          position={[0, -0.025, -0.025]}
          color="#202227"
          roughness={0.5}
          metal={0.2}
        />
      )}
      {c.level !== "wall" && c.level !== "wardrobe" && (
        <Box
          size={[w, 0.1, d - 0.06]}
          position={[0, -0.05, -0.03]}
          color="#202227"
          roughness={0.5}
          metal={0.2}
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
            castShadow={false}
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
function Decor({ design: _ }: { design: DesignDocument }) {
  return null;
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
        color="#c3baaa"
      />
      <Box
        size={[0.018, 0.08, d]}
        position={[0.01, 0.04, d / 2]}
        color="#c3baaa"
      />
      <Box
        size={[w, 0.025, 0.22]}
        position={[w / 2, h, 0.07]}
        color="#c3baaa"
      />
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
  focus,
}: {
  focus?: string | null;
  cameraView?: CameraView;
  preset: CameraPreset;
  design: DesignDocument;
}) {
  const ref = useRef<CameraControls>(null);
  const dragging = useDesigner((s) => s.dragging);
  const { size } = useThree();
  const bounds = useMemo(
    () =>
      focus
        ? cabinetBounds({
            ...design,
            cabinets: design.cabinets.filter((c) => c.id === focus),
          }).expandByScalar(0.35)
        : cameraBounds(design, preset),
    [
      preset,
      focus,
      design.cabinets,
      design.room.width,
      design.room.depth,
      design.room.height,
    ],
  );
  const boundsKey = [...bounds.min.toArray(), ...bounds.max.toArray()].join(
    ",",
  );
  const aspect = size.width / Math.max(1, size.height);
  const view = useMemo(
    () => cabinetCamera(bounds, preset, aspect, cameraView),
    [preset, cameraView, boundsKey, aspect],
  );
  const limits = useMemo(
    () => orbitLimits(design, view, focus),
    [view, focus, design.cabinets],
  );
  useEffect(() => {
    ref.current?.setLookAt(...view.position, ...view.target, true);
  }, [view]);
  return (
    <CameraControls
      ref={ref}
      makeDefault
      enabled={!dragging}
      minDistance={limits.minDistance}
      maxDistance={limits.maxDistance}
      minAzimuthAngle={limits.minAzimuth}
      maxAzimuthAngle={limits.maxAzimuth}
      minPolarAngle={0.02}
      maxPolarAngle={Math.PI / 2 - 0.04}
      azimuthRotateSpeed={0.55}
      polarRotateSpeed={0.55}
      dollyToCursor
      smoothTime={0.2}
    />
  );
}
function StudioSun({
  design,
  shadows,
}: {
  design: DesignDocument;
  shadows: boolean;
}) {
  const lighting = useMemo(() => {
    const bounds = cabinetBounds(design);
    const center = bounds.getCenter(new Vector3()).setY(0);
    const target = new Object3D();
    target.position.copy(center);
    // Key sun angled from upper-left-front (approx 45° across back wall)
    const offset = new Vector3(-2.4, 4.2, 2.8);
    const direction = offset.clone().normalize();
    const right = new Vector3()
      .crossVectors(new Vector3(0, 1, 0), direction)
      .normalize();
    const up = new Vector3().crossVectors(direction, right);
    const corners = boundsCorners(bounds).map((p) => p.sub(center));
    return {
      target,
      center,
      position: center.clone().add(offset).toArray() as [
        number,
        number,
        number,
      ],
      fillPosition: [center.x + 3.2, 2.6, center.z - 1.8] as [
        number,
        number,
        number,
      ],
      left: Math.min(-4.0, ...corners.map((p) => p.dot(right) - 0.2)),
      right: Math.max(4.0, ...corners.map((p) => p.dot(right) + 0.2)),
      top: Math.max(4.0, ...corners.map((p) => p.dot(up) + 0.2)),
      bottom: Math.min(-0.8, ...corners.map((p) => p.dot(up) - 0.2)),
    };
  }, [design.cabinets, design.room.width, design.room.depth]);
  return (
    <>
      <primitive object={lighting.target} />
      <directionalLight
        target={lighting.target}
        position={lighting.position}
        intensity={1.3}
        color="#fff1e0"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={lighting.left}
        shadow-camera-right={lighting.right}
        shadow-camera-top={lighting.top}
        shadow-camera-bottom={lighting.bottom}
        shadow-camera-near={0.1}
        shadow-camera-far={25}
        shadow-bias={-0.0005}
        shadow-radius={4}
      />
      <directionalLight
        position={lighting.fillPosition}
        intensity={0.65}
        color="#e2e8ef"
        castShadow={false}
      />
    </>
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
  const focus = useDesigner((s) =>
    interactive && s.interactionMode === "showroom" ? s.selected : null,
  );
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
        style={
          interactive ? { height: "calc(100% - 128px)", top: 80 } : undefined
        }
        role="img"
        aria-label={t("sceneLabel")}
        frameloop="demand"
        dpr={performance ? 1 : [1, 1.75]}
        shadows={!performance}
        gl={showroomGL}
        camera={{ position: [2.4, 1.55, 4.2], fov: CABINET_FOV }}
        fallback={<div className="scene-fallback">{t("webglError")}</div>}
        onPointerMissed={() =>
          interactive && useDesigner.getState().select(null)
        }
      >
        <color attach="background" args={["#eee9df"]} />
        <hemisphereLight args={["#fff7e9", "#857b6b", 0.55]} />
        <StudioSun design={design} shadows={!performance} />
        <StudioEnvironment />
        <group position={[-w / 2, 0, -d / 2]}>
          <Box
            size={[w + 0.2, 0.06, d + 0.2]}
            position={[w / 2, -0.05, d / 2]}
            material={{
              id: "floor",
              name: { sq: "", en: "", de: "" },
              color: "#b0a288",
              roughness: 0.42,
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
              color={design.environment?.wallColor || "#e5e0d7"}
            />
          ))}
          {design.cabinets
            .filter((c) => c.level === "wall")
            .map((c) => (
              <group
                key={`support-${c.id}`}
                position={[c.x / 100, 1.75, c.z / 100]}
                rotation={[0, c.rotation, 0]}
              >
                <Box
                  size={[c.width / 100 + 0.01, 1.15, 0.035]}
                  position={[0, 0, -c.depth / 200 - 0.015]}
                  color={design.environment?.wallColor || "#e5e0d7"}
                />
              </group>
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
        <Controls
          preset={preset}
          focus={focus}
          design={committedDesign}
          cameraView={cameraView}
        />
        <Rendering capture={capture} />
      </Canvas>
    </SceneBoundary>
  );
}
