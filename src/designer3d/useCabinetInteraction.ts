import { useEffect, useRef } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Plane, Vector3 } from "three";
import type { Cabinet, Catalog, DesignDocument } from "../catalog/types";
import { useDesigner } from "./store";
import { movedCabinet } from "./drag";
export function useCabinetInteraction(
  c: Cabinet,
  catalog: Catalog,
  interactive: boolean,
  operable: boolean,
) {
  const { gl, invalidate } = useThree();
  const active = useRef<{
    pointer: number;
    release: () => void;
    x: number;
    y: number;
    point: Vector3;
    plane: Plane;
    before: DesignDocument;
    moved: boolean;
  } | null>(null);
  const mode = useDesigner((s) => s.interactionMode);
  useEffect(() => {
    const cancel = () => {
      if (!active.current) return;
      active.current.release();
      active.current = null;
      useDesigner.getState().cancelDrag();
      invalidate();
    };
    const second = (e: PointerEvent) => {
      if (active.current && active.current.pointer !== e.pointerId) cancel();
    };
    gl.domElement.addEventListener("pointerdown", second, true);
    gl.domElement.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      cancel();
      gl.domElement.removeEventListener("pointerdown", second, true);
      gl.domElement.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, [gl, invalidate, mode]);
  return {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      const s = useDesigner.getState();
      if (!interactive || mode !== "edit" || s.selected !== c.id || !s.design)
        return;
      e.stopPropagation();
      active.current = {
        pointer: e.pointerId,
        release: () => {
          try {
            (
              e.target as unknown as {
                releasePointerCapture: (id: number) => void;
              }
            ).releasePointerCapture(e.pointerId);
          } catch {
            /* The browser may already have cancelled capture. */
          }
        },
        x: e.clientX,
        y: e.clientY,
        point: e.point.clone(),
        plane: new Plane(new Vector3(0, 1, 0), -e.point.y),
        before: s.design,
        moved: false,
      };
      s.previewDrag(s.design);
      (
        e.target as unknown as { setPointerCapture: (id: number) => void }
      ).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const a = active.current;
      if (!a || a.pointer !== e.pointerId) return;
      e.stopPropagation();
      if (Math.hypot(e.clientX - a.x, e.clientY - a.y) < 8 && !a.moved) return;
      a.moved = true;
      const p = new Vector3();
      if (!e.ray.intersectPlane(a.plane, p)) return;
      const delta =
        c.wall === "left" || c.wall === "right"
          ? p.z - a.point.z
          : p.x - a.point.x;
      useDesigner
        .getState()
        .previewDrag(movedCabinet(a.before, c.id, delta * 100));
    },
    onPointerUp: (e: ThreeEvent<PointerEvent>) => {
      const a = active.current;
      if (!a || a.pointer !== e.pointerId) return;
      e.stopPropagation();
      active.current = null;
      if (a.moved) useDesigner.getState().finishDrag(catalog);
      else useDesigner.getState().cancelDrag();
      a.release();
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (!interactive || e.delta > 8) return;
      e.stopPropagation();
      const s = useDesigner.getState();
      s.select(c.id);
      if (mode === "showroom" && operable) s.toggleOpen(c.id);
    },
  };
}
