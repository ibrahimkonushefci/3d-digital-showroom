import type { Catalog, DesignDocument } from "../catalog/types";
import { wallPosition, wallOffset, validateDesign } from "./layout";
export function movedCabinet(
  design: DesignDocument,
  id: string,
  deltaCm: number,
): DesignDocument {
  return {
    ...design,
    cabinets: design.cabinets.map((c) => {
      if (c.id !== id) return c;
      const position = wallPosition(
        c.wall,
        Math.round((wallOffset(c) + deltaCm) / 10) * 10,
        c.width,
        c.depth,
        design.room,
      );
      return { ...c, ...position, ...(c.wall === "island" ? { z: c.z } : {}) };
    }),
  };
}
export function validMove(design: DesignDocument, catalog: Catalog) {
  return validateDesign(design, catalog);
}
