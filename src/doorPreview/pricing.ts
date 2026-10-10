import type { Catalog, Language } from "../catalog/types";
import { label, translate } from "../i18n";
import type { Placement, FacadeDesign } from "./types";
import type { PriceLine } from "../pricing";
export function productPrice(p: Placement, c: Catalog) {
  const model = (p.kind === "door" ? c.doors : c.windows).find(
    (m) => m.id === p.modelId,
  );
  if (!model) return 0;
  const options = [...new Set(p.options)].reduce(
    (n, id) => n + (model.options.find((o) => o.id === id)?.price || 0),
    0,
  );
  const area = (p.width * p.height) / 10000;
  if (p.kind === "door") {
    const m = c.doors.find((m) => m.id === p.modelId)!;
    return (
      ((m.price * area) / m.referenceArea) *
        (c.doorTypes.find((t) => t.id === p.materialType)?.multiplier || 1) +
      options
    );
  }
  const m = c.windows.find((m) => m.id === p.modelId)!;
  return (
    Math.max(
      m.minimumPrice,
      area *
        m.perSquareMeter *
        (c.windowMaterials.find((t) => t.id === p.materialType)?.multiplier ||
          1) *
        (c.windowProfiles.find((t) => t.id === p.profile)?.multiplier || 1),
    ) + options
  );
}
export function productDescription(p: Placement, c: Catalog, l: Language) {
  const model = (p.kind === "door" ? c.doors : c.windows).find(
    (m) => m.id === p.modelId,
  )!;
  const material = (p.kind === "door" ? c.doorTypes : c.windowMaterials).find(
    (m) => m.id === p.materialType,
  );
  const outside = c.productFinishes.find((f) => f.id === p.finishId),
    inside = c.productFinishes.find((f) => f.id === p.finishInsideId);
  const parts = [
    label(model.name, l),
    `${p.width} × ${p.height} cm`,
    material ? label(material.name, l) : p.materialType,
  ];
  if (p.kind === "window") {
    const profile = c.windowProfiles.find((f) => f.id === p.profile);
    if (profile) parts.push(label(profile.name, l));
    parts.push(
      translate(
        l,
        p.options.includes("triple-glass") ? "tripleGlass" : "doubleGlass",
      ),
    );
  }
  parts.push(
    `${translate(l, "outsideFinish")}: ${outside ? label(outside.name, l) : p.color}`,
    `${translate(l, "insideFinish")}: ${inside ? label(inside.name, l) : p.colorInside || (outside ? label(outside.name, l) : p.color)}`,
  );
  parts.push(
    ...p.options.map((id) => {
      const o = model.options.find((o) => o.id === id);
      return o ? label(o.name, l) : id;
    }),
  );
  return parts.join(" · ");
}
export function facadePrice(d: FacadeDesign, c: Catalog, l: Language) {
  const lines: PriceLine[] = d.items.map((p) => ({
    id: p.id,
    name: productDescription(p, c, l),
    quantity: 1,
    unit: "piece",
    amount: productPrice(p, c),
  }));
  if (d.removal)
    lines.push({
      id: "removal",
      name: translate(l, "removal"),
      quantity: d.items.length,
      unit: "piece",
      amount: d.items.length * c.pricing.removalPerPiece,
    });
  const subtotal = lines.reduce((n, p) => n + p.amount, 0),
    installation = d.installation
      ? d.items.reduce(
          (n, p) =>
            n +
            (p.kind === "door"
              ? c.pricing.doorInstallationPerPiece
              : c.pricing.windowInstallationPerPiece),
          0,
        )
      : 0;
  const vat = d.vat
      ? ((subtotal + installation) * c.pricing.vatPercent) / 100
      : 0,
    total = subtotal + installation + vat,
    range = c.pricing.rangePercent / 100;
  return {
    lines,
    subtotal,
    installation,
    vat,
    total,
    low: total * (1 - range),
    high: total * (1 + range),
  };
}
