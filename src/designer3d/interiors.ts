import type {
  Cabinet,
  Catalog,
  InteriorComponent,
  Module,
} from "../catalog/types";
export const INTERIOR_REVISION = "wardrobe-interior-v1";
export type InteriorItem = NonNullable<Catalog["interiorItems"]>[number];
export type ResolvedInterior = InteriorComponent & {
  kind: InteriorItem["kind"];
  item?: InteriorItem;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  cabinetYcm: number;
  extensionCm: number;
};
/** Legacy geometry in metres, unchanged for absent interior data and old catalogs. */
export function legacyStorage(c: Cabinet, module: Module) {
  const h = c.height / 100,
    drawers = module.type === "drawers" ? 3 : 0;
  const rail = ["hanging", "sliding"].includes(module.type) ? h - 0.32 : null;
  const shelves = rail
    ? []
    : drawers
      ? [0.68, ...[1.3, 1.9].filter((y) => y < h - 0.12)]
      : [0.32, 0.62, 0.82].map((r) => h * r).filter((y) => y < h - 0.12);
  return { shelves, drawers, drawerHeight: 0.22, rail };
}
export function canEditInterior(module: Module, catalog: Catalog) {
  return (
    module.kind === "wardrobe" &&
    !!module.interiorPricing &&
    !!catalog.interiorItems?.length &&
    !!catalog.interiorPresets?.length
  );
}
/** Presets derive sizes/positions once, matching existing shelves, rail and drawer counts. */
export function presetComponents(
  c: Cabinet,
  module: Module,
  catalog: Catalog,
  presetId = module.interiorPricing?.includedPresetId,
): InteriorComponent[] {
  const preset = catalog.interiorPresets?.find((p) => p.id === presetId);
  const type =
    preset?.layout === "hanging"
      ? "hanging"
      : preset?.layout === "drawers"
        ? "drawers"
        : preset?.layout === "shelves"
          ? "open"
          : module.type;
  const legacy = legacyStorage(c, { ...module, type });
  const list: { kind: InteriorItem["kind"]; yCm: number }[] = [
    ...legacy.shelves.map((y) => ({
      kind: "shelf" as const,
      yCm: Math.round((y * 100 - 2.7) * 10000) / 10000,
    })),
    ...(legacy.rail !== null
      ? [{ kind: "rail" as const, yCm: legacy.rail * 100 - 2.6 }]
      : []),
    ...Array.from({ length: legacy.drawers }, (_, i) => ({
      kind: "drawer" as const,
      yCm: i * 22,
    })),
  ];
  return list.map((p, index) => ({
    id: `${c.id}:preset:${index}`,
    productId:
      catalog.interiorItems?.find((i) => i.kind === p.kind)?.id ??
      `legacy-${p.kind}`,
    yCm: p.yCm,
  }));
}
export function resolveInterior(
  c: Cabinet,
  module: Module,
  catalog: Catalog,
): ResolvedInterior[] {
  return (c.interior?.components ?? presetComponents(c, module, catalog)).map(
    (component) => {
      const item = catalog.interiorItems?.find(
        (i) => i.id === component.productId,
      );
      if (c.interior && !item) throw Error("interiorReferenceError");
      const kind =
        item?.kind ??
        (component.productId.replace("legacy-", "") as InteriorItem["kind"]);
      const heightCm =
        item?.occupiedHeightCm ??
        (kind === "shelf" ? 1.8 : kind === "rail" ? 1.6 : 22);
      return {
        ...component,
        item,
        kind,
        heightCm,
        widthCm: c.width - 3.6,
        depthCm: c.depth - 7.5,
        cabinetYcm: 1.8 + component.yCm + heightCm / 2,
        extensionCm: item?.extensionCm ?? 0,
      };
    },
  );
}
export function snapInterior(yCm: number, item: InteriorItem, direction = 0) {
  const n = (yCm - item.mounting.originCm) / item.mounting.stepCm;
  const step =
    direction > 0
      ? Math.floor(n + 1e-6) + 1
      : direction < 0
        ? Math.ceil(n - 1e-6) - 1
        : Math.round(n);
  return (
    Math.round((item.mounting.originCm + step * item.mounting.stepCm) * 10000) /
    10000
  );
}
export function withInterior(
  c: Cabinet,
  components: InteriorComponent[],
): Cabinet {
  return {
    ...c,
    interior: {
      version: 1,
      components: components.map(({ id, productId, yCm, span }) => ({
        id,
        productId,
        yCm,
        ...(span ? { span } : {}),
      })),
    },
  };
}
/** Quantity/size-class delta, never mesh count; the module package remains intact. */
export function interiorAdjustments(
  c: Cabinet,
  module: Module,
  catalog: Catalog,
) {
  if (!c.interior || !module.interiorPricing) return [];
  const rule = module.interiorPricing;
  const count = (list: InteriorComponent[]) => {
    const counts = new Map<string, number>();
    for (const i of list)
      counts.set(i.productId, (counts.get(i.productId) ?? 0) + 1);
    return counts;
  };
  const current = count(c.interior.components),
    included = count(presetComponents(c, module, catalog));
  const result: {
    item: InteriorItem;
    quantity: number;
    unitPrice: number;
    credit: boolean;
  }[] = [];
  let credits = 0;
  for (const id of new Set([...current.keys(), ...included.keys()])) {
    const item = catalog.interiorItems?.find((i) => i.id === id);
    if (!item) throw Error("interiorReferenceError");
    if (item.coveredAccessoryId && item.coveredAccessoryId === module.accessory)
      continue;
    const delta = (current.get(id) ?? 0) - (included.get(id) ?? 0);
    const rate =
      delta > 0
        ? (rule.additionPrices[id] ?? item.price)
        : (rule.removalCredits[id] ?? 0);
    if (!delta || !rate) continue;
    if (delta < 0) credits += -delta * rate;
    result.push({
      item,
      quantity: Math.abs(delta),
      unitPrice: delta < 0 ? -rate : rate,
      credit: delta < 0,
    });
  }
  if (credits > rule.includedAllowance + 0.001)
    throw Error("interiorCreditError");
  return result;
}
