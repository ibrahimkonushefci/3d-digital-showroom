import type { Catalog, DesignDocument } from "../catalog/types";
import {
  presentationPresets,
  type ShowroomPreset,
} from "../designer3d/presets";
import { applyToAll } from "../designer3d/finishes";
import {
  KITCHEN_THEMES,
  WARDROBE_THEMES,
  type CuratedTheme,
} from "../designer3d/looks";
import type { CameraView } from "../designer3d/Scene";

/** Catalog presentations of existing rooms, not new furniture or room recipes. */
const editions = [
  { id: "home-sage", source: "japandi", look: "sage" },
  { id: "home-oak", source: "modern", look: "oak" },
  { id: "home-white-island", source: "classic", look: "white-brass" },
  { id: "home-oak-wardrobe", source: "wardrobe-straight", look: "milano-oak" },
];
const cameras: Record<string, CameraView> = {
  "home-sage": {
    position: [0.6, 1.65, 3.2],
    target: [-0.6, 1.25, -1.2],
    fov: 58,
  },
  "home-oak": {
    position: [-1.8, 1.8, 3.7],
    target: [0.15, 1.2, -1.3],
    fov: 54,
  },
  "home-white-island": {
    position: [2.4, 1.8, 3.5],
    target: [0, 1.15, -0.6],
    fov: 58,
  },
  "home-oak-wardrobe": {
    position: [0.2, 1.5, 3.0],
    target: [0, 1.3, -1.4],
    fov: 48,
  },
};

export function applyCatalogLook(
  design: DesignDocument,
  look: CuratedTheme,
): DesignDocument {
  const base = applyToAll(design);
  return {
    ...base,
    style: {
      ...base.style,
      front: look.front,
      carcass: look.carcass,
      handle: look.handle,
      plinth: look.plinth,
      profile: look.profile,
      led: look.led,
      countertop:
        design.kind === "kitchen" ? look.countertop : base.style.countertop,
    },
    environment: {
      floor: look.floor,
      wallColor: base.environment?.wallColor || "#e5e0d7",
      internalLed: base.environment?.internalLed || design.kind === "wardrobe",
    },
  };
}

export function homeCatalog(catalog: Catalog): ShowroomPreset[] {
  const prepared = presentationPresets(catalog);
  const variants = editions.flatMap((edition) => {
    const source = prepared.find((preset) => preset.id === edition.source);
    if (!source) return [];
    const look = [...KITCHEN_THEMES, ...WARDROBE_THEMES].find(
      (item) => item.id === edition.look,
    )!;
    // A custom brand may omit a finish: never offer an unbuildable look.
    if (
      !catalog.fronts.some((m) => m.id === look.front) ||
      !catalog.carcasses.some((m) => m.id === look.carcass) ||
      !catalog.handles.some((m) => m.id === look.handle) ||
      !catalog.plinths.some((m) => m.id === look.plinth) ||
      (source.design.kind === "kitchen" &&
        !catalog.countertops.some((m) => m.id === look.countertop))
    )
      return [];
    return [
      {
        ...source,
        id: edition.id,
        name: look.name,
        thumbnail: `shared/showroom/${edition.id}.webp`,
        camera: cameras[edition.id],
        design: applyCatalogLook(source.design, look),
      },
    ];
  });
  // Mix materials and viewpoints through the grid rather than repeating
  // three pale kitchens first and putting all colour on a later row.
  const order = [
    "japandi",
    "home-oak",
    "classic",
    "home-sage",
    "modern",
    "home-white-island",
    "wardrobe-straight",
    "wardrobe",
    "home-oak-wardrobe",
  ];
  return [...prepared, ...variants].sort((a, b) => {
    const rank = (id: string) =>
      order.includes(id) ? order.indexOf(id) : order.length;
    return rank(a.id) - rank(b.id);
  });
}
