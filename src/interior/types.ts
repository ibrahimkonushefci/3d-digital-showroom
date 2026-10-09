import { z } from "zod";
import { OfferDetailsSchema, RoomSchema } from "../catalog/types";
export const InteriorDoorSchema = z.object({
  id: z.string(),
  modelId: z.string(),
  width: z.union([z.literal(70), z.literal(80), z.literal(90)]),
  wall: z.enum(["back", "left", "right", "front"]),
  offset: z.number().nonnegative(),
  opening: z.enum(["left", "right"]),
  finishTier: z.string(),
  finishId: z.string(),
  handleId: z.string(),
  hiddenHinges: z.boolean(),
});
export const InteriorSchema = z.object({
  version: z.literal(1),
  kind: z.literal("interior"),
  id: z.string(),
  preset: z.enum(["hallway", "living", "bedroom"]),
  room: RoomSchema.extend({ height: z.number().min(220).max(600) }),
  laminateId: z.string(),
  pattern: z.enum(["straight", "diagonal", "herringbone"]),
  direction: z.boolean(),
  doors: z.array(InteriorDoorSchema).min(1).max(20),
  skirtingId: z.string(),
  skirtingHeight: z.number().positive(),
  underlay: z.boolean(),
  furniture: z.boolean(),
  evening: z.boolean(),
  installation: z.boolean(),
  vat: z.boolean(),
  exact: z.boolean(),
  offer: OfferDetailsSchema.optional(),
});
export type InteriorDesign = z.infer<typeof InteriorSchema>;
export type InteriorDoor = z.infer<typeof InteriorDoorSchema>;
