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
    <mesh position={position} castShadow receiveShadow>
      {geometry ? (
        <primitive object={geometry} attach="geometry" />
      ) : (
        <boxGeometry args={size} />
      )}
      {material && (material.texture || material.normalMap) ? (
        <Suspense
          fallback={
            <meshStandardMaterial
              color={material.color}
              roughness={material.roughness}
            />
          }
        >
          <SurfaceMaterial material={material} world={world} />
        </Suspense>
      ) : (
        <meshStandardMaterial
          color={material?.color || color}
          roughness={roughness ?? material?.roughness ?? 0.65}
          metalness={metal}
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
