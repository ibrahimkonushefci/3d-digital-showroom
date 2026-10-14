import { useMemo, useRef, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { Scene } from "three";
const revisions = new WeakMap<Scene, number>();
const motions = new WeakMap<
  Scene,
  { active: Set<object | string>; boundary: number }
>();
export function setSceneMoving(
  scene: Scene,
  source: object | string,
  moving: boolean,
) {
  let state = motions.get(scene);
  if (!state) {
    state = { active: new Set(), boundary: 0 };
    motions.set(scene, state);
  }
  const wasMoving = state.active.size > 0;
  if (moving) state.active.add(source);
  else state.active.delete(source);
  const nowMoving = state.active.size > 0;
  if (wasMoving !== nowMoving) state.boundary++;
}
export const motionBoundary = (scene: Scene) =>
  motions.get(scene)?.boundary || 0;
export const activityRevision = (scene: Scene) => revisions.get(scene) || 0;
/** Animation components explicitly announce motion; no scene traversal per frame. */
export function useSceneInvalidation() {
  const { scene, invalidate } = useThree();
  const source = useRef({});
  useEffect(() => () => setSceneMoving(scene, source.current, false), [scene]);
  return useMemo(
    () =>
      Object.assign(
        () => {
          setSceneMoving(scene, source.current, true);
          revisions.set(scene, activityRevision(scene) + 1);
          invalidate();
        },
        { settled: () => setSceneMoving(scene, source.current, false) },
      ),
    [scene, invalidate],
  );
}
