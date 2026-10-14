import { useLayoutEffect, useRef } from "react";
import {
  BoxGeometry,
  MeshStandardMaterial,
  Object3D,
  type InstancedMesh,
} from "three";
import { ResourceCache, useSharedResource } from "./resources";
type Fitting = {
  position: [number, number, number];
  size: [number, number, number];
};
const geometries = new ResourceCache<BoxGeometry>();
const materials = new ResourceCache<MeshStandardMaterial>();
/** One draw for all illustrative stationary hinge mounts, runners and shelf pins in a cabinet. */
export function Fittings({
  parts,
  color = "#9ca5a6",
  roughness = 0.35,
  metalness = 0.65,
  decorative = false,
  castShadow = true,
}: {
  parts: Fitting[];
  color?: string;
  roughness?: number;
  metalness?: number;
  decorative?: boolean;
  castShadow?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useSharedResource(
    geometries,
    "unit-box",
    () => new BoxGeometry(1, 1, 1),
  );
  const material = useSharedResource(
    materials,
    JSON.stringify([color, roughness, metalness]),
    () =>
      new MeshStandardMaterial({
        color,
        metalness,
        roughness,
      }),
  );
  useLayoutEffect(() => {
    if (!ref.current) return;
    const transform = new Object3D();
    parts.forEach((part, i) => {
      transform.position.set(...part.position);
      transform.scale.set(...part.size);
      transform.updateMatrix();
      ref.current!.setMatrixAt(i, transform.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [parts, geometry, material]);
  useLayoutEffect(() => {
    const o = ref.current;
    return () => {
      o?.dispose();
    };
  }, [geometry, material, parts.length]);
  return geometry && material && parts.length ? (
    <instancedMesh
      key={parts.length}
      ref={ref}
      args={[geometry, material, parts.length]}
      dispose={null}
      castShadow={castShadow}
      receiveShadow
      raycast={decorative ? () => {} : undefined}
    />
  ) : null;
}
export function cabinetFittings(
  w: number,
  h: number,
  d: number,
  shelves: number[],
  drawerHeights: number[],
  hinged: boolean,
): Fitting[] {
  const parts: Fitting[] = [];
  for (const side of [-1, 1]) {
    for (const y of shelves)
      for (const z of [-d / 2 + 0.055, d / 2 - 0.065])
        parts.push({
          position: [side * (w / 2 - 0.022), y - 0.014, z],
          size: [0.008, 0.008, 0.012],
        });
    if (hinged)
      for (const y of h > 1.4
        ? [h * 0.15, h * 0.5, h * 0.85]
        : [h * 0.2, h * 0.8]) {
        parts.push({
          position: [side * (w / 2 - 0.021), y, d / 2 - 0.035],
          size: [0.005, 0.045, 0.035],
        });
        parts.push({
          position: [side * (w / 2 - 0.031), y, d / 2 - 0.013],
          size: [0.025, 0.018, 0.022],
        });
      }
    for (const y of drawerHeights)
      parts.push({
        position: [side * (w / 2 - 0.023), y, -0.007],
        size: [0.01, 0.024, Math.min(0.46, d - 0.075)],
      });
  }
  return parts;
}
