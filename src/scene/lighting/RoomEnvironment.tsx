import { useEffect, createContext } from "react";
import { useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import {
  BoxGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  Vector3,
  type WebGLRenderer,
} from "three";
import type { DesignDocument } from "../../catalog/types";
import { pendingModelLoads } from "../assets/ModelAsset";
import { SceneResources } from "../resources";
import { withProbePass } from "../renderPass";
import { useQuality, roomQuality } from "../quality";
import { resolveRoom } from "../rooms/resolveRoom";
import {
  lightingSignature,
  openingPosition,
  wallPieces,
} from "./lightingRecipe";

const pending = new WeakSet<Scene>();
/** Scenes whose first probe has run: later edits debounce, the first runs
 * as soon as loading allows, behind the loading cue. */
const probed = new WeakSet<Scene>();
const slowRenderers = new WeakSet<WebGLRenderer>();
export const environmentPending = (scene: Scene) => pending.has(scene);
export const EnvironmentPolicy = createContext<"auto" | "authored">("auto");
/** Authored low-detail room radiance, rebuilt to the actual dimensions/apertures. */
export function authoredEnvironment(design: DesignDocument) {
  const env = new Scene(),
    owned: Array<{ dispose(): void }> = [];
  const { recipe } = resolveRoom(design),
    room = design.room;
  const w = room.width / 100,
    d = room.depth / 100,
    h = room.height / 100;
  env.background = new Color("#948979");
  const add = (
    size: [number, number, number],
    position: [number, number, number],
    color: string,
    brightness: number,
    yaw = 0,
  ) => {
    const geometry = new BoxGeometry(...size);
    const material = new MeshBasicMaterial({
      color: new Color(color).multiplyScalar(brightness),
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.y = yaw;
    env.add(mesh);
    owned.push(geometry, material);
  };
  for (const side of ["back", "left", "right", "front"] as const)
    for (const p of wallPieces(room, side))
      add(
        p.size,
        [p.position[0] - w / 2, p.position[1], p.position[2] - d / 2],
        recipe.finishes.wall,
        recipe.lightRecipe.wallBrightness,
        p.rotation[1],
      );
  add([w, 0.04, d], [0, -0.02, 0], "#b2a389", 0.42);
  add([w, 0.04, d], [0, h + 0.02, 0], "#fff4e4", 0.8);
  if (!room.openings.some((o) => o.type === "window"))
    add([w * 0.4, 0.02, d * 0.35], [0, h - 0.02, 0], "#fff1d8", 2.1);
  for (const o of room.openings.filter((o) => o.type === "window")) {
    const p = openingPosition(room, o);
    add(
      [o.width / 100, o.height / 100, 0.02],
      p.toArray(),
      "#e7f2ff",
      recipe.lightRecipe.windowBrightness,
      o.wall === "left" || o.wall === "right" ? Math.PI / 2 : 0,
    );
  }
  return { env, owned, dispose: () => owned.forEach((r) => r.dispose()) };
}
export function RoomEnvironment({
  design,
  policy = "auto",
}: {
  design: DesignDocument;
  policy?: "auto" | "authored";
}) {
  const { gl, scene, invalidate } = useThree();
  const quality = useQuality();
  const probeResolution = roomQuality(quality).probeResolution;
  const signature = lightingSignature(design);
  useEffect(() => {
    const resources = new SceneResources(),
      pmrem = new PMREMGenerator(gl);
    let live = true,
      timer: ReturnType<typeof setTimeout>;
    const status = {
      mode: "authored",
      resolution: 64,
      refreshes: 0,
      lastMs: 0,
      fallbackReason: "",
      signature,
    };
    scene.userData.roomEnvironment = status;
    const room = authoredEnvironment(design);
    try {
      const fallback = withProbePass(gl, () =>
        // Same size as the runtime probe that may replace it: a different
        // size changes every PBR shader and recompiled them all mid-view.
        pmrem.fromScene(room.env, 0.025, 0.05, 50, {
          size: probeResolution || 64,
          position: new Vector3(0, 1.2, 0),
        }),
      );
      resources.replace("authored", fallback);
      scene.environment = fallback.texture;
      scene.environmentIntensity =
        resolveRoom(design).recipe.lightRecipe.environmentIntensity ?? 1;
    } finally {
      room.dispose();
    }
    invalidate();
    const fallbackOnly =
      !probeResolution ||
      policy === "authored" ||
      slowRenderers.has(gl) ||
      design.cabinets.length >= 24;
    if (!fallbackOnly) {
      pending.add(scene);
      const started = performance.now();
      const refresh = () => {
        if (!live) return;
        if (
          document.hidden ||
          useProgress.getState().active ||
          pendingModelLoads()
        ) {
          if (performance.now() - started < 5000) {
            timer = setTimeout(refresh, 100);
            return;
          }
          status.fallbackReason = "loading-timeout-or-background";
          pending.delete(scene);
          return;
        }
        const probe = authoredEnvironment(design);
        // Borrow ONLY immutable room decor, never cabinets/fronts, mirrors, or
        // the main scene's environment. This prevents reflection self-feedback.
        scene.updateMatrixWorld(true);
        scene.traverse((object) => {
          if (!object.userData.reflectionStatic) return;
          const clone = object.clone(true);
          object.matrixWorld.decompose(
            clone.position,
            clone.quaternion,
            clone.scale,
          );
          clone.traverse((child) => {
            const mesh = child as Mesh;
            if (!mesh.isMesh) return;
            const materials = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            const copies = materials.map((material) => {
              const source = material as MeshBasicMaterial;
              const copy = new MeshBasicMaterial({
                color: source.color?.clone().multiplyScalar(0.65) || "#b6a990",
                side: DoubleSide,
              });
              probe.owned.push(copy);
              return copy;
            });
            mesh.material = Array.isArray(mesh.material) ? copies : copies[0];
          });
          probe.env.add(clone);
        });
        const begin = performance.now();
        try {
          const target = withProbePass(gl, () =>
            pmrem.fromScene(probe.env, 0.025, 0.05, 50, {
              size: probeResolution,
              position: new Vector3(0, 1.2, 0),
            }),
          );
          status.lastMs = performance.now() - begin;
          status.refreshes++;
          if (status.lastMs > 50) {
            // A single synchronous refresh must also satisfy the 50 ms UI-stall
            // guard, stricter than the total 150 ms allowance. No repeated retry.
            target.dispose();
            slowRenderers.add(gl);
            status.fallbackReason = "refresh-exceeded-50ms";
          } else {
            resources.replace("runtime", target);
            scene.environment = target.texture;
            status.mode = "runtime";
            status.resolution = probeResolution;
          }
        } catch {
          status.fallbackReason = "capture-failed";
        } finally {
          probe.dispose();
          pending.delete(scene);
          invalidate();
        }
      };
      timer = setTimeout(refresh, probed.has(scene) ? 650 : 0);
      probed.add(scene);
    } else
      status.fallbackReason = !probeResolution
        ? "manual-performance"
        : policy === "authored"
          ? "explicit-authored"
          : design.cabinets.length >= 24
            ? "large-design"
            : "previous-slow-refresh";
    return () => {
      live = false;
      clearTimeout(timer);
      pending.delete(scene);
      scene.environment = null;
      resources.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, signature, probeResolution, policy, invalidate]);
  return null;
}
