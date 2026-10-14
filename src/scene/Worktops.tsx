import { useMemo, useEffect, Suspense } from "react";
import { Shape, Path, ExtrudeGeometry } from "three";
import type { Catalog, DesignDocument } from "../catalog/types";
import { worktopRuns, pointInPolygon } from "./countertopGeometry";

import { SurfaceMaterial } from "./Materials";
import { resolveRunStyle } from "../designer3d/finishes";
import { slabUvGenerator } from "./materialMapping";
export function Worktops({
  design,
  catalog,
}: {
  design: DesignDocument;
  catalog: Catalog;
}) {
  const slabs = useMemo(
    () =>
      worktopRuns(design.cabinets, catalog).flatMap((run) => {
        const { countertop: material, thickness } = resolveRunStyle(
          design,
          run,
          catalog,
        );
        return run.outlines.map((points) => {
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
            // ExtrudeGeometry adds bevelThickness at both ends; keep the tier's outer thickness.
            depth: thickness - 0.004,
            bevelEnabled: true,
            bevelThickness: 0.002,
            bevelSize: 0.002,
            bevelSegments: 2,
            steps: 1,
            curveSegments: 8,
            ...(material.mapping
              ? {
                  UVGenerator: slabUvGenerator(
                    [points, ...run.holes],
                    material.mapping,
                  ),
                }
              : {}),
          });
          geometry.setAttribute("uv1", geometry.getAttribute("uv").clone());
          return {
            geometry,
            material,
            y: 0.1 + run.height / 100 + thickness - 0.002,
          };
        });
      }),
    [
      design.cabinets,
      design.style.countertop,
      design.style.backsplash,
      design.worktopFinishes,
      catalog,
    ],
  );
  useEffect(() => () => slabs.forEach((s) => s.geometry.dispose()), [slabs]);
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
          <Suspense
            fallback={<meshStandardMaterial color={s.material.color} />}
          >
            <SurfaceMaterial material={s.material} world />
          </Suspense>
        </mesh>
      ))}
    </>
  );
}
