import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useProgress } from "@react-three/drei";
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  PCFSoftShadowMap,
  PCFShadowMap,
  Vector2,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { qualityForFrames, useQuality, useRenderQuality } from "./quality";
export type CaptureImage = () => Promise<string>;
export type RegisterCapture = (capture: CaptureImage) => void;
export const showroomGL = {
  antialias: true,
  preserveDrawingBuffer: false,
  toneMapping: ACESFilmicToneMapping,
  outputColorSpace: SRGBColorSpace,
  toneMappingExposure: 0.98,
};
export function RefreshShadows({
  revision,
  scale = 12,
}: {
  revision: unknown;
  scale?: number;
}) {
  const quality = useQuality();
  return quality === "lightweight" ? null : (
    <ContactShadows
      key={JSON.stringify(revision)}
      position={[0, -0.015, 0]}
      opacity={0.28}
      scale={scale}
      blur={2.5}
      far={scale / 4}
      frames={90}
      resolution={256}
    />
  );
}
export function Rendering({
  capture,
  crispShadows = false,
}: {
  capture?: RegisterCapture;
  crispShadows?: boolean;
}) {
  const { gl, scene, camera, size, invalidate, setDpr } = useThree();
  const quality = useQuality();
  const pixelRatio = useThree((s) => s.viewport.dpr);
  const frames = useRef<number[]>([]),
    downgraded = useRef(false),
    exporting = useRef(false),
    motion = useRef({ signature: NaN, active: false });
  const pipeline = useMemo(() => {
    if (quality !== "high") return null;
    const composer = new EffectComposer(gl);
    const ao = new SSAOPass(scene, camera, size.width, size.height, 8);
    ao.kernelRadius = 0.14;
    ao.minDistance = 0.002;
    ao.maxDistance = 0.12;
    const output = new OutputPass();
    const aa = new ShaderPass(FXAAShader);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(ao);
    composer.addPass(output);
    composer.addPass(aa);
    return { composer, ao, output, aa };
  }, [gl, scene, camera, quality]);
  useEffect(
    () => () => {
      pipeline?.ao.dispose();
      pipeline?.output.dispose();
      pipeline?.aa.dispose();
      pipeline?.composer.dispose();
    },
    [pipeline],
  );
  useEffect(() => {
    gl.shadowMap.type = PCFSoftShadowMap;
    setDpr(
      quality === "lightweight"
        ? 1
        : Math.min(window.devicePixelRatio, quality === "high" ? 1.75 : 1.5),
    );
    invalidate();
  }, [quality, gl, setDpr, invalidate, crispShadows]);
  useEffect(() => {
    pipeline?.composer.setPixelRatio(pixelRatio);
    pipeline?.composer.setSize(size.width, size.height);
    invalidate();
  }, [pipeline, size, pixelRatio, invalidate]);
  const render = () => {
    if (pipeline) {
      pipeline.aa.uniforms.resolution.value.set(
        1 / gl.domElement.width,
        1 / gl.domElement.height,
      );
      pipeline.composer.render();
    } else gl.render(scene, camera);
  };
  useFrame((_, dt) => {
    if (!exporting.current) {
      // Sample consecutive moving frames only, excluding idle invalidations and shadow refreshes.
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
      scene.traverse(measure);
      const active = Math.abs(signature - motion.current.signature) > 1e-7;
      if (active && motion.current.active && dt > 0)
        frames.current.push(Math.min(99, dt * 1000));
      else if (!active) frames.current = [];
      motion.current = { signature, active };
      if (frames.current.length >= 120) {
        const next = qualityForFrames(quality, frames.current);
        frames.current = [];
        if (next !== quality && !(downgraded.current && next === "high")) {
          if (next === "lightweight" || quality === "high")
            downgraded.current = true;
          useRenderQuality.getState().setLevel(next);
        }
      }
    }
    render();
  }, 1);
  useEffect(() => {
    let live = true;
    capture?.(async () => {
      if (!live || exporting.current) throw Error("Capture unavailable");
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
            !useProgress.getState().active && key === previous ? stable + 1 : 0;
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
        pipeline?.composer.setPixelRatio(1);
        pipeline?.composer.setSize(
          Math.round(oldSize.x * ratio),
          Math.round(oldSize.y * ratio),
        );
        render();
        return gl.domElement.toDataURL("image/png");
      } finally {
        hidden.forEach((o) => (o.visible = true));
        gl.setPixelRatio(dpr);
        gl.setSize(oldSize.x, oldSize.y, false);
        pipeline?.composer.setPixelRatio(dpr);
        pipeline?.composer.setSize(oldSize.x, oldSize.y);
        exporting.current = false;
        invalidate();
      }
    });
    return () => {
      live = false;
    };
  }, [capture, pipeline, gl, camera, scene, invalidate]);
  return null;
}
