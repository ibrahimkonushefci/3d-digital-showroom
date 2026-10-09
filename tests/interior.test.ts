import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CatalogSchema, BrandSchema } from "../src/catalog/types";
import { newInterior, perimeter, validInterior } from "../src/interior/layout";
import { interiorPrice } from "../src/interior/pricing";
import { decodeShare, encodeShare } from "../src/sharing";
const c = CatalogSchema.parse(
    JSON.parse(readFileSync("public/brands/drita-home/catalog.json", "utf8")),
  ),
  brand = BrandSchema.parse(
    JSON.parse(readFileSync("public/brands/drita-home/brand.json", "utf8")),
  );
it("prices whole packs rather than unrounded floor area", () => {
  const d = newInterior(c),
    q = interiorPrice(d, c, "sq"),
    f = c.laminates[0];
  expect(q.area).toBeCloseTo(13.2);
  expect(q.withWaste).toBeCloseTo(14.52);
  expect(q.packs).toBe(Math.ceil(14.52 / f.m2PerPack));
  expect(q.lines[0].amount).toBeCloseTo(q.packs * f.m2PerPack * f.pricePerM2);
});
it.each(["straight", "diagonal", "herringbone"] as const)(
  "uses catalog waste for %s",
  (pattern) => {
    const d = { ...newInterior(c), pattern },
      q = interiorPrice(d, c, "sq");
    expect(q.withWaste).toBeCloseTo(
      q.area * (1 + c.interiorPricing!.waste[pattern]),
    );
  },
);
it("subtracts door widths from the skirting perimeter", () => {
  const d = newInterior(c);
  expect(perimeter(d)).toBeCloseTo(2 * (2.2 + 6) - 4 * 0.8);
  expect(interiorPrice(d, c, "sq").perimeter).toBeCloseTo(perimeter(d));
});
it("keeps installation, transport and VAT distinct", () => {
  const d = newInterior(c),
    q = interiorPrice({ ...d, vat: true }, c, "sq"),
    rates = c.interiorPricing!;
  expect(q.installation).toBeCloseTo(
    q.area * rates.floorInstallationPerM2 + 4 * rates.doorInstallationPerPiece,
  );
  expect(q.vat).toBeCloseTo(
    ((q.subtotal + q.installation) * c.pricing.vatPercent) / 100,
  );
  expect(q.lines.find((l) => l.id === "transport")?.amount).toBe(
    rates.transport,
  );
});
it("presets fit, detects overlapping doors and round-trips interior links", () => {
  for (const preset of ["hallway", "living", "bedroom"] as const) {
    const d = newInterior(c, preset);
    expect(validInterior(d, c)).toBe(true);
    expect(decodeShare(encodeShare(d, brand, c.id, false)).design).toEqual(d);
  }
  const d = newInterior(c);
  d.doors[1].offset = d.doors[0].offset;
  expect(validInterior(d, c)).toBe(false);
});
