import type { Catalog, DesignDocument, Material } from "../catalog/types";
import type { FacadeDesign } from "../doorPreview/types";
import type { InteriorDesign } from "../interior/types";
export function proposalFinishes(
  design: DesignDocument | FacadeDesign | InteriorDesign,
  catalog: Catalog,
): Material[] {
  let items: Array<Material | undefined>;
  if (design.kind === "facade")
    items = design.items.flatMap((p) => [
      catalog.productFinishes.find((f) => f.id === p.finishId),
      catalog.productFinishes.find((f) => f.id === p.finishInsideId),
    ]);
  else if (design.kind === "interior")
    items = [
      catalog.laminates.find((f) => f.id === design.laminateId),
      ...design.doors.map((d) =>
        catalog.productFinishes.find((f) => f.id === d.finishId),
      ),
    ];
  else
    items = [
      catalog.fronts.find((f) => f.id === design.style.front),
      ...(design.kind === "kitchen"
        ? [catalog.countertops.find((f) => f.id === design.style.countertop)]
        : []),
      catalog.carcasses.find((f) => f.id === design.style.carcass),
    ];
  return items
    .filter((m): m is Material => !!m)
    .filter((m, i, a) => a.findIndex((n) => n.id === m.id) === i);
}
