import manifest from "./previews.json";

/**
 * Small pictures of finishes, handles, front styles, floors and ready-made
 * looks, rendered from the real scene by scripts/review/render-previews.mjs.
 * Each entry records the catalogue colour it was rendered with, so a brand
 * that changes a colour falls back to a plain swatch instead of showing a
 * wrong picture.
 */
type Entry = { src: string; color?: string };
const items = (manifest as { items: Record<string, Entry> }).items;

export type PreviewKind =
  "front" | "worktop" | "handle" | "profile" | "floor" | "look";

export function previewSrc(
  kind: PreviewKind,
  id: string,
  color?: string,
): string | null {
  const entry = items[`${kind}:${id}`];
  if (!entry) return null;
  if (color && entry.color && entry.color.toLowerCase() !== color.toLowerCase())
    return null;
  return entry.src;
}
