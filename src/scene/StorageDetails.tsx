import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, MathUtils, Shape } from "three";
import { Box } from "./Primitives";
export function StorageDetails({
  kind,
  w,
  h,
  d,
  open,
}: {
  kind: string;
  w: number;
  h: number;
  d: number;
  open: boolean;
}) {
  const ref = useRef<Group>(null),
    { invalidate } = useThree();
  const outline = useMemo(() => {
    const s = new Shape();
    s.moveTo(-w * 0.32, -d * 0.29);
    s.bezierCurveTo(-w * 0.55, -d * 0.02, -w * 0.32, d * 0.37, 0, d * 0.3);
    s.bezierCurveTo(w * 0.45, d * 0.38, w * 0.48, -d * 0.3, w * 0.2, -d * 0.29);
    s.quadraticCurveTo(0, -d * 0.12, -w * 0.32, -d * 0.29);
    return s;
  }, [w, d]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const target = open ? 1 : 0;
    const next = MathUtils.damp(
      ref.current.userData.progress || 0,
      target,
      7,
      dt,
    );
    ref.current.userData.progress = next;
    ref.current.position.z = next * (kind === "pantry" ? 0.38 : 0.22);
    ref.current.rotation.y = kind === "corner" ? next * -0.7 : 0;
    if (Math.abs(next - target) > 0.001) invalidate();
  });
  if (!["pantry", "corner"].includes(kind)) return null;
  return (
    <group ref={ref}>
      {kind === "pantry" ? (
        <>
          <Box
            size={[0.022, h - 0.12, 0.025]}
            position={[0, h / 2, -d * 0.32]}
            color="#899294"
            metal={0.8}
          />
          {Array.from({ length: Math.max(2, Math.floor(h / 0.36)) }, (_, i) => (
            <group key={i} position={[0, 0.15 + i * 0.34, 0]}>
              <Box
                size={[w - 0.09, 0.02, d - 0.1]}
                bevel={0.006}
                color="#b2b8b6"
                metal={0.55}
              />
              {[-1, 1].map((n) => (
                <Box
                  key={n}
                  size={[0.012, 0.065, d - 0.1]}
                  position={[(n * (w - 0.1)) / 2, 0.035, 0]}
                  color="#7e898c"
                  metal={0.8}
                />
              ))}
              <Box
                size={[w - 0.09, 0.06, 0.012]}
                position={[0, 0.03, d / 2 - 0.055]}
                color="#7e898c"
                metal={0.8}
              />
            </group>
          ))}
        </>
      ) : (
        <>
          <Box
            size={[0.025, h - 0.08, 0.025]}
            position={[-w * 0.29, h / 2, -d * 0.3]}
            color="#8c9698"
            metal={0.9}
          />
          {[0.23, 0.53].map((y) => (
            <mesh
              key={y}
              position={[0, y, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <extrudeGeometry
                args={[
                  outline,
                  {
                    depth: 0.022,
                    bevelEnabled: true,
                    bevelSize: 0.003,
                    bevelThickness: 0.003,
                    bevelSegments: 2,
                    steps: 1,
                    curveSegments: 16,
                  },
                ]}
              />
              <meshStandardMaterial
                color="#acb2af"
                metalness={0.6}
                roughness={0.3}
              />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}
