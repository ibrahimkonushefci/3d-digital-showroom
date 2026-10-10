import type { Catalog } from "../catalog/types";
import { newFacade } from "./store";
/** Illustration for the Home hero/thumbnail; never seeds a customer's quote. */
export function portalPresentation(c: Catalog) {
  const d = newFacade(c),
    model = c.doors.find((m) => m.style === 2) || c.doors[0],
    oak = c.productFinishes.find((f) => f.id === "golden-oak"),
    white = c.productFinishes.find((f) => f.id === "white");
  d.items[0] = {
    ...d.items[0],
    modelId: model.id,
    materialType:
      oak && c.doorTypes.some((t) => t.id === "wood")
        ? "wood"
        : d.items[0].materialType,
    ...(oak ? { finishId: oak.id, color: oak.color } : {}),
    ...(white ? { finishInsideId: white.id } : {}),
    options: [
      "side-right",
      "transom",
      "handle-120",
      "led-handle",
      "fingerprint",
    ].filter((id) => model.options.some((o) => o.id === id)),
  };
  return d;
}
