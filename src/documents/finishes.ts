import { resolveInterior } from "../designer3d/interiors";
import type {
  Catalog,
  DesignDocument,
  Language,
  Material,
} from "../catalog/types";
import {
  effectiveCabinetStyle,
  finishZone,
  resolveCabinetStyle,
  resolveRunStyle,
} from "../designer3d/finishes";
import { label, number, translate } from "../i18n";

export function proposalFinishes(
  design: DesignDocument,
  catalog: Catalog,
): Material[] {
  const styles = design.cabinets.map((c) =>
    resolveCabinetStyle(design, c, catalog),
  );
  const frontIds = new Set(styles.map((s) => s.front.id));
  const countertopIds = new Set(
    design.cabinets
      .filter((c) => c.level === "base")
      .map(
        (c) =>
          resolveRunStyle(
            design,
            c.wall === "island" ? "island" : "main",
            catalog,
          ).countertop.id,
      ),
  );
  const items = [
    ...styles.map((s) => s.front),
    ...(design.kind === "kitchen"
      ? design.cabinets
          .filter((c) => c.level === "base")
          .map(
            (c) =>
              resolveRunStyle(
                design,
                c.wall === "island" ? "island" : "main",
                catalog,
              ).countertop,
          )
      : []),
    ...styles.map((s) => s.carcass),
  ];
  return items
    .filter((m, i, a) => a.findIndex((n) => n.id === m.id) === i)
    .map((m) => {
      const tiers = frontIds.has(m.id)
        ? catalog.frontTiers
        : design.kind === "kitchen" && countertopIds.has(m.id)
          ? catalog.countertopTiers
          : [];
      const tier = tiers.find((t) => t.decors.includes(m.id));
      const joined = (l: Language) =>
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
export function hasFinishOverrides(design: DesignDocument) {
  return !!(
    Object.keys(design.finishZones ?? {}).length ||
    Object.keys(design.worktopFinishes ?? {}).length ||
    design.cabinets.some(
      (c) => c.finishOverride && Object.keys(c.finishOverride).length,
    )
  );
}
/** All roles retain their association, including matching products and effective appearance. */
export function finishAssociations(
  design: DesignDocument,
  catalog: Catalog,
  language: Language,
) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const groups = new Map<string, { positions: number[]; index: number }>();
  design.cabinets.forEach((c, index) => {
    const key = JSON.stringify([
      finishZone(c),
      effectiveCabinetStyle(design, c),
    ]);
    const group = groups.get(key) ?? { positions: [], index };
    group.positions.push(index + 1);
    groups.set(key, group);
  });
  const rows = [...groups.values()].map(({ positions, index }) => {
    const c = design.cabinets[index],
      s = resolveCabinetStyle(design, c, catalog);
    return {
      scope: `${t(`zone${finishZone(c)}`)} · ${t("positions")} ${positions.join(", ")}`,
      quantity: `${positions.length} ${t("pieces")}`,
      brief: `${s.frontTier ? label(s.frontTier.name, language) + " · " : ""}${label(s.front.name, language)} / ${label(s.carcass.name, language)}`,
      description: [
        `${t("front")}: ${[...new Set([s.frontTier && label(s.frontTier.name, language), label(s.front.name, language)].filter(Boolean))].join(" · ")}`,
        `${t("carcass")}: ${label(s.carcass.name, language)}`,
        `${t("handle")}: ${label(s.handle.name, language)}`,
        `${t("frontStyle")}: ${t(s.profile === "panel" ? "classic" : "flat")}`,
        ...(c.level !== "wall"
          ? [
              `${t("plinth")}: ${label(s.plinth.name, language)}${s.plinth.matches ? ` (${label(s.plinthAppearance.name, language)})` : ""}`,
            ]
          : []),
      ].join(" · "),
    };
  });
  if (design.kind === "kitchen")
    for (const zone of ["main", "island"] as const) {
      const members = design.cabinets.filter(
        (c) =>
          c.level === "base" &&
          (c.wall === "island" ? "island" : "main") === zone,
      );
      if (!members.length) continue;
      const s = resolveRunStyle(design, zone, catalog);
      rows.push({
        scope: t(zone === "main" ? "mainWorktop" : "islandWorktop"),
        quantity: `${number(
          members.reduce((n, c) => n + c.width / 100, 0),
          language,
        )} m`,
        brief: `${label(s.countertop.name, language)} · ${Math.round(s.thickness * 1000)} mm`,
        description:
          `${label(s.countertop.name, language)} · ${Math.round(s.thickness * 1000)} mm` +
          (zone === "main"
            ? ` · ${t("backsplash")}: ${label(s.backsplash.name, language)}${s.backsplash.matches ? ` (${label(s.backsplashAppearance.name, language)})` : ""}`
            : ""),
      });
    }
  return rows;
}
export function finishDescription(
  design: DesignDocument,
  catalog: Catalog,
  language: Language,
) {
  return finishAssociations(design, catalog, language)
    .map((r) => `${r.scope} (${r.quantity}): ${r.description}`)
    .join("; ");
}

export function interiorAssociations(
  design: DesignDocument,
  catalog: Catalog,
  language: Language,
) {
  if (design.kind !== "wardrobe") return [];
  return design.cabinets.map((c, index) => {
    const module = catalog.modules.find((m) => m.id === c.moduleId)!;
    const components = resolveInterior(c, module, catalog);
    return {
      scope: `${translate(language, "positions")} ${index + 1} · ${label(module.name, language)} (${c.width} cm)`,
      description: components.length
        ? components
            .map(
              (p) =>
                `${p.item ? label(p.item.name, language) : translate(language, p.kind === "shelf" ? "shelfCount" : p.kind === "rail" ? "railHeight" : "drawerCount")}: ${number(p.yCm, language)} cm`,
            )
            .join(" · ")
        : translate(language, "interiorEmpty"),
    };
  });
}

export function interiorSummary(
  design: DesignDocument,
  catalog: Catalog,
  language: Language,
) {
  if (design.kind !== "wardrobe") return "";
  const counts = new Map<string, { name: string; count: number }>();
  for (const c of design.cabinets) {
    const module = catalog.modules.find((m) => m.id === c.moduleId)!;
    for (const part of resolveInterior(c, module, catalog)) {
      const name = part.item
        ? label(part.item.name, language)
        : translate(
            language,
            part.kind === "rail"
              ? "railHeight"
              : part.kind === "shelf"
                ? "shelfCount"
                : "drawerCount",
          );
      const group = counts.get(part.productId) ?? { name, count: 0 };
      group.count++;
      counts.set(part.productId, group);
    }
  }
  return (
    [...counts.values()].map((g) => `${g.name} × ${g.count}`).join(" · ") ||
    translate(language, "interiorEmpty")
  );
}
