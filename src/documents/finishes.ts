import type { Catalog, DesignDocument, Material } from "../catalog/types";
export function proposalFinishes(
  design: DesignDocument,
  catalog: Catalog,
): Material[] {
  const items = [
    catalog.fronts.find((f) => f.id === design.style.front),
    ...(design.kind === "kitchen"
      ? [catalog.countertops.find((f) => f.id === design.style.countertop)]
      : []),
    catalog.carcasses.find((f) => f.id === design.style.carcass),
  ];
  return items
    .filter((m): m is Material => !!m)
    .filter((m, i, a) => a.findIndex((n) => n.id === m.id) === i)
    .map((m) => {
      const tiers =
        m.id === design.style.front
          ? catalog.frontTiers
          : m.id === design.style.countertop && design.kind === "kitchen"
            ? catalog.countertopTiers
            : [];
      const tier = tiers.find((t) => t.decors.includes(m.id));
      // "Granit · Granit" reads as a mistake: skip a tier named like its decor.
      const joined = (l: "sq" | "en" | "de") =>
        tier!.name[l] === m.name[l]
          ? m.name[l]
          : `${tier!.name[l]} · ${m.name[l]}`;
      return tier
        ? {
            ...m,
            name: { sq: joined("sq"), en: joined("en"), de: joined("de") },
          }
        : m;
    });
}
