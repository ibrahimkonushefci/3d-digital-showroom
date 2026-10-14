import { expect, it, vi } from "vitest";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  DataTexture,
  RGBAFormat,
  UnsignedByteType,
  HalfFloatType,
  CubeTexture,
  Scene,
} from "three";
import { setSceneMoving, motionBoundary } from "../src/scene/activity";
import {
  ResourceCache,
  DecodedCache,
  SceneResources,
  instantiateModel,
} from "../src/scene/resources";
import { geometryBytes, percentile, textureBytes } from "../src/scene/metrics";
import { movingFrameMs } from "../src/scene/quality";
it("marks idle boundaries once across overlapping camera and door motion", () => {
  const scene = new Scene();
  expect(motionBoundary(scene)).toBe(0);
  setSceneMoving(scene, "camera", true);
  expect(motionBoundary(scene)).toBe(1);
  setSceneMoving(scene, "door", true);
  setSceneMoving(scene, "camera", false);
  expect(motionBoundary(scene)).toBe(1);
  setSceneMoving(scene, "door", false);
  expect(motionBoundary(scene)).toBe(2);
  setSceneMoving(scene, "door", false);
  expect(motionBoundary(scene)).toBe(2);
});
it("keeps shared geometry/materials alive until the last Canvas releases, and tolerates StrictMode reacquisition", async () => {
  const cache = new ResourceCache<{ dispose(): void }>();
  const dispose = vi.fn(),
    create = vi.fn(() => ({ dispose }));
  const a = cache.acquire("panel", create),
    b = cache.acquire("panel", create);
  expect(a.value).toBe(b.value);
  expect(create).toHaveBeenCalledTimes(1);
  a.release();
  a.release();
  await Promise.resolve();
  expect(dispose).not.toHaveBeenCalled();
  b.release();
  const c = cache.acquire("panel", create);
  await Promise.resolve();
  expect(dispose).not.toHaveBeenCalled();
  c.release();
  await Promise.resolve();
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(cache.size).toBe(0);
});
it("shares a single pending decode and disposes a decode that completes after unmount", async () => {
  const cache = new DecodedCache<{ dispose(): void }>();
  const dispose = vi.fn();
  let finish!: (value: { dispose(): void }) => void;
  const load = vi.fn(
    () =>
      new Promise<{ dispose(): void }>((resolve) => {
        finish = resolve;
      }),
  );
  const a = cache.acquire("local-model-v1", load),
    b = cache.acquire("local-model-v1", load);
  expect(a.value.promise).toBe(b.value.promise);
  await Promise.resolve();
  expect(load).toHaveBeenCalledTimes(1);
  a.release();
  b.release();
  await Promise.resolve();
  finish({ dispose });
  await a.value.promise;
  await Promise.resolve();
  expect(dispose).toHaveBeenCalledTimes(1);
});
it("retries a failed decoded resource after leases release", async () => {
  const cache = new DecodedCache<{ dispose(): void }>();
  const failed = cache.acquire("texture", async () => {
    throw Error("missing");
  });
  await expect(failed.value.promise).rejects.toThrow("missing");
  failed.release();
  await Promise.resolve();
  const next = cache.acquire("texture", async () => ({ dispose() {} }));
  await expect(next.value.promise).resolves.toHaveProperty("dispose");
  next.release();
});
it("disposes replaced targets and instance overrides without mutating cached GLTF materials or transforms", () => {
  const owner = new SceneResources(),
    first = { dispose: vi.fn() },
    second = { dispose: vi.fn() };
  owner.replace("probe", first);
  owner.replace("probe", second);
  expect(first.dispose).toHaveBeenCalledTimes(1);
  const material = new MeshStandardMaterial({ color: "white" }),
    geometry = new BoxGeometry();
  const source = new Group(),
    mesh = new Mesh(geometry, material);
  mesh.name = "front";
  source.add(mesh);
  const instance = instantiateModel(source, owner, {
    front: (m) => (m as MeshStandardMaterial).color.set("red"),
  });
  const local = instance.children[0] as Mesh;
  expect(local.geometry).toBe(geometry);
  expect(local.material).not.toBe(material);
  expect(material.color.getHexString()).toBe("ffffff");
  instance.position.x = 5;
  expect(source.position.x).toBe(0);
  const disposed = vi.fn();
  (local.material as MeshStandardMaterial).addEventListener(
    "dispose",
    disposed,
  );
  owner.dispose();
  owner.dispose();
  expect(second.dispose).toHaveBeenCalledTimes(1);
  expect(disposed).toHaveBeenCalledTimes(1);
  geometry.dispose();
  material.dispose();
});
it("counts active slow frames, excludes idle boundaries, and estimates mipmaps/half-float maps/unique geometry buffers", () => {
  expect(movingFrameMs(0.5, true, true)).toBe(500);
  expect(movingFrameMs(5, false, true)).toBeNull();
  expect(movingFrameMs(5, true, false)).toBeNull();
  expect(percentile([], 0.95)).toBeNull();
  expect(percentile([1, 2, 3, 100], 0.95)).toBe(100);
  const texture = new DataTexture(
    new Uint8Array(4 * 16),
    4,
    4,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.generateMipmaps = false;
  expect(textureBytes(texture)).toBe(64);
  texture.type = HalfFloatType;
  expect(textureBytes(texture)).toBe(128);
  texture.generateMipmaps = true;
  expect(textureBytes(texture)).toBe(171);
  const cube = new CubeTexture(Array(6).fill({ width: 4, height: 4 }));
  cube.generateMipmaps = false;
  expect(textureBytes(cube)).toBe(384);
  const geometry = new BoxGeometry();
  expect(geometryBytes([geometry, geometry])).toBe(geometryBytes([geometry]));
  geometry.dispose();
  texture.dispose();
  cube.dispose();
});
