import type { ThreeEvent } from "@react-three/fiber";
import { useDesigner } from "./store";
export function useInteriorInteraction(
  cabinetId: string,
  componentId: string,
  interactive: boolean,
) {
  const stop = (e: ThreeEvent<PointerEvent>) => {
    if (interactive) e.stopPropagation();
  };
  return interactive
    ? {
        onPointerDown: stop,
        onPointerUp: stop,
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta <= 8)
            useDesigner.getState().selectInterior({ cabinetId, componentId });
        },
        onDoubleClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
      }
    : {};
}
