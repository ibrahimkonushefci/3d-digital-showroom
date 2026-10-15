import {
  Component,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  useLayoutEffect,
  type ReactNode,
} from "react";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  Color,
  Matrix4,
  Mesh,
  Object3D,
  type InstancedMesh,
  type MeshStandardMaterial,
} from "three";
import { useThree } from "@react-three/fiber";
import { DecodedCache } from "../resources";
import { useQuality } from "../quality";
import { modelRecord } from "./manifest";
const cache = new DecodedCache<{ gltf: GLTF; dispose(): void }>();
const noHit = () => {};
/** DEV studio may exercise missing-file isolation; default runtime always loads local models. */
export const ModelPolicy = createContext<"detailed" | "fallback" | "missing">(
  "detailed",
);
let pending = 0;
export const pendingModelLoads = () => pending;
type Transform = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Fabric colour for this instance (materials named "fabric" only). */
  tint?: string;
};
/** Material slots that take a per-instance colour; others keep their own. */
const TINTED = new Set(["fabric"]);
class IsolatedModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function LoadedModel({
  path,
  transforms,
  selectable,
  fallback,
  castShadow,
  glow,
}: {
  path: string;
  transforms: Transform[];
  selectable: boolean;
  fallback: ReactNode;
  castShadow: boolean;
  glow?: string;
}) {
  const [source, setSource] = useState<GLTF | null>(null);
  const { invalidate } = useThree();
  useEffect(() => {
    let live = true;
    const lease = cache.acquire(path, async () => {
      pending++;
      let gltf: GLTF;
      try {
        // Phase 2 kit geometry is quantised + meshopt-compressed; the decoder
        // ships inside three (wasm embedded), so this stays offline-safe.
        gltf = await new GLTFLoader()
          .setMeshoptDecoder(MeshoptDecoder)
          .loadAsync("/" + path);
      } finally {
        pending--;
      }
      return {
        gltf,
        dispose() {
          const gs = new Set<Mesh["geometry"]>(),
            ms = new Set<Mesh["material"]>();
          gltf.scene.traverse((o) => {
            if ((o as Mesh).isMesh) {
              gs.add((o as Mesh).geometry);
              ms.add((o as Mesh).material);
            }
          });
          gs.forEach((g) => g.dispose());
          ms.forEach((m) =>
            (Array.isArray(m) ? m : [m]).forEach((v) => v.dispose()),
          );
        },
      };
    });
    setSource(null);
    lease.value.promise.then(
      (v) => {
        if (live) {
          setSource(v.gltf);
          invalidate();
        }
      },
      () => {
        if (live) {
          setSource(null);
          invalidate();
        }
      },
    );
    return () => {
      live = false;
      lease.release();
    };
  }, [path, invalidate]);
  const parts = useMemo(() => {
    if (!source) return [];
    source.scene.updateMatrixWorld(true);
    const result: {
      mesh: Mesh;
      material: Mesh["material"];
      matrices: Matrix4[];
      colours?: Color[];
    }[] = [];
    source.scene.traverse((o) => {
      if ((o as Mesh).isMesh) {
        const mesh = o as Mesh;
        const shared = mesh.material as MeshStandardMaterial;
        // A lit diffuser is an owned copy; the shared decoded material stays immutable.
        let material: Mesh["material"] = mesh.material;
        if (glow && !Array.isArray(shared) && shared.name === glow) {
          const lit = shared.clone();
          lit.emissive.set("#fff1d6");
          lit.emissiveIntensity = 1.6;
          material = lit;
        }
        result.push({
          mesh,
          material,
          matrices: transforms.map((t) => {
            const obj = new Object3D();
            obj.position.fromArray(t.position || [0, 0, 0]);
            obj.rotation.set(...(t.rotation || [0, 0, 0]));
            obj.updateMatrix();
            return obj.matrix.multiply(mesh.matrixWorld);
          }),
          colours:
            !Array.isArray(shared) &&
            TINTED.has(shared.name) &&
            transforms.some((t) => t.tint)
              ? transforms.map((t) => new Color(t.tint || "#ffffff"))
              : undefined,
        });
      }
    });
    return result;
  }, [source, transforms, glow]);
  useEffect(
    () => () =>
      parts.forEach(
        (p) =>
          p.material !== p.mesh.material &&
          (p.material as MeshStandardMaterial).dispose(),
      ),
    [parts],
  );
  if (!source) return fallback;
  return (
    <group dispose={null}>
      {parts.map(({ mesh, material, matrices, colours }) => (
        <ModelInstances
          key={mesh.uuid + ":" + matrices.length + (colours ? ":c" : "")}
          mesh={mesh}
          material={material}
          matrices={matrices}
          colours={colours}
          selectable={selectable}
          castShadow={castShadow}
        />
      ))}
    </group>
  );
}
function ModelInstances({
  mesh,
  material,
  matrices,
  colours,
  selectable,
  castShadow,
}: {
  mesh: Mesh;
  material: Mesh["material"];
  matrices: Matrix4[];
  colours?: Color[];
  selectable: boolean;
  castShadow: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const o = ref.current;
    if (o) {
      matrices.forEach((m, i) => o.setMatrixAt(i, m));
      o.instanceMatrix.needsUpdate = true;
      if (colours) {
        colours.forEach((c, i) => o.setColorAt(i, c));
        o.instanceColor!.needsUpdate = true;
      }
      o.computeBoundingSphere();
    }
  }, [matrices, colours]);
  // Source geometry/material leases are shared; instance buffers belong to this wrapper.
  useLayoutEffect(() => {
    const o = ref.current;
    return () => {
      o?.dispose();
    };
  }, []);
  return (
    <instancedMesh
      ref={ref}
      args={[mesh.geometry, material, matrices.length]}
      dispose={null}
      castShadow={castShadow}
      receiveShadow
      raycast={selectable ? undefined : noHit}
    />
  );
}
/** Fixed metre-scale geometry; per-instance matrices, shared immutable source resources. */
export function ModelAsset({
  id,
  fallback = null,
  transforms,
  position,
  rotation,
  selectable = false,
  disabled = false,
  castShadow = true,
  glow,
}: {
  id: string;
  fallback?: ReactNode;
  transforms?: Transform[];
  selectable?: boolean;
  disabled?: boolean;
  /** Ceiling fixtures stay out of the shadow maps. */
  castShadow?: boolean;
  /** Material slot name rendered as a lit diffuser. */
  glow?: string;
} & Transform) {
  const quality = useQuality(),
    record = modelRecord(id);
  const policy = useContext(ModelPolicy);
  const instances = useMemo(
    () => transforms || [{ position, rotation }],
    [transforms, position?.join(), rotation?.join()],
  );
  const path =
    policy === "missing"
      ? "shared/models/phase-2-missing-fixture.glb"
      : record &&
        (quality === "lightweight" ? record.lowerDetail.path : record.path);
  // Retain fallback until the isolated async model is ready (and after failure).
  return (
    <IsolatedModelBoundary key={path} fallback={fallback}>
      {disabled || policy === "fallback" || !path ? (
        fallback
      ) : (
        <LoadedModel
          path={path}
          transforms={instances}
          selectable={selectable}
          fallback={fallback}
          castShadow={castShadow}
          glow={glow}
        />
      )}
    </IsolatedModelBoundary>
  );
}
