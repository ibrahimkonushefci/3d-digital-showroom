import {
  DesignSchema,
  type Cabinet,
  type Catalog,
  type DesignDocument,
  type Module,
} from "../catalog/types";
import {
  canEditInterior,
  interiorAdjustments,
  presetComponents,
  resolveInterior,
  snapInterior,
} from "./interiors";
export type InteriorIssue = {
  cabinetId: string;
  componentId?: string;
  code:
    | "interiorReferenceError"
    | "interiorBoundsError"
    | "interiorOverlapError"
    | "interiorRailError"
    | "interiorAccessError"
    | "interiorMountError"
    | "interiorCreditError"
    | "interiorLimitError";
};
export function validateInterior(
  c: Cabinet,
  module: Module,
  catalog: Catalog,
): InteriorIssue[] {
  if (!c.interior) return [];
  const issues: InteriorIssue[] = [];
  const fail = (code: InteriorIssue["code"], componentId?: string) =>
    issues.push({ cabinetId: c.id, componentId, code });
  if (!canEditInterior(module, catalog)) {
    fail("interiorReferenceError");
    return issues;
  }
  if (c.interior.components.length > 32) fail("interiorLimitError");
  if (
    new Set(c.interior.components.map((i) => i.id)).size !==
    c.interior.components.length
  )
    fail("interiorReferenceError");
  if (
    c.interior.components.some(
      (i) => !catalog.interiorItems?.some((p) => p.id === i.productId),
    )
  ) {
    fail("interiorReferenceError");
    return issues;
  }
  const parts = resolveInterior(c, module, catalog),
    defaults = (catalog.interiorPresets ?? []).flatMap((p) =>
      presetComponents(c, module, catalog, p.id),
    );
  for (const part of parts) {
    const i = part.item!;
    if (
      !i.compatibleModuleTypes.includes(module.type) ||
      part.kind === "divider" ||
      part.span
    )
      fail("interiorReferenceError", part.id);
    if (
      !Number.isFinite(part.yCm) ||
      part.yCm < 0 ||
      part.yCm + part.heightCm + i.clearanceAboveCm > c.height - 3.6 + 0.001 ||
      part.yCm < i.clearanceBelowCm ||
      c.width < i.minWidthCm ||
      c.width > i.maxWidthCm ||
      c.depth < i.minDepthCm ||
      c.depth > i.maxDepthCm ||
      (i.supportedWidthsCm && !i.supportedWidthsCm.includes(c.width))
    )
      fail("interiorBoundsError", part.id);
    // Original off-grid mounting positions remain legitimate, including after first edit.
    // Legacy ratio positions at previous whole-centimetre cabinet heights remain valid on resize.
    // These are authored exceptions; all new moves still snap to the item's catalog grid.
    const priorLegacyPosition =
      part.kind === "shelf"
        ? [0.32, 0.62, 0.82].some((r) => {
            const height = (part.yCm + 2.7) / r;
            return (
              height >= 30 &&
              height <= module.height + 0.001 &&
              Math.abs(height - Math.round(height)) < 0.001
            );
          })
        : part.kind === "rail" &&
          part.yCm + 34.6 <= module.height + 0.001 &&
          Math.abs(part.yCm + 34.6 - Math.round(part.yCm + 34.6)) < 0.001;
    const defaultPosition =
      priorLegacyPosition ||
      defaults.some(
        (p) =>
          p.productId === part.productId && Math.abs(p.yCm - part.yCm) < 0.001,
      );
    if (
      !defaultPosition &&
      Math.abs(snapInterior(part.yCm, i) - part.yCm) > 0.001
    )
      fail("interiorMountError", part.id);
    if (
      part.kind === "drawer" &&
      module.type === "drawers" &&
      part.yCm + part.heightCm > 66.2
    )
      fail("interiorBoundsError", part.id);
    if (
      (part.kind === "drawer" || part.kind === "basket") &&
      (module.type === "sliding" || i.extensionCm > part.depthCm)
    )
      fail("interiorAccessError", part.id);
    for (const other of parts)
      if (other.id !== part.id) {
        const lower = part.yCm <= other.yCm ? part : other,
          upper = lower === part ? other : part;
        if (
          lower.yCm + lower.heightCm + (lower.item?.clearanceAboveCm ?? 0) >
          upper.yCm - (upper.item?.clearanceBelowCm ?? 0) + 0.001
        )
          fail("interiorOverlapError", part.id);
        if (
          part.kind === "rail" &&
          other.yCm < part.yCm &&
          other.yCm + other.heightCm > part.yCm - i.clearanceBelowCm + 0.001
        )
          fail("interiorRailError", part.id);
      }
  }
  try {
    interiorAdjustments(c, module, catalog);
  } catch {
    fail("interiorCreditError");
  }
  return issues;
}
export function validateInteriorReferences(
  design: DesignDocument,
  catalog: Catalog,
): InteriorIssue[] {
  if (!DesignSchema.safeParse(design).success)
    return [{ cabinetId: "", code: "interiorLimitError" }];
  const accessIssues: InteriorIssue[] = [];
  // Conservative swept pull-out footprint. Furniture never moves to make space.
  for (const c of design.cabinets) {
    const module = catalog.modules.find((m) => m.id === c.moduleId);
    if (
      !c.interior ||
      !module ||
      c.interior.components.some(
        (i) => !catalog.interiorItems?.some((p) => p.id === i.productId),
      )
    )
      continue;
    for (const part of resolveInterior(c, module, catalog).filter(
      (i) => i.kind === "drawer" || i.kind === "basket",
    )) {
      const cos = Math.cos(c.rotation),
        sin = Math.sin(c.rotation);
      const points = [-part.widthCm / 2, part.widthCm / 2].flatMap((x) =>
        [c.depth / 2 - 4, c.depth / 2 + part.extensionCm].map((z) => [
          c.x + x * cos + z * sin,
          c.z - x * sin + z * cos,
        ]),
      );
      const b = {
        x0: Math.min(...points.map((p) => p[0])),
        x1: Math.max(...points.map((p) => p[0])),
        z0: Math.min(...points.map((p) => p[1])),
        z1: Math.max(...points.map((p) => p[1])),
      };
      let invalid =
        b.x0 < -0.1 ||
        b.z0 < -0.1 ||
        b.x1 > design.room.width + 0.1 ||
        b.z1 > design.room.depth + 0.1;
      for (const other of design.cabinets)
        if (other.id !== c.id) {
          const cs = Math.cos(other.rotation),
            sn = Math.sin(other.rotation);
          const p = [-other.width / 2, other.width / 2].flatMap((x) =>
            [-other.depth / 2, other.depth / 2].map((z) => [
              other.x + x * cs + z * sn,
              other.z - x * sn + z * cs,
            ]),
          );
          if (
            b.x0 < Math.max(...p.map((i) => i[0])) - 0.1 &&
            b.x1 > Math.min(...p.map((i) => i[0])) + 0.1 &&
            b.z0 < Math.max(...p.map((i) => i[1])) - 0.1 &&
            b.z1 > Math.min(...p.map((i) => i[1])) + 0.1
          )
            invalid = true;
        }
      if (invalid)
        accessIssues.push({
          cabinetId: c.id,
          componentId: part.id,
          code: "interiorAccessError",
        });
    }
  }
  return [
    ...accessIssues,
    ...design.cabinets.flatMap((c) => {
      const module = catalog.modules.find((m) => m.id === c.moduleId);
      return module
        ? validateInterior(c, module, catalog)
        : c.interior
          ? [{ cabinetId: c.id, code: "interiorReferenceError" as const }]
          : [];
    }),
  ];
}
