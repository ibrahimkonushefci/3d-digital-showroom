import {
  useEffect,
  useState,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { useBrand } from "../brand";
import { useT, useLanguage, money, label } from "../i18n";
import { Field, Toggle } from "../app/components";
import { OfferFields } from "../app/OfferFields";
import { SendAnyone } from "../app/SendAnyone";
import { newOffer } from "../documents/details";
import { messageUrl, shareUrl } from "../sharing";
import { useFacade, loadFacade, newFacade } from "./store";
import { facadePrice } from "./pricing";
import { ProductControls } from "./Controls";
import type { HouseCamera } from "./House";
const House = lazy(() => import("./House")),
  Photo = lazy(() => import("./Preview"));
export default function ExteriorDesigner() {
  const { brand, catalog, local, logoUrl } = useBrand(),
    t = useT(),
    { language } = useLanguage(),
    { design, set } = useFacade();
  const [mode, setMode] = useState<"house" | "photo">(design?.view || "house"),
    [selected, select] = useState("entry"),
    [preset, setPreset] = useState<HouseCamera>("entry"),
    [result, setResult] = useState(false),
    [photoItems, setPhotoItems] = useState<NonNullable<typeof design>["items"]>(
      [],
    ),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false);
  const capture = useRef<() => Promise<string>>(null),
    register = useCallback((fn: () => Promise<string>) => {
      capture.current = fn;
    }, []);
  useEffect(() => {
    if (!useFacade.getState().design) set(loadFacade(brand.slug, catalog));
  }, [brand.slug, catalog]);
  useEffect(() => {
    if (design?.view === "photo") setMode("photo");
  }, [design?.id]);
  useEffect(() => {
    if (design)
      try {
        localStorage.setItem(
          `showroom-facade-${brand.slug}`,
          JSON.stringify(design),
        );
      } catch {
        /* optional storage */
      }
  }, [design, brand.slug]);
  if (!design) return <div className="startup">{t("sceneLoading")}</div>;
  const active = design.items.find((p) => p.id === selected) || design.items[0],
    offerDesign = {
      ...design,
      items: mode === "photo" ? photoItems : design.items,
      view: mode,
    },
    price = facadePrice(offerDesign, catalog, language),
    url = offerDesign.items.length
      ? shareUrl(offerDesign, brand, catalog.id, local)
      : `${window.location.origin}/preview?brand=${brand.slug}`;
  const showResult = () => {
    if (!design.offer)
      set({ ...design, offer: newOffer(brand, catalog, language) });
    setResult(!result);
    if (mode === "photo")
      requestAnimationFrame(() =>
        document
          .querySelector(".photo-offer-grid")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
  };
  const booking = () =>
    window.open(
      messageUrl(
        "whatsapp",
        brand,
        `${t("bookingMessage")} ${Object.values(design.offer?.customer || {}).join(" · ")}\n${price.lines.map((l) => l.name).join("\n")}`,
      ),
      "_blank",
      "noopener,noreferrer",
    );
  const pdf = async () => {
    setBusy(true);
    try {
      const { createOffer } = await import("../documents/offer");
      const doc = await createOffer({
        design: offerDesign,
        brand,
        catalog,
        language,
        logoUrl,
        screenshot: (await capture.current?.().catch(() => null)) || null,
        t,
        priceOverride: price,
        description: t("doorsWindows"),
      });
      doc.save(`${brand.slug}-doors-offer.pdf`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page exterior-page">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{brand.companyName}</div>
          <h1>{t("doorsWindows")}</h1>
        </div>
        <div className="segmented">
          {(["house", "photo"] as const).map((k) => (
            <button
              key={k}
              className={mode === k ? "active" : ""}
              onClick={() => {
                if (k === "house" && design.view === "photo")
                  set({ ...newFacade(catalog), offer: design.offer });
                setMode(k);
              }}
            >
              {t(k === "house" ? "houseMode" : "photoMode")}
            </button>
          ))}
        </div>
      </div>
      {mode === "photo" && (
        <button className="button secondary" onClick={showResult}>
          {t(result ? "backToDesign" : "summary")}
        </button>
      )}
      {mode === "photo" && (
        <Suspense fallback={<p>{t("sceneLoading")}</p>}>
          <Photo
            onItemsChange={setPhotoItems}
            sharedItems={design.view === "photo" ? design.items : undefined}
            capture={register}
          />
        </Suspense>
      )}
      <div className={mode === "house" ? "designer-grid" : "photo-offer-grid"}>
        {mode === "house" && (
          <section className="scene-panel">
            <div className="scene-toolbar">
              {(["facade", "entry", "balcony"] as const).map((k) => (
                <button
                  className="button secondary"
                  key={k}
                  onClick={() => setPreset(k)}
                >
                  {t(k)}
                </button>
              ))}
            </div>
            <div className="designer-canvas">
              <Suspense fallback={<p>{t("sceneLoading")}</p>}>
                <House
                  design={design}
                  catalog={catalog}
                  selected={selected}
                  onSelect={select}
                  preset={preset}
                  capture={register}
                />
              </Suspense>
            </div>
            <p className="helper">{t("houseHint")}</p>
          </section>
        )}
        <aside className="designer-controls">
          <button className="button secondary full" onClick={showResult}>
            {t(result ? "backToDesign" : "summary")}
          </button>
          {result ? (
            <>
              <h2>{t("parts")}</h2>
              {price.lines.map((l) => (
                <div key={l.id} className="product-line">
                  <span>{l.name}</span>
                  <strong>{money(l.amount, language)}</strong>
                </div>
              ))}
              {design.offer && (
                <OfferFields
                  details={design.offer}
                  onChange={(offer) => set({ ...design, offer })}
                />
              )}
              <Toggle
                label={t("installation")}
                checked={design.installation}
                onChange={(v) => set({ ...design, installation: v })}
              />
              <Toggle
                label={t("removal")}
                checked={design.removal}
                onChange={(v) => set({ ...design, removal: v })}
              />
              <Toggle
                label={t("vat")}
                checked={design.vat}
                onChange={(v) => set({ ...design, vat: v })}
              />
              <Toggle
                label={t("exactPrice")}
                checked={design.exact}
                onChange={(v) => set({ ...design, exact: v })}
              />
              <button
                className="button primary full"
                disabled={busy}
                onClick={pdf}
              >
                {t(busy ? "preparing" : "pdf")}
              </button>
              <button
                className="button secondary full"
                onClick={() => {
                  setLink(url);
                  navigator.clipboard?.writeText(url).catch(() => {});
                }}
              >
                {t("share")}
              </button>
              {link && (
                <textarea
                  readOnly
                  value={link}
                  aria-label={t("copyFallback")}
                />
              )}
              <SendAnyone
                title={brand.companyName}
                text={t("message", { link: "" })}
                url={url}
              />
              <div className="two-buttons">
                {(["whatsapp", "viber"] as const).map((s) => (
                  <button
                    className="button secondary"
                    key={s}
                    onClick={() =>
                      window.open(
                        messageUrl(s, brand, t("message", { link: url })),
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    {t(s)}
                  </button>
                ))}
              </div>
              <button className="button primary full" onClick={booking}>
                {t("bookMeasure")}
              </button>
            </>
          ) : (
            mode === "house" && (
              <>
                <Field label={t("selection")}>
                  <select
                    value={active.id}
                    onChange={(e) => select(e.target.value)}
                  >
                    {design.items.map((p, i) => (
                      <option key={p.id} value={p.id}>
                        {t(p.kind)} {i + 1} ·{" "}
                        {label(
                          (p.kind === "door"
                            ? catalog.doors
                            : catalog.windows
                          ).find((m) => m.id === p.modelId)!.name,
                          language,
                        )}
                      </option>
                    ))}
                  </select>
                </Field>
                <ProductControls
                  item={active}
                  catalog={catalog}
                  onChange={(item) =>
                    set({
                      ...design,
                      items: design.items.map((p) =>
                        p.id === item.id ? item : p,
                      ),
                    })
                  }
                />
                {active.kind === "window" && (
                  <button
                    className="button secondary full"
                    onClick={() =>
                      set({
                        ...design,
                        items: design.items.map((p) =>
                          p.kind === "window"
                            ? { ...active, id: p.id, corners: p.corners }
                            : p,
                        ),
                      })
                    }
                  >
                    {t("applyAllWindows")}
                  </button>
                )}
                <details>
                  <summary>{t("houseSettings")}</summary>
                  <Field label={t("facadeColor")}>
                    <input
                      type="color"
                      value={design.facadeColor}
                      onChange={(e) =>
                        set({ ...design, facadeColor: e.target.value })
                      }
                    />
                  </Field>
                  <Toggle
                    label={t("evening")}
                    checked={design.evening}
                    onChange={(v) => set({ ...design, evening: v })}
                  />
                  <Toggle
                    label={t("glassRailing")}
                    checked={design.railing === "glass"}
                    onChange={(v) =>
                      set({ ...design, railing: v ? "glass" : "metal" })
                    }
                  />
                  <Toggle
                    label={t("swingGate")}
                    checked={design.gate === "swing"}
                    onChange={(v) =>
                      set({ ...design, gate: v ? "swing" : "sliding" })
                    }
                  />
                  <Toggle
                    label={t("garage")}
                    checked={design.garage}
                    onChange={(v) => set({ ...design, garage: v })}
                  />
                </details>
                <button
                  className="button secondary full"
                  onClick={() => set(newFacade(catalog))}
                >
                  {t("reset")}
                </button>
              </>
            )
          )}
          <div className="price-sticky">
            <span>{t("estimate")}</span>
            <strong>
              {design.exact
                ? money(price.total, language)
                : `${money(price.low, language)} – ${money(price.high, language)}`}
            </strong>
            <small>{t("indicative")}</small>
          </div>
        </aside>
      </div>
    </main>
  );
}
