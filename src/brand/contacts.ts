import type { BrandConfig } from "../catalog/types";
export function withDemoContacts(
  brand: BrandConfig,
  fallback = import.meta.env.VITE_DEMO_CONTACT_PHONE || "",
): BrandConfig {
  if (!brand.demo) return brand;
  return {
    ...brand,
    contact: {
      ...brand.contact,
      phone: brand.contact.phone || fallback,
      whatsapp: brand.contact.whatsapp || brand.contact.phone || fallback,
      viber: brand.contact.viber || brand.contact.phone || fallback,
    },
  };
}
