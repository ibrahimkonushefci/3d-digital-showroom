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
      return tier
        ? {
            ...m,
            name: {
              sq: `${tier.name.sq} · ${m.name.sq}`,
              en: `${tier.name.en} · ${m.name.en}`,
              de: `${tier.name.de} · ${m.name.de}`,
            },
          }
        : m;
    });
}
