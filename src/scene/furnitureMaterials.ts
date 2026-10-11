import type { Catalog, DesignDocument, Material } from "../catalog/types";
export function furnitureResponse(material: Material) {
  const tier = material.tier || "";
  const gloss =
    ["lacquer", "acrylic"].includes(tier) || material.id === "gloss";
  return {
    roughness:
      tier === "fenix"
        ? 0.84
        : tier === "lacquer"
          ? 0.32
          : gloss
            ? 0.16
            : material.texture
              ? 0.58
              : 0.72,
    clearcoat: gloss ? 0.85 : material.texture ? 0.06 : 0.02,
    clearcoatRoughness: gloss ? 0.12 : 0.6,
    envMapIntensity: gloss ? 1 : 0.7,
  };
}
export function countertopThickness(design: DesignDocument, catalog: Catalog) {
  const material = catalog.countertops.find(
    (m) => m.id === design.style.countertop,
  );
  const tier = catalog.countertopTiers.find((t) =>
    t.decors.includes(material?.id || ""),
  );
  return (tier?.thicknessMm ?? 38) / 1000;
}

export function selectFamily(
  current: string,
  decors: string[],
  items: Material[],
) {
  const valid = decors.filter((id) => items.some((m) => m.id === id));
  return valid.includes(current) ? current : valid[0] || current;
}
