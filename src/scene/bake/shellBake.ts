import { createContext } from "react";
import {
  Vector3,
  Vector4,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import manifest from "../../../public/shared/bakes/manifest.json";

/**
 * Phase 3 baked room lighting.
 *
 * The five prepared designs ship a Cycles lightmap of their room shell
 * (floor, ceiling, walls): sun and sky through the window, the interior key,
 * downlights and LED runs, with every bounce and the furniture's shadows.
 * The shell materials replace their live diffuse lighting with it, weighted
 * by `bakeWeight`. Specular (reflections, the floor's sheen) stays live.
 *
 * There is no lightmap UV: the shader finds the surface from the world
 * position and normal and projects into the atlas, so the procedural walls
 * (any openings, the stance extensions) need no geometry changes. Fragments
 * that are not on one of the six room planes (window reveals, wall edges)
 * keep their live lighting.
 */
export type BakeEntry = {
  preset: string;
  file: string;
  bytes: number;
  /** Atlas rects [x, y, w, h] (0-1) for floor, ceiling, back, front, left, right. */
  rects: Record<string, [number, number, number, number]>;
  room: [number, number, number];
  encodeMax: number;
  gamma: number;
  gain: number;
};
export const BAKES = (
  manifest as unknown as { bakes: Record<string, BakeEntry> }
).bakes;
export const SURFACES = [
  "floor",
  "ceiling",
  "back",
  "front",
  "left",
  "right",
] as const;
/** Crossfade between baked and live lighting, seconds (plan: ~300 ms). */
export const BAKE_FADE_S = 0.3;

export type ShellBakeUniforms = {
  bakeMap: { value: Texture | null };
  bakeWeight: { value: number };
  bakeScale: { value: number };
  bakeRects: { value: Vector4[] };
  bakeRoom: { value: Vector3 };
  bakeOrigin: { value: Vector3 };
};
export function shellBakeUniforms(): ShellBakeUniforms {
  return {
    bakeMap: { value: null },
    bakeWeight: { value: 0 },
    bakeScale: { value: 1 },
    bakeRects: { value: SURFACES.map(() => new Vector4(0, 0, 1, 1)) },
    bakeRoom: { value: new Vector3(1, 1, 1) },
    bakeOrigin: { value: new Vector3() },
  };
}
/** One uniform set per scene, shared by every shell material in it. */
export const ShellBake = createContext<ShellBakeUniforms | null>(null);
export const SHELL_BAKE_KEY = "shell-bake-v1";

const FRAGMENT_HEAD = /* glsl */ `
uniform sampler2D bakeMap;
uniform float bakeWeight;
uniform float bakeScale;
uniform vec4 bakeRects[6];
uniform vec3 bakeRoom;
uniform vec3 bakeOrigin;
varying vec3 vBakeWorld;
varying vec3 vBakeNormal;
// Baked irradiance (three.js units) and whether this fragment lies on a room
// plane. Skirting faces sit 6 cm proud of the wall and still read the wall.
vec4 shellBake() {
  vec3 p = vBakeWorld - bakeOrigin;
  vec3 n = normalize(vBakeNormal);
  const float near = 0.075;
  int i = -1;
  vec2 uv;
  if (n.y > 0.5 && abs(p.y) < near) { i = 0; uv = p.xz / bakeRoom.xz; }
  else if (n.y < -0.5 && abs(p.y - bakeRoom.y) < near) { i = 1; uv = p.xz / bakeRoom.xz; }
  else if (n.z > 0.5 && abs(p.z) < near) { i = 2; uv = p.xy / bakeRoom.xy; }
  else if (n.z < -0.5 && abs(p.z - bakeRoom.z) < near) { i = 3; uv = p.xy / bakeRoom.xy; }
  else if (n.x > 0.5 && abs(p.x) < near) { i = 4; uv = p.zy / bakeRoom.zy; }
  else if (n.x < -0.5 && abs(p.x - bakeRoom.x) < near) { i = 5; uv = p.zy / bakeRoom.zy; }
  if (i < 0) return vec4(0.0);
  vec4 r = bakeRects[i];
  // Clamped inside its own rect: atlas neighbours never bleed in, and the
  // stance walls beyond the room continue the edge of their wall.
  vec2 texel = 1.5 / vec2(textureSize(bakeMap, 0));
  vec2 st = clamp(r.xy + clamp(uv, 0.0, 1.0) * r.zw, r.xy + texel, r.xy + r.zw - texel);
  return vec4(pow(texture2D(bakeMap, st).rgb, vec3(2.2)) * bakeScale, 1.0);
}
`;

/** onBeforeCompile step for floor, wall, skirting and ceiling materials. */
export function applyShellBake(
  shader: WebGLProgramParametersWithUniforms,
  uniforms: ShellBakeUniforms,
) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      "#include <common>\nvarying vec3 vBakeWorld;\nvarying vec3 vBakeNormal;",
    )
    .replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
      vBakeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vBakeNormal = mat3(modelMatrix) * objectNormal;`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\n" + FRAGMENT_HEAD)
    .replace(
      "#include <opaque_fragment>",
      `if (bakeWeight > 0.0) {
        vec4 baked = shellBake();
        // Live diffuse (and the ceiling's fake-bounce glow) out, baked in.
        vec3 bakedDiffuse = material.diffuseColor * baked.rgb * RECIPROCAL_PI;
        outgoingLight += (bakedDiffuse - totalDiffuse - totalEmissiveRadiance) * bakeWeight * baked.a;
      }
      #include <opaque_fragment>`,
    );
}

/** Points the shared uniforms at a loaded bake. The room size comes from
 * the bake itself, so a fade-out after a resize still lines up. */
export function applyBakeEntry(
  uniforms: ShellBakeUniforms,
  entry: BakeEntry,
  texture: Texture,
) {
  const [w, h, d] = entry.room;
  uniforms.bakeMap.value = texture;
  uniforms.bakeScale.value = entry.encodeMax * entry.gain;
  SURFACES.forEach((s, i) =>
    uniforms.bakeRects.value[i].set(...entry.rects[s]),
  );
  uniforms.bakeRoom.value.set(w, h, d);
  // The room group sits at (-w/2, 0, -d/2); see Scene.tsx.
  uniforms.bakeOrigin.value.set(-w / 2, 0, -d / 2);
}
