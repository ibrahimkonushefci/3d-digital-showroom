/** Imported only by the DEV studio. Hooks are installed/restored per renderer. */
import { useLayoutEffect, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import type {
  BufferGeometry,
  Mesh,
  Material,
  Texture,
  WebGLRenderTarget,
} from "three";
import { activityRevision, motionBoundary } from "./activity";
import { currentRenderPass } from "./renderPass";
import { movingFrameMs } from "./quality";
import { environmentPending } from "./lighting/RoomEnvironment";
import { pendingModelLoads } from "./assets/ModelAsset";
import {
  emptyPass,
  geometryBytes,
  percentile,
  textureBytes,
  type MetricsReport,
} from "./metrics";

const activeEstimates = new Map<string, number>();
let capturePeak = 0;
export function resetCapturePeak() {
  capturePeak = 0;
}

export default function RenderMetrics({
  sceneId,
  quality,
  onReport,
  measurement = { scope: "desktop-browser", label: "@Browser desktop" },
  sampleEpoch = 0,
}: {
  sceneId: string;
  quality: string;
  onReport: (report: MetricsReport) => void;
  measurement?: { scope: MetricsReport["scope"]; label: string };
  /** Clear motion history without replacing a warmed WebGL renderer. */
  sampleEpoch?: number;
}) {
  const { gl, scene, camera, size } = useThree();
  const callback = useRef(onReport);
  callback.current = onReport;
  const samples = useRef<number[]>([]);
  const renderedFrames = useRef(0);
  const motion = useRef({ key: "", active: false, boundary: 0 });
  const passes = useRef({
    main: emptyPass(),
    shadow: emptyPass(),
    offscreen: emptyPass(),
  });
  const probes = useRef(emptyPass());
  const peakDrawFrame = useRef({ main: 0, shadow: 0, offscreen: 0, total: 0 });
  const targets = useRef(new Set<WebGLRenderTarget<Texture | Texture[]>>());
  const ready = useRef<number | null>(null);
  const started = useRef(performance.now());
  const lastPublish = useRef(0);
  const key = `${scene.uuid}:${sceneId}`;
  useEffect(() => {
    samples.current = [];
    motion.current = { key: "", active: false, boundary: 0 };
  }, [sampleEpoch]);

  useLayoutEffect(() => {
    const render = gl.render,
      reset = gl.info.reset,
      setTarget = gl.setRenderTarget;
    // Installed Three 0.180 resets info AFTER shadows and BEFORE the main pass.
    // Explicit reset before each render excludes stale counters from the prior pass.
    gl.render = function (renderScene, renderCamera) {
      reset.call(gl.info);
      let shadowCalls = 0,
        shadowTriangles = 0;
      const previousReset = gl.info.reset;
      gl.info.reset = () => {
        shadowCalls += gl.info.render.calls;
        shadowTriangles += gl.info.render.triangles;
        reset.call(gl.info);
      };
      const main = renderScene === scene && gl.getRenderTarget() === null;
      const start = performance.now();
      try {
        render.call(gl, renderScene, renderCamera);
      } finally {
        gl.info.reset = previousReset;
      }
      const measured = passes.current;
      const probe = currentRenderPass(gl) === "probe";
      const pass = main
        ? measured.main
        : probe
          ? probes.current
          : measured.offscreen;
      pass.calls += gl.info.render.calls;
      pass.triangles += gl.info.render.triangles;
      pass.cpuSubmitMs += performance.now() - start;
      measured.shadow.calls += shadowCalls;
      measured.shadow.triangles += shadowTriangles;
      if (
        main &&
        ready.current === null &&
        !useProgress.getState().active &&
        !pendingModelLoads() &&
        !environmentPending(scene)
      )
        ready.current = performance.now() - started.current;
    };
    gl.setRenderTarget = function (target, ...rest) {
      if (target && !targets.current.has(target)) {
        targets.current.add(target);
        target.addEventListener("dispose", () =>
          targets.current.delete(target),
        );
      }
      setTarget.call(gl, target, ...rest);
    };
    return () => {
      gl.render = render;
      gl.info.reset = reset;
      gl.setRenderTarget = setTarget;
      targets.current.clear();
      activeEstimates.delete(key);
    };
  }, [gl, scene, key]);

  const publish = () => {
    const textures = new Set<Texture>(),
      geometries = new Set<BufferGeometry>();
    const addMaterial = (m: Material) =>
      Object.values(m).forEach((value) => {
        if (value && typeof value === "object" && "isTexture" in value)
          textures.add(value as Texture);
      });
    scene.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material)
        (Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]
        ).forEach(addMaterial);
      if ("shadow" in object) {
        const shadow = object.shadow as
          { map?: WebGLRenderTarget; mapPass?: WebGLRenderTarget } | undefined;
        for (const t of [shadow?.map, shadow?.mapPass])
          if (t) targets.current.add(t);
      }
    });
    if (scene.environment) textures.add(scene.environment);
    let renderTargetsBytes = 0;
    for (const target of targets.current) {
      for (const texture of target.textures.flat()) {
        textures.delete(texture); // Avoid counting an environment as both map and target.
        renderTargetsBytes +=
          textureBytes(texture) * ("isWebGLCubeRenderTarget" in target ? 6 : 1);
      }
      // Illustrative depth storage and MSAA attachment allowance.
      if (target.depthBuffer)
        renderTargetsBytes += target.width * target.height * 4;
      if (target.samples)
        renderTargetsBytes += target.width * target.height * target.samples * 8;
    }
    const texturesBytes = [...textures].reduce(
      (n, t) => n + textureBytes(t),
      0,
    );
    const buffers = geometryBytes(geometries);
    const framebufferBytes = gl.domElement.width * gl.domElement.height * 8;
    const totalBytes =
      texturesBytes + renderTargetsBytes + buffers + framebufferBytes;
    activeEstimates.set(key, totalBytes);
    capturePeak = Math.max(
      capturePeak,
      [...activeEstimates.values()].reduce((a, b) => a + b, 0),
    );
    const context = gl.getContext();
    const report: MetricsReport = {
      version: 1,
      camera: {
        position: camera.position.toArray(),
        quaternion: camera.quaternion.toArray(),
      },
      renderedFrames: renderedFrames.current,
      roomLighting: scene.userData.roomLighting,
      roomEnvironment: scene.userData.roomEnvironment,
      sceneId,
      scope: measurement.scope,
      device: { label: measurement.label, userAgent: navigator.userAgent },
      recordedAt: new Date().toISOString(),
      viewport: {
        width: size.width,
        height: size.height,
        dpr: gl.getPixelRatio(),
      },
      renderer: String(context.getParameter(context.RENDERER)),
      quality,
      movingFrames: {
        samples: samples.current.length,
        p50Ms: percentile(samples.current, 0.5),
        p95Ms: percentile(samples.current, 0.95),
        maxMs: samples.current.length ? Math.max(...samples.current) : null,
      },
      sceneReadyMs: ready.current,
      passes: {
        ...structuredClone(passes.current),
        probe: { ...probes.current },
      },
      rendererCounts: {
        textures: gl.info.memory.textures,
        geometries: gl.info.memory.geometries,
      },
      estimates: {
        texturesBytes,
        renderTargetsBytes,
        geometryBytes: buffers,
        framebufferBytes,
        totalBytes,
        capturePeakBytes: capturePeak,
      },
      notes: [
        "Browser frame intervals and CPU submission time; GPU execution time is not measured.",
        "Main/shadow/offscreen counts are the latest demand frame; offscreen is contact depth/blur. Probe counts/time are cumulative authored/debounced PMREM work for this scene, not per-frame. RoomEnvironment records refresh cost and fallback; orbit/front/finish changes do not refresh it.",
        "CPU submit time includes the shadow work in that render; shadow CPU time cannot be separated (0 means unavailable).",
        "Scene-ready means first complete main pass with loader idle, measured from profiler commit; excludes route/catalog loading and is not cold-network interactivity.",
        "Memory estimates exclude driver/system allocation, decoded CPU images, shader programs, and opaque internal buffers. Shared resources may be counted in each Canvas at capture peak.",
      ],
      peakDrawFrame: { ...peakDrawFrame.current },
    };
    callback.current(report);
  };
  const latestPublish = useRef(publish);
  latestPublish.current = publish;
  useEffect(() => {
    // Report settled loader/resource state even after demand rendering becomes idle.
    // This samples counters only; it never requests additional render frames.
    const timer = setInterval(() => latestPublish.current(), 1000);
    return () => clearInterval(timer);
  }, []);
  useFrame((_, dt) => {
    renderedFrames.current++;
    const next = [
      ...camera.position.toArray(),
      ...camera.quaternion.toArray(),
      activityRevision(scene),
    ].join(",");
    const active = next !== motion.current.key && !document.hidden;
    const boundary = motionBoundary(scene);
    const ms = movingFrameMs(
      dt,
      active,
      motion.current.active && boundary === motion.current.boundary,
    );
    if (ms !== null) {
      samples.current.push(ms);
      if (samples.current.length > 60000) samples.current.shift();
    }
    motion.current = { key: next, active, boundary };
    passes.current = {
      main: emptyPass(),
      shadow: emptyPass(),
      offscreen: emptyPass(),
    };
  }, -0.5);
  useFrame(() => {
    const p = passes.current,
      draws = {
        main: p.main.calls,
        shadow: p.shadow.calls,
        offscreen: p.offscreen.calls,
        total: p.main.calls + p.shadow.calls + p.offscreen.calls,
      };
    if (draws.total > peakDrawFrame.current.total)
      peakDrawFrame.current = draws;
    // Publish on capture frames too (the resized framebuffer would otherwise be missed).
    if (
      performance.now() - lastPublish.current > 500 ||
      gl.domElement.width > size.width * gl.getPixelRatio() + 2
    ) {
      lastPublish.current = performance.now();
      publish();
    }
  }, 2);
  return null;
}
