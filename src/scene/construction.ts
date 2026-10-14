/** Illustrative millimetre construction, not a manufacturer-specific fitting specification. */
import type { Cabinet } from "../catalog/types";
/** Shared layout/render elevation. Inputs cm, output metres, worktop already metres. */
export function cabinetElevation(cabinet: Cabinet, worktopThickness = 0.038) {
  const bottom =
    cabinet.level === "wall" ? 1.4 : cabinet.level === "wardrobe" ? 0 : 0.1;
  return {
    bottom,
    carcassTop: bottom + cabinet.height / 100,
    top:
      bottom +
      cabinet.height / 100 +
      (cabinet.level === "base" ? worktopThickness : 0),
  };
}
export const construction = {
  panel: 0.018,
  back: 0.008,
  backInset: 0.025,
  shelfSetback: 0.045,
  shelfCentreZ: -0.008,
};
export function shelfDepth(depth: number) {
  return depth - 0.075;
}
export function drawerConstruction(
  width: number,
  height: number,
  depth: number,
) {
  const side = 0.012,
    bottom = 0.01,
    outerWidth = width - 0.048;
  const bodyDepth = Math.min(0.46, shelfDepth(depth));
  const bottomY = -height / 2 + 0.025;
  const sideHeight = Math.max(0.06, height * 0.65);
  return {
    side,
    bottom,
    outerWidth,
    bodyDepth,
    bottomY,
    sideHeight,
    sideY: bottomY + bottom / 2 + sideHeight / 2,
    centreZ: -bodyDepth / 2 - 0.016,
    backZ: -bodyDepth - 0.016 + side / 2,
    extension: Math.min(0.38, bodyDepth * 0.85),
  };
}
