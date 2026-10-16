import { beginCapture } from "../pwa/busy";
import { environmentPending } from "./lighting/RoomEnvironment";
import { useEffect, useRef, useState, memo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useProgress } from "@react-three/drei";
import { ACESFilmicToneMapping, SRGBColorSpace, Vector2 } from "three";
import {
  aoScale,
  aoShouldPause,
  qualityForFrames,
  useQuality,
  useRenderQuality,
} from "./quality";
import { activityRevision, motionBoundary } from "./activity";
import { useContactTargetOwnership } from "./resources";
import { pendingModelLoads } from "./assets/ModelAsset";
import { RenderPipeline } from "./pipeline/RenderPipeline";
import { installSmoothShadows } from "./pipeline/smoothShadows";
import { prepareFrame, warmupPending } from "./pipeline/shaderWarmup";
import { bakePending } from "./bake/ShellBakeDriver";
import type { ShellBakeUniforms } from "./bake/shellBake";
import type { Group, Mesh, MeshBasicMaterial } from "three";
// Before any material compiles: shadow edges without stair-stepped copies.
installSmoothShadows();
export type CaptureImage = () => Promise<string>;
export type RegisterCapture = (capture: CaptureImage) => void;
export const showroomGL = {
  antialias: true,
  preserveDrawingBuffer: false,
  toneMapping: ACESFilmicToneMapping,
  outputColorSpace: SRGBColorSpace,
  toneMappingExposure: 0.98,
};
const pendingContacts = new WeakSet<import("three").Scene>();
const CONTACT_OPACITY = 0.28;
function OwnedContactShadows({
  scale,
  bake,
  revision,
}: {
  scale: number;
  bake?: ShellBakeUniforms;
  /** A new value re-renders, and so redraws, the shadows. */
  revision: string;
}) {
  useContactTargetOwnership();
  // A baked floor already holds its contact shadows: fade these with it.
  const group = useRef<Group>(null);
  useFrame(() => {
    const plane = group.current?.children.find((o) => (o as Mesh).isMesh) as
      Mesh<never, MeshBasicMaterial> | undefined;
    if (plane)
      plane.material.opacity =
        CONTACT_OPACITY * (1 - (bake?.bakeWeight.value ?? 0));
  });
  return (
    <ContactShadows
      ref={group}
      position={[0, 0.001, 0]}
      opacity={CONTACT_OPACITY}
      scale={scale}
      blur={2.5}
      far={1.2}
      frames={1}
      resolution={256}
    />
  );
}
export const RefreshShadows = memo(
  function RefreshShadows({
    revision,
    scale = 12,
    bake,
  }: {
    revision: unknown;
    scale?: number;
    bake?: ShellBakeUniforms;
  }) {
    const quality = useQuality();
    const { scene } = useThree();
    // Contact depth is static presentation work, never a 90-frame motion pass.
    // Wait for the current opening animation/load before recomputing it.
    const [settled, setSettled] = useState(false);
    const [shown, setShown] = useState<string | null>(null);
    useEffect(() => {
      setSettled(false);
      if (quality !== "lightweight") pendingContacts.add(scene);
      const timer = setTimeout(() => {
        setSettled(true);
        setShown(JSON.stringify(revision));
        pendingContacts.delete(scene);
      }, 800);
      return () => {
        clearTimeout(timer);
        pendingContacts.delete(scene);
      };
    }, [revision, quality, scene]);
    // One instance, hidden while things move and re-rendered (drei redraws
    // its frames on every render) once they settle. Remounting it freed its
    // shaders and re-linked them on the spot: a ~60 ms stall after each
    // front opened or closed.
    return quality === "lightweight" || shown === null ? null : (
      <group visible={settled}>
        <OwnedContactShadows revision={shown} scale={scale} bake={bake} />
      </group>
    );
  },
  (a, b) =>
    a.scale === b.scale &&
    a.bake === b.bake &&
    JSON.stringify(a.revision) === JSON.stringify(b.revision),
);
export function Rendering({
  capture,
  lockQuality = false,
  fullAO = false,
}: {
  capture?: RegisterCapture;
  lockQuality?: boolean;
  /** Presentation-only scenes (offer page, Home, Material Switcher) draw few
   * frames, so they keep full-resolution AO; the designer uses the quality's. */
  fullAO?: boolean;
}) {
  const { gl, scene, camera, invalidate, setDpr, advance } = useThree();
  const quality = useQuality();
  const frames = useRef<number[]>([]),
    exporting = useRef(false),
    motion = useRef({ signature: NaN, active: false, boundary: 0 });
  useEffect(() => {
    setDpr(
      quality === "lightweight"
        ? 1
        : Math.min(window.devicePixelRatio, quality === "high" ? 1.75 : 1.5),
    );
    invalidate();
  }, [quality, gl, setDpr, invalidate]);
  // Balanced/high share one AO pipeline with every capture; lightweight
  // keeps the direct render.
  const pipeline = useRef<RenderPipeline | null>(null);
  const aoPaused = useRenderQuality((s) => s.aoPaused);
  useEffect(() => {
    if (quality === "lightweight") return;
    const next = new RenderPipeline(
      gl,
      scene,
      camera,
      fullAO ? 1 : aoScale(quality),
    );
    pipeline.current = next;
    invalidate();
    return () => {
      if (pipeline.current === next) pipeline.current = null;
      next.dispose();
    };
  }, [gl, scene, camera, quality, invalidate, fullAO]);
  useEffect(() => {
    pipeline.current?.setAO(!aoPaused);
    invalidate();
  }, [aoPaused, quality, fullAO, invalidate]);
  useEffect(() => {
    // The info-log reads force every program to finish linking on the spot;
    // production relies on the background warm-up instead.
    gl.debug.checkShaderErrors = import.meta.env.DEV;
  }, [gl]);
  const render = () => {
    const target = pipeline.current?.sceneTarget ?? null;
    if (!prepareFrame(gl, scene, camera, invalidate, target)) return;
    if (pipeline.current) pipeline.current.render();
    else gl.render(scene, camera);
  };
  useFrame((_, dt) => {
    if (!exporting.current) {
      // Constant-size camera sample plus explicit furniture-animation activity.
      let signature = 0,
        index = 1;
      const measure = (o: import("three").Object3D) => {
        signature +=
          (o.position.x +
            o.position.y * 3 +
            o.position.z * 7 +
            o.quaternion.x * 11 +
            o.quaternion.y * 13 +
            o.quaternion.z * 17 +
            o.quaternion.w * 19) *
          index++;
      };
      measure(camera);
      signature += activityRevision(scene) * 23;
      const active = Math.abs(signature - motion.current.signature) > 1e-7;
      const boundary = motionBoundary(scene);
      if (
        active &&
        motion.current.active &&
        boundary === motion.current.boundary &&
        dt > 0 &&
        !document.hidden
      )
        frames.current.push(dt * 1000);
      else if (!active) frames.current = [];
      motion.current = { signature, active, boundary };
      if (frames.current.length >= 120) {
        if (
          !lockQuality &&
          aoShouldPause(quality, frames.current) &&
          !useRenderQuality.getState().aoPaused
        )
          useRenderQuality.getState().pauseAO();
        const next = qualityForFrames(quality, frames.current);
        frames.current = [];
        if (!lockQuality && next !== quality)
          useRenderQuality.getState().setLevel(next);
      }
    }
    if (!document.hidden && !gl.getContext().isContextLost()) render();
  }, 1);
  useEffect(() => {
    let live = true;
    capture?.(async () => {
      if (!live || exporting.current) throw Error("Capture unavailable");
      if (gl.getContext().isContextLost()) throw Error("Context lost");
      const endCapture = beginCapture();
      exporting.current = true;
      const hidden: Array<import("three").Object3D> = [];
      let restoreAO = () => {};
      const oldSize = gl.getSize(new Vector2()),
        dpr = gl.getPixelRatio();
      try {
        // Wait for textures and animated transforms to settle, with a bounded failure.
        let previous = "",
          stable = 0;
        for (let i = 0; i < 100; i++) {
          if (!live) throw Error("Scene unmounted");
          invalidate();
          await new Promise((resolve) => setTimeout(resolve, 50));
          const transforms: number[] = [...camera.matrixWorld.elements];
          scene.traverse((o) =>
            transforms.push(...o.position.toArray(), ...o.quaternion.toArray()),
          );
          const key = transforms.map((n) => n.toFixed(3)).join(",");
          stable =
            !useProgress.getState().active &&
            !pendingModelLoads() &&
            !pendingContacts.has(scene) &&
            !environmentPending(scene) &&
            !warmupPending(scene) &&
            !bakePending(scene) &&
            key === previous
              ? stable + 1
              : 0;
          previous = key;
          if (stable >= 4) break;
          if (i === 99) throw Error("Scene still loading");
        }
        scene.traverse((o) => {
          if (o.visible && o.userData.exportHidden) {
            hidden.push(o);
            o.visible = false;
          }
        });
        // A still has no frame budget: full-resolution AO (and AO even if it
        // was paused for live motion), so offer and A/B images stay clean.
        const still = pipeline.current;
        const liveScale = still?.aoScale;
        still?.setAOScale(1);
        still?.setAO(true);
        restoreAO = () => {
          if (liveScale !== undefined) still?.setAOScale(liveScale);
          still?.setAO(!useRenderQuality.getState().aoPaused);
        };
        const ratio = 1600 / Math.max(oldSize.x, oldSize.y);
        gl.setPixelRatio(1);
        gl.setSize(
          Math.round(oldSize.x * ratio),
          Math.round(oldSize.y * ratio),
          false,
        );
        // Run one complete frame rather than a bare render, so camera controls,
        // wall cut-aways and animations are applied even when no frame has run
        // since they changed (a background tab, or a capture right after load).
        advance(performance.now());
        return gl.domElement.toDataURL("image/png");
      } finally {
        restoreAO();
        hidden.forEach((o) => (o.visible = true));
        gl.setPixelRatio(dpr);
        gl.setSize(oldSize.x, oldSize.y, false);
        exporting.current = false;
        endCapture();
        invalidate();
      }
    });
    return () => {
      live = false;
    };
  }, [capture, gl, camera, scene, invalidate, advance]);
  return null;
}
