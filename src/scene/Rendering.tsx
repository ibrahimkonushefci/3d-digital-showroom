import { beginCapture } from "../pwa/busy";
import { environmentPending } from "./lighting/RoomEnvironment";
import { useEffect, useRef, useState, memo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useProgress } from "@react-three/drei";
import { ACESFilmicToneMapping, SRGBColorSpace, Vector2 } from "three";
import { MOTION_SETTLE_MS, pixelRatios, useQuality } from "./quality";
import { activityRevision } from "./activity";
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
  // Window openings mark the garden backdrop's area (RoomShell).
  stencil: true,
  preserveDrawingBuffer: false,
  toneMapping: ACESFilmicToneMapping,
  outputColorSpace: SRGBColorSpace,
  toneMappingExposure: 0.98,
};
const pendingContacts = new WeakSet<import("three").Scene>();
export const contactsPending = (scene: import("three").Scene) =>
  pendingContacts.has(scene);
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
    // The first draw happens behind the loading cue, with nothing moving yet.
    const first = useRef(true);
    useEffect(() => {
      setSettled(false);
      if (quality !== "lightweight") pendingContacts.add(scene);
      const timer = setTimeout(
        () => {
          setSettled(true);
          setShown(JSON.stringify(revision));
          pendingContacts.delete(scene);
        },
        first.current ? 0 : 800,
      );
      first.current = false;
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
export function Rendering({ capture }: { capture?: RegisterCapture }) {
  const { gl, scene, camera, invalidate, setDpr, advance } = useThree();
  const quality = useQuality();
  const ratios = pixelRatios(quality);
  const exporting = useRef(false),
    motion = useRef({ signature: NaN, last: -Infinity }),
    settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    setDpr(ratios.still);
    invalidate();
  }, [ratios.still, gl, setDpr, invalidate]);
  // Balanced/high share the AO pipeline with every capture; lightweight
  // keeps the direct render. A second pipeline at the lighter motion ratio
  // draws while the view moves; both stay allocated, so switching is free.
  const pipeline = useRef<RenderPipeline | null>(null);
  const motionPipeline = useRef<RenderPipeline | null>(null);
  useEffect(() => {
    if (quality === "lightweight") return;
    const still = new RenderPipeline(gl, scene, camera);
    const moving =
      ratios.motion < ratios.still
        ? new RenderPipeline(gl, scene, camera, ratios.motion)
        : null;
    pipeline.current = still;
    motionPipeline.current = moving;
    invalidate();
    return () => {
      if (pipeline.current === still) pipeline.current = null;
      if (motionPipeline.current === moving) motionPipeline.current = null;
      still.dispose();
      moving?.dispose();
    };
  }, [gl, scene, camera, quality, ratios.still, ratios.motion, invalidate]);
  useEffect(() => () => clearTimeout(settle.current), []);
  useEffect(() => {
    // The info-log reads force every program to finish linking on the spot;
    // production relies on the background warm-up instead.
    gl.debug.checkShaderErrors = import.meta.env.DEV;
  }, [gl]);
  const render = (moving: boolean) => {
    const active =
      (moving && motionPipeline.current) || pipeline.current || null;
    const target = active?.sceneTarget ?? null;
    if (!prepareFrame(gl, scene, camera, invalidate, target)) return;
    // Read by the `?fps=1` diagnostics only.
    scene.userData.drawRatio =
      active && active === motionPipeline.current
        ? ratios.motion
        : ratios.still;
    if (active) active.render();
    else gl.render(scene, camera);
  };
  useFrame(() => {
    let moving = false;
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
      const now = performance.now();
      if (Math.abs(signature - motion.current.signature) > 1e-7) {
        motion.current.last = now;
        // Demand rendering draws nothing once the view rests: ask for the
        // one sharp frame after the movement has settled.
        clearTimeout(settle.current);
        settle.current = setTimeout(invalidate, MOTION_SETTLE_MS + 10);
      }
      motion.current.signature = signature;
      moving = now - motion.current.last < MOTION_SETTLE_MS;
    }
    if (!document.hidden && !gl.getContext().isContextLost()) render(moving);
  }, 1);
  useEffect(() => {
    let live = true;
    capture?.(async () => {
      if (!live || exporting.current) throw Error("Capture unavailable");
      if (gl.getContext().isContextLost()) throw Error("Context lost");
      const endCapture = beginCapture();
      exporting.current = true;
      const hidden: Array<import("three").Object3D> = [];
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
