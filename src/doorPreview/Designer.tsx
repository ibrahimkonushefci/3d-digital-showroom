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
import { Field, Toggle, ErrorNotice } from "../app/components";
import { OfferFields } from "../app/OfferFields";
import { SendAnyone } from "../app/SendAnyone";
import { newOffer } from "../documents/details";
import { messageUrl, shareUrl } from "../sharing";
import {
  useFacade,
  loadFacade,
  loadPhotoDraft,
  persistStudio,
  persistPhotoDraft,
  restoredView,
  product,
  newFacade,
} from "./store";
import { facadePrice, productPrice } from "./pricing";
import { ProductControls } from "./Controls";
import { ProductCards } from "./ProductCards";
import { applyWindowConfiguration, hasGlazing } from "./configuration";
import type { HouseCamera } from "./House";
import type { FacadeDesign, Placement } from "./types";
const House = lazy(() => import("./House")),
  Photo = lazy(() => import("./Preview"));
export default function ExteriorDesigner() {
  const { brand, catalog, local, logoUrl } = useBrand(),
    t = useT(),
    { language } = useLanguage(),
    { design, photoDesign, set, setPhoto } = useFacade();
  const [mode, setMode] = useState<"house" | "photo">("house"),
    [selected, select] = useState("entry"),
    [preset, setPreset] = useState<HouseCamera>("full"),
    [open, setOpen] = useState(false),
    [result, setResult] = useState(false),
    [loaded, setLoaded] = useState(false),
    [photoVisited, setPhotoVisited] = useState(!!photoDesign),
    [initialPhotoItems, setInitialPhotoItems] = useState<
      Placement[] | undefined
    >(photoDesign?.items),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false),
    [exportView, setExportView] = useState(false),
    [error, setError] = useState<string | null>(null);
  const studioCapture = useRef<() => Promise<string>>(null),
    photoCapture = useRef<() => Promise<string>>(null),
    initialized = useRef<string | null>(null);
  const registerStudio = useCallback((fn: () => Promise<string>) => {
      studioCapture.current = fn;
    }, []),
    registerPhoto = useCallback((fn: () => Promise<string>) => {
      photoCapture.current = fn;
    }, []);
  useEffect(() => {
    if (initialized.current === brand.slug) return;
    initialized.current = brand.slug;
    const state = useFacade.getState();
    const view = restoredView(brand.slug, state.pendingView);
    useFacade.setState({ pendingView: null });
    const studio = state.design || loadFacade(brand.slug, catalog);
    set(studio);
    select(studio.items[0]?.id || "");
    const photo = state.photoDesign || loadPhotoDraft(brand.slug, catalog);
    if (photo) {
      setPhoto(photo);
      setInitialPhotoItems(photo.items);
    } else setPhoto({ ...newFacade(catalog), items: [], view: "photo" });
    setMode(view);
    setPhotoVisited(view === "photo");
    setLoaded(true);
  }, [brand.slug, catalog]);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem(`showroom-preview-mode-${brand.slug}`, mode);
      } catch {
        /* optional presentation preference */
      }
  }, [loaded, mode, brand.slug]);
  useEffect(() => {
    if (loaded && design)
      try {
        persistStudio(brand.slug, design);
      } catch {
        setError("storageError");
      }
  }, [loaded, design, brand.slug]);
  useEffect(() => {
    if (loaded && photoDesign)
      try {
        persistPhotoDraft(brand.slug, photoDesign);
      } catch {
        setError("storageError");
      }
  }, [loaded, photoDesign, brand.slug]);
  const photoItemsChanged = useCallback(
    (items: Placement[]) => {
      const d = useFacade.getState().photoDesign;
      if (d) setPhoto({ ...d, items });
    },
    [setPhoto],
  );
  if (!loaded || !design || !photoDesign)
    return <div className="startup">{t("sceneLoading")}</div>;
  const active = design.items.find((p) => p.id === selected) || design.items[0],
    offerDesign = mode === "photo" ? photoDesign : design,
    price = facadePrice(offerDesign, catalog, language),
    url = offerDesign.items.length
      ? shareUrl(offerDesign, brand, catalog.id, local)
      : `${window.location.origin}/preview?brand=${brand.slug}`;
  const updateQuote = (d: FacadeDesign) =>
    mode === "photo" ? setPhoto(d) : set(d);
  const showResult = () => {
    if (!offerDesign.offer)
      updateQuote({
        ...offerDesign,
        offer: newOffer(brand, catalog, language),
      });
    setResult(!result);
  };
  const choose = (id: string) => {
    select(id);
    setOpen(false);
    setPreset("full");
  };
  const add = (kind: "door" | "window") => {
    if (design.items.length >= 60) return;
    const p = product(catalog, kind);
    set({ ...design, items: [...design.items, p] });
    choose(p.id);
  };
  const remove = (id: string) => {
    if (design.items.length === 1) {
      setError("keepOneProduct");
      return;
    }
    const items = design.items.filter((p) => p.id !== id);
    set({ ...design, items });
    if (active.id === id) choose(items[0].id);
  };
  const booking = () =>
    window.open(
      messageUrl(
        "whatsapp",
        brand,
        `${t("bookingMessage")} ${Object.values(offerDesign.offer?.customer || {}).join(" · ")}\n${price.lines.map((l) => l.name).join("\n")}`,
      ),
      "_blank",
      "noopener,noreferrer",
    );
  const pdf = async () => {
    setBusy(true);
    try {
      if (mode === "house") {
        setExportView(true);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      }
      const screenshot = await (mode === "house" ? studioCapture : photoCapture)
        .current?.()
        .catch(() => null);
      const { createOffer } = await import("../documents/offer");
      const model = (
        active.kind === "door" ? catalog.doors : catalog.windows
      ).find((m) => m.id === active.modelId)!;
      const doc = await createOffer({
        design: offerDesign,
        brand,
        catalog,
        language,
        logoUrl,
        screenshot: screenshot || null,
        t,
        priceOverride: price,
        description: t("doorsWindows"),
        imageCaption:
          mode === "house"
            ? `${t("picturedProduct")}: ${label(model.name, language)} · ${active.width} × ${active.height} cm`
            : t("photoMode"),
      });
      doc.save(`${brand.slug}-doors-offer.pdf`);
    } catch {
      setError("exportError");
    } finally {
      setExportView(false);
      setBusy(false);
    }
  };
  return (
    <main className="page exterior-page">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{brand.companyName}</div>
          <h1>{t("doorsWindows")}</h1>
          <p>{t("studioIntro")}</p>
        </div>
        <div className="segmented">
          {(["house", "photo"] as const).map((k) => (
            <button
              key={k}
              aria-pressed={mode === k}
              className={mode === k ? "active" : ""}
              onClick={() => {
                setMode(k);
                setResult(false);
                setLink("");
                if (k === "photo") setPhotoVisited(true);
              }}
            >
              {t(k === "house" ? "houseMode" : "photoMode")}
            </button>
          ))}
        </div>
      </div>
      {
        <p
          className={`photo-quote-heading ${mode === "house" ? "studio-quote-heading" : ""}`}
        >
          {t("quoteTotal")} · {offerDesign.items.length}{" "}
          {t(offerDesign.items.length === 1 ? "quoteItem" : "quoteItems")} ·{" "}
          <strong>
            {offerDesign.exact
              ? money(price.total, language)
              : `${money(price.low, language)} – ${money(price.high, language)}`}
          </strong>
        </p>
      }
      <ErrorNotice message={error} onDismiss={() => setError(null)} />
      {photoVisited && (
        <div hidden={mode !== "photo"}>
          <Suspense fallback={<p>{t("sceneLoading")}</p>}>
            <Photo
              onItemsChange={photoItemsChanged}
              sharedItems={initialPhotoItems}
              capture={registerPhoto}
            />
          </Suspense>
        </div>
      )}
      <div className={mode === "house" ? "designer-grid" : "photo-offer-grid"}>
        {mode === "house" && (
          <section className="scene-panel">
            <div className="scene-toolbar">
              {(["full", "detail", "glass", "inside"] as const).map((k) => (
                <button
                  className={
                    "button secondary " + (preset === k ? "active" : "")
                  }
                  key={k}
                  aria-pressed={preset === k}
                  disabled={
                    busy || (k === "glass" && !hasGlazing(active, catalog))
                  }
                  onClick={() => setPreset(k)}
                >
                  {t(
                    k === "full"
                      ? "fullProduct"
                      : k === "detail"
                        ? "profileDetail"
                        : k === "glass"
                          ? "glassDetail"
                          : "interiorView",
                  )}
                </button>
              ))}
              {active.kind === "door" && (
                <button
                  className="button primary"
                  disabled={busy}
                  aria-pressed={open}
                  onClick={() => setOpen(!open)}
                >
                  {t(open ? "closeDoor" : "openDoor")}
                </button>
              )}
            </div>
            <div className="designer-canvas">
              <Suspense fallback={<p>{t("sceneLoading")}</p>}>
                <House
                  design={design}
                  catalog={catalog}
                  selected={active.id}
                  onSelect={select}
                  preset={preset}
                  open={open}
                  exportView={exportView}
                  capture={registerStudio}
                />
              </Suspense>
            </div>
            <div className="studio-scene-caption">
              <span>
                {label(
                  (active.kind === "door"
                    ? catalog.doors
                    : catalog.windows
                  ).find((m) => m.id === active.modelId)!.name,
                  language,
                )}{" "}
                · {active.width} × {active.height} cm
              </span>
              <b>
                {t("selectedEstimate")}:{" "}
                {money(productPrice(active, catalog), language)}
              </b>
            </div>
            <p className="helper">{t("houseHint")}</p>
          </section>
        )}
        <aside className="designer-controls">
          <button className="button secondary full" onClick={showResult}>
            {t(result ? "backToDesign" : "summary")}
          </button>
          <div className="quote-total-card">
            <span>
              {t("quoteTotal")} · {offerDesign.items.length}{" "}
              {t(offerDesign.items.length === 1 ? "quoteItem" : "quoteItems")}
            </span>
            <strong>
              {offerDesign.exact
                ? money(price.total, language)
                : `${money(price.low, language)} – ${money(price.high, language)}`}
            </strong>
            <small>{t("indicative")}</small>
          </div>
          {result ? (
            <>
              <h2>{t("parts")}</h2>
              {price.lines.map((l) => (
                <div key={l.id} className="product-line">
                  <span>{l.name}</span>
                  <strong>{money(l.amount, language)}</strong>
                </div>
              ))}
              {offerDesign.offer && (
                <OfferFields
                  details={offerDesign.offer}
                  onChange={(offer) => updateQuote({ ...offerDesign, offer })}
                />
              )}
              {(["installation", "removal", "vat", "exact"] as const).map(
                (k) => (
                  <Toggle
                    key={k}
                    label={t(k === "exact" ? "exactPrice" : k)}
                    checked={offerDesign[k]}
                    onChange={(v) => updateQuote({ ...offerDesign, [k]: v })}
                  />
                ),
              )}
              <button
                className="button primary full"
                disabled={busy || !offerDesign.items.length}
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
          ) : mode === "house" ? (
            <>
              <ProductCards
                items={design.items}
                selected={active.id}
                catalog={catalog}
                onSelect={choose}
                onAdd={add}
                onRemove={remove}
              />
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
                      items: applyWindowConfiguration(design.items, active),
                    })
                  }
                >
                  {t("applyAllWindows")}
                </button>
              )}
              <section className="studio-setting">
                <h2>{t("studioSetting")}</h2>
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
              </section>
              <button
                className="button secondary full"
                onClick={() => {
                  const d = newFacade(catalog);
                  set(d);
                  choose(d.items[0].id);
                }}
              >
                {t("reset")}
              </button>
            </>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
