import type { Catalog, DesignDocument } from "../catalog/types";
import { countertopThickness } from "../scene/furnitureMaterials";
import { bounds } from "./layout";
import { newCabinet, type Spot } from "./placement";
import { useDesigner } from "./store";

/** Where each highlighted place appears on screen (client pixels), for
 * dropping a dragged picture card. Set by PlacementSpots while it shows. */
export const spotScreen: {
  centres: (() => Array<{ x: number; y: number } | null>) | null;
} = { centres: null };

/** The box a unit of this type would fill at the spot's best width (cm). */
export function spotBox(
  design: DesignDocument,
  catalog: Catalog,
  moduleId: string,
  spot: Spot,
) {
  const m = catalog.modules.find((x) => x.id === moduleId)!;
  const o = spot.options[0];
  return bounds(
    newCabinet(m, spot.wall, o.offset, o.width, design),
    countertopThickness(design, catalog, spot.wall),
  );
}

/** Commits a placement as one undoable edit, selects the new unit and
 * announces it with Undo. */
export function commitPlacement(
  result: { design: DesignDocument; id: string } | null,
  catalog: Catalog,
  text: string,
) {
  const s = useDesigner.getState();
  if (!result || !s.edit(result.design, catalog)) return false;
  s.select(result.id);
  s.setPlacing(null);
  s.setNotice({ text, undo: true });
  return true;
}
// Review scripts (development server only) drop dragged cards on a place.
if (import.meta.env.DEV && typeof window !== "undefined")
  (window as unknown as { __spotScreen: typeof spotScreen }).__spotScreen =
    spotScreen;
