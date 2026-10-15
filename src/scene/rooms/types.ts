import { z } from "zod";
export const RoomRecipeSchema = z.object({
  version: z.literal(1),
  id: z.string(),
  revision: z.number().int().positive(),
  compatibleKinds: z.array(z.enum(["kitchen", "wardrobe"])),
  compatibleLayouts: z.array(z.string()),
  supportedRoomCm: z.object({
    min: z.tuple([
      z.number().positive(),
      z.number().positive(),
      z.number().positive(),
    ]),
    max: z.tuple([
      z.number().positive(),
      z.number().positive(),
      z.number().positive(),
    ]),
  }),
  finishes: z.object({
    wall: z.string(),
    skirting: z.string(),
    rug: z.string(),
  }),
  stagedOpening: z
    .object({
      wall: z.enum(["back", "left", "right", "front"]),
      width: z.number().positive(),
      height: z.number().positive(),
      sill: z.number().nonnegative(),
    })
    .nullable(),
  propAnchors: z.array(z.string()),
  exclusionPolicy: z.literal("cabinet-and-swept-fronts-and-doors"),
  lightRecipe: z.object({
    version: z.literal(1),
    daylightIntensity: z.number().min(0).max(5),
    ceilingIntensity: z.number().min(0).max(5),
    fillIntensity: z.number().min(0).max(2),
    windowBrightness: z.number().min(0).max(8),
    wallBrightness: z.number().min(0.05).max(2),
    /** v3: scales the room radiance, so direct light can model the furniture. */
    environmentIntensity: z.number().min(0).max(2).optional(),
    /** v3: soft ceiling-height key inside the room, in candela. */
    interiorKeyIntensity: z.number().min(0).max(200).optional(),
  }),
  environmentReference: z.literal("authored-room-probe-v1"),
  cameraShots: z.array(z.string()),
});
export type RoomRecipe = z.infer<typeof RoomRecipeSchema>;
