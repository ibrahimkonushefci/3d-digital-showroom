import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BrandSchema, CatalogSchema } from "../src/catalog/types";
import { product, newFacade, validFacade } from "../src/doorPreview/store";
import { productPrice, facadePrice } from "../src/doorPreview/pricing";
import { encodeShare, decodeShare } from "../src/sharing";
const c = CatalogSchema.parse(
    JSON.parse(readFileSync("public/brands/drita-home/catalog.json", "utf8")),
  ),
  b = BrandSchema.parse(
    JSON.parse(readFileSync("public/brands/drita-home/brand.json", "utf8")),
  );
it("door size, material and fingerprint price come from the catalog", () => {
  const p = product(c, "door"),
    base = productPrice(p, c),
    option = c.doors[0].options.find((o) => o.id === "fingerprint")!;
  expect(
    productPrice({ ...p, options: ["fingerprint", "fingerprint"] }, c),
  ).toBeCloseTo(base + option.price);
  expect(productPrice({ ...p, width: 200 }, c)).toBeCloseTo(base * 2);
  expect(productPrice({ ...p, materialType: "wood" }, c)).toBeCloseTo(
    base * c.doorTypes.find((t) => t.id === "wood")!.multiplier,
  );
});
it("window minimum, material, glazing and installation/removal are independent", () => {
  const p = { ...product(c, "window"), modelId: c.windows[0].id },
    small = { ...p, width: 40, height: 40 };
  expect(productPrice(small, c)).toBe(c.windows[0].minimumPrice);
  const d = { ...newFacade(c), items: [p], installation: true, removal: true },
    q = facadePrice(d, c, "sq");
  expect(q.installation).toBe(c.pricing.windowInstallationPerPiece);
  expect(q.lines.find((l) => l.id === "removal")?.amount).toBe(
    c.pricing.removalPerPiece,
  );
  expect(
    productPrice({ ...p, options: ["triple-glass", "shutter-electric"] }, c) -
      productPrice(p, c),
  ).toBeCloseTo(
    c.windows[0].options
      .filter((o) => ["triple-glass", "shutter-electric"].includes(o.id))
      .reduce((n, o) => n + o.price, 0),
  );
});
it("facade links retain product options and no furniture catalogs", () => {
  const d = newFacade(c);
  expect(decodeShare(encodeShare(d, b, c.id, false)).design).toEqual(d);
  expect(c.modules).toEqual([]);
});

it("rejects unknown product options and duplicate identifiers", () => {
  const d = newFacade(c);
  expect(validFacade(d, c)).toBe(true);
  expect(
    validFacade({ ...d, items: [{ ...d.items[0], options: ["unknown"] }] }, c),
  ).toBe(false);
  expect(validFacade({ ...d, items: [d.items[0], d.items[0]] }, c)).toBe(false);
});
