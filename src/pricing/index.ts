import type { Catalog, DesignDocument, Language } from "../catalog/types";
import { label, money, number, translate } from "../i18n";
export type PriceLine = {
  id: string;
  name: string;
  quantity: number;
  unit: "piece" | "m" | "m2";
  amount: number;
  /** Price per piece or per metre, shown so a client can check each line. */
  unitPrice: number;
  /** Module size in cm (width × depth × height), for cabinet lines only. */
  size?: [number, number, number];
};
export type Price = ReturnType<typeof calculatePrice>;
export function calculatePrice(
  design: DesignDocument,
  catalog: Catalog,
  language: Language,
) {
  const lines: PriceLine[] = [];
  const front = catalog.fronts.find((m) => m.id === design.style.front)!;
  const carcass = catalog.carcasses.find((m) => m.id === design.style.carcass)!;
  const handle = catalog.handles.find((m) => m.id === design.style.handle)!;
  const groups = new Map<
    string,
    { n: number; amount: number; item: string; size?: PriceLine["size"] }
  >();
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
    const size: [number, number, number] = [c.width, c.depth, c.height];
    const key = `${m.id}@${size.join("x")}`;
    const group = groups.get(key) || { n: 0, amount: 0, item: m.id, size };
    group.n++;
    group.amount += amount;
    groups.set(key, group);
    handles += m.handleCount;
    if (m.accessory) {
      const accessory = catalog.accessories.find((a) => a.id === m.accessory);
      if (accessory) {
        const g = groups.get("a-" + accessory.id) || {
          n: 0,
          amount: 0,
          item: accessory.id,
        };
        g.n++;
        g.amount += accessory.price;
        groups.set("a-" + accessory.id, g);
      }
    }
  }
  for (const [id, g] of groups) {
    const item = id.startsWith("a-")
      ? catalog.accessories.find((a) => a.id === g.item)!
      : catalog.modules.find((m) => m.id === g.item)!;
    lines.push({
      id,
      name: label(item.name, language),
      quantity: g.n,
      unit: "piece",
      amount: g.amount,
      unitPrice: g.amount / g.n,
      size: g.size,
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
  const counterTier = catalog.countertopTiers.find(
    (t) => t.id === counter.tier,
  );
  const tierName = counterTier ? label(counterTier.name, language) : "";
  const decorName = label(counter.name, language);
  const metres = (
    id: string,
    name: string,
    quantity: number,
    unitPrice: number,
  ) =>
    lines.push({
      id,
      name,
      quantity,
      unit: "m",
      amount: quantity * unitPrice,
      unitPrice,
    });
  if (baseMeters)
    metres(
      "countertop",
      `${translate(language, "countertop")} – ${[...new Set([tierName, decorName].filter(Boolean))].join(" · ")}`,
      baseMeters,
      counterTier?.perMeter ?? counter.perMeter,
    );
  if (handles && handle.perPiece)
    lines.push({
      id: "handles",
      name:
        handle.id === "profile"
          ? translate(language, "profileAllowance")
          : label(handle.name, language),
      quantity: handles,
      unit: "piece",
      amount: handles * handle.perPiece,
      unitPrice: handle.perPiece,
    });
  const plinth = catalog.plinths.find((m) => m.id === design.style.plinth)!;
  const plinthRate = plinth.perMeter || catalog.pricing.plinthPerMeter;
  if (plinthMeters && plinthRate)
    metres("plinth", translate(language, "plinth"), plinthMeters, plinthRate);
  const splash = catalog.backsplashes.find(
    (m) => m.id === design.style.backsplash,
  )!;
  if (splash.perMeter && baseMeters)
    metres(
      "backsplash",
      label(splash.name, language),
      baseMeters,
      splash.perMeter,
    );
  if (design.style.led && wallMeters)
    metres(
      "led",
      translate(language, "led"),
      wallMeters,
      catalog.pricing.ledPerMeter,
    );
  if (design.kind === "wardrobe" && design.environment?.internalLed)
    metres(
      "internal-led",
      translate(language, "internalLed"),
      design.cabinets.reduce((n, c) => n + c.width / 100, 0),
      catalog.pricing.internalLedPerMeter,
    );
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
      unitPrice: pack.price,
    });
  // Discount applies to the goods; installation and VAT follow on the result.
  const subtotal = lines.reduce((s, l) => s + l.amount, 0),
    discountPercent = Math.min(
      30,
      Math.max(0, design.offer?.discountPercent ?? 0),
    ),
    discount = (subtotal * discountPercent) / 100,
    installation = design.installation
      ? ((subtotal - discount) * catalog.pricing.installationPercent) / 100
      : 0,
    net = subtotal - discount + installation,
    vat = design.vat ? (net * catalog.pricing.vatPercent) / 100 : 0,
    total = net + vat,
    range = catalog.pricing.rangePercent / 100;
  return {
    lines,
    subtotal,
    discountPercent,
    discount,
    installation,
    net,
    vat,
    total,
    low: total * (1 - range),
    high: total * (1 + range),
  };
}

/** The headline figure: one price, or the indicative range. */
export function estimateLabel(
  price: Pick<Price, "total" | "low" | "high">,
  exact: boolean,
  language: Language,
) {
  return exact
    ? money(price.total, language)
    : `${money(price.low, language)} – ${money(price.high, language)}`;
}

export function quantityLabel(
  line: PriceLine,
  language: Language,
  pieces: string,
) {
  const value = number(line.quantity, language);
  return line.unit === "m"
    ? `${value} m`
    : line.unit === "m2"
      ? `${value} m²`
      : `${value} ${pieces}`;
}
