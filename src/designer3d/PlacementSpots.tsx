import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Catalog, DesignDocument } from "../catalog/types";
import { label, useLanguage, useT } from "../i18n";
import { findSpots, placeUnit } from "./placement";
import { commitPlacement, spotBox, spotScreen } from "./placementView";
import { useDesigner } from "./store";

const SPOT_COLOUR = "#2f8a68";

/**
 * Edit mode, while a unit type is being placed: every free place where it
 * fits as a translucent box (its "+ 40 cm" label is SpotLabels, outside the
 * canvas). Tapping a box adds the unit there; a dragged picture card drops
 * into the nearest one. Drawn inside the room group (cm / 100, room origin).
 */
export function PlacementSpots({
  design,
  catalog,
}: {
  design: DesignDocument;
  catalog: Catalog;
}) {
  const placing = useDesigner((s) => s.placing);
  const hover = useDesigner((s) => s.placingHover);
  const edit = useDesigner((s) => s.interactionMode === "edit");
  const t = useT();
  const { language } = useLanguage();
  const { camera, gl, invalidate } = useThree();
  const active = edit && placing ? placing : null;
  const spots = useMemo(
    () => (active ? findSpots(design, catalog, active) : []),
    [design, catalog, active],
  );
  const boxes = useMemo(
    () => spots.map((s) => spotBox(design, catalog, active!, s)),
    [spots],
  );
  const w = design.room.width / 100,
    d = design.room.depth / 100;
  useEffect(() => {
    invalidate();
    if (!boxes.length) return;
    const point = new Vector3();
    spotScreen.centres = () => {
      const r = gl.domElement.getBoundingClientRect();
      return boxes.map((b) => {
        point
          .set(
            (b.x0 + b.x1) / 200 - w / 2,
            (b.y0 + b.y1) / 200,
            (b.z0 + b.z1) / 200 - d / 2,
          )
          .project(camera);
        // Behind the camera or outside the picture: no label, no drop.
        if (point.z > 1 || Math.abs(point.x) > 0.97 || Math.abs(point.y) > 0.95)
          return null;
        return {
          x: r.left + ((point.x + 1) / 2) * r.width,
          y: r.top + ((1 - point.y) / 2) * r.height,
        };
      });
    };
    return () => {
      spotScreen.centres = null;
    };
  }, [boxes, camera, gl, w, d]);
  useEffect(() => invalidate(), [hover]);
  if (!active) return null;
  const name = label(
    catalog.modules.find((m) => m.id === active)!.name,
    language,
  );
  const place = (index: number) =>
    commitPlacement(
      placeUnit(design, catalog, active, spots[index]),
      catalog,
      t("unitAdded", { name }),
    );
  return (
    <>
      {spots.map((spot, i) => {
        const b = boxes[i];
        const centre: [number, number, number] = [
          (b.x0 + b.x1) / 200,
          (b.y0 + b.y1) / 200,
          (b.z0 + b.z1) / 200,
        ];
        return (
          <group key={`${spot.wall}:${spot.gap[0]}`}>
            <mesh
              position={centre}
              renderOrder={10}
              onClick={(e) => {
                e.stopPropagation();
                place(i);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                gl.domElement.style.cursor = "copy";
              }}
              onPointerOut={() => (gl.domElement.style.cursor = "")}
            >
              <boxGeometry
                args={[
                  (b.x1 - b.x0) / 100,
                  (b.y1 - b.y0) / 100,
                  (b.z1 - b.z0) / 100,
                ]}
              />
              <meshBasicMaterial
                color={SPOT_COLOUR}
                transparent
                opacity={hover === i ? 0.5 : 0.28}
                depthWrite={false}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
