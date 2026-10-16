import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import {
  MathUtils,
  Plane,
  Ray,
  Spherical,
  Vector3,
  type PerspectiveCamera,
} from "three";
import type { Catalog, DesignDocument } from "../catalog/types";
import { useDesigner } from "./store";
import {
  CABINET_FOV,
  cameraBounds,
  orbitLimits,
  recenterTarget,
  viewDistance,
  type CameraPreset,
  type CameraView,
} from "./framing";
import {
  cameraObstacles,
  cameraPath,
  cameraStructureKey,
  roomShot,
  sampleCameraPath,
  SHOT_DURATION_MS,
} from "./cameraShots";
import { setSceneMoving } from "../scene/activity";
import { liveCamera } from "./liveCamera";

export default function SceneControls({
  preset,
  design,
  catalog,
  cameraView,
  focus,
  reframe,
  opened = [],
}: {
  preset: CameraPreset;
  design: DesignDocument;
  catalog: Catalog;
  cameraView?: CameraView;
  focus?: string | null;
  reframe?: unknown;
  opened?: readonly string[];
}) {
  const ref = useRef<CameraControls>(null);
  const dragging = useDesigner((s) => s.dragging);
  const { size, camera, gl, events, scene, invalidate } = useThree();
  const structure = cameraStructureKey(design);
  const overall = useMemo(
    () => cameraBounds(design, preset, catalog),
    [structure, preset, catalog],
  );
  const aspect = size.width / Math.max(1, size.height);
  const view = roomShot(design, catalog, preset, aspect, {
    focus,
    authored: cameraView,
    opened,
  });
  const overview = roomShot(design, catalog, "overall", aspect, { opened });
  const home = useRef({ target: new Vector3(), distance: 10 });
  home.current = {
    target: new Vector3(...overview.target),
    distance: viewDistance(overview),
  };
  const limits = orbitLimits(design, view, focus, home.current.distance);
  const placed = useRef<string | null>(null);
  const userMoved = useRef(false);
  const transition = useRef<{
    path: CameraView[];
    start: number;
    fov: [number, number];
  } | null>(null);
  const applyFov = (fov: number) => {
    const lens = camera as PerspectiveCamera;
    if (!lens.isPerspectiveCamera || Math.abs(lens.fov - fov) < 1e-3) return;
    lens.fov = fov;
    lens.updateProjectionMatrix();
  };
  const frameKey = [
    preset,
    focus ?? "",
    structure,
    JSON.stringify(cameraView ?? null),
    String(reframe ?? ""),
  ].join("|");
  const reduced = useRef(false);
  const cancelTransition = () => {
    transition.current = null;
    const c = ref.current;
    if (c) {
      const position = c.getPosition(new Vector3(), false);
      const target = c.getTarget(new Vector3(), false);
      c.stop();
      void c.setLookAt(...position.toArray(), ...target.toArray(), false);
    }
    setSceneMoving(scene, "shot", false);
  };
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = media.matches;
    const change = () => {
      reduced.current = media.matches;
      if (media.matches && transition.current) {
        const end = transition.current.path.at(-1)!;
        const fov = transition.current.fov[1];
        cancelTransition();
        applyFov(fov);
        void ref.current?.setLookAt(...end.position, ...end.target, false);
        invalidate();
      }
    };
    const interrupt = () => {
      cancelTransition();
      userMoved.current = true;
    };
    const visibility = () => {
      if (document.hidden) cancelTransition();
    };
    gl.domElement.addEventListener("pointerdown", interrupt, true);
    media.addEventListener("change", change);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelTransition();
      gl.domElement.removeEventListener("pointerdown", interrupt, true);
      media.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [gl, scene, invalidate]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.setBoundary(overall.clone().expandByVector(new Vector3(0.4, 0, 0.4)));
    // Even an untouched initial view survives a rotation or finish edit.
    if (placed.current === frameKey) return;
    const initial = placed.current === null;
    cancelTransition();
    const from: CameraView = {
      position: c.getPosition(new Vector3(), false).toArray(),
      target: c.getTarget(new Vector3(), false).toArray(),
    };
    const path = initial
      ? []
      : cameraPath(
          from,
          view,
          cameraObstacles(design, catalog),
          reduced.current,
        );
    const fov = view.fov ?? CABINET_FOV;
    if (path.length) {
      transition.current = {
        path,
        start: performance.now(),
        fov: [(camera as PerspectiveCamera).fov ?? fov, fov],
      };
      setSceneMoving(scene, "shot", true);
    } else {
      applyFov(fov);
      void c.setLookAt(...view.position, ...view.target, false);
    }
    placed.current = frameKey;
    userMoved.current = false;
    invalidate();
  }, [frameKey]);
  useFrame(() => {
    const move = transition.current,
      c = ref.current;
    if (!move || !c || document.hidden) return;
    const progress = Math.min(
      1,
      (performance.now() - move.start) / SHOT_DURATION_MS,
    );
    const next = sampleCameraPath(move.path, progress);
    const ease = progress * progress * (3 - 2 * progress);
    applyFov(move.fov[0] + (move.fov[1] - move.fov[0]) * ease);
    void c.setLookAt(...next.position, ...next.target, false);
    if (progress >= 1) {
      transition.current = null;
      setSceneMoving(scene, "shot", false);
    } else invalidate();
  }, -2);
  // Where the customer is looking from now (the settled view, not a frame
  // of a glide), for "back to my view" after an inspection.
  useEffect(() => {
    const read = (): CameraView => {
      const c = ref.current;
      const lens = camera as PerspectiveCamera;
      return {
        position: (c
          ? c.getPosition(new Vector3(), true)
          : camera.position
        ).toArray() as CameraView["position"],
        target: (c
          ? c.getTarget(new Vector3(), true)
          : new Vector3()
        ).toArray() as CameraView["target"],
        fov: lens.isPerspectiveCamera ? lens.fov : undefined,
      };
    };
    liveCamera.read = read;
    return () => {
      if (liveCamera.read === read) liveCamera.read = null;
    };
  }, [camera]);
  // Wheel, trackpad scroll and trackpad pinch all become one bounded dolly:
  // zooming in heads for what is under the cursor, zooming out glides back
  // to the whole-furniture framing instead of drifting into empty space.
  useEffect(() => {
    const c = ref.current;
    // The element drei connects the controls to; capture runs before them.
    const el = (events.connected as HTMLElement | undefined) ?? gl.domElement;
    if (!c || !el) return;
    const onWheel = (e: WheelEvent) => {
      if (!c.enabled) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const pixels =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
            ? e.deltaY * 400
            : e.deltaY;
      const delta = MathUtils.clamp(pixels, -200, 200);
      const from = c.getSpherical(new Spherical(), true).radius;
      const to = MathUtils.clamp(
        from * Math.exp(delta * (e.ctrlKey ? 0.012 : 0.002)),
        c.minDistance,
        c.maxDistance,
      );
      if (Math.abs(to - from) < 1e-4) return;
      const target = c.getTarget(new Vector3(), true);
      let next = target;
      if (to < from) {
        const rect = el.getBoundingClientRect();
        const ray = new Ray(camera.position.clone());
        ray.direction
          .set(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
            0.5,
          )
          .unproject(camera)
          .sub(camera.position)
          .normalize();
        const plane = new Plane().setFromNormalAndCoplanarPoint(
          camera.getWorldDirection(new Vector3()),
          target,
        );
        const cursor = ray.intersectPlane(plane, new Vector3());
        if (cursor) next = target.clone().lerp(cursor, 1 - to / from);
      } else
        next = recenterTarget(
          target,
          home.current.target,
          from,
          to,
          home.current.distance,
        );
      cancelTransition();
      userMoved.current = true;
      void c.dollyTo(to, true);
      void c.moveTo(next.x, next.y, next.z, true);
    };
    // Shift turns a left-drag into a pan, for trackpads without a right drag.
    const ACTION = CameraControlsImpl.ACTION;
    const pan = (e: KeyboardEvent) => {
      c.mouseButtons.left = e.shiftKey ? ACTION.TRUCK : ACTION.ROTATE;
    };
    const unpan = () => (c.mouseButtons.left = ACTION.ROTATE);
    el.addEventListener("wheel", onWheel, { capture: true, passive: false });
    window.addEventListener("keydown", pan);
    window.addEventListener("keyup", pan);
    window.addEventListener("blur", unpan);
    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("keydown", pan);
      window.removeEventListener("keyup", pan);
      window.removeEventListener("blur", unpan);
    };
  }, [camera, gl, events.connected]);

  // Pinching out on touch screens re-centers the same way.
  const pinch = useRef(0);
  return (
    <CameraControls
      ref={ref}
      makeDefault
      enabled={!dragging}
      minDistance={limits.minDistance}
      maxDistance={limits.maxDistance}
      minAzimuthAngle={limits.minAzimuth}
      maxAzimuthAngle={limits.maxAzimuth}
      minPolarAngle={0.02}
      maxPolarAngle={Math.PI / 2 - 0.04}
      minZoom={1}
      maxZoom={1}
      // Negative: dragging right walks the camera to the right of the room.
      azimuthRotateSpeed={-0.55}
      polarRotateSpeed={0.55}
      smoothTime={0.2}
      onWake={() => setSceneMoving(scene, "camera", true)}
      onSleep={() => setSceneMoving(scene, "camera", false)}
      onControlStart={() => {
        cancelTransition();
        userMoved.current = true;
        pinch.current = ref.current?.getSpherical(new Spherical()).radius ?? 0;
      }}
      onControl={() => {
        const c = ref.current;
        if (!c) return;
        const radius = c.getSpherical(new Spherical()).radius;
        if (radius > pinch.current + 1e-4) {
          const next = recenterTarget(
            c.getTarget(new Vector3()),
            home.current.target,
            pinch.current,
            radius,
            home.current.distance,
          );
          void c.moveTo(next.x, next.y, next.z, true);
        }
        pinch.current = radius;
      }}
    />
  );
}
