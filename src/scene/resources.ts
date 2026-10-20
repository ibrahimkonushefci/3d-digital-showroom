import type {
  Material,
  Object3D,
  Mesh,
  WebGLRenderTarget,
  WebGLRenderer,
  Scene,
  Light,
} from "three";
import { useLayoutEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Box3 } from "three";

type Disposable = { dispose(): void };
/** Shared immutable resources; leases are idempotent and safe across two Canvases. */
export class ResourceCache<T extends Disposable> {
  private entries = new Map<string, { value: T; users: number }>();
  acquire(key: string, create: () => T) {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { value: create(), users: 0 };
      this.entries.set(key, entry);
    }
    entry.users++;
    const held = entry;
    let released = false;
    return {
      value: held.value,
      release: () => {
        if (released) return;
        released = true;
        held.users--;
        // A StrictMode re-acquisition or another Canvas can keep the resource.
        queueMicrotask(() => {
          if (!held.users && this.entries.get(key) === held) {
            this.entries.delete(key);
            held.value.dispose();
          }
        });
      },
    };
  }
  get size() {
    return this.entries.size;
  }
}

/** Async decoded model/texture foundation. Rejections may be retried. */
export class DecodedCache<T extends Disposable> {
  private cache = new ResourceCache<{ promise: Promise<T>; dispose(): void }>();
  acquire(key: string, load: () => Promise<T>) {
    return this.cache.acquire(key, () => {
      const promise = Promise.resolve().then(load);
      return {
        promise,
        dispose: () => {
          void promise.then(
            (v) => v.dispose(),
            () => {},
          );
        },
      };
    });
  }
}

/** Per-scene ownership for targets and override materials, never cached sources. */
export class SceneResources {
  private owned = new Map<string, Disposable>();
  replace<T extends Disposable>(key: string, resource: T): T {
    const previous = this.owned.get(key);
    this.owned.set(key, resource);
    if (previous !== resource && ![...this.owned.values()].includes(previous!))
      previous?.dispose();
    return resource;
  }
  dispose() {
    new Set(this.owned.values()).forEach((v) => v.dispose());
    this.owned.clear();
  }
}

const targetOwners = new WeakMap<WebGLRenderer, SceneResources>();
/** Brackets drei's contact-shadow callback, whose private targets lack cleanup.
 * Directional shadow targets belong to the renderer/light, not this component.
 * No new lighting technique or pass is introduced.
 */
export function useContactTargetOwnership() {
  const { gl, scene } = useThree();
  const [owner] = useState(() => new SceneResources());
  useLayoutEffect(() => {
    const setTarget = gl.setRenderTarget;
    const render = gl.render;
    const lights: Light[] = [];
    scene.traverse((object) => {
      if ((object as Light).isLight) lights.push(object as Light);
    });
    gl.setRenderTarget = function (target, ...rest) {
      if (
        targetOwners.get(gl) === owner &&
        target &&
        !lights.some((light) => {
          const shadow = (
            light as Light & {
              shadow?: { map?: WebGLRenderTarget; mapPass?: WebGLRenderTarget };
            }
          ).shadow;
          return target === shadow?.map || target === shadow?.mapPass;
        })
      )
        owner.replace(
          (Array.isArray(target.texture) ? target.texture : [target.texture])
            .map((t) => t.uuid)
            .join(":"),
          target,
        );
      setTarget.call(gl, target, ...rest);
    };
    // drei r180's blur plane and depth/blur materials are allocated outside the
    // React tree. Target cleanup alone leaves one uploaded plane per finish edit.
    const captureRender: typeof gl.render = function (renderScene, camera) {
      if (targetOwners.get(gl) === owner) {
        if (renderScene === scene && scene.overrideMaterial)
          owner.replace(
            "contact-depth:" + scene.overrideMaterial.uuid,
            scene.overrideMaterial,
          );
        if (renderScene !== scene && (renderScene as unknown as Mesh).isMesh) {
          const mesh = renderScene as unknown as Mesh;
          owner.replace("contact-plane:" + mesh.geometry.uuid, mesh.geometry);
          for (const material of Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material])
            owner.replace("contact-blur:" + material.uuid, material);
        }
      }
      const owned = targetOwners.get(gl) === owner;
      const shadowUpdate = gl.shadowMap.autoUpdate;
      const shadowNeedsUpdate = gl.shadowMap.needsUpdate;
      const hidden: Object3D[] = [];
      // Contact-depth override needs no directional shadow pass. Restore before
      // the main pass; moving furniture still receives dynamic shadows there.
      if (owned) {
        gl.shadowMap.autoUpdate = false;
        gl.shadowMap.needsUpdate = false;
        // One bounded floor-contact pass after an edit, not an active-frame
        // traversal. Upper furniture cannot contribute within the 1.2 m depth.
        if (renderScene === scene) {
          scene.updateMatrixWorld(true);
          const bounds = new Box3();
          scene.traverse((o) => {
            const mesh = o as Mesh;
            if (
              mesh.isMesh &&
              mesh.visible &&
              (mesh.userData.shadowOnly ||
                !mesh.castShadow ||
                bounds.setFromObject(mesh).min.y > 1.2)
            ) {
              hidden.push(mesh);
              mesh.visible = false;
            }
          });
        }
      }
      try {
        render.call(gl, renderScene, camera);
      } finally {
        // Only undo what the contact pass changed. Restoring the flags after
        // every render put back R3F's start-up needsUpdate = true, so the AO
        // normal pass redrew both shadow maps on every frame.
        if (owned) {
          gl.shadowMap.autoUpdate = shadowUpdate;
          gl.shadowMap.needsUpdate = shadowNeedsUpdate;
        }
        hidden.forEach((o) => (o.visible = true));
      }
    };
    gl.render = captureRender;
    return () => {
      gl.setRenderTarget = setTarget;
      if (gl.render === captureRender) gl.render = render;
      targetOwners.delete(gl);
      owner.dispose();
    };
  }, [gl, scene, owner]);
  useFrame(() => targetOwners.set(gl, owner), -0.25);
  useFrame(() => targetOwners.delete(gl), 0.5);
}

/** Acquire only on commit; aborted/StrictMode renders cannot leak a lease. */
export function useSharedResource<T extends Disposable>(
  cache: ResourceCache<T>,
  key: string | null,
  create: () => T,
) {
  const [held, setHeld] = useState<{ key: string; value: T } | null>(null);
  useLayoutEffect(() => {
    if (key === null) {
      setHeld(null);
      return;
    }
    const lease = cache.acquire(key, create);
    setHeld({ key, value: lease.value });
    return lease.release;
    // The key represents all creation inputs; callback identity is intentionally irrelevant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, key]);
  return held?.key === key ? held.value : undefined;
}

/** Static GLTF contract: transforms cloned, geometry/maps shared, overrides local. */
export function instantiateModel(
  source: Object3D,
  owner: SceneResources,
  overrides: Record<string, (material: Material) => void> = {},
) {
  const instance = source.clone(true);
  instance.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    const override = overrides[mesh.name];
    if (!override) return;
    const clone = (material: Material, index: number) => {
      const local = owner.replace(
        `${instance.uuid}:${mesh.uuid}:${index}`,
        material.clone(),
      );
      override(local);
      return local;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(clone)
      : clone(mesh.material, 0);
  });
  return instance;
}
