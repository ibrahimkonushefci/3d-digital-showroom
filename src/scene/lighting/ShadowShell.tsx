import { useMemo } from "react";
import { BoxGeometry, type BufferGeometry, DoubleSide } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { DesignDocument } from "../../catalog/types";
import { useQuality } from "../quality";
import { ResourceCache, useSharedResource } from "../resources";
import { wallPieces, openingShadowPieces } from "./lightingRecipe";
import { resolveRoom } from "../rooms/resolveRoom";
const cache = new ResourceCache<BufferGeometry>();
export function ShadowShell({ design }: { design: DesignDocument }) {
  const quality = useQuality();
  const { envelope } = resolveRoom(design);
  const pieces = useMemo(() => {
    // The presentation room's walls, in the design room's corner frame.
    const [ox, oz] = envelope.origin;
    return [
      ...(["back", "left", "right", "front"] as const).flatMap((s) =>
        wallPieces(envelope.room, s),
      ),
      ...openingShadowPieces(envelope.room),
    ].map((p) => ({
      ...p,
      position: [p.position[0] + ox, p.position[1], p.position[2] + oz] as [
        number,
        number,
        number,
      ],
    }));
  }, [envelope]);
  const geometry = useSharedResource(cache, JSON.stringify(pieces), () => {
    const parts = pieces.map((p) => {
      const box = new BoxGeometry(...p.size);
      const g = box.toNonIndexed();
      box.dispose();
      g.clearGroups();
      g.rotateY(p.rotation[1]);
      g.translate(...p.position);
      return g;
    });
    const merged = mergeGeometries(parts, false)!;
    parts.forEach((g) => g.dispose());
    return merged;
  });
  // r180 shadow traversal uses the MAIN camera layers. Layer-only exclusion
  // would also lose shadows. A visible, no-color/no-depth material stays in
  // shadow traversal regardless of the camera-controlled visible wall groups.
  return quality !== "lightweight" && geometry ? (
    <mesh castShadow raycast={() => {}} userData={{ shadowOnly: true }}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        colorWrite={false}
        depthWrite={false}
        depthTest={false}
        side={DoubleSide}
      />
    </mesh>
  ) : null;
}
