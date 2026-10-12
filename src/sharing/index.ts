import LZString from "lz-string";
import { z } from "zod";
import {
  BrandSchema,
  DesignSchema,
  type BrandConfig,
  type DesignDocument,
} from "../catalog/types";
export const SnapshotSchema = BrandSchema.omit({ logo: true }).extend({
  catalogId: z.string().regex(/^[a-z0-9-]+$/),
});
const ShareSchema = z.object({
  version: z.literal(1),
  catalogId: z.string().regex(/^[a-z0-9-]+$/),
  design: DesignSchema,
  brand: SnapshotSchema.optional(),
});
export function decodeShare(encoded: string) {
  if (encoded.length > 30000) throw Error("invalidLink");
  const raw = LZString.decompressFromEncodedURIComponent(encoded);
  if (!raw || raw.length > 150000) throw Error("invalidLink");
  return ShareSchema.parse(JSON.parse(raw));
}
export function encodeShare(
  design: DesignDocument,
  brand: BrandConfig,
  catalogId: string,
  local: boolean,
) {
  const { logo: _, ...basic } = brand;
  return LZString.compressToEncodedURIComponent(
    JSON.stringify({
      version: 1,
      catalogId,
      design: { ...design, offer: undefined },
      ...(local ? { brand: { ...basic, catalogId } } : {}),
    }),
  );
}
export function shareUrl(
  design: DesignDocument,
  brand: BrandConfig,
  catalogId: string,
  local: boolean,
) {
  const url = new URL(window.location.origin + ("/designer/" + design.kind));
  url.searchParams.set("brand", local ? catalogId : brand.slug);
  url.hash = "design=" + encodeShare(design, brand, catalogId, local);
  return url.href;
}
export function messageUrl(
  service: "whatsapp" | "viber",
  brand: BrandConfig,
  message: string,
) {
  const raw = brand.contact[service] || brand.contact.phone;
  const number = raw.replace(/[^0-9+]/g, "");
  if (!number.replace(/\D/g, ""))
    // Without a number, let the user pick a chat in the same app.
    return service === "whatsapp"
      ? anyoneUrl(message)
      : `viber://forward?text=${encodeURIComponent(message)}`;
  return service === "whatsapp"
    ? `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
    : `viber://chat?number=${encodeURIComponent(number)}&text=${encodeURIComponent(message)}`;
}

export function hasContact(service: "whatsapp" | "viber", brand: BrandConfig) {
  return /\d/.test(brand.contact[service] || brand.contact.phone);
}

/**
 * Hands the PDF itself to the native share sheet (iPad/iPhone Safari,
 * Android Chrome), so WhatsApp receives the document with the message.
 */
export async function shareOfferPdf(file: File, title: string, text: string) {
  const data = { files: [file], title, text };
  if (!navigator.canShare?.(data)) return "unsupported" as const;
  try {
    await navigator.share(data);
    return "shared" as const;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      return "aborted" as const;
    // Safari only shares shortly after a tap; a slow export can miss it.
    if (e instanceof DOMException && e.name === "NotAllowedError")
      return "blocked" as const;
    return "unsupported" as const;
  }
}

export function anyoneUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
export async function sendAnyone(title: string, text: string, url: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  window.open(anyoneUrl(`${text} ${url}`), "_blank", "noopener,noreferrer");
}
