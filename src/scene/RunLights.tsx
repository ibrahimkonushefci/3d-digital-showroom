import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import type { DesignDocument } from "../catalog/types";
import { useQuality } from "./quality";
import { wallOffset, wallPosition } from "../designer3d/layout";
import { MAX_LED_FILLS } from "./lighting/lightingRecipe";
RectAreaLightUniformsLib.init();
export function ledRuns(design: DesignDocument) {
  const wardrobe = design.kind === "wardrobe";
  if (!(wardrobe ? design.environment?.internalLed : design.style.led))
    return [];
  const runs: Array<{
    wall: DesignDocument["cabinets"][number]["wall"];
    a: number;
    b: number;
    depth: number;
    height: number;
  }> = [];
  for (const c of design.cabinets
    .filter((c) => c.level === (wardrobe ? "wardrobe" : "wall"))
    .sort(
      (a, b) => a.wall.localeCompare(b.wall) || wallOffset(a) - wallOffset(b),
    )) {
    const a = wallOffset(c),
      b = a + c.width,
      last = runs.at(-1);
    if (
      last &&
      last.wall === c.wall &&
      last.height === c.height &&
      last.depth === c.depth &&
      a <= last.b + 0.1
    )
      last.b = Math.max(last.b, b);
    else runs.push({ wall: c.wall, a, b, depth: c.depth, height: c.height });
  }
  return runs.sort((a, b) => b.b - b.a - (a.b - a.a)).slice(0, MAX_LED_FILLS);
}
export function RunLights({ design }: { design: DesignDocument }) {
  const q = useQuality();
  const wardrobe = design.kind === "wardrobe";
  if (q === "lightweight") return null;
  return (
    <>
      {ledRuns(design).map(({ wall, a, b, depth, height }, i) => {
        const p = wallPosition(wall, a, b - a, depth, design.room);
        return (
          <group
            key={i}
            position={[
              p.x / 100,
              wardrobe ? height / 100 - 0.045 : 1.385,
              p.z / 100,
            ]}
            rotation={[0, p.rotation, 0]}
          >
            <rectAreaLight
              position={[0, 0, wardrobe ? depth / 200 - 0.045 : 0.1]}
              rotation={[wardrobe ? -Math.PI / 4 : -Math.PI / 2, 0, 0]}
              width={(b - a) / 100}
              height={0.06}
              intensity={wardrobe ? 1.8 : 4}
              color="#ffd1a1"
            />
          </group>
        );
      })}
    </>
  );
}
