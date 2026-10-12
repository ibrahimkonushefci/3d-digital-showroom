import { furnitureResponse } from "./furnitureMaterials";
import { useQuality } from "./quality";
import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { RepeatWrapping, SRGBColorSpace, Vector2, ShaderChunk } from "three";
import { useBrand } from "../brand";
import { useDesigner } from "../designer3d/store";
import type { Material } from "../catalog/types";
export function SurfaceMaterial({
  material,
  repeat = [1, 1],
  world = false,
  lacquer = false,
}: {
  material: Material;
  repeat?: [number, number];
  world?: boolean;
  lacquer?: boolean;
}) {
  const { assetUrl } = useBrand(),
    performance = useQuality() === "lightweight";
  const paths = [
    material.texture,
    ...(!performance ? [material.normalMap, material.roughnessMap] : []),
  ].filter((x): x is string => !!x);
  const loaded = useTexture(paths.map(assetUrl));
  const maps = useMemo(
    () =>
      loaded.map((t, i) => {
        const map = t.clone();
        map.wrapS = map.wrapT = RepeatWrapping;
        map.repeat.set(...repeat);
        map.anisotropy = performance ? 1 : 4;
        if (i === 0 && material.texture) map.colorSpace = SRGBColorSpace;
        return map;
      }),
    [loaded, repeat[0], repeat[1], performance, material.texture],
  );
  useEffect(() => () => maps.forEach((m) => m.dispose()), [maps]);
  const response = furnitureResponse(material);
  const offset = material.texture ? 1 : 0;
  // three.js compiles map usage into the shader and r3f does not flag a
  // recompile when a map appears or disappears, so a plain → textured switch
  // would keep rendering the untextured (white) program. Remount instead.
  const signature = [
    !!material.texture,
    !performance && !!material.normalMap,
    !performance && !!material.roughnessMap,
    lacquer,
    world,
  ].join();
  return (
    <meshPhysicalMaterial
      key={signature}
      map={material.texture ? maps[0] : undefined}
      color={material.texture ? "#ffffff" : material.color}
      normalMap={!performance && material.normalMap ? maps[offset] : undefined}
      normalScale={new Vector2(0.25, 0.25)}
      roughnessMap={
        !(lacquer && !material.texture) && !performance && material.roughnessMap
          ? maps[offset + (material.normalMap ? 1 : 0)]
          : undefined
      }
      roughness={
        world
          ? material.tier === "compact"
            ? 0.64
            : material.tier === "laminate"
              ? 0.48
              : 0.24
          : lacquer
            ? response.roughness
            : material.roughness
      }
      metalness={lacquer ? 0.02 : 0}
      clearcoat={
        world
          ? material.tier === "quartz" || material.tier === "granite"
            ? 0.5
            : 0.08
          : lacquer
            ? response.clearcoat
            : 0
      }
      clearcoatRoughness={world ? 0.25 : response.clearcoatRoughness}
      envMapIntensity={world ? 1.1 : lacquer ? response.envMapIntensity : 0.6}
      onBeforeCompile={
        world
          ? (shader) => {
              shader.vertexShader = shader.vertexShader
                .replace(
                  "#include <common>",
                  "#include <common>\nvarying vec3 slabPosition;",
                )
                .replace(
                  "#include <worldpos_vertex>",
                  "#include <worldpos_vertex>\nslabPosition=(modelMatrix*vec4(transformed,1.0)).xyz;",
                );
              shader.fragmentShader = shader.fragmentShader
                .replace(
                  "#include <common>",
                  "#include <common>\nvarying vec3 slabPosition;",
                )
                .replace(
                  "#include <map_fragment>",
                  "#ifdef USE_MAP\nvec4 sampledDiffuseColor = texture2D(map,slabPosition.xz*.4);\ndiffuseColor *= sampledDiffuseColor;\n#endif",
                )
                .replace(
                  "#include <normal_fragment_maps>",
                  ShaderChunk.normal_fragment_maps.replaceAll(
                    "vNormalMapUv",
                    "(slabPosition.xz*.4)",
                  ),
                )
                .replace(
                  "#include <roughnessmap_fragment>",
                  ShaderChunk.roughnessmap_fragment.replaceAll(
                    "vRoughnessMapUv",
                    "(slabPosition.xz*.4)",
                  ),
                );
            }
          : undefined
      }
    />
  );
}
