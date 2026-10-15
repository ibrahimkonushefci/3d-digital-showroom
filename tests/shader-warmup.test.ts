import { expect, it } from "vitest";
import {
  Group,
  Mesh,
  MeshStandardMaterial,
  BoxGeometry,
  PerspectiveCamera,
  Scene,
  type WebGLRenderer,
} from "three";
import {
  prepareFrame,
  warmupPending,
} from "../src/scene/pipeline/shaderWarmup";

/** Just enough renderer for the warm-up: compile() hands back the materials
 * of what it was given, and each program reports ready on demand. */
function fakeRenderer() {
  const ready = new Map<object, boolean>();
  const compiled: object[][] = [];
  let target: unknown = "canvas";
  const targets: unknown[] = [];
  const gl = {
    compile(batch: { traverse(v: (o: Mesh) => void): void }) {
      targets.push(target);
      const materials = new Set<object>();
      batch.traverse((o) => materials.add(o.material as object));
      compiled.push([...materials]);
      for (const m of materials) if (!ready.has(m)) ready.set(m, false);
      return materials;
    },
    properties: {
      get: (m: object) => ({ currentProgram: { isReady: () => ready.get(m) } }),
    },
    initTexture() {},
    getRenderTarget: () => target,
    setRenderTarget: (next: unknown) => (target = next ?? "canvas"),
  };
  return { gl: gl as unknown as WebGLRenderer, ready, compiled, targets };
}

it("holds the frame until new programs link, then prepares only new objects", () => {
  const { gl, ready, compiled, targets } = fakeRenderer();
  const scene = new Scene(),
    camera = new PerspectiveCamera();
  const material = new MeshStandardMaterial();
  const hidden = new Group();
  hidden.visible = false;
  hidden.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  scene.add(new Mesh(new BoxGeometry(), material), hidden);
  const pipelineTarget = { isRenderTarget: true };
  const frame = () =>
    prepareFrame(gl, scene, camera, () => {}, pipelineTarget as never);

  expect(frame()).toBe(false);
  // Hidden interiors are prepared too, against the target the scene draws to.
  expect(compiled[0]).toHaveLength(2);
  expect(targets[0]).toBe(pipelineTarget);
  expect(warmupPending(scene)).toBe(true);

  for (const m of ready.keys()) ready.set(m, true);
  expect(frame()).toBe(true);
  expect(warmupPending(scene)).toBe(false);
  // Nothing new: no further compile work on later frames.
  expect(frame()).toBe(true);
  expect(compiled).toHaveLength(1);

  // A finish change (new material) is prepared on its own.
  const next = new MeshStandardMaterial();
  (scene.children[0] as Mesh).material = next;
  ready.set(next, true);
  expect(frame()).toBe(true);
  expect(compiled[1]).toEqual([next]);
});
