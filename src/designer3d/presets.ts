import { presetRoom } from "../scene/rooms/resolveRoom";
import type { Catalog, DesignDocument } from "../catalog/types";
import type { CameraView } from "./Scene";
import {
  examples,
  generateLayout,
  newDesign,
  validateDesign,
  uid,
  wallPosition,
} from "./layout";
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
              ...(p.layout === "l" ? ["corner"] : []),
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
      let d = generateLayout(
        {
          ...newDesign(p.kind, p.layout),
          room: { ...p.room, openings: p.room.openings || [] },
          style: p.style,
        },
        catalog,
      );
      if (d && p.cabinets) {
        const room = d.room;
        d = {
          ...d,
          cabinets: p.cabinets.flatMap((a) => {
            const m = catalog.modules.find((m) => m.id === a.moduleId);
            return m
              ? [
                  {
                    id: uid(),
                    moduleId: m.id,
                    width: a.width,
                    height:
                      m.level === "wardrobe"
                        ? Math.min(m.height, room.height)
                        : m.height,
                    depth: m.depth,
                    level: m.level,
                    wall: a.wall,
                    ...wallPosition(a.wall, a.offset, a.width, m.depth, room),
                  },
                ]
              : [];
          }),
        };
        if (d.cabinets.length !== p.cabinets.length) return [];
      }
      // An explicit empty list means "no window"; only presets that say
      // nothing about openings receive the staged one.
      if (d && p.roomSceneId && !p.room.openings)
        d = { ...d, room: presetRoom(d.room, d.kind, d.cabinets) };
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

/** The authored starting design for a furniture type. */
export function defaultDesign(
  kind: DesignDocument["kind"],
  catalog: Catalog,
): DesignDocument {
  return (
    presentationPresets(catalog).find((p) => p.design.kind === kind)?.design ||
    generateLayout(
      newDesign(kind, kind === "kitchen" ? "l" : "straight"),
      catalog,
    )!
  );
}

/**
 * Restore the default layout, modules and finishes while keeping the
 * document's identity and the client's offer terms.
 */
export function resetConfiguration(
  current: DesignDocument,
  catalog: Catalog,
): DesignDocument {
  return {
    ...defaultDesign(current.kind, catalog),
    id: current.id,
    offer: current.offer,
    vat: current.vat,
    installation: current.installation,
  };
}
