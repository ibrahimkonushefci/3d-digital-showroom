import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  LinearMipmapLinearFilter,
  NoColorSpace,
  TextureLoader,
  type Scene,
  type Texture,
} from "three";
import type { DesignDocument } from "../../catalog/types";
import { useBrand } from "../../brand";
import { bakeSignature } from "./signature";
import {
  applyBakeEntry,
  BAKE_FADE_S,
  BAKES,
  type BakeEntry,
  type ShellBakeUniforms,
} from "./shellBake";

const busy = new WeakSet<Scene>();
/** A lightmap is loading or the crossfade is running (captures wait). */
export const bakePending = (scene: Scene) => busy.has(scene);

/**
 * Keeps the scene's shell lightmap in step with the design: the prepared
 * designs open baked; any structural edit (a cabinet moved, added or resized,
 * the room or its openings changed) fades back to live lighting over 300 ms,
 * and undoing it fades the bake back in. Finish changes keep the bake.
 */
export function ShellBakeDriver({
  design,
  uniforms,
}: {
  design: DesignDocument;
  uniforms: ShellBakeUniforms;
}) {
  const { scene, invalidate } = useThree();
  const { assetUrl, catalog } = useBrand();
  const signature = bakeSignature(design, catalog);
  const entry: BakeEntry | undefined = BAKES[signature];
  const state = useRef<{
    wanted: { signature: string; texture: Texture; entry: BakeEntry } | null;
    shown: Texture | null;
    textures: Map<string, Texture>;
    failed: Set<string>;
    everShown: boolean;
  }>({
    wanted: null,
    shown: null,
    textures: new Map(),
    failed: new Set(),
    everShown: false,
  });
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);
  useEffect(() => {
    const s = state.current;
    s.wanted = null;
    if (!entry) {
      invalidate();
      return;
    }
    const cached = s.textures.get(signature);
    if (cached) {
      s.wanted = { signature, texture: cached, entry };
      invalidate();
      return;
    }
    let live = true;
    busy.add(scene);
    new TextureLoader().load(
      assetUrl(`shared/bakes/${entry.file}`),
      (texture) => {
        texture.colorSpace = NoColorSpace;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.anisotropy = 4;
        s.textures.set(signature, texture);
        if (live) s.wanted = { signature, texture, entry };
        invalidate();
      },
      undefined,
      () => {
        // A missing lightmap just keeps the live lighting.
        s.failed.add(signature);
        busy.delete(scene);
      },
    );
    return () => {
      live = false;
    };
  }, [signature, entry, assetUrl, scene, invalidate]);
  useEffect(() => {
    const s = state.current;
    return () => {
      s.textures.forEach((t) => t.dispose());
      s.textures.clear();
      busy.delete(scene);
      uniforms.bakeMap.value = null;
      uniforms.bakeWeight.value = 0;
    };
  }, [scene, uniforms]);
  useFrame((_, dt) => {
    const s = state.current,
      weight = uniforms.bakeWeight;
    if (s.wanted && s.shown !== s.wanted.texture && weight.value === 0) {
      applyBakeEntry(uniforms, s.wanted.entry, s.wanted.texture);
      s.shown = s.wanted.texture;
      // The opening view starts baked; only later changes crossfade.
      if (!s.everShown) weight.value = 1;
      s.everShown = true;
    }
    let target = s.wanted && s.shown === s.wanted.texture ? 1 : 0;
    // DEV: calibration and before/after captures force a weight.
    if (import.meta.env.DEV) {
      const dev = window as unknown as {
        __bakeForce?: number;
        __shellBake?: unknown;
      };
      dev.__shellBake = { uniforms, scene, invalidate, signature, entry };
      if (typeof dev.__bakeForce === "number" && s.shown)
        target = dev.__bakeForce;
    }
    if (weight.value !== target) {
      const step = reduced.current ? 1 : Math.min(dt, 0.05) / BAKE_FADE_S;
      weight.value =
        target > weight.value
          ? Math.min(target, weight.value + step)
          : Math.max(target, weight.value - step);
      invalidate();
    }
    const settled =
      weight.value === target &&
      (!entry || !!s.wanted || s.failed.has(signature));
    if (settled) busy.delete(scene);
    else busy.add(scene);
  });
  return null;
}
