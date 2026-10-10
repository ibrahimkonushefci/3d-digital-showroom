import type { Catalog } from "../catalog/types";
import type { Placement } from "./types";
import { useT, useLanguage, label, money } from "../i18n";
import { productPrice } from "./pricing";
export function ProductSketch({
  kind,
  style = 0,
  panes,
  sides = "none",
  transom = false,
  color = "#596164",
}: {
  kind: "door" | "window";
  style?: string | number;
  panes?: number;
  sides?: string;
  transom?: boolean;
  color?: string;
}) {
  const door = kind === "door",
    count = door
      ? 1
      : (panes ?? (style === "triple" ? 3 : style === "double" ? 2 : 1));
  return (
    <svg viewBox="0 0 100 110" aria-hidden="true" className="product-sketch">
      <rect x="4" y="4" width="92" height="102" rx="7" fill="#ebe8e0" />
      {transom && (
        <rect
          x="29"
          y="12"
          width="42"
          height="12"
          fill="#bed2d7"
          stroke={color}
          strokeWidth="3"
        />
      )}
      {(sides === "left" || sides === "both") && (
        <rect
          x="15"
          y="28"
          width="11"
          height="70"
          fill="#bed2d7"
          stroke={color}
          strokeWidth="3"
        />
      )}
      {(sides === "right" || sides === "both") && (
        <rect
          x="74"
          y="28"
          width="11"
          height="70"
          fill="#bed2d7"
          stroke={color}
          strokeWidth="3"
        />
      )}
      <rect
        x={door ? 29 : 14}
        y={door ? 28 : 23}
        width={door ? 42 : 72}
        height={door ? 70 : 65}
        fill={door ? color : "#bed2d7"}
        stroke={color}
        strokeWidth="4"
      />
      {door ? (
        <>
          {[2, 4, 6].includes(Number(style)) && (
            <rect
              x="36"
              y="35"
              width={style === 2 ? 6 : 15}
              height="56"
              fill="#bed2d7"
            />
          )}
          {(style === 1 || style === 5) &&
            Array.from({ length: 5 }, (_, i) => (
              <path
                key={i}
                d={
                  style === 5 ? `M${35 + i * 6} 33v60` : `M33 ${40 + i * 10}h34`
                }
                stroke="#ffffff"
                opacity=".25"
              />
            ))}
          {style === 3 && (
            <>
              <rect
                x="35"
                y="37"
                width="29"
                height="23"
                fill="none"
                stroke="#ffffff"
                opacity=".3"
              />
              <rect
                x="35"
                y="67"
                width="29"
                height="23"
                fill="none"
                stroke="#ffffff"
                opacity=".3"
              />
            </>
          )}
          <path d="M62 52v28" stroke="#d4d5ce" strokeWidth="2" />
        </>
      ) : (
        Array.from({ length: count - 1 }, (_, i) => (
          <path
            key={i}
            d={`M${14 + (72 * (i + 1)) / count} 23v65`}
            stroke={color}
            strokeWidth="4"
          />
        ))
      )}
      <path
        d={door ? "M26 100h48" : "M10 91h80"}
        stroke="#a6aaa5"
        strokeWidth="3"
      />
    </svg>
  );
}
export function ProductCards({
  items,
  selected,
  catalog,
  onSelect,
  onAdd,
  onRemove,
}: {
  items: Placement[];
  selected?: string | null;
  catalog: Catalog;
  onSelect: (id: string) => void;
  onAdd: (kind: "door" | "window") => void;
  onRemove: (id: string) => void;
}) {
  const t = useT(),
    { language } = useLanguage();
  return (
    <section className="studio-products">
      <h2>
        {t("quoteProducts")} <small>{items.length}</small>
      </h2>
      {(["door", "window"] as const).map((kind) => (
        <div key={kind} className="product-group">
          <div className="product-group-heading">
            <h3>{t(kind)}</h3>
            <button
              className="text-button"
              disabled={items.length >= 60}
              onClick={() => onAdd(kind)}
            >
              + {t(kind === "door" ? "addDoor" : "addWindow")}
            </button>
          </div>
          <div className="quote-product-cards">
            {items
              .filter((p) => p.kind === kind)
              .map((p) => {
                const model = (
                  kind === "door" ? catalog.doors : catalog.windows
                ).find((m) => m.id === p.modelId);
                return (
                  <div
                    key={p.id}
                    className={
                      "quote-product " + (selected === p.id ? "active" : "")
                    }
                  >
                    <button
                      aria-pressed={selected === p.id}
                      onClick={() => onSelect(p.id)}
                    >
                      <ProductSketch
                        kind={kind}
                        style={model?.style}
                        panes={p.panes}
                        color={p.color}
                        sides={
                          p.options.includes("side-left")
                            ? p.options.includes("side-right")
                              ? "both"
                              : "left"
                            : p.options.includes("side-right")
                              ? "right"
                              : "none"
                        }
                        transom={p.options.includes("transom")}
                      />
                      <span>
                        <strong>
                          {model ? label(model.name, language) : p.modelId}
                        </strong>
                        <small>
                          {p.width} × {p.height} cm
                        </small>
                        <b>{money(productPrice(p, catalog), language)}</b>
                      </span>
                    </button>
                    <button
                      className="remove-product"
                      aria-label={`${t("removePlacement")} ${model ? label(model.name, language) : p.id}`}
                      onClick={() => onRemove(p.id)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </section>
  );
}
