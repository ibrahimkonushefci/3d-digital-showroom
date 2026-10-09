import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Suspense, useMemo, useEffect } from "react";
import { Edges } from "@react-three/drei";
import type { Material } from "../catalog/types";
import { SurfaceMaterial } from "./Materials";
const bevelCache = new Map<
  string,
  { geometry: RoundedBoxGeometry; users: number }
>();
function rounded(size: [number, number, number], bevel: number) {
  const key = [...size, bevel].join(":");
  let entry = bevelCache.get(key);
  if (!entry) {
    entry = {
      geometry: new RoundedBoxGeometry(
        ...size,
        2,
        Math.min(bevel, ...size.map((n) => n / 3)),
      ),
      users: 0,
    };
    bevelCache.set(key, entry);
  }
  return { key, entry };
}
type BoxProps = {
  size: [number, number, number];
  position?: [number, number, number];
  color?: string;
  material?: Material;
  selected?: boolean;
  metal?: number;
  transparent?: boolean;
  world?: boolean;
  emissive?: string;
  bevel?: number;
  roughness?: number;
  lacquer?: boolean;
  castShadow?: boolean;
};
export function Box({
  size,
  position = [0, 0, 0],
  color = "#eeece2",
  material,
  selected,
  metal = 0,
  transparent = false,
  world = false,
  emissive,
  bevel = 0,
  roughness,
  lacquer = false,
  castShadow = true,
}: BoxProps) {
  const resource = useMemo(
    () => (bevel > 0 ? rounded(size, bevel) : null),
    [size[0], size[1], size[2], bevel],
  );
  const geometry = resource?.entry.geometry;
  useEffect(() => {
    if (!resource) return;
    resource.entry.users++;
    return () => {
      resource.entry.users--;
      queueMicrotask(() => {
        if (
          !resource.entry.users &&
          bevelCache.get(resource.key) === resource.entry
        ) {
          resource.entry.geometry.dispose();
          bevelCache.delete(resource.key);
        }
      });
    };
  }, [resource]);
  return (
    <mesh position={position} castShadow={castShadow} receiveShadow>
      {geometry ? (
        <primitive object={geometry} attach="geometry" />
      ) : (
        <boxGeometry args={size} />
      )}
      {material && (material.texture || material.normalMap) ? (
        <Suspense
          fallback={
            <meshPhysicalMaterial
              color={material.color}
              roughness={
                lacquer && !material.texture ? 0.4 : material.roughness
              }
              metalness={lacquer ? 0.02 : metal}
              clearcoat={lacquer && !material.texture ? 0.35 : 0}
              clearcoatRoughness={0.35}
              envMapIntensity={lacquer ? 1 : 0.6}
            />
          }
        >
          <SurfaceMaterial
            material={material}
            world={world}
            lacquer={lacquer}
          />
        </Suspense>
      ) : (
        <meshPhysicalMaterial
          color={material?.color || color}
          roughness={lacquer ? 0.4 : (roughness ?? material?.roughness ?? 0.65)}
          metalness={lacquer ? 0.02 : metal}
          clearcoat={lacquer ? 0.35 : 0}
          clearcoatRoughness={0.35}
          envMapIntensity={lacquer ? 1 : 0.6}
          emissive={emissive}
          emissiveIntensity={emissive ? 1.5 : 0}
          transparent={transparent}
          opacity={transparent ? 0.3 : 1}
        />
      )}{" "}
      {selected && (
        <group userData={{ exportHidden: true }}>
          <Edges color="#c6ac77" />
        </group>
      )}
    </mesh>
  );
}
