import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useBrand } from "../brand";
import { useT, useLanguage, label, money } from "../i18n";
import {
  loadAlternative,
  saveAlternative,
  restoreAlternative,
  compatibleAlternative,
  catalogSignature,
  type Alternative,
  type Slot,
} from "../designer3d/comparison";
import CaptureAlternative from "../designer3d/CaptureAlternative";
import { useDesigner } from "../designer3d/store";
import { loadDesign } from "../persistence";
import { calculatePrice } from "../pricing";
import { proposalFinishes } from "../documents/finishes";
export default function Compare() {
  const { brand, catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage(),
    [params] = useSearchParams(),
    navigate = useNavigate();
  const kind = params.get("kind") === "wardrobe" ? "wardrobe" : "kitchen";
  const [slots, setSlots] = useState<Partial<Record<Slot, Alternative>>>({}),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true);
  const [replace, setReplace] = useState<Slot | null>(null);
  const current = useDesigner((s) => s.design);
  const [refresh, setRefresh] = useState<Slot[]>([]);
  const query = `?brand=${encodeURIComponent(brand.slug)}`;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setSlots({});
    setRefresh([]);
    setReplace(null);
    Promise.all(
      (["A", "B"] as Slot[]).map((slot) =>
        loadAlternative(brand.slug, kind, slot),
      ),
    )
      .then((values) => {
        if (!active) return;
        setSlots({ A: values[0], B: values[1] });
        setRefresh(
          (["A", "B"] as Slot[]).filter(
            (_, i) =>
              values[i] &&
              compatibleAlternative(values[i]!, catalog) &&
              values[i]!.catalogSignature !== catalogSignature(catalog),
          ),
        );
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [brand.slug, kind, catalog]);
  const valid = (slot: Slot) =>
    slots[slot] && compatibleAlternative(slots[slot]!, catalog);
  const total = (slot: Slot) =>
    valid(slot) ? calculatePrice(slots[slot]!.design, catalog, language) : null;
  const a = total("A"),
    b = total("B");
  return (
    <main className="page compare-page">
      <h1>
        {t("compare")} · {t(kind === "kitchen" ? "kitchens" : "wardrobes")}
      </h1>
      <p>{t("comparisonLocal")}</p>
      {error && <p role="alert">{t("comparisonError")}</p>}
      {loading && <p>{t("sceneLoading")}</p>}
      <div className="comparison-grid">
        {(["A", "B"] as Slot[]).map((slot) => {
          const item = slots[slot],
            price = total(slot);
          return (
            <article key={slot} className="comparison-card">
              <h2>
                {slot} · {item?.name || t("emptyAlternative")}
              </h2>
              {item && (
                <>
                  <img src={item.image} alt={`${slot} · ${item.name}`} />
                  <p>
                    {t(item.design.layout)} · {item.design.room.width} ×{" "}
                    {item.design.room.depth} × {item.design.room.height} cm
                  </p>
                  <p>
                    {proposalFinishes(item.design, catalog)
                      .map((m) => label(m.name, language))
                      .join(" · ")}
                  </p>
                  {price ? (
                    <strong>
                      {money(price.low, language)} –{" "}
                      {money(price.high, language)} · {t("indicative")}
                    </strong>
                  ) : (
                    <p role="alert">{t("comparisonUnavailable")}</p>
                  )}
                  {price &&
                    item.catalogSignature !== catalogSignature(catalog) && (
                      <p role="status">
                        {t(refresh.length ? "sceneLoading" : "comparisonError")}
                      </p>
                    )}
                  <button
                    className="button primary"
                    disabled={
                      !price ||
                      refresh.length > 0 ||
                      !!replace ||
                      item.catalogSignature !== catalogSignature(catalog)
                    }
                    onClick={() => {
                      const current =
                        useDesigner.getState().design?.kind === kind
                          ? useDesigner.getState().design
                          : loadDesign(brand.slug, kind, catalog);
                      useDesigner
                        .getState()
                        .setDesign(restoreAlternative(item, catalog, current));
                      navigate(`/designer/${kind}${query}`);
                    }}
                  >
                    {t("chooseAlternative")}
                  </button>
                </>
              )}
              <button
                className="button secondary"
                disabled={
                  !current ||
                  current.kind !== kind ||
                  !!replace ||
                  refresh.length > 0
                }
                onClick={() => setReplace(slot)}
              >
                {t(slot === "A" ? "saveA" : "saveB")}
              </button>
              <Link to={`/designer/${kind}${query}`}>{t("edit")}</Link>
            </article>
          );
        })}
      </div>
      {a && b && (
        <p className="comparison-difference">
          <strong>
            {t("priceDifference")}: {b.total - a.total >= 0 ? "+" : ""}
            {money(b.total - a.total, language)}
          </strong>{" "}
          · {t("indicative")}
        </p>
      )}
      {replace && current?.kind === kind && (
        <CaptureAlternative
          key={`replace-${replace}`}
          design={current}
          catalog={catalog}
          onCapture={async (image) => {
            try {
              const updated = await saveAlternative(
                brand.slug,
                current,
                catalog,
                replace,
                slots[replace]?.name || replace,
                async () => image,
              );
              setSlots((s) => ({ ...s, [replace]: updated }));
            } catch {
              setError(true);
            }
            setReplace(null);
          }}
          onError={() => {
            setError(true);
            setReplace(null);
          }}
        />
      )}
      {refresh[0] && slots[refresh[0]] && (
        <CaptureAlternative
          key={refresh[0]}
          design={slots[refresh[0]]!.design}
          catalog={catalog}
          onCapture={async (image) => {
            const slot = refresh[0],
              item = slots[slot]!;
            try {
              const updated = await saveAlternative(
                brand.slug,
                item.design,
                catalog,
                slot,
                item.name,
                async () => image,
              );
              setSlots((s) => ({ ...s, [slot]: updated }));
            } catch {
              setError(true);
            }
            setRefresh((s) => s.slice(1));
          }}
          onError={() => {
            setError(true);
            setRefresh((s) => s.slice(1));
          }}
        />
      )}
    </main>
  );
}
