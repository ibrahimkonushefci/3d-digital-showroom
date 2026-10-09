import { useMemo } from "react";
import { Shape, CatmullRomCurve3, Vector3, DoubleSide } from "three";
import { Box } from "./Primitives";
export function Hob({ width = 0.6 }: { width?: number }) {
  const w = Math.min(0.56, width - 0.04);
  return (
    <group>
      <Box
        size={[w, 0.008, 0.48]}
        bevel={0.004}
        color="#080e12"
        metal={0.18}
        roughness={0.13}
      />
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <group
            key={`${x}${z}`}
            position={[x * w * 0.24, 0.0045, z * 0.115]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <mesh>
              <ringGeometry args={[0.067, 0.0678, 40]} />
              <meshBasicMaterial color="#657071" />
            </mesh>
            <mesh>
              <planeGeometry args={[0.014, 0.0008]} />
              <meshBasicMaterial color="#8f9897" />
            </mesh>
          </group>
        )),
      )}
      {[0, 1, 2, 3, 4].map((i) => (
        <Box
          key={i}
          size={[0.012, 0.001, 0.002]}
          position={[-0.036 + i * 0.018, 0.005, 0.198]}
          color="#a5aaa7"
        />
      ))}
      <Box
        size={[0.007, 0.001, 0.007]}
        position={[w * 0.35, 0.005, 0.198]}
        color="#ed6e53"
        emissive="#ad3825"
      />
    </group>
  );
}
export function Sink({ width = 0.6 }: { width?: number }) {
  const w = width * 0.61;
  const curve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(-0.105, 0.005, -0.21),
        new Vector3(-0.105, 0.26, -0.21),
        new Vector3(-0.075, 0.34, -0.21),
        new Vector3(0.045, 0.34, -0.21),
        new Vector3(0.075, 0.26, -0.21),
      ]),
    [],
  );
  return (
    <group>
      <Box
        size={[w, 0.014, 0.3]}
        position={[0, -0.16, 0]}
        bevel={0.006}
        color="#5d6567"
        metal={0.8}
        roughness={0.32}
      />
      {[-1, 1].map((n) => (
        <group key={n}>
          <Box
            size={[0.014, 0.15, 0.31]}
            position={[(n * w) / 2, -0.08, 0]}
            bevel={0.005}
            color="#8e9799"
            metal={0.8}
            roughness={0.27}
          />
          <Box
            size={[w + 0.014, 0.15, 0.014]}
            position={[0, -0.08, n * 0.15]}
            bevel={0.005}
            color="#8e9799"
            metal={0.8}
            roughness={0.27}
          />
          <Box
            size={[w + 0.042, 0.006, 0.016]}
            position={[0, -0.002, n * 0.162]}
            bevel={0.002}
            color="#b6bcbd"
            metal={0.8}
            roughness={0.22}
          />
          <Box
            size={[0.016, 0.006, 0.31]}
            position={[n * (w / 2 + 0.013), -0.002, 0]}
            bevel={0.002}
            color="#b6bcbd"
            metal={0.8}
            roughness={0.22}
          />
        </group>
      ))}
      <mesh position={[0, -0.152, 0.035]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.016, 0.023, 24]} />
        <meshStandardMaterial color="#bac2c4" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 32, 0.012, 10, false]} />
        <meshStandardMaterial
          color="#c3c9ca"
          metalness={0.94}
          roughness={0.21}
        />
      </mesh>
      <Box
        size={[0.038, 0.035, 0.038]}
        position={[-0.105, 0.01, -0.21]}
        bevel={0.008}
        color="#899497"
        metal={0.9}
      />
      <Box
        size={[0.05, 0.012, 0.016]}
        position={[-0.145, 0.047, -0.21]}
        bevel={0.004}
        color="#c3c9ca"
        metal={0.9}
      />
    </group>
  );
}
export function Hood({
  width = 0.6,
  builtIn = false,
}: {
  width?: number;
  builtIn?: boolean;
}) {
  return (
    <group>
      <Box
        size={[width, 0.045, 0.43]}
        position={[0, -0.035, 0.035]}
        bevel={0.008}
        color="#22292b"
        metal={0.65}
        roughness={0.28}
      />
      <Box
        size={[width - 0.05, 0.003, 0.27]}
        position={[0, -0.059, 0.045]}
        color="#646d70"
        metal={0.85}
      />
      {Array.from({ length: 12 }, (_, i) => (
        <Box
          key={i}
          size={[width - 0.12, 0.002, 0.003]}
          position={[0, -0.061, -0.065 + i * 0.018]}
          color="#272f31"
        />
      ))}
      {!builtIn && (
        <Box
          size={[0.23, 0.58, 0.18]}
          position={[0, 0.27, -0.1]}
          bevel={0.009}
          color="#424b4e"
          metal={0.75}
          roughness={0.3}
        />
      )}
      {[-1, 1].map((n) => (
        <Box
          key={n}
          size={[0.075, 0.004, 0.018]}
          position={[n * width * 0.32, -0.06, 0.2]}
          color="#fff0d1"
          emissive="#ffd299"
          bevel={0.002}
        />
      ))}
    </group>
  );
}
export function Oven({ width = 0.6 }: { width?: number }) {
  return (
    <group>
      <Box
        size={[width - 0.02, 0.59, 0.047]}
        bevel={0.007}
        color="#141c20"
        roughness={0.17}
        metal={0.25}
      />
      <Box
        size={[width - 0.07, 0.38, 0.005]}
        position={[0, -0.045, 0.026]}
        bevel={0.008}
        color="#080e14"
        roughness={0.12}
        metal={0.18}
      />
      <Box
        size={[width - 0.11, 0.024, 0.045]}
        position={[0, 0.183, 0.043]}
        bevel={0.009}
        color="#8a969b"
        metal={0.92}
        roughness={0.22}
      />
      <Box
        size={[0.086, 0.03, 0.003]}
        position={[0, 0.247, 0.027]}
        color="#09282e"
      />
      <Box
        size={[0.043, 0.008, 0.004]}
        position={[0, 0.247, 0.029]}
        color="#b0cdd0"
        emissive="#548e9a"
      />
      {[-1, 1].map((n) => (
        <mesh
          key={n}
          position={[n * (width * 0.32), 0.245, 0.03]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.016, 0.016, 0.012, 20]} />
          <meshStandardMaterial
            color="#646f74"
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}
export function Fridge({
  width = 0.6,
  height = 2.1,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <group>
      {[
        { y: height * 0.665, h: height * 0.66 },
        { y: height * 0.165, h: height * 0.32 },
      ].map((v, i) => (
        <group key={i}>
          <Box
            size={[width - 0.025, v.h, 0.045]}
            position={[0, v.y, 0.016]}
            bevel={0.01}
            color="#919ca0"
            metal={0.72}
            roughness={0.35}
          />
          <Box
            size={[0.014, Math.min(0.42, v.h * 0.6), 0.03]}
            position={[-width * 0.34, v.y, 0.054]}
            bevel={0.006}
            color="#424b50"
            metal={0.8}
          />
        </group>
      ))}
    </group>
  );
}
export function Plant() {
  return (
    <group>
      <mesh position={[0, 0.105, 0]}>
        <cylinderGeometry args={[0.066, 0.048, 0.21, 24]} />
        <meshStandardMaterial color="#b9ac99" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <group
          key={i}
          position={[0, 0.2, 0]}
          rotation={[0.12 * Math.sin(i), i * 2.4, 0.18 * Math.cos(i)]}
        >
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.0018, 0.0028, 0.26, 5]} />
            <meshStandardMaterial color="#5f6042" />
          </mesh>
          {[-1, 1].map((n) => (
            <mesh
              key={n}
              position={[n * 0.035, 0.1 + i * 0.009, 0]}
              rotation={[0.5, n * 0.4, n * -0.65]}
              scale={[0.027, 0.083, 1]}
            >
              <circleGeometry args={[1, 8]} />
              <meshStandardMaterial
                color={i % 2 ? "#465e43" : "#728266"}
                side={DoubleSide}
                roughness={0.85}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
export function Garment({ color }: { color: string }) {
  const outline = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-0.035, 0.19);
    for (const [x, y] of [
      [-0.075, 0.18],
      [-0.19, 0.09],
      [-0.14, 0.015],
      [-0.105, 0.065],
      [-0.1, -0.23],
      [0.1, -0.23],
      [0.105, 0.065],
      [0.14, 0.015],
      [0.19, 0.09],
      [0.075, 0.18],
      [0.035, 0.19],
      [0.018, 0.14],
      [-0.018, 0.14],
    ])
      shape.lineTo(x, y);
    shape.closePath();
    return shape;
  }, []);
  return (
    <group>
      <mesh position={[0, 0.28, 0]}>
        <torusGeometry args={[0.025, 0.004, 6, 12, Math.PI * 1.5]} />
        <meshStandardMaterial color="#aa9473" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.066, 0.205, 0]}
          rotation={[0, 0, s * 0.45]}
        >
          <cylinderGeometry args={[0.006, 0.006, 0.16, 8]} />
          <meshStandardMaterial color="#c4aa84" />
        </mesh>
      ))}
      <mesh position={[0, 0, -0.014]}>
        <extrudeGeometry
          args={[
            outline,
            {
              depth: 0.028,
              bevelEnabled: true,
              bevelSegments: 1,
              steps: 1,
              bevelSize: 0.004,
              bevelThickness: 0.003,
            },
          ]}
        />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
    </group>
  );
}
