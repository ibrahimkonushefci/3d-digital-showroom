import type { CameraView } from "./framing";

/** The interactive scene's current camera, for "back to my view" after an
 * inspection. Set by SceneControls while it is mounted. */
export const liveCamera: { read: (() => CameraView) | null } = { read: null };
if (import.meta.env.DEV && typeof window !== "undefined")
  (window as unknown as { __liveCamera: typeof liveCamera }).__liveCamera =
    liveCamera;
