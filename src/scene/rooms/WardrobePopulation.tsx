import { useMemo } from "react";
import type { Cabinet, Module } from "../../catalog/types";
import type { storageMeasurements } from "../../designer3d/storage";
import { ModelAsset } from "../assets/ModelAsset";
import { modelRecord } from "../assets/manifest";
import { transformedVolume } from "../assets/placement";
import { Garment } from "../Appliances";
type Storage = ReturnType<typeof storageMeasurements>;
type Item = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  tint?: string;
};
/** Hanging garments are modelled facing front; on the rail they turn to
 * ~35° short of perpendicular, so the row fans out and still shows fronts. */
const HANG_YAW = (55 * Math.PI) / 180;
const HANG_STEP = 0.095;
/** Fabric colours per garment shape; varied by position for a lived-in rail. */
const TINTS: Record<string, string[]> = {
  shirt: ["#e8e5de", "#bccbda", "#dfcdc5", "#e8e5de"],
  tee: ["#8e9d88", "#2f3b4c", "#d8cdbc", "#b9a58d"],
  dress: ["#b0654b", "#2b2c30", "#6d7f74"],
  coat: ["#ad8a61", "#4b4d50", "#c2b5a0"],
  trousers: ["#34405a", "#c9b9a0", "#6b6763"],
};
const LONG = [
  "coat",
  "dress",
  "coat",
  "dress",
  "shirt",
  "shirt",
  "tee",
  "shirt",
];
const SHORT = [
  "shirt",
  "shirt",
  "tee",
  "shirt",
  "trousers",
  "tee",
  "trousers",
  "shirt",
];
/** Shorter fallbacks when a long piece would reach the floor or a shelf. */
const SHORTER: Record<string, string[]> = {
  coat: ["shirt", "tee"],
  dress: ["shirt", "tee"],
  shirt: ["tee", "trousers"],
  tee: ["trousers"],
  trousers: [],
};
const seed = (id: string) =>
  [...id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
/** Fit real rail/shelf spaces; population is never a priced inventory or capacity claim. */
export function storagePopulation(
  c: Cabinet,
  m: Module,
  s: Storage,
  /** +1/-1: which side of the cabinet hanging fronts turn towards. */
  fan = 1,
) {
  const result: Item[] = [];
  const w = s.width,
    d = s.depth,
    h = c.height / 100,
    n = seed(c.id);
  const fits = (
    id: string,
    p: [number, number, number],
    ceiling: number,
    yaw = 0,
  ) => {
    const b = modelRecord(id)?.bounds;
    if (!b) return false;
    const v = transformedVolume(b.min, b.max, p, yaw);
    return (
      v.min[0] >= -w / 2 + 0.018 &&
      v.max[0] <= w / 2 - 0.018 &&
      v.min[2] >= -d / 2 + 0.015 &&
      v.max[2] <= d / 2 - 0.015 &&
      v.min[1] >= 0.018 &&
      v.max[1] <= ceiling - 0.025 &&
      (!c.interior ||
        !s.components.some((part) => {
          if (part.kind === "rail") return false;
          const bottom = (1.8 + part.yCm) / 100,
            top = bottom + part.heightCm / 100;
          return v.min[1] < top - 0.001 && v.max[1] > bottom + 0.001;
        }))
    );
  };
  // Shelves below a rail limit how long its garments may hang.
  const floorUnder = (rail: number) =>
    Math.max(
      0.018,
      ...s.shelves.filter((y) => y < rail - 0.05).map((y) => y + 0.009),
    );
  for (const rail of s.rails) {
    const drop = rail - floorUnder(rail);
    const pattern = drop > 1.12 ? LONG : SHORT;
    // the fanned row is about 0.26 m wide at its ends
    const count = Math.min(
      8,
      Math.max(0, Math.floor((w - 0.3) / HANG_STEP) + 1),
    );
    for (let i = 0; i < count; i++) {
      const p: [number, number, number] = [
        (i - (count - 1) / 2) * HANG_STEP,
        rail,
        0,
      ];
      const yaw = fan * (HANG_YAW + (((n >> i) & 3) - 1.5) * 0.03);
      const wanted = pattern[(i + n) % pattern.length];
      const id = [wanted, ...SHORTER[wanted]].find((g) => {
        const b = modelRecord(g)?.bounds;
        return (
          b &&
          // clear of the shoes on the compartment floor
          rail + b.min[1] >= floorUnder(rail) + 0.13 &&
          fits(g, p, h - 0.018, yaw)
        );
      });
      if (!id) continue;
      const tints = TINTS[id];
      result.push({
        id,
        position: p,
        rotation: [0, yaw, 0],
        tint: tints[(i * 7 + n) % tints.length],
      });
    }
    // Shoes on the compartment floor, two pairs where there is room.
    const base = floorUnder(rail);
    const pairs = w >= 0.56 ? ["shoes", "shoes-loafer"] : ["shoes"];
    pairs.forEach((id, k) => {
      const p: [number, number, number] = [
        pairs.length > 1 ? (k ? 1 : -1) * w * 0.22 : 0,
        base + 0.001,
        0,
      ];
      if (base < rail - 0.9 && fits(id, p, rail - 0.9))
        result.push({ id, position: p, rotation: [0, 0, 0] });
    });
  }
  if (!s.rails.length || c.interior) {
    for (let i = 0; i < s.shelves.length; i++) {
      const floor = s.shelves[i] + 0.009,
        ceil = s.shelves[i + 1] - 0.009 || h - 0.018;
      const id =
        i === 0
          ? "fold"
          : i === 1
            ? "fold-ribbed"
            : ["box-linen", "towels", "bag", "box-ink"][(n + i) % 4];
      const p: [number, number, number] = [0, floor, 0];
      const top = Number.isFinite(ceil) ? ceil : h - 0.018;
      // Wide compartments get a second, smaller piece beside the first.
      const pair = w >= 0.7 && i < 2;
      const main: [number, number, number] = pair ? [-w * 0.2, floor, 0] : p;
      if (fits(id, main, top))
        result.push({ id, position: main, rotation: [0, 0, 0] });
      if (pair) {
        const extra = i === 0 ? "towels" : "fold";
        const q: [number, number, number] = [w * 0.22, floor, 0];
        if (fits(extra, q, top))
          result.push({ id: extra, position: q, rotation: [0, 0, 0] });
      }
    }
  }
  return result;
}
const HANGING = new Set(["shirt", "tee", "dress", "coat", "trousers"]);
export function WardrobePopulation({
  cabinet,
  module,
  storage,
  fan = 1,
}: {
  cabinet: Cabinet;
  module: Module;
  storage: Storage;
  fan?: number;
}) {
  const items = useMemo(
    () => storagePopulation(cabinet, module, storage, fan),
    [cabinet, module, storage, fan],
  );
  return (
    <group>
      {[...new Set(items.map((p) => p.id))].map((id) => (
        <ModelAsset
          key={id}
          id={id}
          transforms={items.filter((p) => p.id === id)}
          fallback={
            HANGING.has(id) ? (
              <group>
                {items
                  .filter((p) => p.id === id)
                  .map((p, i) => (
                    <group
                      key={i}
                      position={[
                        p.position[0],
                        p.position[1] - 0.28,
                        p.position[2],
                      ]}
                      rotation={[0, p.rotation[1], 0]}
                    >
                      <Garment color={p.tint || "#b7b1a3"} />
                    </group>
                  ))}
              </group>
            ) : null
          }
        />
      ))}
    </group>
  );
}
