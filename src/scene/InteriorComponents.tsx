import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MathUtils } from "three";
import type { Cabinet, Material } from "../catalog/types";
import type { ResolvedInterior } from "../designer3d/interiors";
import { useDesigner } from "../designer3d/store";
import { useInteriorInteraction } from "../designer3d/useInteriorInteraction";
import { Box } from "./Primitives";
import { SelectionFrame } from "../designer3d/furniture/SelectionFrame";
import { Fittings } from "./Fittings";
import { useSceneInvalidation } from "./activity";
function Component({
  c,
  part,
  carcass,
  interactive,
  interior,
}: {
  c: Cabinet;
  part: ResolvedInterior;
  carcass: Material;
  interactive: boolean;
  interior: boolean;
}) {
  const selected = useDesigner(
    (s) =>
      interactive &&
      s.selectedInterior?.cabinetId === c.id &&
      s.selectedInterior.componentId === part.id,
  );
  const opened = useDesigner(
    (s) =>
      interactive &&
      s.openedInterior.some(
        (i) => i.cabinetId === c.id && i.componentId === part.id,
      ),
  );
  const ref = useRef<Group>(null),
    invalidate = useSceneInvalidation();
  const w = part.widthCm / 100,
    d = part.depthCm / 100,
    h = part.heightCm / 100,
    y = part.cabinetYcm / 100;
  const pullout = part.kind === "drawer" || part.kind === "basket";
  const interaction = useInteriorInteraction(
    c.id,
    part.id,
    interactive && interior,
  );
  useFrame((_, dt) => {
    if (!ref.current || !pullout) return;
    const target = opened && interior ? part.extensionCm / 100 : 0;
    ref.current.position.z = MathUtils.damp(
      ref.current.position.z,
      target,
      8,
      dt,
    );
    if (Math.abs(ref.current.position.z - target) > 0.001) invalidate();
    else invalidate.settled();
  });
  return (
    <group {...interaction}>
      <group ref={ref} position={[0, 0, 0]}>
        {part.kind === "shelf" ? (
          <Box
            size={[w, h, d]}
            position={[0, y, -0.008]}
            material={carcass}
            bevel={0.0015}
            grain="horizontal"
            panelRole={`interior-${part.id}`}
          />
        ) : part.kind === "rail" ? (
          <>
            <mesh
              position={[0, y, 0]}
              rotation={[0, 0, Math.PI / 2]}
              castShadow
            >
              <cylinderGeometry args={[0.008, 0.008, w - 0.014, 12]} />
              <meshStandardMaterial
                color="#adb5b4"
                metalness={0.8}
                roughness={0.25}
              />
            </mesh>
            {[-1, 1].map((side) => (
              <Box
                key={side}
                size={[0.016, 0.042, 0.042]}
                position={[side * (w / 2 - 0.008), y, 0]}
                color="#adb5b4"
                metal={0.8}
              />
            ))}
          </>
        ) : pullout ? (
          <group position={[0, y, 0]}>
            {part.kind === "basket" ? (
              <Fittings
                color="#879295"
                parts={[
                  ...[-1, 1].flatMap((side) => [
                    {
                      size: [0.012, 0.012, d - 0.04] as [
                        number,
                        number,
                        number,
                      ],
                      position: [
                        side * (w / 2 - 0.022),
                        h / 2 - 0.01,
                        -0.008,
                      ] as [number, number, number],
                    },
                    {
                      size: [w - 0.04, 0.012, 0.012] as [
                        number,
                        number,
                        number,
                      ],
                      position: [
                        0,
                        h / 2 - 0.01,
                        side * (d / 2 - 0.02) - 0.008,
                      ] as [number, number, number],
                    },
                  ]),
                  ...Array.from({ length: 7 }, (_, i) => ({
                    size: [0.008, 0.008, d - 0.04] as [number, number, number],
                    position: [
                      ((i - 3) * (w - 0.05)) / 6,
                      -h / 2 + 0.01,
                      -0.008,
                    ] as [number, number, number],
                  })),
                  ...Array.from({ length: 7 }, (_, i) => ({
                    size: [0.008, h - 0.02, 0.008] as [number, number, number],
                    position: [
                      ((i - 3) * (w - 0.05)) / 6,
                      0,
                      d / 2 - 0.028,
                    ] as [number, number, number],
                  })),
                  ...[-1, 1].map((side) => ({
                    size: [0.008, h - 0.02, 0.008] as [number, number, number],
                    position: [side * (w / 2 - 0.022), 0, -d / 2 + 0.012] as [
                      number,
                      number,
                      number,
                    ],
                  })),
                ]}
              />
            ) : (
              <>
                <Box
                  size={[w - 0.02, 0.012, d - 0.04]}
                  position={[0, -h / 2 + 0.006, -0.008]}
                  material={carcass}
                />
                <Box
                  size={[w - 0.02, h, 0.018]}
                  position={[0, 0, d / 2 - 0.026]}
                  material={carcass}
                  panelRole={`interior-front-${part.id}`}
                />
                <Fittings
                  color="#879295"
                  parts={[-1, 1]
                    .map((side) => ({
                      size: [0.012, h - 0.02, d - 0.04] as [
                        number,
                        number,
                        number,
                      ],
                      position: [side * (w / 2 - 0.022), 0, -0.008] as [
                        number,
                        number,
                        number,
                      ],
                    }))
                    .concat([
                      {
                        size: [w - 0.04, h - 0.02, 0.012],
                        position: [0, 0, -d / 2 + 0.018],
                      },
                    ])}
                />
              </>
            )}
          </group>
        ) : null}
        {selected && (
          <SelectionFrame
            kind="selected"
            w={w}
            y0={y - Math.max(h / 2, 0.025)}
            y1={y + Math.max(h / 2, 0.025)}
            z0={-d / 2 - 0.008}
            z1={d / 2}
          />
        )}
      </group>
    </group>
  );
}
export function InteriorComponents({
  c,
  components,
  carcass,
  interactive,
  interior,
}: {
  c: Cabinet;
  components: ResolvedInterior[];
  carcass: Material;
  interactive: boolean;
  interior: boolean;
}) {
  return (
    <>
      {components
        .filter((i) => c.interior || i.kind !== "drawer")
        .map((part) => (
          <Component
            key={part.id}
            c={c}
            part={part}
            carcass={carcass}
            interactive={interactive}
            interior={interior}
          />
        ))}
    </>
  );
}
