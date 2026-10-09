// Convert illustrative generated diffuse grain to catalog tones; preserve existing textures.
import fs from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || "sharp");
const [oak, walnut] = process.argv.slice(2);
if (!oak || !walnut) throw Error("Pass oak and walnut source PNG paths.");
const catalog = JSON.parse(
  await fs.readFile("public/brands/default/catalog.json", "utf8"),
);
for (const [kind, products] of [
  ["floor", catalog.laminates],
  [
    "door",
    catalog.productFinishes.filter((p) =>
      ["golden-oak", "walnut"].includes(p.id),
    ),
  ],
]) {
  for (const p of products) {
    if (p.id.startsWith("concrete")) continue;
    const source = p.id.includes("walnut") ? walnut : oak;
    const stats = await sharp(source).stats();
    const gain = [1, 3, 5].map(
      (i, channel) =>
        parseInt(p.color.slice(i, i + 2), 16) / stats.channels[channel].mean,
    );
    await sharp(source)
      .resize(768, 768)
      .linear(gain, [0, 0, 0])
      .webp({ quality: 80 })
      .toFile(`public/shared/interior/${kind}-${p.id}.webp`);
  }
}
for (const brand of ["default", "drita-home"]) {
  const path = `public/brands/${brand}/catalog.json`,
    c = JSON.parse(await fs.readFile(path, "utf8"));
  for (const p of c.laminates)
    if (!p.id.startsWith("concrete"))
      p.previewTexture = `shared/interior/floor-${p.id}.webp`;
  for (const p of c.productFinishes)
    if (["golden-oak", "walnut"].includes(p.id))
      p.previewTexture = `shared/interior/door-${p.id}.webp`;
  await fs.writeFile(path, JSON.stringify(c, null, 2) + "\n");
}
