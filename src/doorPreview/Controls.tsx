import type { Placement } from "./types";
import type { Catalog } from "../catalog/types";
import { Field, NumberField, Toggle } from "../app/components";
import { useT, useLanguage, label } from "../i18n";
export function ProductControls({
  item,
  catalog,
  onChange,
}: {
  item: Placement;
  catalog: Catalog;
  onChange: (p: Placement) => void;
}) {
  const t = useT(),
    { language } = useLanguage(),
    models = item.kind === "door" ? catalog.doors : catalog.windows,
    model = models.find((m) => m.id === item.modelId)!;
  const change = (v: Partial<Placement>) => onChange({ ...item, ...v });
  const option = (id: string, v: boolean) => {
    let options = item.options.filter((o) => o !== id);
    if (v) {
      const group = id.startsWith("shutter-")
        ? "shutter-"
        : id.startsWith("handle-")
          ? "handle-"
          : null;
      if (group) options = options.filter((o) => !o.startsWith(group));
      options.push(id);
    }
    change({ options });
  };
  return (
    <>
      <Field label={t("model")}>
        <select
          value={item.modelId}
          onChange={(e) => change({ modelId: e.target.value })}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {label(m.name, language)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("materialTier")}>
        <select
          value={item.materialType}
          onChange={(e) => change({ materialType: e.target.value })}
        >
          {(item.kind === "door"
            ? catalog.doorTypes
            : catalog.windowMaterials
          ).map((m) => (
            <option key={m.id} value={m.id}>
              {label(m.name, language)}
            </option>
          ))}
        </select>
      </Field>
      {item.kind === "window" && (
        <>
          <Field label={t("profileBrand")}>
            <select
              value={item.profile}
              onChange={(e) => change({ profile: e.target.value })}
            >
              {catalog.windowProfiles.map((m) => (
                <option key={m.id} value={m.id}>
                  {label(m.name, language)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("glazing")}>
            <select
              value={
                item.options.includes("triple-glass") ? "triple" : "double"
              }
              onChange={(e) =>
                option("triple-glass", e.target.value === "triple")
              }
            >
              <option value="double">{t("doubleGlass")}</option>
              <option value="triple">{t("tripleGlass")}</option>
            </select>
          </Field>
          <Field label={t("panes")}>
            <select
              value={item.panes}
              onChange={(e) => change({ panes: Number(e.target.value) })}
            >
              {[1, 2, 3].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field label={t("openingType")}>
            <select
              value={
                item.options.includes("sliding")
                  ? "sliding"
                  : model.style === "fixed"
                    ? "fixed"
                    : "tilt"
              }
              onChange={(e) => {
                if (e.target.value === "fixed")
                  change({
                    modelId: catalog.windows.find((m) => m.style === "fixed")!
                      .id,
                    options: item.options.filter((o) => o !== "sliding"),
                  });
                else if (e.target.value === "sliding") option("sliding", true);
                else
                  change({
                    modelId: catalog.windows.find((m) => m.style === "single")!
                      .id,
                    options: item.options.filter((o) => o !== "sliding"),
                  });
              }}
            >
              {(["fixed", "tilt", "sliding"] as const).map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
      <Field label={t("color")}>
        <select
          value={item.finishId || "anthracite"}
          onChange={(e) => {
            const f = catalog.productFinishes.find(
              (f) => f.id === e.target.value,
            )!;
            change({ finishId: f.id, color: f.color });
          }}
        >
          {catalog.productFinishes.map((f) => (
            <option key={f.id} value={f.id}>
              {label(f.name, language)}
            </option>
          ))}
        </select>
      </Field>
      {item.kind === "window" && (
        <Field label={t("insideColor")}>
          <input
            type="color"
            value={item.colorInside || item.color}
            onChange={(e) => change({ colorInside: e.target.value })}
          />
        </Field>
      )}
      <div className="dimension-grid">
        <NumberField
          label={t("width")}
          value={item.width}
          min={40}
          max={300}
          onChange={(v) => change({ width: Math.max(40, Math.min(300, v)) })}
        />
        <NumberField
          label={t("height")}
          value={item.height}
          min={60}
          max={300}
          onChange={(v) => change({ height: Math.max(60, Math.min(300, v)) })}
        />
      </div>
      <details>
        <summary>{t("productOptions")}</summary>
        {model.options
          .filter((o) => item.kind !== "window" || o.id !== "triple-glass")
          .map((o) => (
            <Toggle
              key={o.id}
              label={label(o.name, language)}
              checked={item.options.includes(o.id)}
              onChange={(v) => option(o.id, v)}
            />
          ))}
      </details>
      {item.kind === "window" &&
        item.options.some((o) => o.startsWith("shutter-")) && (
          <Toggle
            label={t("shutterOpen")}
            checked={item.shutterOpen}
            onChange={(v) => change({ shutterOpen: v })}
          />
        )}
    </>
  );
}
