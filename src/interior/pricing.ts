import type { Catalog, Language } from "../catalog/types";
import type { PriceLine } from "../pricing";
import { label, translate } from "../i18n";
import type { InteriorDesign, InteriorDoor } from "./types";
import { perimeter } from "./layout";
export function interiorDoorPrice(p: InteriorDoor, c: Catalog) {
  const model = c.interiorDoors.find((m) => m.id === p.modelId)!;
  return (
    model.price *
      (c.interiorFinishes.find((f) => f.id === p.finishTier)?.multiplier || 1) +
    (p.hiddenHinges ? model.hiddenHingePrice : 0) +
    (c.interiorHandles.find((h) => h.id === p.handleId)?.price || 0)
  );
}
export function interiorPrice(d: InteriorDesign, c: Catalog, l: Language) {
  const floor = c.laminates.find((m) => m.id === d.laminateId)!,
    rates = c.interiorPricing!,
    area = (d.room.width * d.room.depth) / 10000,
    waste = rates.waste[d.pattern],
    withWaste = area * (1 + waste),
    packs = Math.ceil(withWaste / floor.m2PerPack),
    purchased = packs * floor.m2PerPack;
  const lines: PriceLine[] = [
    {
      id: "floor",
      name: `${translate(l, "laminate")} ${label(floor.name, l)} – ${new Intl.NumberFormat(l === "en" ? "en-GB" : "de-DE", { maximumFractionDigits: 1 }).format(withWaste)} m² → ${packs} ${translate(l, "packs")}`,
      quantity: packs,
      unit: "piece",
      amount: purchased * floor.pricePerM2,
    },
  ];
  if (d.underlay)
    lines.push({
      id: "underlay",
      name: translate(l, "underlay"),
      quantity: area,
      unit: "m2",
      amount: area * rates.underlayPerM2,
    });
  const skirting = c.skirtings.find((s) => s.id === d.skirtingId)!,
    meters = perimeter(d),
    skirtingRate =
      skirting.heightRates.find((h) => h.height === d.skirtingHeight)
        ?.perMeter || 0;
  lines.push({
    id: "skirting",
    name: `${translate(l, "skirting")} · ${label(skirting.name, l)} ${d.skirtingHeight} cm`,
    quantity: meters,
    unit: "m",
    amount: meters * skirtingRate,
  });
  d.doors.forEach((p) =>
    lines.push({
      id: p.id,
      name: `${translate(l, "door")} · ${label(c.interiorDoors.find((m) => m.id === p.modelId)!.name, l)} · ${p.width} cm`,
      quantity: 1,
      unit: "piece",
      amount: interiorDoorPrice(p, c),
    }),
  );
  lines.push({
    id: "transport",
    name: translate(l, "transport"),
    quantity: 1,
    unit: "piece",
    amount: rates.transport,
  });
  const subtotal = lines.reduce((n, x) => n + x.amount, 0),
    installation = d.installation
      ? area * rates.floorInstallationPerM2 +
        d.doors.length * rates.doorInstallationPerPiece
      : 0,
    vat = d.vat ? ((subtotal + installation) * c.pricing.vatPercent) / 100 : 0,
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
    area,
    withWaste,
    packs,
    purchased,
    perimeter: meters,
    waste,
    floorInstallation: area * rates.floorInstallationPerM2,
    doorInstallation: d.doors.length * rates.doorInstallationPerPiece,
  };
}
