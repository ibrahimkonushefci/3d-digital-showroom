import { useInteriorOcclusion } from "./lighting/InteriorOcclusion";
import { Suspense, useMemo } from "react";
import { BoxGeometry, type BufferGeometry } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Material } from "../catalog/types";
import { mapPanelGeometry, panelOffset } from "./materialMapping";
import { construction } from "./construction";
import { SurfaceMaterial } from "./Materials";
import { furnitureResponse } from "./furnitureMaterials";
import { ResourceCache, useSharedResource } from "./resources";
export type ShellPanel = {
  role: string;
  grain: "horizontal" | "vertical";
  size: [number, number, number];
  position: [number, number, number];
};
export function shellPanels(
  w: number,
  h: number,
  d: number,
  sink = false,
): ShellPanel[] {
  return [
    {
      role: "bottom",
      grain: "horizontal",
      size: [w, 0.018, d - 0.025],
      position: [0, 0.009, 0],
    },
    ...(sink
      ? []
      : [
          {
            role: "top",
            grain: "horizontal" as const,
            size: [w, 0.018, d - 0.025] as [number, number, number],
            position: [0, h - 0.009, 0] as [number, number, number],
          },
        ]),
    {
      role: "back",
      grain: "vertical",
      size: [w - 0.036, h - 0.036, construction.back],
      position: [0, h / 2, -d / 2 + construction.backInset],
    },
    ...[-1, 1].map((n) => ({
      role: "side-" + n,
      grain: "vertical" as const,
      size: [0.018, h, d - 0.018] as [number, number, number],
      position: [n * (w / 2 - 0.009), h / 2, 0] as [number, number, number],
    })),
  ];
}
/** Same physical panels/UV roles as Phase 1, one draw per carcass material. */
export function shellGeometry(
  panels: ShellPanel[],
  material: Material,
  cabinetId: string,
) {
  const parts = panels.map((p) => {
    const radius = Math.min(0.0008, ...p.size.map((n) => n / 3));
    let g: BufferGeometry = new RoundedBoxGeometry(...p.size, 1, radius);
    if (material.mapping)
      mapPanelGeometry(
        g,
        p.size,
        radius,
        material.mapping,
        material.mapping.variation === "stable-offset"
          ? panelOffset(cabinetId, "carcass:" + p.role)
          : [0, 0],
        p.grain,
      );
    if (!g.getAttribute("uv1"))
      g.setAttribute("uv1", g.getAttribute("uv").clone());
    if (g.index) {
      const source = g;
      g = g.toNonIndexed();
      source.dispose();
    }
    g.clearGroups();
    g.translate(...p.position);
    return g;
  });
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  return merged;
}
const cache = new ResourceCache<BufferGeometry>();
export function CabinetShell({
  w,
  h,
  d,
  sink,
  material,
  cabinetId,
  shelves,
}: {
  w: number;
  h: number;
  d: number;
  sink: boolean;
  material: Material;
  cabinetId: string;
  shelves: readonly number[];
}) {
  const occlusion = useInteriorOcclusion({ size: [w, h, d], shelves });
  const panels = useMemo(() => shellPanels(w, h, d, sink), [w, h, d, sink]);
  const geometry = useSharedResource(
    cache,
    JSON.stringify([panels, material.mapping, !!material.aoMap, cabinetId]),
    () => shellGeometry(panels, material, cabinetId),
  );
  const r = furnitureResponse(material),
    fallback = (
      <meshPhysicalMaterial
        {...occlusion}
        color={material.color}
        roughness={material.response ? r.roughness : material.roughness}
        clearcoat={material.response ? r.clearcoat : 0}
        clearcoatRoughness={r.clearcoatRoughness}
        envMapIntensity={material.response ? r.envMapIntensity : 0.6}
      />
    );
  return geometry ? (
    <mesh castShadow receiveShadow>
      <primitive object={geometry} attach="geometry" />
      {material.texture ||
      material.normalMap ||
      material.roughnessMap ||
      material.aoMap ? (
        <Suspense fallback={fallback}>
          <SurfaceMaterial
            material={material}
            cavity={{ size: [w, h, d], shelves }}
          />
        </Suspense>
      ) : (
        fallback
      )}
    </mesh>
  ) : null;
}
