import type {
  Cabinet,
  Catalog,
  DesignDocument,
  FinishOverride,
  FinishZone,
  Material,
} from "../catalog/types";
/** Selected products retain their own price; matches only resolves appearance. */
export function matchingAppearance(
  material: Material,
  front: Material,
  countertop: Material,
) {
  return material.matches === "front"
    ? front
    : material.matches === "countertop"
      ? countertop
      : material;
}

export type FinishScope = "all" | FinishZone | { cabinetId: string };
export type RunZone = "main" | "island";
export type ValidationIssue = { path: string; id: string };
export const FINISH_REVISION = "finish-zones-v3-1";
export function finishZone(cabinet: Cabinet): FinishZone {
  return cabinet.wall === "island" ? "island" : cabinet.level;
}
export function effectiveCabinetStyle(
  design: DesignDocument,
  cabinet: Cabinet,
) {
  return {
    ...design.style,
    ...design.finishZones?.[finishZone(cabinet)],
    ...cabinet.finishOverride,
  };
}
function required<T extends { id: string }>(items: T[], id: string): T {
  const value = items.find((item) => item.id === id);
  if (!value) throw Error(`Unresolved furniture product: ${id}`);
  return value;
}
export function resolveRunStyle(
  design: DesignDocument,
  run: RunZone | { zone: RunZone },
  catalog: Catalog,
) {
  const zone = typeof run === "string" ? run : run.zone;
  const countertop = required(
    catalog.countertops,
    design.worktopFinishes?.[zone] ?? design.style.countertop,
  );
  const tier = catalog.countertopTiers.find((t) =>
    t.decors.includes(countertop.id),
  );
  const backsplash = required(catalog.backsplashes, design.style.backsplash);
  return {
    zone,
    countertop,
    tier,
    thickness: (tier?.thicknessMm ?? 38) / 1000,
    backsplash,
    backsplashAppearance: matchingAppearance(
      backsplash,
      required(catalog.fronts, design.style.front),
      countertop,
    ),
  };
}
export function resolveCabinetStyle(
  design: DesignDocument,
  cabinet: Cabinet,
  catalog: Catalog,
) {
  const ids = effectiveCabinetStyle(design, cabinet);
  const front = required(catalog.fronts, ids.front),
    plinth = required(catalog.plinths, ids.plinth);
  const run = resolveRunStyle(
    design,
    cabinet.wall === "island" ? "island" : "main",
    catalog,
  );
  return {
    ...run,
    front,
    frontTier: catalog.frontTiers.find((t) => t.decors.includes(front.id)),
    carcass: required(catalog.carcasses, ids.carcass),
    handle: required(catalog.handles, ids.handle),
    plinth,
    profile: ids.profile,
    plinthAppearance: matchingAppearance(plinth, front, run.countertop),
  };
}
export function validateFinishReferences(
  design: DesignDocument,
  catalog: Catalog,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const groups = {
    front: catalog.fronts,
    carcass: catalog.carcasses,
    handle: catalog.handles,
    plinth: catalog.plinths,
    countertop: catalog.countertops,
    backsplash: catalog.backsplashes,
  };
  const check = (style: Partial<DesignDocument["style"]>, path: string) => {
    for (const [key, group] of Object.entries(groups)) {
      const id = style[key as keyof typeof style];
      if (typeof id === "string" && !group.some((m) => m.id === id))
        issues.push({ path: `${path}.${key}`, id });
    }
    if (style.profile && !["flat", "panel"].includes(style.profile))
      issues.push({ path: `${path}.profile`, id: style.profile });
  };
  check(design.style, "style");
  if (
    design.presentation &&
    design.presentation.roomSceneId !== `${design.kind}-warm-v1`
  )
    issues.push({
      path: "presentation.roomSceneId",
      id: design.presentation.roomSceneId,
    });
  for (const [zone, value] of Object.entries(design.finishZones ?? {}))
    if (value) check(value, `finishZones.${zone}`);
  for (const c of design.cabinets)
    if (c.finishOverride)
      check(c.finishOverride, `cabinets.${c.id}.finishOverride`);
  for (const [zone, id] of Object.entries(design.worktopFinishes ?? {}))
    if (id && !catalog.countertops.some((m) => m.id === id))
      issues.push({ path: `worktopFinishes.${zone}`, id });
  return issues;
}
/** Global means defaults only. A selected scope changes its shared zone or cabinet patch. */
export function applyFinishChange(
  design: DesignDocument,
  scope: FinishScope,
  patch: FinishOverride,
): DesignDocument {
  if (scope === "all")
    return { ...design, style: { ...design.style, ...patch } };
  if (typeof scope === "object")
    return {
      ...design,
      cabinets: design.cabinets.map((c) =>
        c.id === scope.cabinetId
          ? { ...c, finishOverride: { ...c.finishOverride, ...patch } }
          : c,
      ),
    };
  return {
    ...design,
    finishZones: {
      ...design.finishZones,
      [scope]: { ...design.finishZones?.[scope], ...patch },
    },
  };
}
/** Explicit complete reset, passed to the store as one edit/history entry. */
export function applyToAll(design: DesignDocument): DesignDocument {
  const { finishZones: _zones, worktopFinishes: _tops, ...rest } = design;
  return {
    ...rest,
    cabinets: design.cabinets.map(({ finishOverride: _override, ...c }) => c),
  };
}
export function scopeCabinets(design: DesignDocument, scope: FinishScope) {
  return design.cabinets.filter(
    (c) =>
      scope === "all" ||
      (typeof scope === "object"
        ? c.id === scope.cabinetId
        : finishZone(c) === scope),
  );
}
export function scopeValue(
  design: DesignDocument,
  scope: FinishScope,
  key: keyof FinishOverride,
): string {
  const values = [
    ...new Set(
      scopeCabinets(design, scope).map(
        (c) => effectiveCabinetStyle(design, c)[key],
      ),
    ),
  ];
  return values.length === 1 ? values[0]! : "";
}
