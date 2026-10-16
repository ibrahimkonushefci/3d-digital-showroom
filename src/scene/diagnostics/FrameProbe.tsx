/** Inside the designer canvas when `?fps=1` is on: records drawn moving
 * frames, quality and pixel-ratio changes and when start-up work ends. */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import { activityRevision, motionBoundary } from "../activity";
import { useQuality } from "../quality";
import { pendingModelLoads } from "../assets/ModelAsset";
import { warmupPending } from "../pipeline/shaderWarmup";
import { environmentPending } from "../lighting/RoomEnvironment";
import { bakePending } from "../bake/ShellBakeDriver";
import { contactsPending } from "../Rendering";
import { diag, logEvent, logFrame, logLongTask, openSession } from "./recorder";

export default function FrameProbe({ design }: { design: string }) {
  const { gl, scene, camera } = useThree();
  const quality = useQuality();
  const start = useRef(0);
  const last = useRef({ at: 0, key: "", active: false, boundary: 0 });
  const work = useRef<Record<string, { pending: boolean; since: number }>>({});
  const shown = useRef({ dpr: 0, canvas: "" });
  useEffect(() => {
    openSession(design, quality);
    const context = gl.getContext();
    const info = context.getExtension("WEBGL_debug_renderer_info");
    diag.renderer = String(
      context.getParameter(
        info ? info.UNMASKED_RENDERER_WEBGL : context.RENDERER,
      ),
    );
    work.current = {};
    shown.current = { dpr: 0, canvas: "" };
    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver((list) =>
        list.getEntries().forEach((e) => logLongTask(e.startTime, e.duration)),
      );
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      /* not supported */
    }
    return () => observer?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design, gl]);
  useEffect(() => {
    diag.live.quality = quality;
    logEvent(`quality ${quality}`);
  }, [quality]);
  useEffect(() => {
    diag.live.ao = quality === "lightweight" ? "off" : "on";
  }, [quality]);
  useFrame(() => {
    start.current = performance.now();
  }, -100);
  useFrame(() => {
    const now = performance.now();
    const key = [
      ...camera.position.toArray(),
      ...camera.quaternion.toArray(),
      activityRevision(scene),
    ].join(",");
    const boundary = motionBoundary(scene);
    const active = key !== last.current.key && !document.hidden;
    const interval =
      active && last.current.active && boundary === last.current.boundary
        ? now - last.current.at
        : null;
    // The ratio this frame was drawn at: the still or the motion pipeline.
    const dpr = (scene.userData.drawRatio as number) || gl.getPixelRatio();
    const canvas = `${gl.domElement.width}x${gl.domElement.height}`;
    diag.live.dpr = dpr;
    if (canvas !== shown.current.canvas) {
      shown.current = { dpr, canvas };
      diag.live.canvas = canvas;
      logEvent(`canvas ${canvas} (still ratio ${gl.getPixelRatio()})`);
    }
    logFrame(now, interval, now - start.current, dpr, canvas);
    last.current = { at: now, key, active, boundary };
    const states: Record<string, boolean> = {
      textures: useProgress.getState().active,
      models: pendingModelLoads() > 0,
      shaders: warmupPending(scene),
      environment: environmentPending(scene),
      "contact shadows": contactsPending(scene),
      bake: bakePending(scene),
    };
    for (const [name, pending] of Object.entries(states)) {
      const w = work.current[name];
      if (!w) {
        work.current[name] = { pending, since: now };
        if (pending) logEvent(`${name} started`);
      } else if (w.pending !== pending) {
        logEvent(
          pending
            ? `${name} started`
            : `${name} done (${Math.round(now - w.since)} ms)`,
        );
        work.current[name] = { pending, since: now };
      }
    }
  }, 100);
  return null;
}
