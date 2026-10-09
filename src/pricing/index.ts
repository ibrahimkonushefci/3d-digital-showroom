import type { Catalog, DesignDocument, Language } from "../catalog/types";
import { label, translate } from "../i18n";
export type PriceLine = {
  id: string;
  name: string;
  quantity: number;
  unit: "piece" | "m" | "m2";
  amount: number;
};
export function calculatePrice(
  design: DesignDocument,
  catalog: Catalog,
  language: Language,
) {
  const lines: PriceLine[] = [];
  const front = catalog.fronts.find((m) => m.id === design.style.front)!;
  const carcass = catalog.carcasses.find((m) => m.id === design.style.carcass)!;
  const handle = catalog.handles.find((m) => m.id === design.style.handle)!;
  const groups = new Map<string, { n: number; amount: number }>();
  let handles = 0;
  for (const c of design.cabinets) {
    const m = catalog.modules.find((m) => m.id === c.moduleId)!;
    const amount =
      ((m.pricePerMeter * c.width) / 100) *
      (catalog.frontTiers.find((t) => t.id === front.tier)?.multiplier ?? 1) *
      front.multiplier *
      carcass.multiplier *
      (design.style.profile === "panel" ? catalog.pricing.panelMultiplier : 1) *
      (c.height / m.height);
    const group = groups.get(m.id) || { n: 0, amount: 0 };
    group.n++;
    group.amount += amount;
    groups.set(m.id, group);
    handles += m.handleCount;
    if (m.accessory) {
      const accessory = catalog.accessories.find((a) => a.id === m.accessory);
      if (accessory) {
        const g = groups.get("a-" + accessory.id) || { n: 0, amount: 0 };
        g.n++;
        g.amount += accessory.price;
        groups.set("a-" + accessory.id, g);
      }
    }
  }
  for (const [id, g] of groups) {
    const item = id.startsWith("a-")
      ? catalog.accessories.find((a) => a.id === id.slice(2))!
      : catalog.modules.find((m) => m.id === id)!;
    lines.push({
      id,
      name: label(item.name, language),
      quantity: g.n,
      unit: "piece",
      amount: g.amount,
    });
  }
  const baseMeters = design.cabinets
      .filter((c) => c.level === "base")
      .reduce((s, c) => s + c.width / 100, 0),
    plinthMeters = design.cabinets
      .filter((c) => c.level !== "wall")
      .reduce((s, c) => s + c.width / 100, 0),
    wallMeters = design.cabinets
      .filter((c) => c.level === "wall")
      .reduce((s, c) => s + c.width / 100, 0);
  const counter = catalog.countertops.find(
    (m) => m.id === design.style.countertop,
  )!;
  if (baseMeters)
    lines.push({
      id: "countertop",
      name: `${translate(language, "countertop")} – ${label(catalog.countertopTiers.find((t) => t.id === counter.tier)?.name ?? counter.name, language)}`,
      quantity: baseMeters,
      unit: "m",
      amount:
        baseMeters *
        (catalog.countertopTiers.find((t) => t.id === counter.tier)?.perMeter ??
          counter.perMeter),
    });
  if (handles && handle.perPiece)
    lines.push({
      id: "handles",
      name: label(handle.name, language),
      quantity: handles,
      unit: "piece",
      amount: handles * handle.perPiece,
    });
  const plinth = catalog.plinths.find((m) => m.id === design.style.plinth)!;
  const plinthRate = plinth.perMeter || catalog.pricing.plinthPerMeter;
  if (plinthMeters && plinthRate)
    lines.push({
      id: "plinth",
      name: "plinth",
      quantity: plinthMeters,
      unit: "m",
      amount: plinthMeters * plinthRate,
    });
  const splash = catalog.backsplashes.find(
    (m) => m.id === design.style.backsplash,
  )!;
  if (splash.perMeter && baseMeters)
    lines.push({
      id: "backsplash",
      name: label(splash.name, language),
      quantity: baseMeters,
      unit: "m",
      amount: baseMeters * splash.perMeter,
    });
  if (design.style.led && wallMeters)
    lines.push({
      id: "led",
      name: "led",
      quantity: wallMeters,
      unit: "m",
      amount: wallMeters * catalog.pricing.ledPerMeter,
    });
  if (design.kind === "wardrobe" && design.environment?.internalLed) {
    const meters = design.cabinets.reduce((n, c) => n + c.width / 100, 0);
    lines.push({
      id: "internal-led",
      name: translate(language, "internalLed"),
      quantity: meters,
      unit: "m",
      amount: meters * catalog.pricing.internalLedPerMeter,
    });
  }
  const pack = catalog.appliancePackages.find(
    (p) => p.id === design.appliancePackage,
  );
  if (design.kind === "kitchen" && pack?.price)
    lines.push({
      id: "appliances",
      name: label(pack.name, language),
      quantity: 1,
      unit: "piece",
      amount: pack.price,
    });
  const subtotal = lines.reduce((s, l) => s + l.amount, 0),
    installation = design.installation
      ? (subtotal * catalog.pricing.installationPercent) / 100
      : 0,
    vat = design.vat
      ? ((subtotal + installation) * catalog.pricing.vatPercent) / 100
      : 0,
    total = subtotal + installation + vat,
    range = catalog.pricing.rangePercent / 100;
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
export function windowPrice(
  model: Catalog["windows"][number],
  width: number,
  height: number,
) {
  return Math.max(
    model.minimumPrice,
    ((Math.max(0, width) * Math.max(0, height)) / 10000) * model.perSquareMeter,
  );
}
