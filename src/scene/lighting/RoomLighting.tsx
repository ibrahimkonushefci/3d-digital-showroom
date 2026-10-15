import { useMemo, useEffect, useRef } from "react";
import { Object3D, type DirectionalLight, type SpotLight } from "three";
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
  const keyTarget = useMemo(() => {
    const object = new Object3D();
    object.position.copy(light.interiorKey.target);
    return object;
  }, [light]);
  const { scene } = useThree();
  const directional = useRef<DirectionalLight>(null);
  const key = useRef<SpotLight>(null);
  useEffect(() => {
    const shadow = key.current?.shadow;
    if (!shadow) return;
    if (shadow.map && shadow.map.width !== light.shadowSize) {
      shadow.map.dispose();
      shadow.map = null;
    }
    shadow.camera.updateProjectionMatrix();
    shadow.needsUpdate = true;
  }, [light]);
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
      shadowCasters:
        quality === "lightweight" ? 0 : light.interiorKey.intensity ? 2 : 1,
    };
  }, [scene, light, quality]);
  return (
    <>
      <primitive object={target} />
      <primitive object={keyTarget} />
      {light.interiorKey.intensity > 0 && (
        <spotLight
          ref={key}
          position={light.interiorKey.position.toArray()}
          target={keyTarget}
          intensity={light.interiorKey.intensity}
          color="#fff4e6"
          angle={1.05}
          penumbra={1}
          decay={2}
          castShadow={quality !== "lightweight"}
          shadow-mapSize={[light.shadowSize, light.shadowSize]}
          shadow-camera-near={0.2}
          shadow-camera-far={12}
          shadow-bias={-0.0002}
          shadow-normalBias={0.02}
          shadow-radius={3}
        />
      )}
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
        shadow-radius={8}
      />
    </>
  );
}
