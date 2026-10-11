import { useMemo, useEffect, Suspense } from "react";
import { Shape, Path, ExtrudeGeometry } from "three";
import type { Catalog, DesignDocument } from "../catalog/types";
import { worktopRuns, pointInPolygon } from "./countertopGeometry";
import { countertopThickness } from "./furnitureMaterials";
import { SurfaceMaterial } from "./Materials";
export function Worktops({
  design,
  catalog,
}: {
  design: DesignDocument;
  catalog: Catalog;
}) {
  const thickness = countertopThickness(design, catalog);
  const slabs = useMemo(
    () =>
      worktopRuns(design.cabinets, catalog).flatMap((run) =>
        run.outlines.map((points) => {
          const shape = new Shape();
          points.forEach(([x, z], i) =>
            i ? shape.lineTo(x, z) : shape.moveTo(x, z),
          );
          shape.closePath();
          for (const h of run.holes)
            if (pointInPolygon(h[0], points)) {
              const path = new Path();
              [...h]
                .reverse()
                .forEach(([x, z], i) =>
                  i ? path.lineTo(x, z) : path.moveTo(x, z),
                );
              path.closePath();
              shape.holes.push(path);
            }
          const geometry = new ExtrudeGeometry(shape, {
            depth: thickness,
            bevelEnabled: true,
            bevelThickness: 0.002,
            bevelSize: 0.002,
            bevelSegments: 4,
            steps: 1,
            curveSegments: 8,
          });
          return { geometry, y: 0.1 + run.height / 100 + thickness };
        }),
      ),
    [design.cabinets, catalog, thickness],
  );
  useEffect(() => () => slabs.forEach((s) => s.geometry.dispose()), [slabs]);
  const material = catalog.countertops.find(
    (m) => m.id === design.style.countertop,
  )!;
  return (
    <>
      {slabs.map((s, i) => (
        <mesh
          key={i}
          geometry={s.geometry}
          position={[0, s.y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        >
          <Suspense fallback={<meshStandardMaterial color={material.color} />}>
            <SurfaceMaterial material={material} world />
          </Suspense>
        </mesh>
      ))}
    </>
  );
}
