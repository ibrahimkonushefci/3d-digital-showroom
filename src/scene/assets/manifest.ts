import { z } from "zod";
import raw from "../../../public/shared/asset-manifest.json";
const local = z.string().regex(/^shared\/models\/[a-z0-9-]+\.glb$/);
const vec = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
const stats = z.object({
  path: local,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().positive().max(1_000_000),
  triangles: z.number().int().nonnegative(),
  drawCalls: z.number().int().nonnegative(),
  geometryBytes: z.number().nonnegative(),
  nativeDimensions: vec.refine((v) => v.every((n) => n > 0)),
  bounds: z.object({ min: vec, max: vec }),
});
export const ModelManifestSchema = z.object({
  version: z.literal(1),
  revision: z.string(),
  assets: z.array(
    stats.extend({
      id: z.string(),
      revision: z.number().int().positive(),
      lowerDetail: stats,
      nativeDimensions: vec.refine((v) => v.every((n) => n > 0)),
      bounds: z.object({ min: vec, max: vec }),
      materialSlots: z.array(z.string()),
      origin: z.enum([
        "center",
        "floor-front",
        "countertop",
        "floor",
        "ceiling",
        "rail",
        "shelf",
        "wall",
      ]),
      up: z.literal("+Y"),
      forward: z.literal("+Z"),
      anchors: z.record(z.string(), vec),
      quality: z.literal("balanced"),
      decodedTextureBytes: z.number().nonnegative(),
      licenseKey: z.string(),
      source: z.string(),
      sourceSha256: z.string(),
      quotedProduct: z.literal(false),
    }),
  ),
});
export const modelManifest = ModelManifestSchema.parse(raw);
// Asset bytes invalidate saved previews even when a recipe ID is unchanged.
export const SCENE_REVISION = JSON.stringify([
  modelManifest.revision,
  ...modelManifest.assets.map((a) => [a.id, a.sha256, a.lowerDetail.sha256]),
]);
export type ModelRecord = (typeof modelManifest.assets)[number];
export const modelRecord = (id: string) =>
  modelManifest.assets.find((a) => a.id === id);
export const requiredSceneAssets = [
  ...new Set([
    "shared/asset-manifest.json",
    "shared/rooms/kitchen-warm-v3.json",
    "shared/rooms/wardrobe-warm-v3.json",
    ...modelManifest.assets.flatMap((a) => [a.path, a.lowerDetail.path]),
  ]),
];
