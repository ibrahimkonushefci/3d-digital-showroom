import { openDB } from "idb";
import {
  DesignSchema,
  type Catalog,
  type DesignDocument,
} from "../catalog/types";
import { validateDesign } from "../designer3d/layout";
export function saveDesign(brand: string, d: DesignDocument) {
  localStorage.setItem(`showroom-design-${brand}-${d.kind}`, JSON.stringify(d));
  localStorage.setItem(`showroom-recent-${brand}`, d.kind);
}
export function loadDesign(
  brand: string,
  kind: DesignDocument["kind"],
  catalog: Catalog,
) {
  try {
    const data = localStorage.getItem(`showroom-design-${brand}-${kind}`);
    if (!data) return null;
    const d = DesignSchema.parse(JSON.parse(data));
    return d.kind === kind && validateDesign(d, catalog) ? d : null;
  } catch {
    return null;
  }
}
export async function photoDB() {
  return openDB("showroom-photos", 1, {
    upgrade(db) {
      db.createObjectStore("photos");
    },
  });
}
export async function savePhoto(key: string, data: unknown) {
  const db = await photoDB();
  await db.put("photos", data, key);
}
export async function getPhoto(key: string) {
  const db = await photoDB();
  return db.get("photos", key);
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
