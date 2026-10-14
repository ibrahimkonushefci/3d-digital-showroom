import { z } from "zod";
export const LanguageSchema = z.enum(["sq", "en", "de"]);
export type Language = z.infer<typeof LanguageSchema>;
const Label = z.object({ sq: z.string(), en: z.string(), de: z.string() });
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const asset = z
  .string()
  .refine(
    (s) =>
      !s.includes("..") &&
      !s.includes("\\") &&
      !s.startsWith("/") &&
      !/^[a-z]+:/i.test(s),
    "Use a local asset path",
  );
export const BrandSchema = z.object({
  version: z.literal(1).default(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  companyName: z.string().min(1).max(80),
  tagline: z.string().max(200),
  logo: asset,
  colors: z.object({
    primary: color,
    accent: color,
    background: color,
    text: color,
  }),
  font: z.literal("Inter"),
  contact: z.object({
    phone: z.string().max(60),
    whatsapp: z.string().max(60),
    viber: z.string().max(60),
    email: z.string().max(120),
    address: z.string().max(200),
    city: z.string().max(80),
  }),
  /** Registration and payment details printed on every offer page. */
  legal: z
    .object({
      businessNumber: z.string().max(40).default(""),
      fiscalNumber: z.string().max(40).default(""),
      vatNumber: z.string().max(40).default(""),
      bankName: z.string().max(80).default(""),
      iban: z.string().max(40).default(""),
      website: z.string().max(120).default(""),
    })
    .default({
      businessNumber: "",
      fiscalNumber: "",
      vatNumber: "",
      bankName: "",
      iban: "",
      website: "",
    }),
  languages: z.array(LanguageSchema).min(1),
  defaultLanguage: LanguageSchema,
  modules: z.object({
    kitchenDesigner: z.boolean(),
    wardrobeDesigner: z.boolean(),
  }),
  demo: z.boolean().default(false),
  presentationMode: z.boolean().default(false),
  catalogId: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});
export type BrandConfig = z.infer<typeof BrandSchema>;
export const MaterialSchema = z.object({
  id: z.string(),
  name: Label,
  tier: z.string().optional(),
  color,
  supplier: z
    .object({
      manufacturer: z.string(),
      code: z.string(),
      name: z.string(),
      source: z.string().url(),
      appearance: z.literal("illustrative"),
    })
    .optional(),
  texture: asset.optional(),
  normalMap: asset.optional(),
  roughnessMap: asset.optional(),
  aoMap: asset.optional(),
  mapping: z
    .object({
      tileSizeCm: z.tuple([
        z.number().positive().max(10000),
        z.number().positive().max(10000),
      ]),
      grain: z.enum(["none", "vertical", "horizontal"]),
      sourceGrain: z.enum(["vertical", "horizontal"]).optional(),
      variation: z.enum(["none", "stable-offset"]),
      scaleBasis: z.literal("authored-illustrative").optional(),
    })
    .optional(),
  response: z
    .object({
      roughness: z.number().min(0).max(1),
      normalStrength: z.number().min(0).max(2),
      clearcoat: z.number().min(0).max(1),
      clearcoatRoughness: z.number().min(0).max(1),
      envMapIntensity: z.number().min(0).max(4),
    })
    .optional(),
  matches: z.enum(["front", "countertop"]).optional(),
  roughness: z.number().min(0).max(1),
  multiplier: z.number().nonnegative().default(1),
  perMeter: z.number().nonnegative().default(0),
});
const InteriorKindSchema = z.enum([
  "shelf",
  "rail",
  "drawer",
  "basket",
  "divider",
]);
export const InteriorComponentSchema = z
  .object({
    id: z.string().min(1).max(160),
    productId: z.string().min(1).max(80),
    yCm: z.number().finite().min(0).max(600),
    span: z
      .object({
        xCm: z.number().finite().min(0).max(2000),
        widthCm: z.number().positive().max(2000),
      })
      .strict()
      .optional(),
  })
  .strict();
export type InteriorComponent = z.infer<typeof InteriorComponentSchema>;
const InteriorItemSchema = z.object({
  id: z.string().min(1).max(80),
  name: Label,
  kind: InteriorKindSchema,
  compatibleModuleTypes: z.array(z.string()).min(1),
  minWidthCm: z.number().positive(),
  maxWidthCm: z.number().positive(),
  minDepthCm: z.number().positive(),
  maxDepthCm: z.number().positive(),
  supportedWidthsCm: z.array(z.number().positive()).optional(),
  occupiedHeightCm: z.number().positive().max(100),
  clearanceAboveCm: z.number().nonnegative().max(200),
  clearanceBelowCm: z.number().nonnegative().max(200),
  mounting: z.object({
    stepCm: z.number().positive().max(100),
    originCm: z.number().nonnegative().max(600),
  }),
  material: z.enum(["carcass", "metal"]),
  price: z.number().nonnegative().max(10000),
  coveredAccessoryId: z.string().optional(),
  extensionCm: z.number().nonnegative().max(100).default(0),
  basis: z.literal("illustrative"),
});
const InteriorPresetSchema = z.object({
  id: z.string(),
  name: Label,
  layout: z.enum(["shelves", "hanging", "drawers"]),
  compatibleModuleTypes: z.array(z.string()).min(1),
});
const moduleSchema = z.object({
  id: z.string(),
  name: Label,
  kind: z.enum(["kitchen", "wardrobe"]),
  type: z.enum([
    "doors",
    "drawers",
    "open",
    "glass",
    "sink",
    "oven",
    "fridge",
    "dishwasher",
    "corner",
    "hanging",
    "sliding",
    "pantry",
    "hood",
  ]),
  level: z.enum(["base", "wall", "tall", "wardrobe"]),
  widths: z.array(z.number().positive()).min(1),
  height: z.number().positive(),
  depth: z.number().positive(),
  pricePerMeter: z.number().nonnegative(),
  handleCount: z.number().int().nonnegative(),
  accessory: z.string().optional(),
  interiorPricing: z
    .object({
      includedPresetId: z.string(),
      additionPrices: z.record(z.string(), z.number().nonnegative().max(10000)),
      removalCredits: z.record(z.string(), z.number().nonnegative().max(10000)),
      includedAllowance: z.number().nonnegative().max(10000),
    })
    .optional(),
});
export const OpeningSchema = z.object({
  id: z.string(),
  wall: z.enum(["back", "left", "right", "front"]),
  type: z.enum(["door", "window"]),
  offset: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
  sill: z.number().nonnegative(),
});
export const CatalogSchema = z
  .object({
    version: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]+$/),
    presentationPresets: z
      .array(
        z.object({
          id: z.string(),
          name: Label,
          kind: z.enum(["kitchen", "wardrobe"]),
          layout: z.enum([
            "straight",
            "l",
            "u",
            "parallel",
            "island",
            "corner",
            "walkin",
          ]),
          thumbnail: asset,
          roomSceneId: z
            .enum(["kitchen-warm-v1", "wardrobe-warm-v1"])
            .optional(),
          sceneRevision: z.number().int().positive().optional(),
          room: z.object({
            width: z.number().positive(),
            depth: z.number().positive(),
            height: z.number().positive(),
            openings: z.array(OpeningSchema).max(30).optional(),
          }),
          style: z.object({
            front: z.string(),
            carcass: z.string(),
            countertop: z.string(),
            handle: z.string(),
            backsplash: z.string(),
            plinth: z.string(),
            led: z.boolean(),
            profile: z.enum(["flat", "panel"]),
          }),
          cabinets: z
            .array(
              z.object({
                moduleId: z.string(),
                wall: z.enum(["back", "left", "right", "front", "island"]),
                offset: z.number().nonnegative(),
                width: z.number().positive(),
              }),
            )
            .optional(),
          camera: z.object({
            position: z.tuple([z.number(), z.number(), z.number()]),
            target: z.tuple([z.number(), z.number(), z.number()]),
          }),
        }),
      )
      .optional(),
    fronts: z.array(MaterialSchema).default([]),
    carcasses: z.array(MaterialSchema).default([]),
    countertops: z.array(MaterialSchema).default([]),
    backsplashes: z.array(MaterialSchema).default([]),
    plinths: z.array(MaterialSchema).default([]),
    handles: z
      .array(
        z.object({
          id: z.string(),
          name: Label,
          color,
          perPiece: z.number().nonnegative(),
        }),
      )
      .default([]),
    modules: z.array(moduleSchema).default([]),
    interiorItems: z.array(InteriorItemSchema).max(100).optional(),
    interiorPresets: z.array(InteriorPresetSchema).max(50).optional(),
    accessories: z
      .array(
        z.object({
          id: z.string(),
          name: Label,
          price: z.number().nonnegative(),
        }),
      )
      .default([]),
    frontTiers: z
      .array(
        z.object({
          id: z.string(),
          name: Label,
          multiplier: z.number().positive(),
          decors: z.array(z.string()).min(1),
        }),
      )
      .default([]),
    countertopTiers: z
      .array(
        z.object({
          id: z.string(),
          name: Label,
          perMeter: z.number().nonnegative(),
          thicknessMm: z.number().positive().max(100).optional(),
          decors: z.array(z.string()).min(1),
        }),
      )
      .default([]),
    appliancePackages: z
      .array(
        z.object({
          id: z.string(),
          name: Label,
          price: z.number().nonnegative(),
        }),
      )
      .default([]),
    pricing: z.object({
      installationPercent: z.number().min(0).max(100),
      vatPercent: z.number().min(0).max(100),
      rangePercent: z.number().min(0).max(50),
      ledPerMeter: z.number().nonnegative(),
      internalLedPerMeter: z.number().nonnegative().default(0),
      plinthPerMeter: z.number().nonnegative(),
      minimumAisle: z.number().positive(),
      offerPrefix: z.string().max(12).default("OF"),
      validityDays: z.number().int().positive().default(15),
      paymentTerms: Label.default({
        sq: "Avans 40%",
        en: "40% deposit",
        de: "40% Anzahlung",
      }),
      panelMultiplier: z.number().positive().default(1.12),
    }),
  })
  .superRefine((c, ctx) => {
    for (const group of [
      "fronts",
      "carcasses",
      "countertops",
      "backsplashes",
      "plinths",
      "handles",
      "modules",
      "accessories",
      "frontTiers",
      "countertopTiers",
      "appliancePackages",
    ] as const) {
      const ids = c[group].map((item) => item.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: "custom",
          message: "Catalog identifiers must be unique",
          path: [group],
        });
    }
    for (const [tiers, decors, path] of [
      [c.frontTiers, c.fronts, "frontTiers"],
      [c.countertopTiers, c.countertops, "countertopTiers"],
    ] as const)
      for (const tier of tiers)
        if (tier.decors.some((id) => !decors.some((m) => m.id === id)))
          ctx.addIssue({
            code: "custom",
            message: "Unknown decor reference",
            path: [path],
          });
    const items = c.interiorItems ?? [],
      presets = c.interiorPresets ?? [];
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message, path: ["interiorItems"] });
    if (
      new Set(items.map((i) => i.id)).size !== items.length ||
      new Set(presets.map((i) => i.id)).size !== presets.length
    )
      issue("Interior identifiers must be unique");
    for (const item of items) {
      if (
        item.minWidthCm > item.maxWidthCm ||
        item.minDepthCm > item.maxDepthCm
      )
        issue("Invalid interior fit range");
      if (
        item.coveredAccessoryId &&
        !c.accessories.some((a) => a.id === item.coveredAccessoryId)
      )
        issue("Unknown covered accessory");
    }
    for (const preset of presets)
      if (
        ![
          "shelf",
          ...(preset.layout === "hanging"
            ? ["rail"]
            : preset.layout === "drawers"
              ? ["drawer"]
              : []),
        ].every((kind) => items.some((i) => i.kind === kind))
      )
        issue("Preset needs its interior products");
    for (const m of c.modules)
      if (m.interiorPricing) {
        const rule = m.interiorPricing;
        if (
          m.kind !== "wardrobe" ||
          !presets.some(
            (p) =>
              p.id === rule.includedPresetId &&
              p.compatibleModuleTypes.includes(m.type),
          )
        )
          issue("Invalid included interior preset");
        for (const id of [
          ...Object.keys(rule.additionPrices),
          ...Object.keys(rule.removalCredits),
        ])
          if (!items.some((i) => i.id === id))
            issue("Unknown interior price reference");
      }
    for (const m of c.modules)
      if (m.accessory && !c.accessories.some((a) => a.id === m.accessory))
        ctx.addIssue({
          code: "custom",
          message: "Unknown accessory",
          path: ["modules"],
        });
  });
export type Catalog = z.infer<typeof CatalogSchema>;
export type Material = z.infer<typeof MaterialSchema>;
export type Module = Catalog["modules"][number];
export const WallSchema = z.enum(["back", "left", "right", "front", "island"]);
export type Wall = z.infer<typeof WallSchema>;
export const RoomSchema = z.object({
  width: z.number().min(120).max(2000),
  depth: z.number().min(120).max(2000),
  height: z.number().min(180).max(600),
  openings: z.array(OpeningSchema).max(30),
});
export const FinishOverrideSchema = z
  .object({
    front: z.string().optional(),
    carcass: z.string().optional(),
    handle: z.string().optional(),
    profile: z.enum(["flat", "panel"]).optional(),
    plinth: z.string().optional(),
  })
  .strict();
export const FinishZoneSchema = z.enum([
  "base",
  "wall",
  "tall",
  "island",
  "wardrobe",
]);
export type FinishZone = z.infer<typeof FinishZoneSchema>;
export type FinishOverride = z.infer<typeof FinishOverrideSchema>;
export const CabinetSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
  depth: z.number().positive(),
  x: z.number().finite(),
  z: z.number().finite(),
  rotation: z.number().finite(),
  wall: WallSchema,
  level: z.enum(["base", "wall", "tall", "wardrobe"]),
  finishOverride: FinishOverrideSchema.optional(),
  interior: z
    .object({
      version: z.literal(1),
      components: z.array(InteriorComponentSchema).max(32),
    })
    .strict()
    .optional(),
});
export const OfferDetailsSchema = z.object({
  number: z.string().max(60),
  date: z.string().max(30),
  validityDays: z.number().int().positive(),
  customer: z.object({
    name: z.string().max(100),
    phone: z.string().max(60),
    city: z.string().max(80),
  }),
  salesperson: z.string().max(100),
  paymentTerms: z.string().max(200),
  notes: z.string().max(1500),
  discountPercent: z.number().min(0).max(30).optional(),
});
export type OfferDetails = z.infer<typeof OfferDetailsSchema>;
const DesignFields = z.object({
  offer: OfferDetailsSchema.optional(),
  appliancePackage: z.string().optional(),
  id: z.string(),
  kind: z.enum(["kitchen", "wardrobe"]),
  layout: z.enum([
    "straight",
    "l",
    "u",
    "parallel",
    "island",
    "corner",
    "walkin",
  ]),
  room: RoomSchema,
  environment: z
    .object({
      floor: z.enum(["laminate", "tiles", "concrete"]),
      wallColor: color,
      internalLed: z.boolean(),
    })
    .optional(),
  cabinets: z.array(CabinetSchema).max(200),
  style: z.object({
    front: z.string(),
    carcass: z.string(),
    countertop: z.string(),
    handle: z.string(),
    backsplash: z.string(),
    plinth: z.string(),
    led: z.boolean(),
    profile: z.enum(["flat", "panel"]).default("flat"),
  }),
  installation: z.boolean(),
  vat: z.boolean(),
  exact: z.boolean(),
});
// Explicit legacy inputs: v1/v2 cannot smuggle v3 fields through migration.
const LegacyFields = DesignFields.extend({
  cabinets: z
    .array(CabinetSchema.omit({ finishOverride: true, interior: true }))
    .max(200),
});
export const DesignV1Schema = LegacyFields.extend({ version: z.literal(1) });
export const DesignV2Schema = LegacyFields.extend({ version: z.literal(2) });
export const DesignV3Schema = DesignFields.extend({
  version: z.literal(3),
  finishZones: z
    .object({
      base: FinishOverrideSchema.optional(),
      wall: FinishOverrideSchema.optional(),
      tall: FinishOverrideSchema.optional(),
      island: FinishOverrideSchema.optional(),
      wardrobe: FinishOverrideSchema.optional(),
    })
    .strict()
    .optional(),
  worktopFinishes: z
    .object({ main: z.string().optional(), island: z.string().optional() })
    .strict()
    .optional(),
  presentation: z
    .object({ roomSceneId: z.enum(["kitchen-warm-v1", "wardrobe-warm-v1"]) })
    .strict()
    .optional(),
});
export const DesignSchema = z
  .discriminatedUnion("version", [
    DesignV1Schema,
    DesignV2Schema,
    DesignV3Schema,
  ])
  .superRefine((d, ctx) => {
    if (
      d.cabinets.reduce(
        (n, c) =>
          n + ("interior" in c ? (c.interior?.components.length ?? 0) : 0),
        0,
      ) > 512
    )
      ctx.addIssue({
        code: "custom",
        message: "Maximum 512 interior components per design",
        path: ["cabinets"],
      });
    const ids = d.cabinets.flatMap((c) =>
      "interior" in c ? (c.interior?.components.map((i) => i.id) ?? []) : [],
    );
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Interior identities must be unique in the design",
        path: ["cabinets"],
      });
  })
  .transform((design): z.infer<typeof DesignV3Schema> => ({
    ...design,
    version: 3 as const,
  }));
export type DesignDocument = z.infer<typeof DesignSchema>;
export type Cabinet = z.infer<typeof CabinetSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Opening = z.infer<typeof OpeningSchema>;
export type Layout = DesignDocument["layout"];

export function validateCatalogForBrand(catalog: Catalog, brand: BrandConfig) {
  const furniture =
    brand.modules.kitchenDesigner || brand.modules.wardrobeDesigner;
  if (
    furniture &&
    [
      catalog.fronts,
      catalog.carcasses,
      catalog.countertops,
      catalog.backsplashes,
      catalog.plinths,
      catalog.handles,
    ].some((g) => !g.length)
  )
    return false;
  if (
    brand.modules.kitchenDesigner &&
    !catalog.modules.some((m) => m.kind === "kitchen")
  )
    return false;
  if (
    brand.modules.wardrobeDesigner &&
    !catalog.modules.some((m) => m.kind === "wardrobe")
  )
    return false;
  return true;
}
