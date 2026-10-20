import { parseDesignDocument } from "../catalog/migrations";
import { type Catalog, type DesignDocument } from "../catalog/types";
import { validateDesign } from "../designer3d/layout";
export function saveDesign(brand: string, d: DesignDocument) {
  localStorage.setItem(`showroom-design-${brand}-${d.kind}`, JSON.stringify(d));
  localStorage.setItem(`showroom-recent-${brand}`, d.kind);
}
/** Reset demo: the brand's kitchen and wardrobe drafts. Branding, offer
 * numbers and device settings stay. */
export function clearDesigns(brand: string) {
  for (const kind of ["kitchen", "wardrobe"])
    localStorage.removeItem(`showroom-design-${brand}-${kind}`);
  localStorage.removeItem(`showroom-recent-${brand}`);
}
export function readDesign(
  brand: string,
  kind: DesignDocument["kind"],
  catalog: Catalog,
): { design: DesignDocument | null; error: "incompatibleDesign" | null } {
  try {
    const data = localStorage.getItem(`showroom-design-${brand}-${kind}`);
    if (!data) return { design: null, error: null };
    const design = parseDesignDocument(JSON.parse(data));
    if (design.kind !== kind || !validateDesign(design, catalog))
      return { design: null, error: "incompatibleDesign" };
    return { design, error: null };
  } catch {
    return { design: null, error: "incompatibleDesign" };
  }
}
export function loadDesign(
  brand: string,
  kind: DesignDocument["kind"],
  catalog: Catalog,
) {
  return readDesign(brand, kind, catalog).design;
}

export function restoreSummary(
  brand: string,
  catalog: Catalog,
  kind?: string | null,
) {
  try {
    if (kind === "kitchen" || kind === "wardrobe")
      return loadDesign(brand, kind, catalog);
    const recent = localStorage.getItem(`showroom-recent-${brand}`);
    const order: DesignDocument["kind"][] =
      recent === "wardrobe" ? ["wardrobe", "kitchen"] : ["kitchen", "wardrobe"];
    return (
      order.map((k) => loadDesign(brand, k, catalog)).find(Boolean) || null
    );
  } catch {
    return null;
  }
}
