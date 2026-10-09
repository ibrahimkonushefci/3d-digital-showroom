import type { FacadeDesign } from "./types";
export const openingPositions: Record<string, [number, number, number]> = {
  entry: [0, 0.24, 3.08],
  "ground-left": [-2.6, 1.05, 3.08],
  "ground-right": [2.6, 1.05, 3.08],
  "upper-left": [-2.6, 3.9, 3.08],
  "upper-right": [2.6, 3.9, 3.08],
  balcony: [0, 3.4, 3.08],
};
/** A rectangle partition leaves genuine voids for every configured opening and sidelight. */
export function facadePanels(d: FacadeDesign) {
  const holes = d.items
    .filter((p) => openingPositions[p.id])
    .map((p) => {
      const [x, y] = openingPositions[p.id];
      return {
        left: x - p.width / 200 - (p.options.includes("side-left") ? 0.32 : 0),
        right:
          x + p.width / 200 + (p.options.includes("side-right") ? 0.32 : 0),
        bottom: y - 0.025,
        top:
          y +
          p.height / 100 +
          (p.options.includes("transom") ? 0.32 : 0) +
          0.025,
      };
    });
  const xs = [
      ...new Set([
        -4,
        4,
        ...holes.flatMap((h) => [Math.max(-4, h.left), Math.min(4, h.right)]),
      ]),
    ].sort((a, b) => a - b),
    ys = [
      ...new Set([
        0.32,
        6.32,
        ...holes.flatMap((h) => [
          Math.max(0.32, h.bottom),
          Math.min(6.32, h.top),
        ]),
      ]),
    ].sort((a, b) => a - b);
  const panels: {
    size: [number, number, number];
    position: [number, number, number];
  }[] = [];
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      const x = (xs[i] + xs[i + 1]) / 2,
        y = (ys[j] + ys[j + 1]) / 2;
      if (
        !holes.some(
          (h) => x > h.left && x < h.right && y > h.bottom && y < h.top,
        )
      )
        panels.push({
          size: [xs[i + 1] - xs[i], ys[j + 1] - ys[j], 0.18],
          position: [x, y, 3],
        });
    }
  return panels;
}
