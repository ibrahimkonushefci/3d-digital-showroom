import { Plant } from "../scene/Appliances";
import {
  Rendering,
  RefreshShadows,
  showroomGL,
  type RegisterCapture,
} from "../scene/Rendering";
import { useQuality } from "../scene/quality";
import { Canvas, useThree } from "@react-three/fiber";
import {
  CameraControls,
  Environment,
  Lightformer,
  ContactShadows,
} from "@react-three/drei";
import { useEffect, useRef } from "react";
import type { Catalog } from "../catalog/types";
import type { FacadeDesign } from "./types";
import { Product } from "../scene/Product";
import { Box } from "../scene/Primitives";
import { openingPositions, facadePanels } from "./houseLayout";
import type { Material } from "../catalog/types";
import { useDesigner } from "../designer3d/store";
export type HouseCamera = "facade" | "entry" | "balcony";
function Camera({
  preset,
  capture,
}: {
  preset: HouseCamera;
  capture?: RegisterCapture;
}) {
  const ref = useRef<CameraControls>(null),
    { gl, scene, camera } = useThree();
  useEffect(() => {
    const v =
      preset === "entry"
        ? [2, 2.2, 7, 0, 1.6, 2.8]
        : preset === "balcony"
          ? [6, 5, 8, 0, 4, 3.2]
          : [11, 7, 15, 0, 2.1, 0];
    ref.current?.setLookAt(v[0], v[1], v[2], v[3], v[4], v[5], true);
  }, [preset]);

  return (
    <CameraControls
      ref={ref}
      minDistance={3}
      maxDistance={25}
      maxPolarAngle={Math.PI / 2 - 0.025}
    />
  );
}
export default function House({
  design,
  catalog,
  selected,
  onSelect,
  preset = "entry",
  capture,
}: {
  design: FacadeDesign;
  catalog: Catalog;
  selected?: string | null;
  onSelect?: (id: string) => void;
  preset?: HouseCamera;
  capture?: RegisterCapture;
}) {
  const performance = useQuality() === "lightweight";
  const positions = openingPositions;
  const stone: Material = {
    id: "plinth-stone",
    name: { sq: "Travertin", en: "Travertine", de: "Travertin" },
    color: "#d4cfc2",
    texture: "shared/textures/travertine-color.webp",
    normalMap: "shared/textures/travertine-normal.webp",
    roughnessMap: "shared/textures/travertine-roughness.webp",
    roughness: 0.85,
    multiplier: 1,
    perMeter: 0,
  };

  const paving: Material = {
    ...stone,
    id: "paving",
    color: "#b9b4a8",
    texture: "shared/textures/concrete-color.webp",
    normalMap: "shared/textures/concrete-normal.webp",
    roughnessMap: "shared/textures/concrete-roughness.webp",
  };
  const facade: Material = {
    ...paving,
    id: "facade",
    texture: undefined,
    color: design.facadeColor,
  };
  return (
    <Canvas
      frameloop="demand"
      dpr={performance ? 1 : [1, 1.6]}
      shadows={!performance}
      camera={{ position: [11, 7, 15], fov: 42 }}
      gl={showroomGL}
    >
      <color
        attach="background"
        args={[design.evening ? "#354756" : "#e3edf0"]}
      />
      <ambientLight intensity={design.evening ? 0.2 : 0.3} />
      <directionalLight
        position={[-3, 10, 7]}
        intensity={design.evening ? 0.4 : 2.4}
        castShadow={!performance}
        shadow-mapSize={1024}
        shadow-normalBias={0.025}
      />
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={2} position={[0, 8, 3]} scale={[20, 10, 1]} />
      </Environment>
      <Box size={[22, 0.1, 18]} position={[0, -0.1, 0]} color="#9ba996" />
      <Box size={[10, 0.06, 9]} position={[0, -0.035, 1]} material={paving} />
      {[-1, 1].flatMap((n) =>
        [0, 1, 2].map((i) => (
          <group
            key={`${n}-${i}`}
            position={[n * 4.5, 0, -2 + i * 1.6]}
            scale={2.8}
          >
            <Plant />
          </group>
        )),
      )}
      {Array.from({ length: 9 }, (_, i) => (
        <Box
          key={i}
          size={[10, 0.002, 0.015]}
          position={[0, 0.001, -3 + i]}
          color="#a4a297"
        />
      ))}
      {[-1, 1].map((n) => (
        <Box
          key={n}
          size={[0.045, 0.09, 6.7]}
          position={[n * 4.15, 6.28, 0]}
          color="#626d6d"
          bevel={0.01}
        />
      ))}
      {/* Facade built around actual openings, rather than solid wall behind products. */}
      <Box size={[8, 0.32, 6]} position={[0, 0.16, 0]} color="#88867d" />
      <Box size={[8, 6, 0.18]} position={[0, 3.32, -3]} material={facade} />
      {[-1, 1].map((x) => (
        <Box
          key={x}
          size={[0.18, 6, 6]}
          position={[x * 4, 3.32, 0]}
          material={facade}
        />
      ))}
      {facadePanels(design).map((panel, i) => (
        <Box key={i} {...panel} material={facade} />
      ))}
      {[-1, 1].map((x) => (
        <Box
          key={x}
          size={[0.21, 0.42, 6]}
          position={[x * 4, 0.53, 0]}
          material={stone}
        />
      ))}
      <Box size={[8, 0.42, 0.21]} position={[0, 0.53, -3]} material={stone} />
      {[-1, 1].map((x) => (
        <Box
          key={x}
          size={[3.45, 0.42, 0.21]}
          position={[x * 2.28, 0.53, 3.03]}
          material={stone}
        />
      ))}

      <mesh position={[0, 6.65, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[6.05, 1.4, 4]} />
        <meshStandardMaterial color="#53535a" roughness={0.8} />
      </mesh>
      <Box size={[8.6, 0.14, 6.6]} position={[0, 6.32, 0]} color="#d2cfc3" />
      {design.items.map((p) => (
        <group key={p.id} position={positions[p.id] || [0, 1, 3.08]}>
          <Product
            item={p}
            catalog={catalog}
            onClick={() => onSelect?.(p.id)}
          />
          {selected === p.id && (
            <group userData={{ exportHidden: true }}>
              <Box
                size={[p.width / 100 + 0.04, 0.02, 0.02]}
                position={[0, -0.02, 0.16]}
                color="#c6ad78"
              />
            </group>
          )}
          {design.evening && (
            <pointLight
              position={[0, p.height / 200, -0.35]}
              color="#ffbc76"
              intensity={0.55}
              distance={2.5}
            />
          )}
        </group>
      ))}
      <Box
        size={[2.8, 0.15, 1.25]}
        position={[0, 3.27, 3.57]}
        color="#d1cfc5"
      />
      {[-1, 1].map((x) => (
        <Box
          key={x}
          size={[0.05, 1.02, 0.05]}
          position={[x * 1.36, 3.85, 4.13]}
          color="#3e484b"
          metal={0.65}
        />
      ))}
      <Box
        size={[2.75, 0.035, 0.04]}
        position={[0, 4.37, 4.13]}
        color="#3e484b"
        metal={0.7}
      />
      {design.railing === "glass" ? (
        <Box
          size={[2.68, 0.9, 0.016]}
          position={[0, 3.85, 4.13]}
          color="#abc2c4"
          transparent
        />
      ) : (
        Array.from({ length: 16 }, (_, i) => (
          <Box
            key={i}
            size={[0.018, 0.94, 0.018]}
            position={[-1.3 + i * 0.17, 3.85, 4.13]}
            color="#3e484b"
          />
        ))
      )}
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          size={[1.8, 0.08, 1.1 - i * 0.2]}
          position={[0, 0.04 + i * 0.08, 3.6 - i * 0.1]}
          color="#9c9c94"
        />
      ))}
      <Box size={[2.2, 0.1, 0.9]} position={[0, 2.6, 3.4]} color="#3e4749" />
      <Box size={[4.3, 0.8, 0.18]} position={[-2.8, 0.4, 6]} color="#bbb5a5" />
      <Box size={[0.6, 0.8, 0.18]} position={[4.45, 0.4, 6]} color="#bbb5a5" />
      {[-0.6, 4.1].map((x) => (
        <Box
          key={x}
          size={[0.25, 1.45, 0.25]}
          position={[x, 0.72, 6]}
          color="#aaa28f"
        />
      ))}
      <group position={[1.75, 0.62, 6]}>
        {Array.from({ length: 11 }, (_, i) => (
          <Box
            key={i}
            size={[4.4, 0.055, 0.055]}
            position={[0, -0.5 + i * 0.1, 0]}
            color="#3d484b"
            metal={0.55}
          />
        ))}
        {design.gate === "swing" && (
          <Box size={[0.035, 1.1, 0.065]} color="#677073" />
        )}
      </group>
      {design.garage && (
        <group position={[4.9, 0, 1]}>
          <Box
            size={[2.8, 2.6, 3.8]}
            position={[0, 1.3, 0]}
            material={facade}
          />
          {Array.from({ length: 9 }, (_, i) => (
            <Box
              key={i}
              size={[2.5, 0.24, 0.05]}
              position={[0, 0.15 + i * 0.27, 1.93]}
              color="#555e61"
            />
          ))}
        </group>
      )}
      <RefreshShadows revision={design} scale={22} />
      <Camera preset={preset} />
      <Rendering capture={capture} />
    </Canvas>
  );
}
