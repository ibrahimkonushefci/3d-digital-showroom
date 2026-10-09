import type { Catalog } from "../catalog/types";
import type { DoorStyle } from "./types";
export function interiorDoorChoices(c: Catalog) {
  return [
    {
      id: "whiteGlass",
      model: "glass",
      finish: "white",
      tier: "paint",
      handle: "inox",
      hidden: false,
    },
    {
      id: "oakCpl",
      model: "flat",
      finish: "golden-oak",
      tier: "cpl",
      handle: "black",
      hidden: false,
    },
    {
      id: "walnutCpl",
      model: "flat",
      finish: "walnut",
      tier: "cpl",
      handle: "inox",
      hidden: false,
    },
    {
      id: "anthraciteMatte",
      model: "flat",
      finish: "anthracite",
      tier: "paint",
      handle: "black",
      hidden: true,
    },
    {
      id: "softGreyMatte",
      model: "flat",
      finish: "soft-grey",
      tier: "paint",
      handle: "inox",
      hidden: true,
    },
  ]
    .filter(
      (p) =>
        c.interiorDoors.some((m) => m.id === p.model) &&
        c.productFinishes.some((m) => m.id === p.finish) &&
        c.interiorFinishes.some((m) => m.id === p.tier) &&
        c.interiorHandles.some((m) => m.id === p.handle),
    )
    .map((p) => ({
      id: p.id,
      style: {
        modelId: p.model,
        finishId: p.finish,
        finishTier: p.tier,
        handleId: p.handle,
        hiddenHinges: p.hidden,
      } satisfies DoorStyle,
    }));
}
