import { usePresentation } from "./preferences";
import {
  useEffect,
  useState,
  lazy,
  Suspense,
  useRef,
  useCallback,
} from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Link2, MessageCircle } from "lucide-react";
import { useBrand } from "../brand";
import { useDesigner } from "../designer3d/store";
import { calculatePrice } from "../pricing";
import { useLanguage, useT, money } from "../i18n";
import { OfferFields } from "./OfferFields";
import { newOffer } from "../documents/details";
import { restoreSummary } from "../persistence";
import { SendAnyone } from "./SendAnyone";
import { shareUrl, messageUrl } from "../sharing";
import { Toggle, ErrorNotice } from "./components";
const Scene = lazy(() => import("../designer3d/Scene"));
export default function Summary() {
  const { brand, catalog, logoUrl, local } = useBrand(),
    state = useDesigner(),
    t = useT(),
    { language } = useLanguage();
  const presentation = usePresentation(brand);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string | null>(null),
    [link, setLink] = useState("");
  const capture = useRef<(() => Promise<string>) | null>(null);
  const register = useCallback((fn: () => Promise<string>) => {
    capture.current = fn;
  }, []);
  useEffect(() => {
    const kind = new URLSearchParams(location.search).get("kind");
    if (!state.design || (kind && state.design.kind !== kind)) {
      const saved = restoreSummary(brand.slug, catalog, kind);
      if (saved) state.setDesign(saved);
    }
  }, [brand.slug, catalog]);
  useEffect(() => {
    if (state.design && !state.design.offer)
      state.edit(
        { ...state.design, offer: newOffer(brand, catalog, language) },
        catalog,
      );
  }, [state.design?.id, brand.slug]);
  const { design } = state;
  if (!design)
    return (
      <main className="page startup">
        <p>{t("empty")}</p>
        <Link
          className="button primary"
          to={"/designer/kitchen" + location.search}
        >
          {t("startDesign")}
        </Link>
      </main>
    );
  const price = calculatePrice(design, catalog, language);
  const url = () => shareUrl(design, brand, catalog.id, local);
  const copy = async () => {
    const value = url();
    setLink(value);
    try {
      await navigator.clipboard.writeText(value);
      setNotice("copied");
    } catch {
      setLink(value);
      setNotice("copyFallback");
    }
  };
  const send = (service: "whatsapp" | "viber") => {
    const target = messageUrl(service, brand, t("message", { link: url() }));
    window.open(target, "_blank", "noopener,noreferrer");
  };
  const pdf = async () => {
    setBusy(true);
    try {
      const { createOffer } = await import("../documents/offer");
      const screenshot =
        (await capture.current?.().catch(() => null)) || state.screenshot;
      const doc = await createOffer({
        design,
        brand,
        catalog,
        language,
        screenshot,
        logoUrl,
        t,
      });
      doc.save(brand.slug + "-" + design.kind + "-offer.pdf");
    } catch {
      setNotice("exportError");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page summary-page">
      <Link
        className="back-link"
        to={"/designer/" + design.kind + location.search}
      >
        <ArrowLeft size={17} />
        {t("backToDesign")}
      </Link>
      <div className="section-heading">
        <div>
          <div className="eyebrow">{brand.companyName}</div>
          <h1>{t("summary")}</h1>
        </div>
        <span className="pill">{t("indicative")}</span>
      </div>
      <div className="summary-grid">
        <div className="summary-left">
          <div className="summary-scene">
            <Suspense fallback={<p>{t("sceneLoading")}</p>}>
              <Scene design={design} catalog={catalog} capture={register} />
            </Suspense>
          </div>
          <div className="offer-table">
            <h2>{t("parts")}</h2>
            <table>
              <thead>
                <tr>
                  <th>{t("item")}</th>
                  <th>{t("quantity")}</th>
                  <th>{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {price.lines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.id === "led" || l.id === "plinth" ? t(l.id) : l.name}
                    </td>
                    <td>
                      {Number(l.quantity.toFixed(2))}
                      {l.unit === "m"
                        ? " m"
                        : l.unit === "m2"
                          ? " m²"
                          : ` ${t("pieces")}`}
                    </td>
                    <td>{money(l.amount, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="offer-card">
          <div className="summary-price">
            <span className="eyebrow">{t("estimate")}</span>
            <h2>
              {design.exact
                ? money(price.total, language)
                : `${money(price.low, language)} – ${money(price.high, language)}`}
            </h2>
          </div>
          <p className="helper">{t("priceDisclaimer")}</p>
          {design.offer && (
            <OfferFields
              details={design.offer}
              onChange={(offer) => state.edit({ ...design, offer }, catalog)}
            />
          )}
          <Toggle
            label={`${t("installation")} · ${catalog.pricing.installationPercent}%`}
            checked={design.installation}
            onChange={(v) =>
              state.edit({ ...design, installation: v }, catalog)
            }
          />
          <Toggle
            label={`${t("vat")} · ${catalog.pricing.vatPercent}%`}
            checked={design.vat}
            onChange={(v) => state.edit({ ...design, vat: v }, catalog)}
          />
          <Toggle
            label={t("exactPrice")}
            checked={design.exact}
            onChange={(v) => state.edit({ ...design, exact: v }, catalog)}
          />
          <button className="button primary full" onClick={pdf} disabled={busy}>
            <Download size={18} />
            {t(busy ? "preparing" : "pdf")}
          </button>
          <button className="button secondary full" onClick={copy}>
            <Link2 size={18} />
            {t("share")}
          </button>
          <SendAnyone
            title={brand.companyName}
            text={t("message", { link: "" })}
            url={url()}
          />
          <div className="two-buttons">
            <button
              className="button secondary"
              onClick={() => send("whatsapp")}
            >
              <MessageCircle size={16} />
              {t("whatsapp")}
            </button>
            <button className="button secondary" onClick={() => send("viber")}>
              {t("viber")}
            </button>
          </div>
          {notice && (
            <div className="notice" role="status">
              {t(notice as Parameters<typeof t>[0])}
            </div>
          )}
          {link && (
            <textarea
              aria-label={t("copyFallback")}
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
            />
          )}{" "}
          {local && !presentation && (
            <p className="helper">{t("sharedBrandNote")}</p>
          )}
          <div className="offer-contact">
            <img src={logoUrl} alt="" />
            <div>
              <strong>{brand.companyName}</strong>
              <span>{brand.contact.phone || brand.contact.city}</span>
            </div>
          </div>
          <ErrorNotice message={state.error} />
        </aside>
      </div>
    </main>
  );
}
