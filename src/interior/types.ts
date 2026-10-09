import { z } from "zod";
import { OfferDetailsSchema, RoomSchema } from "../catalog/types";
export const DoorStyleSchema = z.object({
  modelId: z.string(),
  finishTier: z.string(),
  finishId: z.string(),
  handleId: z.string(),
  hiddenHinges: z.boolean(),
});
export const InteriorDoorSchema = DoorStyleSchema.extend({
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
  height: z.number().min(180).max(240).default(200),
  frameHeight: z.number().min(185).max(250).default(205),
  frameDepth: z.number().min(10).max(25).default(15),
  roomType: z.enum(["living", "bedroom", "bathroom"]).default("bedroom"),
});
const DocumentSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
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
  doorStyle: DoorStyleSchema.optional(),
  legacyMixed: z.boolean().default(false),
});
export const InteriorSchema = DocumentSchema.transform((d) => {
  const first = d.doors[0];
  const style = d.doorStyle || DoorStyleSchema.parse(first);
  const mixed = d.doors.some((p) =>
    Object.keys(style).some(
      (key) =>
        p[key as keyof typeof style] !== style[key as keyof typeof style],
    ),
  );
  return {
    ...d,
    version: 2 as const,
    doorStyle: style,
    legacyMixed: mixed,
    doors: d.doors.map((p) => ({
      ...p,
      height: d.version === 1 ? 210 : p.height,
      frameHeight: d.version === 1 ? 215 : p.frameHeight,
    })),
  };
});
export type InteriorDesign = z.infer<typeof InteriorSchema>;
export type InteriorDoor = z.infer<typeof InteriorDoorSchema>;
export type DoorStyle = z.infer<typeof DoorStyleSchema>;
