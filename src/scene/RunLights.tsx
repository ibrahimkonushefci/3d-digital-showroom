import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import type { DesignDocument } from "../catalog/types";
import { useQuality } from "./quality";
import { wallOffset, wallPosition } from "../designer3d/layout";
RectAreaLightUniformsLib.init();
export function RunLights({ design }: { design: DesignDocument }) {
  const q = useQuality();
  if (!design.style.led || q === "lightweight") return null;
  const runs: Array<{
    wall: DesignDocument["cabinets"][number]["wall"];
    a: number;
    b: number;
    depth: number;
  }> = [];
  for (const c of design.cabinets
    .filter((c) => c.level === "wall")
    .sort(
      (a, b) => a.wall.localeCompare(b.wall) || wallOffset(a) - wallOffset(b),
    )) {
    const a = wallOffset(c),
      b = a + c.width,
      last = runs.at(-1);
    if (last && last.wall === c.wall && a <= last.b + 0.1)
      last.b = Math.max(last.b, b);
    else runs.push({ wall: c.wall, a, b, depth: c.depth });
  }
  return (
    <>
      {runs
        .sort((a, b) => b.b - b.a - (a.b - a.a))
        .slice(0, 3)
        .map(({ wall, a, b, depth }, i) => {
          const p = wallPosition(wall, a, b - a, depth, design.room);
          return (
            <group
              key={i}
              position={[p.x / 100, 1.385, p.z / 100]}
              rotation={[0, p.rotation, 0]}
            >
              <rectAreaLight
                position={[0, 0, 0.1]}
                rotation={[-Math.PI / 2, 0, 0]}
                width={(b - a) / 100}
                height={0.06}
                intensity={4}
                color="#ffd1a1"
              />
            </group>
          );
        })}
    </>
  );
}
