import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BrandSchema, CatalogSchema, DesignSchema } from "../src/catalog/types";
import { examples, newDesign, generateLayout } from "../src/designer3d/layout";
import { calculatePrice } from "../src/pricing";
import { encodeShare, decodeShare } from "../src/sharing";
const catalog = CatalogSchema.parse(
    JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
  ),
  brand = BrandSchema.parse(
    JSON.parse(readFileSync("public/brands/default/brand.json", "utf8")),
  );
it("migrates version one and excludes private offer information from shared design data", () => {
  const design = DesignSchema.parse({
    ...examples(catalog)[0],
    version: 1,
    offer: {
      number: "DD-2026-0042",
      date: "2026-10-08",
      validityDays: 15,
      customer: { name: "Private person", phone: "123", city: "Prishtinë" },
      salesperson: "Name",
      paymentTerms: "40%",
      notes: "Private notes",
    },
  });
  expect(design.version).toBe(2);
  expect(
    decodeShare(encodeShare(design, brand, catalog.id, false)).design.offer,
  ).toBeUndefined();
  expect(design.offer?.customer.name).toBe("Private person");
});
it("material tiers and appliance packages contribute independently to the estimate", () => {
  const design = examples(catalog)[0],
    price = calculatePrice(design, catalog, "sq");
  const upgraded = calculatePrice(
    {
      ...design,
      style: { ...design.style, front: "fenix-anthracite" },
      appliancePackage: "premium",
    },
    catalog,
    "sq",
  );
  expect(upgraded.lines.find((l) => l.id === "appliances")?.amount).toBe(2600);
  expect(upgraded.total).toBeGreaterThan(price.total + 2600);
  const quartz = calculatePrice(
    { ...design, style: { ...design.style, countertop: "quartz" } },
    catalog,
    "sq",
  );
  expect(quartz.lines.find((l) => l.id === "countertop")?.name).toBe(
    "Banaku – Kuarc",
  );
});
it("adds the optional wardrobe internal LED at the catalog rate", () => {
  const d = generateLayout(newDesign("wardrobe", "corner"), catalog)!;
  const price = calculatePrice(
    {
      ...d,
      environment: {
        floor: "laminate",
        wallColor: "#ffffff",
        internalLed: true,
      },
    },
    catalog,
    "sq",
  );
  expect(price.lines.find((l) => l.id === "internal-led")?.amount).toBeCloseTo(
    d.cabinets.reduce((n, p) => n + p.width / 100, 0) *
      catalog.pricing.internalLedPerMeter,
  );
});
import { documentDate } from "../src/documents/offer";
it("quotes new designs including VAT as a single figure", () => {
  const d = newDesign("kitchen", "l");
  expect(d.vat).toBe(true);
  expect(d.exact).toBe(true);
});
it("applies the discount to the goods before installation and VAT", () => {
  const d = generateLayout(newDesign("kitchen", "l"), catalog)!;
  const base = calculatePrice(d, catalog, "sq");
  const discounted = calculatePrice(
    {
      ...d,
      offer: {
        number: "FS-2026-0001",
        date: "2026-10-12",
        validityDays: 15,
        customer: { name: "", phone: "", city: "" },
        salesperson: "",
        paymentTerms: "",
        notes: "",
        discountPercent: 10,
      },
    },
    catalog,
    "sq",
  );
  const { installationPercent, vatPercent } = catalog.pricing;
  expect(discounted.discount).toBeCloseTo(base.subtotal * 0.1);
  expect(discounted.installation).toBeCloseTo(
    (base.subtotal * 0.9 * installationPercent) / 100,
  );
  expect(discounted.net).toBeCloseTo(
    base.subtotal * 0.9 * (1 + installationPercent / 100),
  );
  expect(discounted.vat).toBeCloseTo((discounted.net * vatPercent) / 100);
  expect(discounted.total).toBeCloseTo(discounted.net + discounted.vat);
  expect(base.total).toBeCloseTo(
    base.subtotal * (1 + installationPercent / 100) * (1 + vatPercent / 100),
  );
});
it("lists cabinets per size with unit prices that add up to each line", () => {
  const d = generateLayout(newDesign("kitchen", "u"), catalog)!;
  const price = calculatePrice(d, catalog, "en");
  const cabinets = price.lines.filter((l) => l.size);
  expect(cabinets.reduce((n, l) => n + l.quantity, 0)).toBe(d.cabinets.length);
  for (const line of price.lines)
    expect(line.unitPrice * line.quantity).toBeCloseTo(line.amount);
  for (const line of cabinets)
    expect(
      d.cabinets.filter(
        (c) => `${c.moduleId}@${c.width}x${c.depth}x${c.height}` === line.id,
      ),
    ).toHaveLength(line.quantity);
});
it("dates offers as dd.mm.yyyy and computes the validity end across months", () => {
  expect(documentDate("2026-10-12")).toBe("12.10.2026");
  expect(documentDate("2026-10-25", 15)).toBe("09.11.2026");
  expect(documentDate("2026-12-20", 15)).toBe("04.01.2027");
});
