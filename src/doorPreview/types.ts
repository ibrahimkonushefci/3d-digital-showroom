import { z } from "zod";
import { OfferDetailsSchema } from "../catalog/types";

const PointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export const PlacementSchema = z.object({
  id: z.string().max(100),
  kind: z.enum(["door", "window"]),
  modelId: z.string().max(100),
  corners: z.tuple([PointSchema, PointSchema, PointSchema, PointSchema]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  handle: z.string().max(100),
  brightness: z.number().min(0.45).max(1.5),
  width: z.number().min(20).max(600),
  height: z.number().min(20).max(600),
  options: z.array(z.string()).default([]),
  materialType: z.string().default("pvc"),
  profile: z.string().default("standard"),
  finishId: z.string().optional(),
  colorInside: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  panes: z.number().int().min(1).max(3).default(2),
  shutterOpen: z.boolean().default(true),
});
export type Placement = z.infer<typeof PlacementSchema>;
export const SavedPhotoSchema = z.object({
  photo: z
    .string()
    .max(30000000)
    .regex(/^data:image\/(jpeg|png|webp);base64,/),
  placements: z.array(PlacementSchema).max(60),
});

export const FacadeSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  kind: z.literal("facade"),
  view: z.enum(["house", "photo"]).default("house"),
  items: z.array(PlacementSchema).min(1).max(60),
  facadeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  evening: z.boolean(),
  railing: z.enum(["glass", "metal"]),
  gate: z.enum(["sliding", "swing"]),
  garage: z.boolean(),
  installation: z.boolean(),
  vat: z.boolean(),
  exact: z.boolean(),
  removal: z.boolean(),
  offer: OfferDetailsSchema.optional(),
});
export type FacadeDesign = z.infer<typeof FacadeSchema>;

export const PhotoSceneSchema = z.object({
  version: z.literal(1),
  photo: z
    .string()
    .regex(/^shared\/scenes\/[a-z0-9-]+\.(jpg|jpeg|png|webp|svg)$/),
  placements: z
    .array(
      PlacementSchema.pick({
        kind: true,
        corners: true,
        width: true,
        height: true,
      }),
    )
    .max(60),
});
