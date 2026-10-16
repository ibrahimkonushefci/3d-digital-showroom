import type { Catalog, DesignDocument, Cabinet } from "../catalog/types";
import { storageMeasurements } from "../designer3d/storage";
import type { Quality } from "./quality";
import { resolveCabinetStyle, FINISH_REVISION } from "../designer3d/finishes";
import { LIGHTING_REVISION } from "./lighting/lightingRecipe";

import { resolveRoom } from "./rooms/resolveRoom";
import type { RoomRecipe } from "./rooms/types";
export type { RoomRecipe } from "./rooms/types";

/** Default-style facade retained for legacy consumers; cabinets resolve independently. */
export function resolveFurnitureStyle(
  design: DesignDocument,
  catalog: Catalog,
) {
  return resolveCabinetStyle(
    design,
    { wall: "back", level: "base" } as Cabinet,
    catalog,
  );
}
export function resolveFurnitureCabinet(cabinet: Cabinet, catalog: Catalog) {
  const module = catalog.modules.find((m) => m.id === cabinet.moduleId);
  if (!module) throw Error(`Unresolved furniture module: ${cabinet.moduleId}`);
  return {
    cabinet,
    module,
    interior: storageMeasurements(cabinet, module, catalog),
  };
}

/** cm and stable identity remain in commercial state; metres are derived here. */
export function assembleRenderInput(
  design: DesignDocument,
  catalog: Catalog,
  roomRecipe: RoomRecipe = resolveRoom(design).recipe,
  quality: Quality = "balanced",
) {
  return {
    revision: `${LIGHTING_REVISION}:${FINISH_REVISION}`,
    commercial: { design, catalog },
    furniture: {
      style: resolveFurnitureStyle(design, catalog),
      cabinets: design.cabinets.map((c) => ({
        ...resolveFurnitureCabinet(c, catalog),
        style: resolveCabinetStyle(design, c, catalog),
        sizeMetres: [c.width / 100, c.height / 100, c.depth / 100] as const,
      })),
    },
    presentation: { roomRecipe, quality },
  };
}
export type RenderInput = ReturnType<typeof assembleRenderInput>;
