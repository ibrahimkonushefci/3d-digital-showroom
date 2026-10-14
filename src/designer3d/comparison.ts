import { CAMERA_REVISION } from "./cameraShots";
import { INTERIOR_REVISION } from "./interiors";
import { FINISH_REVISION } from "./finishes";
import { parseDesignDocument } from "../catalog/migrations";
import { LIGHTING_REVISION } from "../scene/lighting/lightingRecipe";
import { SCENE_REVISION } from "../scene/assets/manifest";
import { openDB } from "idb";
import {
  DesignSchema,
  type Catalog,
  type DesignDocument,
} from "../catalog/types";
import { validateDesign } from "./layout";
export type Slot = "A" | "B";
export type Alternative = {
  version: 1;
  name: string;
  design: DesignDocument;
  image: string;
  catalogSignature: string;
  savedAt: string;
};
const key = (brand: string, kind: DesignDocument["kind"], slot: Slot) =>
  `${brand}:${kind}:${slot}`;
const db = () =>
  openDB("showroom-furniture-comparisons", 1, {
    upgrade(database) {
      database.createObjectStore("alternatives");
    },
  });
export const catalogSignature = (catalog: Catalog) =>
  JSON.stringify([
    "furniture-sales-v1",
    SCENE_REVISION,
    LIGHTING_REVISION,
    FINISH_REVISION,
    INTERIOR_REVISION,
    CAMERA_REVISION,
    catalog,
  ]);
export function compatibleAlternative(value: Alternative, catalog: Catalog) {
  const parsed = DesignSchema.safeParse(value.design);
  return (
    parsed.success &&
    validateDesign(parsed.data, catalog) &&
    (!parsed.data.appliancePackage ||
      catalog.appliancePackages.some(
        (p) => p.id === parsed.data.appliancePackage,
      ))
  );
}
export function restoreAlternative(
  value: Alternative,
  catalog: Catalog,
  current?: DesignDocument | null,
) {
  if (!compatibleAlternative(value, catalog))
    throw Error("comparisonUnavailable");
  return { ...parseDesignDocument(value.design), offer: current?.offer };
}
export async function loadAlternative(
  brand: string,
  kind: DesignDocument["kind"],
  slot: Slot,
): Promise<Alternative | undefined> {
  const database = await db();
  try {
    const value = await database.get("alternatives", key(brand, kind, slot));
    if (!value) return undefined;
    const design = parseDesignDocument(value.design);
    if (
      design.kind !== kind ||
      value.version !== 1 ||
      typeof value.image !== "string" ||
      typeof value.name !== "string"
    )
      throw Error("comparisonError");
    const { offer: _private, ...safe } = design;
    return { ...value, design: safe };
  } finally {
    database.close();
  }
}
export async function saveAlternative(
  brand: string,
  design: DesignDocument,
  catalog: Catalog,
  slot: Slot,
  name: string,
  capture: () => Promise<string>,
) {
  const { offer: _private, ...snapshot } = parseDesignDocument(
    structuredClone(design),
  );
  if (!validateDesign(snapshot, catalog)) throw Error("comparisonUnavailable");
  const image = await capture();
  if (!/^data:image\/(png|jpeg|webp);base64,.+/.test(image))
    throw Error("comparisonError");
  const alternative: Alternative = {
    version: 1,
    name: name.trim().slice(0, 80) || slot,
    design: snapshot,
    image,
    catalogSignature: catalogSignature(catalog),
    savedAt: new Date().toISOString(),
  };
  const database = await db();
  try {
    await database.put(
      "alternatives",
      alternative,
      key(brand, design.kind, slot),
    );
  } finally {
    database.close();
  }
  return alternative;
}
export async function clearComparisons(brand: string) {
  const database = await db();
  try {
    const tx = database.transaction("alternatives", "readwrite");
    for (const kind of ["kitchen", "wardrobe"] as const)
      for (const slot of ["A", "B"] as const)
        await tx.store.delete(key(brand, kind, slot));
    await tx.done;
  } finally {
    database.close();
  }
}
