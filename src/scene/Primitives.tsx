import {
  useInteriorOcclusion,
  type Cavity,
} from "./lighting/InteriorOcclusion";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Suspense, createContext, useContext } from "react";
import { BoxGeometry, type BufferGeometry } from "three";
import { mapPanelGeometry, panelOffset, type Grain } from "./materialMapping";
import { Edges } from "@react-three/drei";
import type { Material } from "../catalog/types";
import { furnitureResponse } from "./furnitureMaterials";
import { SurfaceMaterial } from "./Materials";
import { ResourceCache, useSharedResource } from "./resources";
const bevelCache = new ResourceCache<BufferGeometry>();
export const PanelMapping = createContext({ cabinetId: "room", role: "panel" });
type BoxProps = {
  cavity?: Cavity;
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
  panelRole?: string;
  grain?: Grain;
  decorative?: boolean;
};
export function Box({
  cavity,
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
  panelRole,
  grain,
  decorative = false,
}: BoxProps) {
  const occlusion = useInteriorOcclusion(cavity);
  bevel = bevel || (lacquer ? 0.0015 : 0);
  const response = material
    ? furnitureResponse(material)
    : {
        roughness: 0.4,
        clearcoat: 0.35,
        clearcoatRoughness: 0.35,
        envMapIntensity: 0.6,
      };
  const identity = useContext(PanelMapping);
  const mapping = material?.mapping;
  const role =
    identity.role + ":" + (panelRole || [...position, ...size].join(":"));
  const offset =
    mapping?.variation === "stable-offset"
      ? panelOffset(identity.cabinetId, role)
      : ([0, 0] as [number, number]);
  const radius = Math.min(bevel, ...size.map((n) => n / 3));
  const geometry = useSharedResource(
    bevelCache,
    JSON.stringify([size, radius, mapping, offset, grain, !!material?.aoMap]),
    () => {
      const g =
        radius > 0
          ? new RoundedBoxGeometry(...size, 1, radius)
          : new BoxGeometry(...size);
      if (mapping)
        return mapPanelGeometry(g, size, radius, mapping, offset, grain);
      if (material?.aoMap) g.setAttribute("uv1", g.getAttribute("uv").clone());
      return g;
    },
  );
  return (
    <mesh
      position={position}
      castShadow={castShadow}
      receiveShadow
      raycast={decorative ? () => {} : undefined}
    >
      {geometry ? (
        <primitive object={geometry} attach="geometry" />
      ) : (
        <boxGeometry args={size} />
      )}
      {material &&
      (material.texture ||
        material.normalMap ||
        material.roughnessMap ||
        material.aoMap) ? (
        <Suspense
          fallback={
            <meshPhysicalMaterial
              {...occlusion}
              color={material.color}
              roughness={
                material.response || lacquer
                  ? response.roughness
                  : material.roughness
              }
              metalness={lacquer ? 0.02 : metal}
              clearcoat={material.response || lacquer ? response.clearcoat : 0}
              clearcoatRoughness={response.clearcoatRoughness}
              envMapIntensity={
                material.response ? response.envMapIntensity : lacquer ? 1 : 0.6
              }
            />
          }
        >
          <SurfaceMaterial
            cavity={cavity}
            material={material}
            world={world}
            lacquer={lacquer}
          />
        </Suspense>
      ) : (
        <meshPhysicalMaterial
          {...occlusion}
          color={material?.color || color}
          roughness={
            material?.response || lacquer
              ? response.roughness
              : (roughness ?? material?.roughness ?? 0.65)
          }
          metalness={lacquer ? 0.02 : metal}
          clearcoat={material?.response || lacquer ? response.clearcoat : 0}
          clearcoatRoughness={response.clearcoatRoughness}
          envMapIntensity={
            material?.response ? response.envMapIntensity : lacquer ? 1 : 0.6
          }
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
