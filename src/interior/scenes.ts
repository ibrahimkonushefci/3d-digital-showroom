import metadata from "../../public/shared/interior/scenes.json";
import type { Corners, Point } from "../doorPreview/homography";
import type { InteriorDesign } from "./types";
export type PhotoDoor = {
  leaf: Corners;
  frame: Corners;
  opening?: Corners;
  handle: [number, number];
  hardwareSize: [number, number];
  handleSide: string;
  shade: number;
};
export type InteriorPhoto = {
  image: string;
  width: number;
  height: number;
  floorPlane: Corners;
  floorMeters: [number, number];
  floorPolygons: Point[][];
  skirtingPolygons: Point[][];
  occlusions: Point[][];
  doors: PhotoDoor[];
  framing: PhotoView;
};
const corners = (a: number[][]) => a.map(([x, y]) => ({ x, y })) as Corners;
function scene(
  s: typeof metadata.hallway | typeof metadata.bedroom | typeof metadata.living,
): InteriorPhoto {
  return {
    ...s,
    floorMeters: s.floorMeters as [number, number],
    floorPlane: corners(s.floorPlane),
    skirtingPolygons: s.skirtingPolygons.map((p) =>
      p.map(([x, y]) => ({ x, y })),
    ),
    floorPolygons: s.floorPolygons.map((p) => p.map(([x, y]) => ({ x, y }))),
    occlusions: ((s.occlusions || []) as number[][][]).map((p) =>
      p.map(([x, y]) => ({ x, y })),
    ),
    doors: s.doors.map((d) => ({
      ...d,
      handle: d.handle as [number, number],
      hardwareSize: d.hardwareSize as [number, number],
      leaf: corners(d.leaf),
      frame: corners(d.frame),
      opening: "opening" in d ? corners(d.opening as number[][]) : undefined,
    })),
  };
}
export const interiorPhotos = {
  hallway: scene(metadata.hallway),
  bedroom: scene(metadata.bedroom),
  living: scene(metadata.living),
};
export type PhotoView = { zoom: number; x: number; y: number };
export const defaultPhotoView: PhotoView = { zoom: 1, x: 0, y: 0 };
export function boundedPhotoView(v: PhotoView): PhotoView {
  const zoom = Math.max(1, Math.min(1.8, v.zoom)),
    bound = (1 - 1 / zoom) / 2;
  return {
    zoom,
    x: Math.max(-bound, Math.min(bound, v.x)),
    y: Math.max(-bound, Math.min(bound, v.y)),
  };
}
export function supportedPhotoDoor(style: string) {
  return ["flat", "glass", "grooves"].includes(style);
}
