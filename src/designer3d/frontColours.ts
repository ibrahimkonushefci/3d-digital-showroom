import { label } from "../i18n";
import type { Catalog, Language, Material } from "../catalog/types";

/** One front colour: every catalogue finish that looks the same (same
 * colour and texture), offered in one or more materials. */
export type ColourGroup = {
  key: string;
  name: string;
  items: Array<{ front: Material; tier?: Catalog["frontTiers"][number] }>;
};

/** "U708 PM · Light Grey" → "Light Grey": the code goes with the material. */
const plainName = (name: string) => name.split(" · ").pop() ?? name;

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (
    ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114
  );
}

export function colourGroups(catalog: Catalog, language: Language) {
  const groups = new Map<string, ColourGroup>();
  for (const front of catalog.fronts) {
    const key = `${front.color.toLowerCase()}|${front.texture ?? ""}`;
    const tier = catalog.frontTiers.find((t) => t.decors.includes(front.id));
    const group = groups.get(key) ?? {
      key,
      name: plainName(label(front.name, language)),
      items: [],
    };
    // A plain catalogue name ("Natural oak") wins over a supplier's code.
    if (!front.supplier && group.items.every((i) => i.front.supplier))
      group.name = label(front.name, language);
    group.items.push({ front, tier });
    groups.set(key, group);
  }
  // Light to dark, wood decors last; each colour's cheapest material first.
  return [...groups.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort(
        (a, b) => (a.tier?.multiplier ?? 1) - (b.tier?.multiplier ?? 1),
      ),
    }))
    .sort((a, b) => {
      const wa = !!a.items[0].front.texture,
        wb = !!b.items[0].front.texture;
      if (wa !== wb) return wa ? 1 : -1;
      return (
        luminance(b.items[0].front.color) - luminance(a.items[0].front.color)
      );
    });
}
