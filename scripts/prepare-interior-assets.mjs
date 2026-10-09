// Reproducible optimization and code-authored compositing masks. Sources stay outside public/.
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || "sharp");
const scenes = JSON.parse(
  await fs.readFile("public/shared/interior/scenes.json", "utf8"),
);
const paths = {
  hallway: join(
    process.argv[2] || join(homedir(), "Desktop"),
    "hallway-door-2.jpg",
  ),
  bedroom: join(
    process.argv[2] || join(homedir(), "Desktop"),
    "bedroom-door-3.jpg",
  ),
  living:
    process.argv[3] ||
    join(homedir(), "Downloads", "pexels-artbovich-6903161.jpg"),
};
const polygon = (points, fill) =>
  `<polygon points="${points.map(([x, y]) => `${x * 1920},${y * 1280}`).join(" ")}" fill="${fill}"/>`;
for (const [id, s] of Object.entries(scenes)) {
  const photo = await sharp(paths[id])
    .resize(1920, 1280, { fit: "fill" })
    .webp({ quality: 90 })
    .toBuffer();
  await fs.writeFile(`public/shared/interior/${id}.webp`, photo);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1280"><rect width="1920" height="1280" fill="black"/>${s.floorPolygons.map((p) => polygon(p, "red")).join("")}${s.skirtingPolygons.map((p) => polygon(p, "lime")).join("")}${s.occlusions.map((p) => polygon(p, "black")).join("")}</svg>`;
  await sharp(Buffer.from(svg))
    .resize(960, 640)
    .webp({ lossless: true })
    .toFile(`public/shared/interior/${id}-mask.webp`);
  await sharp(photo)
    .resize(480, 320)
    .blur(9)
    .webp({ quality: 85 })
    .toFile(`public/shared/interior/${id}-light.webp`);
}
// A photographic inox rosette/lever, isolated with an explicit silhouette mask.
const hardware = await sharp(paths.hallway)
  .extract({ left: 1107, top: 637, width: 60, height: 41 })
  .toBuffer();
const mask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="41"><ellipse cx="44" cy="21" rx="10" ry="11" fill="white"/><path d="M7 10 L43 12 Q48 15 44 22 L10 22 Q3 20 7 10" fill="white"/></svg>`,
);
await sharp(hardware)
  .ensureAlpha()
  .composite([{ input: mask, blend: "dest-in" }])
  .png()
  .toFile("public/shared/interior/handle.png");
console.log(
  "Prepared three 1920px scenes, masks, lighting maps and photographic hardware.",
);
