import type {
  BrandConfig,
  Catalog,
  Language,
  OfferDetails,
} from "../catalog/types";
import { label } from "../i18n";
/** Number, date and terms printed on the PDF; there is no offer form. */
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
    validityDays: catalog.pricing.validityDays,
    customer: { name: "", phone: "", city: "" },
    salesperson: "",
    paymentTerms: label(catalog.pricing.paymentTerms, language),
    notes: "",
  };
}
