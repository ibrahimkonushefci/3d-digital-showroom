import type { Catalog } from "../catalog/types";
import type { Placement } from "./types";

/** Configuration changes are explicit user actions; loading never normalizes a quote. */
export function changeMaterial(
  p: Placement,
  materialType: string,
  c: Catalog,
): Placement {
  const finish = c.productFinishes.find((f) => f.id === p.finishId);
  const oak =
    c.productFinishes.find((f) => f.id === "golden-oak") ||
    c.productFinishes.find((f) => !!f.texture);
  return materialType === "wood" &&
    p.materialType !== "wood" &&
    !finish?.texture &&
    oak
    ? { ...p, materialType, finishId: oak.id, color: oak.color }
    : { ...p, materialType };
}
export function changeModel(
  p: Placement,
  modelId: string,
  c: Catalog,
): Placement {
  const model = (p.kind === "door" ? c.doors : c.windows).find(
    (m) => m.id === modelId,
  );
  if (!model) return p;
  const panes =
    typeof model.style === "string"
      ? model.style === "triple"
        ? 3
        : model.style === "double"
          ? 2
          : 1
      : p.panes;
  return {
    ...p,
    modelId,
    panes,
    options: p.options.filter((id) => model.options.some((o) => o.id === id)),
  };
}
export function setOption(
  p: Placement,
  id: string,
  enabled: boolean,
): Placement {
  let options = p.options.filter((o) => o !== id);
  if (enabled) {
    const prefix = id.startsWith("handle-")
      ? "handle-"
      : id.startsWith("shutter-")
        ? "shutter-"
        : null;
    if (prefix) options = options.filter((o) => !o.startsWith(prefix));
    options.push(id);
  }
  return { ...p, options };
}
export function applyWindowConfiguration(
  items: Placement[],
  source: Placement,
): Placement[] {
  return items.map((p) =>
    p.kind === "window"
      ? {
          ...source,
          id: p.id,
          width: p.width,
          height: p.height,
          corners: p.corners,
          brightness: p.brightness,
        }
      : p,
  );
}
export function hasGlazing(p: Placement, c: Catalog) {
  return (
    p.kind === "window" ||
    p.options.some((o) => ["side-left", "side-right", "transom"].includes(o)) ||
    [2, 4, 6].includes(c.doors.find((m) => m.id === p.modelId)?.style ?? 0)
  );
}
