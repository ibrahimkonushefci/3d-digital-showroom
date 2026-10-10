import type { Placement } from "./types";
import type { Catalog } from "../catalog/types";
import { Field, NumberField, Swatches, Toggle } from "../app/components";
import { useT, useLanguage, label } from "../i18n";
import { changeMaterial, changeModel, setOption } from "./configuration";
import { ProductSketch } from "./ProductCards";
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
  const change = (v: Partial<Placement>) => onChange({ ...item, ...v }),
    option = (id: string, v: boolean) => onChange(setOption(item, id, v)),
    available = (id: string) => model.options.some((o) => o.id === id);
  const conflict = ["handle-", "shutter-"].some(
    (prefix) => item.options.filter((o) => o.startsWith(prefix)).length > 1,
  );
  const configured = new Set([
    "side-left",
    "side-right",
    "transom",
    "triple-glass",
    "sliding",
    "handle-120",
    "handle-160",
    "black-handle",
    "led-handle",
  ]);
  const sides = item.options.includes("side-left")
    ? item.options.includes("side-right")
      ? "both"
      : "left"
    : item.options.includes("side-right")
      ? "right"
      : "none";
  return (
    <div className="product-controls">
      {conflict && (
        <p className="notice" role="status">
          {t("importedConflict")}
        </p>
      )}
      <section>
        <h2>{t("model")}</h2>
        <div className="model-cards">
          {models.map((m) => (
            <button
              key={m.id}
              className={item.modelId === m.id ? "active" : ""}
              aria-pressed={item.modelId === m.id}
              onClick={() => onChange(changeModel(item, m.id, catalog))}
            >
              <ProductSketch kind={item.kind} style={m.style} />
              <span>{label(m.name, language)}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2>{t("finishSection")}</h2>
        <h3>{t("materialTier")}</h3>
        <div className="choice-grid">
          {(item.kind === "door"
            ? catalog.doorTypes
            : catalog.windowMaterials
          ).map((m) => (
            <button
              key={m.id}
              className={item.materialType === m.id ? "active" : ""}
              aria-pressed={item.materialType === m.id}
              onClick={() => onChange(changeMaterial(item, m.id, catalog))}
            >
              {label(m.name, language)}
            </button>
          ))}
        </div>
        <Swatches
          title={t("outsideFinish")}
          selectedLabel={
            !item.finishId ? `${t("savedColor")} ${item.color}` : undefined
          }
          items={catalog.productFinishes}
          value={item.finishId || ""}
          onChange={(id) => {
            const f = catalog.productFinishes.find((f) => f.id === id)!;
            change({ finishId: id, color: f.color });
          }}
        />
        <Swatches
          title={t("insideFinish")}
          selectedLabel={
            !item.finishInsideId && (item.colorInside || !item.finishId)
              ? `${t("savedColor")} ${item.colorInside || item.color}`
              : undefined
          }
          items={catalog.productFinishes}
          value={
            item.finishInsideId ||
            (!item.colorInside ? item.finishId : undefined) ||
            ""
          }
          onChange={(id) => {
            const f = catalog.productFinishes.find((f) => f.id === id)!;
            change({ finishInsideId: id, colorInside: f.color });
          }}
        />
        {item.colorInside && !item.finishInsideId && (
          <Field label={t("insideColor")}>
            <input
              type="color"
              value={item.colorInside}
              onChange={(e) => change({ colorInside: e.target.value })}
            />
          </Field>
        )}
        <button
          className="text-button"
          onClick={() =>
            change({ finishInsideId: undefined, colorInside: undefined })
          }
        >
          {t("matchOutside")}
        </button>
      </section>
      <section>
        <h2>{t("configuration")}</h2>
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
        {item.kind === "door" ? (
          <>
            {(available("side-left") || available("side-right")) && (
              <>
                <h3>{t("sidelights")}</h3>
                <div className="configuration-cards">
                  {(["none", "left", "right", "both"] as const).map((side) => (
                    <button
                      key={side}
                      disabled={
                        ((side === "left" || side === "both") &&
                          !available("side-left")) ||
                        ((side === "right" || side === "both") &&
                          !available("side-right"))
                      }
                      aria-pressed={sides === side}
                      className={sides === side ? "active" : ""}
                      onClick={() =>
                        change({
                          options: [
                            ...item.options.filter(
                              (o) => o !== "side-left" && o !== "side-right",
                            ),
                            ...(side === "left" || side === "both"
                              ? ["side-left"]
                              : []),
                            ...(side === "right" || side === "both"
                              ? ["side-right"]
                              : []),
                          ],
                        })
                      }
                    >
                      <ProductSketch kind="door" sides={side} />
                      <span>{t(side)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {available("transom") && (
              <Toggle
                label={t("transom")}
                checked={item.options.includes("transom")}
                onChange={(v) => option("transom", v)}
              />
            )}
          </>
        ) : (
          <>
            <h3>{t("profileBrand")}</h3>
            <div className="choice-grid">
              {catalog.windowProfiles.map((m) => (
                <button
                  key={m.id}
                  className={item.profile === m.id ? "active" : ""}
                  aria-pressed={item.profile === m.id}
                  onClick={() => change({ profile: m.id })}
                >
                  {label(m.name, language)}
                </button>
              ))}
            </div>
            <h3>{t("panes")}</h3>
            <div className="choice-grid">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  className={item.panes === n ? "active" : ""}
                  aria-pressed={item.panes === n}
                  onClick={() => change({ panes: n })}
                >
                  {n}
                </button>
              ))}
            </div>
            {available("triple-glass") && (
              <>
                <h3>{t("glazing")}</h3>
                <div className="choice-grid">
                  {[false, true].map((v) => (
                    <button
                      key={String(v)}
                      className={
                        item.options.includes("triple-glass") === v
                          ? "active"
                          : ""
                      }
                      aria-pressed={item.options.includes("triple-glass") === v}
                      onClick={() => option("triple-glass", v)}
                    >
                      {t(v ? "tripleGlass" : "doubleGlass")}
                    </button>
                  ))}
                </div>
              </>
            )}
            {available("sliding") && (
              <Toggle
                label={t("sliding")}
                checked={item.options.includes("sliding")}
                onChange={(v) => option("sliding", v)}
              />
            )}
          </>
        )}
      </section>
      <section>
        <h2>{t("hardware")}</h2>
        {item.kind === "door" && (
          <>
            <h3>{t("handleLength")}</h3>
            <div className="choice-grid">
              {[80, 120, 160].map((n) => {
                const active =
                  n === 160
                    ? item.options.includes("handle-160")
                    : n === 120
                      ? item.options.includes("handle-120")
                      : !item.options.some((o) => o.startsWith("handle-"));
                return (
                  <button
                    key={n}
                    disabled={n !== 80 && !available(`handle-${n}`)}
                    aria-pressed={active}
                    className={active ? "active" : ""}
                    onClick={() =>
                      n === 80
                        ? change({
                            options: item.options.filter(
                              (o) => !o.startsWith("handle-"),
                            ),
                          })
                        : option(`handle-${n}`, true)
                    }
                  >
                    {n} cm
                  </button>
                );
              })}
            </div>
            {available("black-handle") && (
              <>
                <h3>{t("handleFinish")}</h3>
                <div className="choice-grid">
                  {[false, true].map((v) => (
                    <button
                      key={String(v)}
                      className={
                        item.options.includes("black-handle") === v
                          ? "active"
                          : ""
                      }
                      aria-pressed={item.options.includes("black-handle") === v}
                      onClick={() => option("black-handle", v)}
                    >
                      {t(v ? "blackHandle" : "stainlessHandle")}
                    </button>
                  ))}
                </div>
              </>
            )}
            {available("led-handle") && (
              <Toggle
                label={label(
                  model.options.find((o) => o.id === "led-handle")!.name,
                  language,
                )}
                checked={item.options.includes("led-handle")}
                onChange={(v) => option("led-handle", v)}
              />
            )}
          </>
        )}
        {model.options
          .filter((o) => !configured.has(o.id))
          .map((o) => (
            <Toggle
              key={o.id}
              label={label(o.name, language)}
              checked={item.options.includes(o.id)}
              onChange={(v) => option(o.id, v)}
            />
          ))}
        {item.kind === "window" &&
          item.options.some((o) => o.startsWith("shutter-")) && (
            <Toggle
              label={t("shutterOpen")}
              checked={item.shutterOpen}
              onChange={(v) => change({ shutterOpen: v })}
            />
          )}
      </section>
    </div>
  );
}
