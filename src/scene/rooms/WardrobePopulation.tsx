import { useMemo } from "react";
import type { Cabinet, Module } from "../../catalog/types";
import type { storageMeasurements } from "../../designer3d/storage";
import { ModelAsset } from "../assets/ModelAsset";
import { modelRecord } from "../assets/manifest";
import { Garment } from "../Appliances";
type Storage = ReturnType<typeof storageMeasurements>;
/** Fit real rail/shelf spaces; population is never a priced inventory or capacity claim. */
export function storagePopulation(c: Cabinet, m: Module, s: Storage) {
  const result: {
    id: string;
    position: [number, number, number];
    rotation: [number, number, number];
  }[] = [];
  const w = s.width,
    d = s.depth,
    h = c.height / 100;
  const fits = (id: string, p: [number, number, number], ceiling: number) => {
    const b = modelRecord(id)!.bounds;
    return (
      p[0] + b.min[0] >= -w / 2 + 0.018 &&
      p[0] + b.max[0] <= w / 2 - 0.018 &&
      p[2] + b.min[2] >= -d / 2 + 0.015 &&
      p[2] + b.max[2] <= d / 2 - 0.015 &&
      p[1] + b.min[1] >= 0.018 &&
      p[1] + b.max[1] <= ceiling - 0.025 &&
      (!c.interior ||
        !s.components.some((part) => {
          if (part.kind === "rail") return false;
          const bottom = (1.8 + part.yCm) / 100,
            top = bottom + part.heightCm / 100;
          return (
            p[1] + b.min[1] < top - 0.001 && p[1] + b.max[1] > bottom + 0.001
          );
        }))
    );
  };
  for (const rail of s.rails) {
    const count = Math.min(5, Math.max(0, Math.floor((w - 0.08) / 0.12)));
    for (let i = 0; i < count; i++) {
      const id = ["shirt", "coat", "trousers"][i % 3],
        p: [number, number, number] = [(i - (count - 1) / 2) * 0.12, rail, 0];
      if (fits(id, p, h - 0.018))
        result.push({ id, position: p, rotation: [0, 0, 0] });
    }
    const shoes: [number, number, number] = [0, 0.019, 0];
    if (fits("shoes", shoes, rail - 0.9))
      result.push({ id: "shoes", position: shoes, rotation: [0, 0, 0] });
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
            : [...c.id].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 2
              ? "box-linen"
              : "box-ink";
      const p: [number, number, number] = [0, floor, 0];
      if (fits(id, p, Number.isFinite(ceil) ? ceil : h - 0.018))
        result.push({ id, position: p, rotation: [0, 0, 0] });
    }
  }
  return result;
}
export function WardrobePopulation({
  cabinet,
  module,
  storage,
}: {
  cabinet: Cabinet;
  module: Module;
  storage: Storage;
}) {
  const items = useMemo(
    () => storagePopulation(cabinet, module, storage),
    [cabinet, module, storage],
  );
  return (
    <group>
      {[...new Set(items.map((p) => p.id))].map((id) => (
        <ModelAsset
          key={id}
          id={id}
          transforms={items.filter((p) => p.id === id)}
          fallback={
            id === "shirt" || id === "coat" || id === "trousers" ? (
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
                      rotation={[0, Math.PI / 2, 0]}
                    >
                      <Garment color="#b7b1a3" />
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
