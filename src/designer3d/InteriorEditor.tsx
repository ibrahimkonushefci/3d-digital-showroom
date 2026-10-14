import { useEffect, useState } from "react";
import type { Cabinet, DesignDocument } from "../catalog/types";
import { useBrand } from "../brand";
import { label, useLanguage, useT } from "../i18n";
import { Field, NumberField } from "../app/components";
import { useDesigner } from "./store";
import {
  canEditInterior,
  interiorAdjustments,
  presetComponents,
  resolveInterior,
  snapInterior,
  withInterior,
} from "./interiors";
import { validateInterior } from "./interiorValidation";
import { uid } from "./layout";
export function resetCabinetInterior(c: Cabinet): Cabinet {
  const { interior: _, ...rest } = c;
  return rest;
}
export function InteriorEditor({ design }: { design: DesignDocument }) {
  const { catalog } = useBrand(),
    { language } = useLanguage(),
    t = useT(),
    state = useDesigner();
  const c = design.cabinets.find((c) => c.id === state.selected);
  const m = catalog.modules.find((m) => m.id === c?.moduleId);
  const [height, setHeight] = useState(0),
    [productId, setProductId] = useState("");
  const parts = c && m ? resolveInterior(c, m, catalog) : [];
  const selected =
    state.selectedInterior?.cabinetId === c?.id
      ? parts.find((i) => i.id === state.selectedInterior?.componentId)
      : undefined;
  useEffect(() => setHeight(selected?.yCm ?? 0), [selected?.id, selected?.yCm]);
  if (design.kind !== "wardrobe") return null;
  if (!c || !m)
    return (
      <section className="interior-editor">
        <h3>{t("interiorEditor")}</h3>
        <p>{t("interiorSelectCabinet")}</p>
        <div className="module-list">
          {design.cabinets.map((cabinet, index) => (
            <button
              key={cabinet.id}
              onClick={() => {
                state.select(cabinet.id);
                state.setInterior(true);
              }}
            >
              {index + 1} ·{" "}
              {label(
                catalog.modules.find((m) => m.id === cabinet.moduleId)!.name,
                language,
              )}{" "}
              · {cabinet.width} cm
            </button>
          ))}
        </div>
      </section>
    );
  if (!canEditInterior(m, catalog)) return <p>{t("interiorUnavailable")}</p>;
  const items = catalog.interiorItems!.filter(
    (i) => i.kind !== "divider" && i.compatibleModuleTypes.includes(m.type),
  );
  const product = items.find((i) => i.id === productId) ?? items[0];
  const commit = (next: Cabinet) =>
    state.edit(
      {
        ...design,
        cabinets: design.cabinets.map((x) => (x.id === c.id ? next : x)),
      },
      catalog,
    );
  const patch = (
    changes: Partial<NonNullable<Cabinet["interior"]>["components"][number]>,
  ) => {
    if (!selected) return;
    commit(
      withInterior(
        c,
        parts.map((i) => (i.id === selected.id ? { ...i, ...changes } : i)),
      ),
    );
  };
  const add = () => {
    if (!product) return;
    if (
      parts.length >= 32 ||
      design.cabinets.reduce(
        (n, c) =>
          n +
          (c.interior?.components.length ??
            (c.id === state.selected ? parts.length : 0)),
        0,
      ) >= 512
    ) {
      state.setError("interiorLimitError");
      return;
    }
    if (m.type === "sliding" && ["drawer", "basket"].includes(product.kind)) {
      state.setError("interiorAccessError");
      return;
    }
    // Find the first valid mounting position instead of stacking an invalid item.
    for (
      let y = product.mounting.originCm;
      y < c.height - 3.6;
      y += product.mounting.stepCm
    ) {
      const id = `${c.id}:${uid()}`;
      const next = withInterior(c, [
        ...parts,
        { id, productId: product.id, yCm: y },
      ]);
      if (!validateInterior(next, m, catalog).length) {
        if (commit(next))
          state.selectInterior({ cabinetId: c.id, componentId: id });
        return;
      }
    }
    state.setError("interiorNoSpace");
  };
  const adjustment = interiorAdjustments(c, m, catalog).reduce(
    (n, i) => n + i.quantity * i.unitPrice,
    0,
  );
  return (
    <section className="interior-editor">
      <Field label={t("interiorCabinet")}>
        <select
          value={c.id}
          onChange={(e) => {
            state.select(e.target.value);
            state.setInterior(true);
          }}
        >
          {design.cabinets.map((cabinet, index) => (
            <option key={cabinet.id} value={cabinet.id}>
              {index + 1} ·{" "}
              {label(
                catalog.modules.find((m) => m.id === cabinet.moduleId)!.name,
                language,
              )}{" "}
              · {cabinet.width} cm
            </option>
          ))}
        </select>
      </Field>
      <label className="toggle">
        <span>{t("interiorDecoration")}</span>
        <input
          type="checkbox"
          checked={state.interiorDecoration}
          onChange={(e) => state.setInteriorDecoration(e.target.checked)}
        />
        <i aria-hidden="true" />
      </label>
      <h3>
        {t("interiorEditor")} · {design.cabinets.indexOf(c) + 1}
      </h3>
      <p className="helper">{t("interiorHelp")}</p>
      <p>
        {t("interiorAdjustment")}:{" "}
        {adjustment.toLocaleString(language === "sq" ? "de-DE" : language)} €
      </p>
      <button
        className="button secondary full"
        onClick={() => state.setInterior(!state.interior)}
      >
        {t(state.interior ? "showroom" : "interiorView")}
      </button>
      <div className="interior-list" aria-label={t("interiorComponents")}>
        {parts.map((i, index) => (
          <button
            key={i.id}
            aria-pressed={selected?.id === i.id}
            className={selected?.id === i.id ? "active" : ""}
            onClick={() => {
              state.selectInterior({ cabinetId: c.id, componentId: i.id });
              state.setInterior(true);
            }}
          >
            {index + 1} · {i.item ? label(i.item.name, language) : i.kind} ·{" "}
            {i.yCm.toFixed(1)} cm
          </button>
        ))}
        {!parts.length && <p>{t("interiorEmpty")}</p>}
      </div>
      {selected?.item && (
        <div className="interior-selected">
          <strong>{label(selected.item.name, language)}</strong>
          <div className="interior-actions">
            <button
              onClick={() =>
                patch({ yCm: snapInterior(selected.yCm, selected.item!, 1) })
              }
            >
              {t("interiorMoveUp")}
            </button>
            <button
              onClick={() =>
                patch({ yCm: snapInterior(selected.yCm, selected.item!, -1) })
              }
            >
              {t("interiorMoveDown")}
            </button>
          </div>
          <NumberField
            label={t("interiorHeight")}
            value={height}
            onChange={setHeight}
            max={c.height - 3.6}
            step={selected.item.mounting.stepCm}
          />
          <button
            className="button secondary full"
            onClick={() => patch({ yCm: snapInterior(height, selected.item!) })}
          >
            {t("interiorApplyHeight")}
          </button>
          <Field label={t("interiorProduct")}>
            <select
              value={product.id}
              onChange={(e) => setProductId(e.target.value)}
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {label(i.name, language)}
                </option>
              ))}
            </select>
          </Field>
          <button
            className="button secondary full"
            onClick={() =>
              patch({
                productId: product.id,
                yCm: snapInterior(selected.yCm, product),
              })
            }
          >
            {t("interiorReplace")}
          </button>
          {selected.kind === "drawer" || selected.kind === "basket" ? (
            <button
              className="button secondary full"
              onClick={() => {
                // Interior view gives hinged fronts access; sliding access was validated separately.
                state.setInterior(true);
                state.toggleInteriorOpen({
                  cabinetId: c.id,
                  componentId: selected.id,
                });
              }}
            >
              {t(
                state.openedInterior.some(
                  (i) => i.cabinetId === c.id && i.componentId === selected.id,
                )
                  ? "interiorClose"
                  : "interiorOpen",
              )}
            </button>
          ) : null}
          <button
            className="button danger full"
            onClick={() =>
              commit(
                withInterior(
                  c,
                  parts.filter((i) => i.id !== selected.id),
                ),
              )
            }
          >
            {t("interiorRemove")}
          </button>
        </div>
      )}
      {!selected && (
        <Field label={t("interiorProduct")}>
          <select
            value={product.id}
            onChange={(e) => setProductId(e.target.value)}
          >
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {label(i.name, language)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <button className="button primary full" onClick={add}>
        {t("interiorAdd")}
      </button>
      <Field label={t("interiorPreset")}>
        <select
          value=""
          onChange={(e) => {
            if (
              e.target.value &&
              commit(
                withInterior(
                  c,
                  presetComponents(c, m, catalog, e.target.value),
                ),
              )
            )
              state.selectInterior(null);
          }}
        >
          <option value="">{t("interiorChoosePreset")}</option>
          {catalog
            .interiorPresets!.filter((p) =>
              p.compatibleModuleTypes.includes(m.type),
            )
            .map((p) => (
              <option key={p.id} value={p.id}>
                {label(p.name, language)}
              </option>
            ))}
        </select>
      </Field>
      <button
        className="button secondary full"
        onClick={() => commit(resetCabinetInterior(c))}
      >
        {t("interiorReset")}
      </button>
      <p className="helper">{t("interiorPricingHelp")}</p>
    </section>
  );
}
