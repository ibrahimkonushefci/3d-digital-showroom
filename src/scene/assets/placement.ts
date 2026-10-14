import type { Cabinet, DesignDocument } from "../../catalog/types";
export type Volume = {
  min: [number, number, number];
  max: [number, number, number];
};
export const overlaps = (a: Volume, b: Volume) =>
  a.min.every((v, i) => v < b.max[i] - 0.001 && a.max[i] > b.min[i] + 0.001);
export function transformedVolume(
  min: number[],
  max: number[],
  position: number[],
  rotation = 0,
): Volume {
  const xs: number[] = [],
    zs: number[] = [];
  for (const x of [min[0], max[0]])
    for (const z of [min[2], max[2]]) {
      xs.push(position[0] + x * Math.cos(rotation) + z * Math.sin(rotation));
      zs.push(position[2] - x * Math.sin(rotation) + z * Math.cos(rotation));
    }
  return {
    min: [Math.min(...xs), min[1] + position[1], Math.min(...zs)],
    max: [Math.max(...xs), max[1] + position[1], Math.max(...zs)],
  };
}
/** Conservative envelope includes fronts and fully extended drawers. */
export function cabinetExclusion(c: Cabinet): Volume {
  const y = c.level === "wall" ? 1.4 : c.level === "wardrobe" ? 0 : 0.1,
    w = c.width / 100,
    d = c.depth / 100,
    h = c.height / 100;
  return transformedVolume(
    [-w / 2 - 0.04, y, -d / 2 - 0.04],
    [w / 2 + 0.04, y + h + 0.05, d / 2 + Math.max(0.75, w / 2)],
    [c.x / 100, 0, c.z / 100],
    c.rotation,
  );
}
export function doorExclusions(d: DesignDocument): Volume[] {
  return d.room.openings
    .filter((o) => o.type === "door")
    .map((o) => {
      const s = o.width / 100 + 0.1,
        off = o.offset / 100;
      const x =
        o.wall === "left" ? 0 : o.wall === "right" ? d.room.width / 100 : off;
      const z =
        o.wall === "back" ? 0 : o.wall === "front" ? d.room.depth / 100 : off;
      return {
        min: [
          Math.max(0, x - (o.wall === "right" ? s : 0)),
          0,
          Math.max(0, z - (o.wall === "front" ? s : 0)),
        ],
        max: [
          x + (o.wall === "right" ? 0 : s),
          o.height / 100,
          z + (o.wall === "front" ? 0 : s),
        ],
      };
    });
}
export function freePlacement(
  volume: Volume,
  design: DesignDocument,
  occupied: Volume[] = [],
) {
  return (
    volume.min[0] >= 0.04 &&
    volume.min[2] >= 0.04 &&
    volume.min[1] >= -0.001 &&
    volume.max[0] <= design.room.width / 100 - 0.04 &&
    volume.max[2] <= design.room.depth / 100 - 0.04 &&
    volume.max[1] <= design.room.height / 100 + 0.001 &&
    !occupied.some((v) => overlaps(v, volume)) &&
    ![...design.cabinets.map(cabinetExclusion), ...doorExclusions(design)].some(
      (v) => overlaps(v, volume),
    )
  );
}
/** Fixed-size appliance fronts never stretch with a cabinet. */
export const applianceFits = (
  id: "oven" | "fridge",
  width: number,
  height: number,
) =>
  id === "oven"
    ? width >= 0.598 && width <= 0.62 && height >= 0.59
    : width >= 0.598 && width <= 0.62 && height >= 1.91;

/** Fixed oven slot; the upper furniture front clears the 59 cm fascia. */
export function ovenSlot(height: number) {
  const centre = 0.94,
    upperBottom = centre + 0.59 / 2 + 0.01;
  const upperHeight = Math.max(0, height - 0.008 - upperBottom);
  return {
    centre,
    upperBottom,
    upperHeight,
    upperCentre: upperBottom + upperHeight / 2,
  };
}
