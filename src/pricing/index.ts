import { interiorAdjustments } from "../designer3d/interiors";
import { validateInteriorReferences } from "../designer3d/interiorValidation";
import type { Catalog, DesignDocument, Language } from "../catalog/types";
import { label, money, number, translate } from "../i18n";
import {
  resolveCabinetStyle,
  resolveRunStyle,
  effectiveCabinetStyle,
  finishZone,
} from "../designer3d/finishes";
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
  const issues = validateInteriorReferences(design, catalog);
  if (issues.length) throw Error(issues[0].code);
  const lines: PriceLine[] = [];
  const signatures = design.cabinets.map((c) => {
    const ids = effectiveCabinetStyle(design, c);
    return JSON.stringify([
      ids.front,
      ids.carcass,
      ids.profile,
      ids.handle,
      ids.plinth,
    ]);
  });
  const mixed =
    new Set(signatures).size > 1 ||
    new Set(
      ["main", "island"].map(
        (zone) =>
          design.worktopFinishes?.[zone as "main" | "island"] ??
          design.style.countertop,
      ),
    ).size > 1;
  const groups = new Map<
    string,
    {
      n: number;
      amount: number;
      item: string;
      size?: PriceLine["size"];
      finish?: string;
    }
  >();
  const handles = new Map<string, number>(),
    plinths = new Map<string, number>();
  const topMeters = new Map<"main" | "island", number>();
  for (const [index, c] of design.cabinets.entries()) {
    const m = catalog.modules.find((m) => m.id === c.moduleId)!;
    const { front, frontTier, carcass, handle, plinth, profile } =
      resolveCabinetStyle(design, c, catalog);
    const amount =
      ((m.pricePerMeter * c.width) / 100) *
      (catalog.frontTiers.find((t) => t.id === front.tier)?.multiplier ?? 1) *
      front.multiplier *
      carcass.multiplier *
      (profile === "panel" ? catalog.pricing.panelMultiplier : 1) *
      (c.height / m.height);
    const size: [number, number, number] = [c.width, c.depth, c.height];
    const key = `${m.id}@${size.join("x")}${mixed ? "@" + signatures[index] : ""}`;
    const finish = mixed
      ? `${[...new Set([frontTier && label(frontTier.name, language), label(front.name, language)].filter(Boolean))].join(" · ")} · ${label(carcass.name, language)} · ${translate(language, profile === "panel" ? "classic" : "flat")}`
      : undefined;
    const group = groups.get(key) || {
      n: 0,
      amount: 0,
      item: m.id,
      size,
      finish,
    };
    group.n++;
    group.amount += amount;
    groups.set(key, group);
    handles.set(handle.id, (handles.get(handle.id) ?? 0) + m.handleCount);
    if (c.level !== "wall")
      plinths.set(plinth.id, (plinths.get(plinth.id) ?? 0) + c.width / 100);
    if (c.level === "base") {
      const zone = finishZone(c) === "island" ? "island" : "main";
      topMeters.set(zone, (topMeters.get(zone) ?? 0) + c.width / 100);
    }
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
      name: [label(item.name, language), g.finish].filter(Boolean).join(" · "),
      quantity: g.n,
      unit: "piece",
      amount: g.amount,
      unitPrice: g.amount / g.n,
      size: g.size,
    });
  }
  const wallMeters = design.cabinets
    .filter((c) => c.level === "wall")
    .reduce((s, c) => s + c.width / 100, 0);
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
  // A uniform design retains the exact legacy line IDs, accumulation and totals.
  const topGroups = new Map<
    string,
    { quantity: number; zone: "main" | "island" }
  >();
  for (const [zone, quantity] of topMeters) {
    const id = resolveRunStyle(design, zone, catalog).countertop.id;
    const groupKey = mixed ? `${zone}:${id}` : id;
    const old = topGroups.get(groupKey);
    topGroups.set(groupKey, {
      quantity: (old?.quantity ?? 0) + quantity,
      zone,
    });
  }
  for (const [id, group] of topGroups) {
    const { countertop: counter, tier } = resolveRunStyle(
      design,
      group.zone,
      catalog,
    );
    const names = [
      ...new Set(
        [
          tier && label(tier.name, language),
          label(counter.name, language),
        ].filter(Boolean),
      ),
    ].join(" · ");
    metres(
      topGroups.size === 1 ? "countertop" : `countertop-${id}`,
      `${translate(language, "countertop")} – ${names}${topGroups.size > 1 ? " · " + translate(language, group.zone === "island" ? "islandWorktop" : "mainWorktop") : ""}`,
      topGroups.size === 1
        ? design.cabinets
            .filter((c) => c.level === "base")
            .reduce((n, c) => n + c.width / 100, 0)
        : group.quantity,
      tier?.perMeter ?? counter.perMeter,
    );
  }
  for (const [id, quantity] of handles) {
    const handle = catalog.handles.find((h) => h.id === id)!;
    if (quantity && handle.perPiece)
      lines.push({
        id: handles.size === 1 ? "handles" : `handles-${id}`,
        name:
          handle.id === "profile"
            ? translate(language, "profileAllowance")
            : label(handle.name, language),
        quantity,
        unit: "piece",
        amount: quantity * handle.perPiece,
        unitPrice: handle.perPiece,
      });
  }
  for (const [id, quantity] of plinths) {
    const plinth = catalog.plinths.find((p) => p.id === id)!;
    const rate = plinth.perMeter || catalog.pricing.plinthPerMeter;
    if (quantity && rate)
      metres(
        plinths.size === 1 ? "plinth" : `plinth-${id}`,
        translate(language, "plinth") +
          (mixed ? " · " + label(plinth.name, language) : ""),
        quantity,
        rate,
      );
  }
  const splash = catalog.backsplashes.find(
    (m) => m.id === design.style.backsplash,
  )!;
  const baseMeters = design.cabinets
    .filter((c) => c.level === "base")
    .reduce((s, c) => s + c.width / 100, 0);
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
  for (const [index, c] of design.cabinets.entries()) {
    const module = catalog.modules.find((m) => m.id === c.moduleId)!;
    for (const adjustment of interiorAdjustments(c, module, catalog)) {
      lines.push({
        id: `interior:${c.id}:${adjustment.item.id}:${adjustment.credit ? "credit" : "add"}`,
        name: `${translate(language, adjustment.credit ? "interiorRemovalCredit" : "interiorAddition")} · ${label(adjustment.item.name, language)} · ${translate(language, "positions")} ${index + 1} (${c.width} cm)`,
        quantity: adjustment.quantity,
        unit: "piece",
        unitPrice: adjustment.unitPrice,
        amount: adjustment.quantity * adjustment.unitPrice,
      });
    }
  }
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
