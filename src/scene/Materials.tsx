import { applyCavity, type Cavity } from "./lighting/InteriorOcclusion";
import { furnitureResponse } from "./furnitureMaterials";
import { useQuality } from "./quality";
import { useLoader } from "@react-three/fiber";
import {
  RepeatWrapping,
  SRGBColorSpace,
  NoColorSpace,
  Vector2,
  ShaderChunk,
  TextureLoader,
} from "three";
import { useBrand } from "../brand";
import { ResourceCache, useSharedResource } from "./resources";
import type { Texture } from "three";
const surfaceMaps = new ResourceCache<{ maps: Texture[]; dispose(): void }>();
import type { Material } from "../catalog/types";
export function SurfaceMaterial({
  cavity,
  material,
  repeat = [1, 1],
  world = false,
  lacquer = false,
}: {
  cavity?: Cavity;
  material: Material;
  repeat?: [number, number];
  world?: boolean;
  lacquer?: boolean;
}) {
  const { assetUrl } = useBrand(),
    performance = useQuality() === "lightweight";
  const paths = [
    material.texture,
    ...(!performance
      ? [material.normalMap, material.roughnessMap, material.aoMap]
      : []),
  ].filter((x): x is string => !!x);
  // drei useTexture eagerly uploads the unconfigured source as well as our
  // immutable configured variant. Decode via R3F; only the shared variant uploads.
  const loaded = useLoader(TextureLoader, paths.map(assetUrl));
  const pack = useSharedResource(
    surfaceMaps,
    JSON.stringify([
      loaded.map((t) => t.uuid),
      repeat,
      performance,
      !!material.texture,
      paths,
    ]),
    () => {
      const maps = loaded.map((t, i) => {
        const map = t.clone();
        map.wrapS = map.wrapT = RepeatWrapping;
        map.repeat.set(...repeat);
        map.anisotropy = performance ? 1 : 4;
        map.colorSpace =
          i === 0 && material.texture ? SRGBColorSpace : NoColorSpace;
        if (paths[i] === material.aoMap) map.channel = 1;
        return map;
      });
      return { maps, dispose: () => maps.forEach((m) => m.dispose()) };
    },
  );
  const maps = pack?.maps || [];
  const response = furnitureResponse(material);
  const offset = material.texture ? 1 : 0;
  // three.js compiles map usage into the shader and r3f does not flag a
  // recompile when a map appears or disappears, so a plain → textured switch
  // would keep rendering the untextured (white) program. Remount instead.
  const signature = [
    !!pack,
    !!material.texture,
    !performance && !!material.normalMap,
    !performance && !!material.roughnessMap,
    lacquer,
    world,
    !!material.mapping,
    !!material.aoMap,
  ].join();
  return (
    <meshPhysicalMaterial
      key={signature}
      map={material.texture ? maps[0] : undefined}
      color={material.texture ? "#ffffff" : material.color}
      normalMap={!performance && material.normalMap ? maps[offset] : undefined}
      normalScale={
        new Vector2(response.normalStrength, response.normalStrength)
      }
      aoMap={
        !performance && material.aoMap
          ? maps[
              offset +
                (material.normalMap ? 1 : 0) +
                (material.roughnessMap ? 1 : 0)
            ]
          : undefined
      }
      roughnessMap={
        (material.response || !(lacquer && !material.texture)) &&
        !performance &&
        material.roughnessMap
          ? maps[offset + (material.normalMap ? 1 : 0)]
          : undefined
      }
      roughness={
        material.response
          ? response.roughness
          : world
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
        material.response
          ? response.clearcoat
          : world
            ? material.tier === "quartz" || material.tier === "granite"
              ? 0.5
              : 0.08
            : lacquer
              ? response.clearcoat
              : 0
      }
      clearcoatRoughness={
        material.response
          ? response.clearcoatRoughness
          : world
            ? 0.25
            : response.clearcoatRoughness
      }
      envMapIntensity={
        material.response
          ? response.envMapIntensity
          : world
            ? 1.1
            : lacquer
              ? response.envMapIntensity
              : 0.6
      }
      customProgramCacheKey={() =>
        JSON.stringify(["physical-v2", world, !!material.mapping, cavity])
      }
      onBeforeCompile={(shader) => {
        if (cavity) applyCavity(shader, cavity);
        if (world && !material.mapping) {
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
      }}
    />
  );
}
