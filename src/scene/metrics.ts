import {
  FloatType,
  HalfFloatType,
  RGBFormat,
  RedFormat,
  RGFormat,
  UnsignedShortType,
  UnsignedIntType,
  ByteType,
  ShortType,
  IntType,
} from "three";
import type { Texture, BufferGeometry } from "three";
export function percentile(
  values: readonly number[],
  p: number,
): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}
/** Uncompressed GPU-storage estimate, not transfer bytes or total GPU memory. */
export function textureBytes(texture: Texture): number {
  const image = (
    Array.isArray(texture.image) ? texture.image[0] : texture.image
  ) as { width?: number; height?: number; depth?: number } | undefined;
  if (!image?.width || !image.height) return 0;
  const components =
    texture.format === RedFormat
      ? 1
      : texture.format === RGFormat
        ? 2
        : texture.format === RGBFormat
          ? 3
          : 4;
  const bytes = ([FloatType, UnsignedIntType, IntType] as number[]).includes(
    texture.type,
  )
    ? 4
    : ([HalfFloatType, UnsignedShortType, ShortType] as number[]).includes(
          texture.type,
        )
      ? 2
      : 1;
  const faces = Array.isArray(texture.image) ? 6 : 1;
  return Math.ceil(
    image.width *
      image.height *
      (image.depth || 1) *
      components *
      bytes *
      faces *
      (texture.generateMipmaps ? 4 / 3 : 1),
  );
}
export function geometryBytes(geometries: Iterable<BufferGeometry>): number {
  const buffers = new Set<ArrayBufferLike>();
  for (const g of geometries) {
    for (const a of [
      ...Object.values(g.attributes),
      ...Object.values(g.morphAttributes).flat(),
      ...(g.index ? [g.index] : []),
    ]) {
      const array = "data" in a ? a.data.array : a.array;
      buffers.add(array.buffer);
    }
  }
  return [...buffers].reduce((n, b) => n + b.byteLength, 0);
}
export type PassCount = {
  calls: number;
  triangles: number;
  cpuSubmitMs: number;
};
export const emptyPass = (): PassCount => ({
  calls: 0,
  triangles: 0,
  cpuSubmitMs: 0,
});
export type MetricsReport = {
  camera?: { position: number[]; quaternion: number[] };
  renderedFrames?: number;
  roomLighting?: {
    source: string;
    direction: number[];
    shadowSize: number;
    shadowCasters: number;
  };
  roomEnvironment?: {
    mode: string;
    resolution: number;
    refreshes: number;
    lastMs: number;
    fallbackReason: string;
    signature: string;
  };
  peakDrawFrame?: {
    main: number;
    shadow: number;
    offscreen: number;
    total: number;
  };
  version: 1;
  sceneId: string;
  scope: "desktop-browser" | "physical-tablet";
  device: { label: string; userAgent: string };
  recordedAt: string;
  viewport: { width: number; height: number; dpr: number };
  renderer: string;
  quality: string;
  movingFrames: {
    samples: number;
    p50Ms: number | null;
    p95Ms: number | null;
    maxMs: number | null;
  };
  sceneReadyMs: number | null;
  passes: {
    main: PassCount;
    shadow: PassCount;
    offscreen: PassCount;
    probe: PassCount;
  };
  rendererCounts: { textures: number; geometries: number };
  estimates: {
    texturesBytes: number;
    renderTargetsBytes: number;
    geometryBytes: number;
    framebufferBytes: number;
    totalBytes: number;
    capturePeakBytes: number;
  };
  notes: string[];
};
