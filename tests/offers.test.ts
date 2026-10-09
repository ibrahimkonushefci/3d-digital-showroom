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
