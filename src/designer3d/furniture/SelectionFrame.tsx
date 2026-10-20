import { useMemo } from "react";
import { Line } from "@react-three/drei";

/** Selected: the unit being edited. Suggested: a unit offered for replacing
 * or narrowing when nothing fits (never confused with the green free places). */
export type FrameKind = "selected" | "suggested";

const SELECTED = "#1f66e5",
  SUGGESTED = "#e8930c",
  HALO = "#ffffff",
  // Pale and grey-blue: a saturated blue turns dark fronts navy and wood
  // purple, so the tint only lifts the unit slightly and the line does the rest.
  TINT = "#b4c8ee";
const noRaycast = () => null;
const hidden = { exportHidden: true, aoExclude: true };

/**
 * One outline around a whole unit (local frame: bottom centre, fronts at
 * +z), drawn as a thin white halo with a coloured core so it reads on pale,
 * dark and wooden fronts without pulling all the attention, plus a faint
 * tint for the selected unit. It wraps the
 * carcass rather than the fronts, so it stays put while doors open, and
 * covers units without a door (open shelves, sliding wardrobes, drawers).
 * Lines and the transparent tint are excluded from AO (excludedFromAO), the
 * PDF capture (exportHidden) and picking.
 */
export function SelectionFrame({
  kind,
  w,
  y0,
  y1,
  z0,
  z1,
}: {
  kind: FrameKind;
  w: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}) {
  const x = w / 2 + 0.004;
  const segments = useMemo(() => {
    const p = (sx: number, y: number, z: number) =>
      [sx * x, y, z] as [number, number, number];
    const out: [number, number, number][] = [];
    for (const z of [z0, z1])
      for (const [a, b] of [
        [p(-1, y0, z), p(1, y0, z)],
        [p(1, y0, z), p(1, y1, z)],
        [p(1, y1, z), p(-1, y1, z)],
        [p(-1, y1, z), p(-1, y0, z)],
      ])
        out.push(a, b);
    for (const sx of [-1, 1])
      for (const y of [y0, y1]) out.push(p(sx, y, z0), p(sx, y, z1));
    return out;
  }, [x, y0, y1, z0, z1]);
  const selected = kind === "selected";
  const colour = selected ? SELECTED : SUGGESTED;
  return (
    <group userData={hidden}>
      <Line
        points={segments}
        segments
        color={HALO}
        lineWidth={selected ? 4 : 4.5}
        transparent
        opacity={0.9}
        depthWrite={false}
        raycast={noRaycast}
        userData={hidden}
        renderOrder={11}
      />
      <Line
        points={segments}
        segments
        color={colour}
        lineWidth={selected ? 2 : 2.5}
        // Transparent like the halo, so renderOrder draws it on top.
        transparent
        depthWrite={false}
        dashed={!selected}
        dashSize={0.08}
        gapSize={0.05}
        raycast={noRaycast}
        userData={hidden}
        renderOrder={12}
      />
      {selected && (
        <mesh
          position={[0, (y0 + y1) / 2, (z0 + z1) / 2]}
          raycast={noRaycast}
          userData={hidden}
          renderOrder={10}
        >
          <boxGeometry args={[2 * x, y1 - y0, z1 - z0]} />
          <meshBasicMaterial
            color={TINT}
            transparent
            opacity={0.06}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
