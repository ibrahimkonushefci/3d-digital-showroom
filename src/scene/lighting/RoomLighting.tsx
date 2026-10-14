import { useMemo, useEffect, useRef } from "react";
import { Object3D, type DirectionalLight } from "three";
import { useThree } from "@react-three/fiber";
import type { Catalog, DesignDocument } from "../../catalog/types";
import { useQuality } from "../quality";
import { lightingSignature, resolveLighting } from "./lightingRecipe";
export function RoomLighting({
  design,
  catalog,
}: {
  design: DesignDocument;
  catalog: Catalog;
}) {
  const quality = useQuality();
  const signature = lightingSignature(design);
  const light = useMemo(
    () => resolveLighting(design, catalog, quality),
    [signature, catalog, quality],
  );
  const target = useMemo(() => {
    const object = new Object3D();
    object.position.copy(light.target);
    return object;
  }, [light]);
  const { scene } = useThree();
  const directional = useRef<DirectionalLight>(null);
  useEffect(() => {
    const shadow = directional.current?.shadow;
    if (shadow) {
      if (shadow.map && shadow.map.width !== light.shadowSize) {
        shadow.map.dispose();
        shadow.map = null;
      }
      shadow.camera.updateProjectionMatrix();
      shadow.needsUpdate = true;
    }
    scene.userData.roomLighting = {
      source: light.window?.id || "ceiling-fill-solid-room",
      direction: light.direction.toArray(),
      shadowSize: quality === "lightweight" ? 0 : light.shadowSize,
      shadowCasters: quality === "lightweight" ? 0 : 1,
    };
  }, [scene, light, quality]);
  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={["#fff7ea", "#837767", light.fillIntensity]} />
      <directionalLight
        ref={directional}
        position={light.position.toArray()}
        target={target}
        intensity={light.keyIntensity}
        color={light.color}
        castShadow={quality !== "lightweight"}
        shadow-mapSize={[light.shadowSize, light.shadowSize]}
        shadow-camera-left={light.bounds.left}
        shadow-camera-right={light.bounds.right}
        shadow-camera-top={light.bounds.top}
        shadow-camera-bottom={light.bounds.bottom}
        shadow-camera-near={0.1}
        shadow-camera-far={light.bounds.far}
        shadow-bias={-0.00012}
        shadow-normalBias={0.012}
        shadow-radius={2}
      />
    </>
  );
}
