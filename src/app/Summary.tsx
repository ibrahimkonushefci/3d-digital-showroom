import { beginCapture } from "../pwa/busy";
import { interiorAssociations } from "../documents/finishes";
import { finishAssociations } from "../documents/finishes";
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
import { ArrowLeft, Download } from "lucide-react";
import { useBrand } from "../brand";
import { useDesigner } from "../designer3d/store";
import { calculatePrice, estimateLabel, quantityLabel } from "../pricing";
import { useLanguage, useT, money, number } from "../i18n";
import { newOffer } from "../documents/details";
import { restoreSummary } from "../persistence";
import { Toggle, ErrorNotice } from "./components";
const Scene = lazy(() => import("../designer3d/Scene"));
export default function Summary() {
  const { brand, catalog, logoUrl } = useBrand(),
    state = useDesigner(),
    t = useT(),
    { language } = useLanguage();
  const presentation = usePresentation(brand);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string | null>(null);
  const capture = useRef<(() => Promise<string>) | null>(null);
  // The last generated PDF, so a second tap downloads it without delay.
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
  const revision = JSON.stringify([design, language, presentation]);
  // Offer fields and price toggles do not change the picture.
  const look = JSON.stringify([
    design.cabinets,
    design.style,
    design.finishZones,
    design.worktopFinishes,
    design.presentation,
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
    return lastRender.current?.look === look ? lastRender.current.image : null;
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
    const endCapture = beginCapture();
    setBusy(true);
    setNotice(null);
    try {
      await task();
    } catch {
      setNotice("exportError");
    } finally {
      setBusy(false);
      endCapture();
    }
  };
  const download = () =>
    withBusy(async () => {
      const { downloadBlob } = await import("../documents/offer");
      const file = await buildPdf();
      downloadBlob(file, file.name);
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
              <Scene
                preset="overall"
                design={design}
                catalog={catalog}
                capture={register}
              />
            </Suspense>
          </div>
          <section className="offer-table finish-associations">
            <h2>{t("finishAssociations")}</h2>
            {finishAssociations(design, catalog, language).map((r) => (
              <p key={r.scope}>
                <strong>
                  {r.scope} · {r.quantity}
                </strong>
                <br />
                {r.description}
              </p>
            ))}
          </section>
          {design.kind === "wardrobe" && (
            <section className="offer-table">
              <h2>{t("interiorInventory")}</h2>
              <p>{t("interiorInventoryNote")}</p>
              {interiorAssociations(design, catalog, language).map((row) => (
                <p key={row.scope}>
                  <strong>{row.scope}</strong>
                  <br />
                  {row.description}
                </p>
              ))}
            </section>
          )}
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
            onClick={download}
            disabled={busy}
          >
            <Download size={18} />
            {t(busy ? "preparing" : "pdf")}
          </button>
          {notice && (
            <div className="notice" role="alert">
              {t(notice as Parameters<typeof t>[0])}
            </div>
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
