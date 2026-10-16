import { useMemo } from "react";
import { BoxGeometry, MeshStandardMaterial } from "three";

/** Slat pitch and depth of a 35 mm venetian blind, metres. */
const PITCH = 0.04,
  SLAT = 0.035,
  TILT = 0.55;
/**
 * A venetian blind half lowered inside the window reveal, slats tilted open.
 * Daylight passing between the slats draws the soft striped pattern of the
 * Schmidt reference: crisp in the baked room shell, softened by the live
 * shadow map on the furniture. The lower half stays clear for the garden.
 * Local frame: StudioWindow's (window centre, +Z towards the room).
 */
export function WindowBlind({
  w,
  h,
  drop = 0.42,
}: {
  w: number;
  h: number;
  /** Lowered share of the window height. */
  drop?: number;
}) {
  const geometry = useMemo(() => new BoxGeometry(w - 0.012, 0.0012, SLAT), [w]);
  const rail = useMemo(() => new BoxGeometry(w - 0.006, 0.026, 0.045), [w]);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#eeebe4",
        roughness: 0.55,
        metalness: 0.05,
      }),
    [],
  );
  const count = Math.max(1, Math.floor((h * drop) / PITCH));
  const top = h / 2 - 0.03;
  return (
    <group position={[0, 0, 0.055]}>
      <mesh
        geometry={rail}
        material={material}
        position={[0, h / 2 - 0.013, 0]}
        castShadow
        receiveShadow
        raycast={() => {}}
      />
      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={material}
          position={[0, top - i * PITCH, 0]}
          rotation={[TILT, 0, 0]}
          castShadow
          receiveShadow
          raycast={() => {}}
        />
      ))}
      <mesh
        geometry={rail}
        material={material}
        position={[0, top - count * PITCH, 0]}
        scale={[1, 0.7, 0.9]}
        castShadow
        receiveShadow
        raycast={() => {}}
      />
    </group>
  );
}
