import { useMemo } from "react";
import { Vector3, type WebGLProgramParametersWithUniforms } from "three";
export type Cavity = {
  size: [number, number, number];
  shelves: readonly number[];
  offset?: [number, number, number];
};
/** Stationary cavity only. No door/drawer pose participates in this field. */
export function cavityContrast([x, y, z]: number[], cavity: Cavity): number {
  const [w, h, d] = cavity.size;
  if (
    Math.abs(x) > w / 2 - 0.016 ||
    y < 0.016 ||
    y > h - 0.016 ||
    z > d / 2 - 0.035
  )
    return 1;
  const rear = Math.max(0, Math.min(1, (d / 2 - 0.035 - z) / (d - 0.07)));
  const distance = Math.min(
    w / 2 - Math.abs(x),
    y,
    h - y,
    ...cavity.shelves.map((s) => Math.abs(y - s)),
  );
  const contact = 1 - Math.max(0, Math.min(1, distance / 0.07));
  return Math.max(0.6, 1 - 0.22 * rear - 0.18 * contact * (0.35 + 0.65 * rear));
}
/** r180 shader boundary: modulate indirect diffuse/specular after AO, never base color or direct light. */
export function applyCavity(
  shader: WebGLProgramParametersWithUniforms,
  cavity: Cavity,
) {
  shader.uniforms.cavitySize = { value: new Vector3(...cavity.size) };
  shader.uniforms.cavityOffset = {
    value: new Vector3(...(cavity.offset || [0, 0, 0])),
  };
  shader.uniforms.cavityShelves = { value: [...cavity.shelves] };
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      "#include <common>\nuniform vec3 cavityOffset; varying vec3 cavityPosition;",
    )
    .replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\ncavityPosition = transformed + cavityOffset;",
    );
  const count = cavity.shelves.length;
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>\nuniform vec3 cavitySize; varying vec3 cavityPosition; ${count ? `uniform float cavityShelves[${count}];` : ""}`,
    )
    .replace(
      "#include <aomap_fragment>",
      `#include <aomap_fragment>
      vec3 cp = cavityPosition;
      if (abs(cp.x) <= cavitySize.x * 0.5 - 0.016 && cp.y >= 0.016 && cp.y <= cavitySize.y - 0.016 && cp.z <= cavitySize.z * 0.5 - 0.035) {
        float rear = clamp((cavitySize.z * 0.5 - 0.035 - cp.z) / max(0.01, cavitySize.z - 0.07), 0.0, 1.0);
        float gap = min(cavitySize.x * 0.5 - abs(cp.x), min(cp.y, cavitySize.y - cp.y));
        ${Array.from({ length: count }, (_, i) => `gap = min(gap, abs(cp.y - cavityShelves[${i}]));`).join("\n")}
        float contact = 1.0 - clamp(gap / 0.07, 0.0, 1.0);
        float cavityAO = max(0.6, 1.0 - 0.22 * rear - 0.18 * contact * (0.35 + 0.65 * rear));
        reflectedLight.indirectDiffuse *= cavityAO;
        reflectedLight.indirectSpecular *= cavityAO;
      }
    `,
    );
}
export function useInteriorOcclusion(cavity?: Cavity) {
  const signature = JSON.stringify(cavity);
  return useMemo(
    () => ({
      onBeforeCompile: cavity
        ? (shader: WebGLProgramParametersWithUniforms) =>
            applyCavity(shader, cavity)
        : undefined,
      customProgramCacheKey: () => `cavity-v1:${signature || "none"}`,
    }),
    [signature],
  );
}
