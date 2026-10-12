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
import { ArrowLeft, Download, Link2, MessageCircle, Send } from "lucide-react";
import { useBrand } from "../brand";
import { useDesigner } from "../designer3d/store";
import { calculatePrice, estimateLabel, quantityLabel } from "../pricing";
import { useLanguage, useT, money, number } from "../i18n";
import { OfferFields } from "./OfferFields";
import { newOffer } from "../documents/details";
import { restoreSummary } from "../persistence";
import { SendAnyone } from "./SendAnyone";
import { shareUrl, messageUrl, hasContact, shareOfferPdf } from "../sharing";
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
  // The last generated PDF, so a second tap can share it without delay.
  const prepared = useRef<{ revision: string; file: File } | null>(null);
  const lastRender = useRef<{ look: string; image: string } | null>(null);
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
  const estimate = estimateLabel(price, design.exact, language);
  const url = () => shareUrl(design, brand, catalog.id, local);
  const offerText = () =>
    t("offerMessage", {
      name: design.offer?.customer.name ? " " + design.offer.customer.name : "",
      number: design.offer?.number || "",
      company: brand.companyName,
      total: estimate,
      days: design.offer?.validityDays ?? catalog.pricing.validityDays,
      link: url(),
    });
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
    const target = messageUrl(service, brand, offerText());
    window.open(target, "_blank", "noopener,noreferrer");
  };
  const revision = JSON.stringify([design, language, presentation]);
  // Offer fields and price toggles do not change the picture.
  const look = JSON.stringify([
    design.cabinets,
    design.style,
    design.room,
    design.environment,
  ]);
  /** The scene image, retried once while it is still loading. */
  const render = async () => {
    // The scene registers its capture once it has mounted.
    for (let i = 0; i < 20 && !capture.current; i++)
      await new Promise((resolve) => setTimeout(resolve, 200));
    for (let attempt = 0; attempt < 2; attempt++) {
      const image = await capture.current?.().catch(() => null);
      if (image) {
        lastRender.current = { look, image };
        return image;
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
    return lastRender.current?.look === look
      ? lastRender.current.image
      : state.screenshot;
  };
  const buildPdf = async () => {
    if (prepared.current?.revision === revision) return prepared.current.file;
    const { createOffer, offerFileName } = await import("../documents/offer");
    const screenshot = await render();
    const doc = await createOffer({
      design,
      brand,
      catalog,
      language,
      screenshot,
      logoUrl,
      t,
      presentation,
    });
    const file = new File([doc.output("blob")], offerFileName(brand, design), {
      type: "application/pdf",
    });
    // Keep a document without its picture out of the cache: the next tap retries.
    if (screenshot) prepared.current = { revision, file };
    return file;
  };
  const withBusy = async (task: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await task();
    } catch {
      setNotice("exportError");
    } finally {
      setBusy(false);
    }
  };
  const download = () =>
    withBusy(async () => {
      const { downloadBlob } = await import("../documents/offer");
      const file = await buildPdf();
      downloadBlob(file, file.name);
    });
  const sendOffer = () =>
    withBusy(async () => {
      const file = await buildPdf();
      const result = await shareOfferPdf(file, file.name, offerText());
      if (result === "blocked") setNotice("readyToSend");
      else if (result === "unsupported") {
        // Desktop browsers: hand over the file and open the chat to attach it.
        const { downloadBlob } = await import("../documents/offer");
        downloadBlob(file, file.name);
        window.open(
          messageUrl("whatsapp", brand, offerText()),
          "_blank",
          "noopener,noreferrer",
        );
        setNotice("pdfDownloadedAttach");
      }
    });
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
                      {l.name}
                      {l.size && <small> · {l.size.join(" × ")} cm</small>}
                    </td>
                    <td>{quantityLabel(l, language, t("pieces"))}</td>
                    <td>{money(l.amount, language)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {price.discount > 0 && (
                  <tr>
                    <td colSpan={2}>
                      {t("discount")} ({number(price.discountPercent, language)}
                      %)
                    </td>
                    <td>− {money(price.discount, language)}</td>
                  </tr>
                )}
                {design.installation && (
                  <tr>
                    <td colSpan={2}>
                      {t("installation")} ({catalog.pricing.installationPercent}
                      %)
                    </td>
                    <td>{money(price.installation, language)}</td>
                  </tr>
                )}
                {design.vat && (
                  <tr>
                    <td colSpan={2}>
                      {t("vat")} ({catalog.pricing.vatPercent}%)
                    </td>
                    <td>{money(price.vat, language)}</td>
                  </tr>
                )}
                <tr className="offer-total">
                  <td colSpan={2}>
                    {t(design.vat ? "totalInclVat" : "totalExclVat")}
                  </td>
                  <td>{money(price.total, language)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <aside className="offer-card">
          <div className="summary-price">
            <span className="eyebrow">{t("estimate")}</span>
            <h2>{estimate}</h2>
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
          <button
            className="button primary full"
            onClick={sendOffer}
            disabled={busy}
          >
            <Send size={18} />
            {t(busy ? "preparing" : "sendOffer")}
          </button>
          <button
            className="button secondary full"
            onClick={download}
            disabled={busy}
          >
            <Download size={18} />
            {t("pdf")}
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
            {hasContact("viber", brand) && (
              <button
                className="button secondary"
                onClick={() => send("viber")}
              >
                {t("viber")}
              </button>
            )}
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
