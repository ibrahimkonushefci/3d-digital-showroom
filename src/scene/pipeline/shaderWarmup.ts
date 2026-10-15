import type {
  Camera,
  Material,
  Mesh,
  Object3D,
  Scene,
  Texture,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";

/**
 * Shader programs compile in the background before anything uses them.
 *
 * three.js links a material's program the first time an object using it is
 * drawn, and that blocks the page: about half a second when a design opens,
 * then again for every object that enters the view for the first time (zooming
 * out onto a wall-art frame, an interior seen through an opening door). Here,
 * any object the renderer has not prepared yet, visible or not, is handed to
 * renderer.compile(), which starts the program link without waiting for it.
 * With KHR_parallel_shader_compile (Chrome on the M4: yes), the driver links
 * on its own threads, and the frame is only drawn once every program is ready.
 * The previous frame stays on screen meanwhile, normally for a few frames.
 *
 * Without the extension, compile() links synchronously: the same stall as
 * before, just one frame earlier. Nothing is ever skipped for long: after
 * MAX_WAIT_MS the frame is drawn anyway.
 */
const MAX_WAIT_MS = 2000;
const UPLOAD_BUDGET_MS = 8;
const TEXTURE_SLOTS = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
  "alphaMap",
  "bumpMap",
  "lightMap",
  "clearcoatNormalMap",
  "clearcoatRoughnessMap",
  "sheenColorMap",
  "sheenRoughnessMap",
  "specularIntensityMap",
] as const;

type Warmup = {
  /** Per object: the material state it was prepared with. */
  prepared: WeakMap<Object3D, string>;
  /** Lights, shadow casters and environment the programs were built for. */
  global: string;
  waiting: Set<Material>;
  /** Images still to upload, a few per frame. */
  uploads: Set<Texture>;
  since: number;
  timer: ReturnType<typeof setTimeout> | undefined;
};
const warmups = new WeakMap<Scene, Warmup>();

/** True while programs for content already in the scene are still linking. */
export const warmupPending = (scene: Scene) => {
  const state = warmups.get(scene);
  return !!state && (state.waiting.size > 0 || state.uploads.size > 0);
};

const renderable = (o: Object3D) => {
  const f = o as Object3D & {
    isMesh?: boolean;
    isLine?: boolean;
    isPoints?: boolean;
    isSprite?: boolean;
  };
  return !!(f.isMesh || f.isLine || f.isPoints || f.isSprite);
};
const materialsOf = (o: Object3D): Material[] => {
  const m = (o as Mesh).material;
  return !m ? [] : Array.isArray(m) ? m : [m];
};
const materialKey = (o: Object3D) =>
  materialsOf(o)
    .map((m) => m.uuid + "." + m.version)
    .join(",") +
  "|" +
  ((o as Mesh).geometry?.id ?? 0);

function globalKey(scene: Scene) {
  let lights = "";
  scene.traverseVisible((o) => {
    const light = o as Object3D & { isLight?: boolean; castShadow: boolean };
    if (light.isLight) lights += o.type[0] + (light.castShadow ? "s" : "");
  });
  const env = scene.environment as
    (Texture & { image?: { height?: number } }) | null;
  return lights + "|" + (env ? (env.image?.height ?? env.id) : "");
}

/**
 * Called once per frame before drawing. Returns false when the frame should
 * not be drawn yet because new programs are still compiling.
 */
export function prepareFrame(
  gl: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  invalidate: () => void,
  /** Where the scene pass draws. Tone mapping and output colour space differ
   * between the canvas and an off-screen target (the AO pipeline), and they
   * are part of every program, so compile against the same one. */
  target: WebGLRenderTarget | null = null,
): boolean {
  let state = warmups.get(scene);
  if (!state) {
    state = {
      prepared: new WeakMap(),
      global: "",
      waiting: new Set(),
      uploads: new Set(),
      since: 0,
      timer: undefined,
    };
    warmups.set(scene, state);
  }
  const global = globalKey(scene) + (target ? "|target" : "|canvas");
  if (global !== state.global) {
    // New lights or environment change every program: prepare all again.
    state.global = global;
    state.prepared = new WeakMap();
  }
  const fresh: Object3D[] = [];
  scene.traverse((o) => {
    if (!renderable(o)) return;
    const key = materialKey(o);
    if (state.prepared.get(o) === key) return;
    state.prepared.set(o, key);
    fresh.push(o);
  });
  if (fresh.length) {
    // compile() only traverses the object it is given and reads lights from
    // the target scene, so a stand-in that lists just the new objects is
    // enough (and much cheaper than preparing the whole scene again).
    const batch = {
      traverse: (visit: (o: Object3D) => void) => fresh.forEach(visit),
      traverseVisible: () => {},
    } as unknown as Object3D;
    const previous = gl.getRenderTarget();
    try {
      gl.setRenderTarget(target);
      const materials = gl.compile(batch, camera, scene);
      for (const material of materials) {
        state.waiting.add(material);
        for (const slot of TEXTURE_SLOTS) {
          const texture = (material as unknown as Record<string, unknown>)[
            slot
          ] as Texture | null | undefined;
          // Uploaded before the surface first shows, spread over frames.
          if (texture?.isTexture && texture.version > 0)
            state.uploads.add(texture);
        }
      }
      if (!state.since) state.since = performance.now();
    } catch {
      // A failed prepare must never stop drawing; render() reports errors.
      state.waiting.clear();
    } finally {
      gl.setRenderTarget(previous);
    }
  }
  if (state.uploads.size) {
    // About 50 images arrive with a design: uploading them all in one frame
    // was a ~120 ms freeze. initTexture() skips ones already uploaded.
    const start = performance.now();
    for (const texture of state.uploads) {
      state.uploads.delete(texture);
      gl.initTexture(texture);
      if (performance.now() - start > UPLOAD_BUDGET_MS) break;
    }
  }
  if (!state.waiting.size && !state.uploads.size) return true;
  for (const material of state.waiting) {
    const program = (
      gl.properties.get(material) as {
        currentProgram?: { isReady(): boolean };
      }
    ).currentProgram;
    if (!program || program.isReady()) state.waiting.delete(material);
  }
  if (
    (!state.waiting.size && !state.uploads.size) ||
    performance.now() - state.since > MAX_WAIT_MS
  ) {
    state.waiting.clear();
    state.uploads.clear();
    state.since = 0;
    return true;
  }
  // Demand rendering: keep checking until the driver reports the programs.
  clearTimeout(state.timer);
  state.timer = setTimeout(invalidate, 16);
  return false;
}
