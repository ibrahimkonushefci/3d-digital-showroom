import type {
  BrandConfig,
  Catalog,
  Language,
  OfferDetails,
} from "../catalog/types";
import { label } from "../i18n";
export function brandSetting(brand: string, key: string, fallback: string) {
  try {
    return localStorage.getItem(`showroom-${key}-${brand}`) ?? fallback;
  } catch {
    return fallback;
  }
}
export function saveBrandSetting(brand: string, key: string, value: string) {
  try {
    localStorage.setItem(`showroom-${key}-${brand}`, value);
  } catch {
    /* device preference optional */
  }
}
export function newOffer(
  brand: BrandConfig,
  catalog: Catalog,
  language: Language,
): OfferDetails {
  const now = new Date(),
    year = now.getFullYear(),
    key = `showroom-offer-counter-${brand.slug}-${year}`;
  let count = 1;
  try {
    count = (Number(localStorage.getItem(key)) || 0) + 1;
    localStorage.setItem(key, String(count));
  } catch {
    /* no persistent counter available */
  }
  return {
    number: `${catalog.pricing.offerPrefix}-${year}-${String(count).padStart(4, "0")}`,
    date: `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    validityDays:
      Number(
        brandSetting(
          brand.slug,
          "validity",
          String(catalog.pricing.validityDays),
        ),
      ) || catalog.pricing.validityDays,
    customer: { name: "", phone: "", city: "" },
    salesperson: brandSetting(brand.slug, "salesperson", ""),
    paymentTerms: label(catalog.pricing.paymentTerms, language),
    notes: "",
  };
}
