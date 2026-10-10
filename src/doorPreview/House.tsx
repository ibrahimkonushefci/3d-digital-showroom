import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { CameraControls, Environment, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import { Object3D, Vector3 } from "three";
import type { Catalog, Material } from "../catalog/types";
import type { FacadeDesign, Placement } from "./types";
import { Product } from "../scene/Product";
import { Box } from "../scene/Primitives";
import {
  Rendering,
  RefreshShadows,
  showroomGL,
  type RegisterCapture,
} from "../scene/Rendering";
import { useQuality } from "../scene/quality";
import { partitionWall } from "./houseLayout";
import {
  studioCamera,
  studioLayout,
  studioOpenings,
  STUDIO_FOV,
  type StudioCamera,
} from "./studioLayout";
export type HouseCamera = StudioCamera | "facade" | "entry" | "balcony";
function Camera({
  item,
  catalog,
  preset,
  exportView,
}: {
  item: Placement;
  catalog: Catalog;
  preset: StudioCamera;
  exportView: boolean;
}) {
  const ref = useRef<CameraControls>(null);
  const { size } = useThree();
  const saved = useRef<{ position: Vector3; target: Vector3 } | null>(null);
  // Finish and hardware colour changes deliberately do not reset an orbit.
  const dimensions = `${item.id}:${item.kind}:${item.width}:${item.height}:${item.modelId}:${item.options.filter((o) => ["side-left", "side-right", "transom"].includes(o) || o.startsWith("shutter-")).join(",")}`;
  useEffect(() => {
    if (exportView && !saved.current && ref.current)
      saved.current = {
        position: ref.current.getPosition(new Vector3()),
        target: ref.current.getTarget(new Vector3()),
      };
    if (!exportView && saved.current) {
      const previous = saved.current;
      saved.current = null;
      ref.current?.setLookAt(
        ...previous.position.toArray(),
        ...previous.target.toArray(),
        false,
      );
      return;
    }
    const view = studioCamera(
      item,
      catalog,
      exportView ? "full" : preset,
      size.width / Math.max(1, size.height),
    );
    ref.current?.setLookAt(...view.position, ...view.target, true);
  }, [dimensions, preset, size.width, size.height, exportView]);
  return (
    <CameraControls
      ref={ref}
      minDistance={0.45}
      maxDistance={35}
      maxPolarAngle={Math.PI * 0.57}
    />
  );
}
function Sun({
  center,
  radius,
  lightweight,
}: {
  center: [number, number, number];
  radius: number;
  lightweight: boolean;
}) {
  const target = useMemo(() => {
    const o = new Object3D();
    o.position.set(...center);
    return o;
  }, [center[0], center[1], center[2]]);
  return (
    <>
      <primitive object={target} />
      <directionalLight
        target={target}
        position={[-3.5, 6.5, 5]}
        color="#fff4e6"
        intensity={1.5}
        castShadow={!lightweight}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-radius}
        shadow-camera-right={radius}
        shadow-camera-top={radius}
        shadow-camera-bottom={-radius}
        shadow-camera-near={0.1}
        shadow-camera-far={25}
        shadow-bias={-0.0003}
        shadow-normalBias={0.002}
      />
      <directionalLight position={[4, 3, 4]} intensity={1.2} color="#fff7eb" />
    </>
  );
}
function SconceLight({ side, evening }: { side: number; evening: boolean }) {
  const target = useMemo(() => {
    const o = new Object3D();
    o.position.set(0, side * 0.7, -0.1);
    return o;
  }, [side]);
  return (
    <>
      <primitive object={target} />
      <spotLight
        target={target}
        position={[0, side * 0.13, 0.055]}
        color="#ffd6a0"
        intensity={evening ? 5 : 0.8}
        angle={0.65}
        penumbra={0.6}
        distance={2}
      />
    </>
  );
}
function StudioShadows({
  revision,
  scale,
}: {
  revision: string;
  scale: number;
}) {
  const { scene } = useThree(),
    previous = useRef(0),
    moving = useRef(false);
  const [settled, setSettled] = useState(0);
  useFrame(() => {
    const angle = scene.getObjectByName("leaf")?.rotation.y || 0;
    const changed = Math.abs(angle - previous.current) > 0.00001;
    if (!changed && moving.current) setSettled((n) => n + 1);
    moving.current = changed;
    previous.current = angle;
  });
  return <RefreshShadows revision={`${revision}:${settled}`} scale={scale} />;
}
const stone: Material = {
  id: "portal-stone",
  name: { sq: "Travertin", en: "Travertine", de: "Travertin" },
  color: "#d4cfc2",
  texture: "shared/textures/travertine-color.webp",
  normalMap: "shared/textures/travertine-normal.webp",
  roughnessMap: "shared/textures/travertine-roughness.webp",
  roughness: 0.75,
  multiplier: 1,
  perMeter: 0,
};
const concrete: Material = {
  ...stone,
  id: "portal-concrete",
  texture: undefined,
  normalMap: "shared/textures/concrete-normal.webp",
  roughnessMap: "shared/textures/concrete-roughness.webp",
  color: "#ded9cf",
  roughness: 0.86,
};
export default function House({
  design,
  catalog,
  selected,
  onSelect,
  preset = "full",
  capture,
  open = false,
  exportView = false,
}: {
  design: FacadeDesign;
  catalog: Catalog;
  selected?: string | null;
  onSelect?: (id: string) => void;
  preset?: HouseCamera;
  capture?: RegisterCapture;
  open?: boolean;
  exportView?: boolean;
}) {
  const item = design.items.find((p) => p.id === selected) || design.items[0];
  const quality = useQuality(),
    lightweight = quality === "lightweight";
  const l = studioLayout(item),
    wall = { ...concrete, color: design.facadeColor };
  const camera =
    preset === "facade" || preset === "entry" || preset === "balcony"
      ? "full"
      : preset;
  const holes = studioOpenings(item);
  const canopyWidth = Math.max(2.4, l.right - l.left + 0.75),
    canopyY = l.wallHeight - 0.16;
  return (
    <Canvas
      frameloop="demand"
      dpr={lightweight ? 1 : [1, 1.6]}
      shadows={!lightweight}
      camera={{ position: [1, 1.6, 6], fov: STUDIO_FOV }}
      gl={showroomGL}
    >
      <color
        attach="background"
        args={[design.evening ? "#454b50" : "#d5d2ca"]}
      />
      <hemisphereLight
        args={["#fff7ed", "#8d8479", design.evening ? 0.25 : 0.45]}
      />
      <Sun
        center={[l.centerX, l.wallHeight / 2, 0]}
        radius={Math.max(l.wallWidth, l.wallHeight) + 1}
        lightweight={lightweight}
      />
      <Environment
        resolution={lightweight ? 64 : quality === "high" ? 256 : 128}
        frames={1}
      >
        <Lightformer
          intensity={2.5}
          position={[-4, 5, 4]}
          rotation={[0, Math.PI / 4, 0]}
          scale={[4, 6, 1]}
        />
        <Lightformer
          intensity={0.8}
          position={[5, 3, 1]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[4, 5, 1]}
        />
        <Lightformer intensity={0.5} position={[0, 3, -5]} scale={[7, 5, 1]} />
        <Lightformer
          intensity={1.3}
          position={[0, 7, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[8, 8, 1]}
        />
      </Environment>
      <Box
        size={[Math.max(16, l.wallWidth + 8), 0.08, 16]}
        position={[0, -0.06, 0]}
        color="#c1bdb3"
        roughness={0.9}
      />
      <Box
        size={[l.wallWidth + 0.7, 0.14, 4.5]}
        position={[l.centerX, 0.06, 0.65]}
        material={stone}
      />
      <Box
        size={[Math.max(canopyWidth + 0.5, l.w + 1), 0.08, 1.05]}
        position={[l.centerX, 0, 2.25]}
        material={stone}
      />
      {partitionWall(
        {
          left: l.centerX - l.wallWidth / 2,
          right: l.centerX + l.wallWidth / 2,
          bottom: 0.14,
          top: l.wallHeight,
        },
        holes,
      ).map((panel, i) => (
        <Box key={i} {...panel} material={wall} />
      ))}
      {/* Joints, recessed returns and an open-backed interior keep both sides inspectable. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Box
            size={[0.04, l.top - l.bottom, 0.26]}
            position={[
              side === -1 ? l.left - 0.035 : l.right + 0.035,
              (l.bottom + l.top) / 2,
              -0.08,
            ]}
            color="#b9b4a9"
            roughness={0.8}
          />
          <Box
            size={[0.08, l.wallHeight, 0.75]}
            position={[
              l.centerX + side * (l.wallWidth / 2 - 0.06),
              l.wallHeight / 2,
              -0.56,
            ]}
            color="#e4ded2"
          />
          <Box
            size={[0.008, l.wallHeight - 0.3, 0.003]}
            position={[
              l.centerX + side * (l.wallWidth / 2 - 0.48),
              l.wallHeight / 2,
              -0.001,
            ]}
            color="#a8a297"
          />
        </group>
      ))}
      <Box
        size={[l.right - l.left + 0.08, 0.04, 0.26]}
        position={[l.centerX, l.top + 0.035, -0.08]}
        color="#b9b4a9"
      />
      <group position={[0, l.bottom, 0]}>
        <Product
          item={item}
          catalog={catalog}
          open={exportView ? false : open}
          onClick={onSelect ? () => onSelect(item.id) : undefined}
        />
      </group>
      {item.kind === "door" && (
        <>
          <Box
            size={[canopyWidth, 0.095, 1.25]}
            position={[l.centerX, canopyY, 0.43]}
            color="#303a3b"
            metal={0.12}
            roughness={0.42}
            bevel={0.008}
          />
          <Box
            size={[canopyWidth - 0.1, 0.016, 0.045]}
            position={[l.centerX, canopyY - 0.052, 0.94]}
            color="#fff0cf"
            emissive="#ffce8b"
            castShadow={false}
          />
          {[-0.32, 0.32].map((x) => (
            <group
              key={x}
              position={[l.centerX + x * canopyWidth, canopyY - 0.052, 0.55]}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.024, 0.024, 0.008, 16]} />
                <meshStandardMaterial
                  color="#fff1d8"
                  emissive="#ffd6a0"
                  emissiveIntensity={1}
                />
              </mesh>
              <pointLight
                intensity={design.evening ? 2 : 0.35}
                color="#ffddb1"
                distance={3}
                decay={2}
              />
            </group>
          ))}
          <group position={[l.right + 0.48, l.bottom + l.h * 0.65, 0.055]}>
            <Box
              size={[0.12, 0.24, 0.09]}
              color="#343d3d"
              metal={0.12}
              bevel={0.007}
            />
            {[-1, 1].map((side) => (
              <group key={side}>
                <Box
                  size={[0.075, 0.004, 0.055]}
                  position={[0, side * 0.122, 0]}
                  color="#ffe6bd"
                  emissive="#ffce8b"
                  castShadow={false}
                />
                <SconceLight side={side} evening={design.evening} />
              </group>
            ))}
          </group>
        </>
      )}
      <StudioShadows
        revision={`${item.id}:${item.width}:${item.height}:${item.options.join()}:${open}`}
        scale={Math.max(8, l.wallWidth + 2)}
      />
      <Camera
        item={item}
        catalog={catalog}
        preset={camera}
        exportView={exportView}
      />
      <Rendering capture={capture} />
    </Canvas>
  );
}
