import type { Catalog, DesignDocument } from "../catalog/types";
import type { CameraView } from "./Scene";
import { examples, generateLayout, newDesign, validateDesign } from "./layout";
export type ShowroomPreset = {
  id: string;
  name: { sq: string; en: string; de: string };
  thumbnail: string;
  camera: CameraView;
  design: DesignDocument;
};
export function presentationPresets(catalog: Catalog): ShowroomPreset[] {
  if (catalog.presentationPresets)
    return catalog.presentationPresets.flatMap((p) => {
      const required =
        p.kind === "kitchen"
          ? [
              "oven",
              "sink",
              "dishwasher",
              "fridge",
              "base-doors",
              "base-drawers",
              "wall-doors",
              "wall-hood",
              ...(["l", "u"].includes(p.layout) ? ["corner"] : []),
            ]
          : [
              "wardrobe-hanging",
              "wardrobe-shelves",
              "wardrobe-drawers",
              "wardrobe-sliding",
            ];
      if (
        !required.every((id) =>
          catalog.modules.some((m) => m.id === id && m.kind === p.kind),
        )
      )
        return [];
      const d = generateLayout(
        {
          ...newDesign(p.kind, p.layout),
          room: { ...p.room, openings: [] },
          style: p.style,
        },
        catalog,
      );
      return d && validateDesign(d, catalog)
        ? [
            {
              id: p.id,
              name: p.name,
              thumbnail: p.thumbnail,
              camera: p.camera,
              design: d,
            },
          ]
        : [];
    });
  return examples(catalog)
    .filter((d) => validateDesign(d, catalog))
    .map((design, i) => ({
      id: `example-${i}`,
      name: {
        sq: design.kind === "kitchen" ? "Kuzhinë" : "Gardërobë",
        en: design.kind === "kitchen" ? "Kitchen" : "Wardrobe",
        de: design.kind === "kitchen" ? "Küche" : "Kleiderschrank",
      },
      thumbnail: `shared/showroom/${design.kind === "wardrobe" ? "wardrobe" : "modern"}.webp`,
      camera: { position: [3.6, 2.5, 4.4], target: [0, 1, -0.4] },
      design,
    }));
}
