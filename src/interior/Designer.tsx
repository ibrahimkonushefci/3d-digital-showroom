import {
  useState,
  useEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { Trash2, Plus, Download, ChevronRight } from "lucide-react";
import { useBrand } from "../brand";
import {
  useT,
  useLanguage,
  label,
  money,
  number,
  type TranslationKey,
} from "../i18n";
import {
  Field,
  NumberField,
  Toggle,
  ErrorNotice,
  Swatches,
} from "../app/components";
import { OfferFields } from "../app/OfferFields";
import { SendAnyone } from "../app/SendAnyone";
import { shareUrl } from "../sharing";
import { newOffer } from "../documents/details";
import { useInterior, loadInterior } from "./store";
import { interiorPrice, interiorDoorPrice } from "./pricing";
import {
  changeDoorStyle,
  switchInteriorRoom,
  validInterior,
  newQuoteDoor,
  doorWidths,
} from "./layout";
import { interiorDoorChoices } from "./products";
import { supportedPhotoDoor } from "./scenes";
import type { InteriorDesign, InteriorDoor, DoorStyle } from "./types";
const Scene = lazy(() => import("./Scene"));
export default function InteriorDesigner() {
  const { brand, catalog, local, logoUrl, assetUrl } = useBrand(),
    t = useT(),
    { language } = useLanguage(),
    { design, set, brandSlug } = useInterior();
  const [result, setResult] = useState(false),
    [error, setError] = useState<string | null>(null),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [pdfDownload, setPdfDownload] = useState<{
      url: string;
      signature: string;
    } | null>(null);
  const exportSignature = JSON.stringify([design, language, brand.slug]);
  const sceneReady = useCallback((value: boolean) => {
    setReady(value);
    setPdfDownload(null);
  }, []);
  useEffect(
    () => () => {
      if (pdfDownload) URL.revokeObjectURL(pdfDownload.url);
    },
    [pdfDownload],
  );
  const capture = useRef<() => Promise<string>>(null),
    register = useCallback((fn: () => Promise<string>) => {
      capture.current = fn;
    }, []);
  useEffect(() => {
    if (
      !useInterior.getState().design ||
      useInterior.getState().brandSlug !== brand.slug
    ) {
      set(loadInterior(brand.slug, catalog), brand.slug);
      setResult(false);
      setLink("");
    }
  }, [brand.slug, catalog, set]);
  useEffect(() => {
    if (design && brandSlug === brand.slug)
      try {
        localStorage.setItem(
          `showroom-interior-${brand.slug}`,
          JSON.stringify(design),
        );
      } catch {
        /* Optional storage. */
      }
  }, [design, brand.slug, brandSlug]);
  if (!design || brandSlug !== brand.slug)
    return <div className="startup">{t("sceneLoading")}</div>;
  const price = interiorPrice(design, catalog, language),
    floor = catalog.laminates.find((f) => f.id === design.laminateId)!,
    style = design.doorStyle,
    choices = interiorDoorChoices(catalog),
    model = catalog.interiorDoors.find((m) => m.id === style.modelId)!,
    url = shareUrl(design, brand, catalog.id, local);
  const edit = (d: InteriorDesign) => {
    if (validInterior(d, catalog)) {
      set(d);
      setError(null);
    } else setError("fitError");
  };
  const product = (v: Partial<DoorStyle>) => edit(changeDoorStyle(design, v));
  const doorEdit = (id: string, v: Partial<InteriorDoor>) =>
    edit({
      ...design,
      doors: design.doors.map((p) => (p.id === id ? { ...p, ...v } : p)),
    });
  const showResult = () => {
    if (!design.offer)
      set({ ...design, offer: newOffer(brand, catalog, language) });
    setResult(!result);
  };
  const pdf = async () => {
    setBusy(true);
    try {
      if (!ready || !capture.current) throw Error("sceneLoading");
      const screenshot = await capture.current();
      const { createOffer } = await import("../documents/offer");
      const doc = await createOffer({
        design,
        brand,
        catalog,
        language,
        screenshot,
        logoUrl,
        t,
        priceOverride: price,
        description: `${t("interior")} · ${t("quoteMeasurements")} ${design.room.width} × ${design.room.depth} cm · ${number(price.area, language, 1)} m²\n${t("previewRoom")}: ${t(design.preset)} · ${t("photoIllustrative")}`,
      });
      setPdfDownload({
        url: URL.createObjectURL(doc.output("blob")),
        signature: exportSignature,
      });
      doc.save(`${brand.slug}-interior-offer.pdf`);
    } catch {
      setError("exportError");
    } finally {
      setBusy(false);
    }
  };
  const controls = (
    <>
      <section className="interior-product-section">
        <div className="interior-section-title">
          <h2>{t("door")}</h2>
          <small>{t("sharedAcrossRooms")}</small>
        </div>
        {design.legacyMixed && (
          <p className="notice">{t("legacyMixedDoors")}</p>
        )}
        {!supportedPhotoDoor(model.style) && (
          <p className="notice">{t("unsupportedInteriorPreview")}</p>
        )}
        <div className="interior-product-grid">
          {choices.map((choice) => {
            const f = catalog.productFinishes.find(
                (f) => f.id === choice.style.finishId,
              )!,
              selected =
                !design.legacyMixed &&
                Object.entries(choice.style).every(
                  ([k, v]) => style[k as keyof DoorStyle] === v,
                );
            return (
              <button
                key={choice.id}
                className={`interior-product-card ${selected ? "selected" : ""}`}
                aria-pressed={selected}
                onClick={() => product(choice.style)}
              >
                <span
                  className="interior-door-thumb"
                  style={{
                    backgroundColor: f.color,
                    ...(f.texture
                      ? {
                          backgroundImage: `url(${assetUrl(f.previewTexture || f.texture)})`,
                        }
                      : {}),
                  }}
                >
                  {choice.style.modelId === "glass" &&
                    [1, 2, 3, 4].map((n) => (
                      <i
                        className="thumb-glass"
                        key={n}
                        style={{ top: `${n * 19}%` }}
                      />
                    ))}
                  <img
                    alt=""
                    src="/shared/interior/handle.png"
                    className={
                      choice.style.handleId === "black" ? "black-hardware" : ""
                    }
                  />
                </span>
                <span>{t(choice.id as TranslationKey)}</span>
                <strong>
                  {money(
                    interiorDoorPrice(
                      { ...design.doors[0], ...choice.style },
                      catalog,
                    ),
                    language,
                  )}
                  /{t("perPiece")}
                </strong>
              </button>
            );
          })}
        </div>
      </section>
      <section className="interior-product-section">
        <div className="interior-section-title">
          <h2>{t("laminate")}</h2>
          <small>{label(floor.name, language)}</small>
        </div>
        <div className="interior-product-grid interior-floor-grid">
          {catalog.laminates.map((f) => (
            <button
              key={f.id}
              className={`interior-product-card ${f.id === design.laminateId ? "selected" : ""}`}
              aria-pressed={f.id === design.laminateId}
              onClick={() => edit({ ...design, laminateId: f.id })}
            >
              <span
                className="interior-floor-thumb"
                style={{
                  backgroundColor: f.color,
                  backgroundImage: `url(${assetUrl((f.previewTexture || f.texture)!)})`,
                }}
              />
              <span>{label(f.name, language)}</span>
              <strong>{money(f.pricePerM2, language)}/m²</strong>
              <small>
                {f.class}
                {f.usageClass ? ` · ${f.usageClass}` : ""} · {f.thickness} mm
                {f.groove ? " · 4V" : ""}
              </small>
            </button>
          ))}
        </div>
      </section>
      <details>
        <summary>{t("finishesHardware")}</summary>
        <Field label={t("model")}>
          <select
            value={style.modelId}
            onChange={(e) => product({ modelId: e.target.value })}
          >
            {catalog.interiorDoors
              .filter((m) => supportedPhotoDoor(m.style))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {label(m.name, language)}
                </option>
              ))}
          </select>
        </Field>
        <Swatches
          title={t("color")}
          items={catalog.productFinishes.filter((m) =>
            [
              "white",
              "golden-oak",
              "walnut",
              "anthracite",
              "soft-grey",
              style.finishId,
            ].includes(m.id),
          )}
          value={style.finishId}
          onChange={(finishId) => product({ finishId })}
        />
        <Field label={t("finish")}>
          <select
            value={style.finishTier}
            onChange={(e) => product({ finishTier: e.target.value })}
          >
            {catalog.interiorFinishes.map((f) => (
              <option key={f.id} value={f.id}>
                {label(f.name, language)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("handle")}>
          <select
            value={style.handleId}
            onChange={(e) => product({ handleId: e.target.value })}
          >
            {catalog.interiorHandles.map((h) => (
              <option key={h.id} value={h.id}>
                {label(h.name, language)} · {money(h.price, language)}
              </option>
            ))}
          </select>
        </Field>
        <Toggle
          label={t("hiddenHinges")}
          checked={style.hiddenHinges}
          onChange={(hiddenHinges) => product({ hiddenHinges })}
        />
      </details>
      <details>
        <summary>{t("flooringOptions")}</summary>
        <Field label={t("layingPattern")}>
          <select
            value={design.pattern}
            onChange={(e) =>
              edit({
                ...design,
                pattern: e.target.value as InteriorDesign["pattern"],
              })
            }
          >
            {(["straight", "diagonal", "herringbone"] as const).map((k) => (
              <option key={k} value={k}>
                {t(k === "straight" ? "straightPattern" : k)} ·{" "}
                {catalog.interiorPricing!.waste[k] * 100}% {t("waste")}
              </option>
            ))}
          </select>
        </Field>
        <Toggle
          label={t("floorDirection")}
          checked={design.direction}
          onChange={(direction) => edit({ ...design, direction })}
        />
        <Toggle
          label={t("underlay")}
          checked={design.underlay}
          onChange={(underlay) => edit({ ...design, underlay })}
        />
        <Field label={t("skirting")}>
          <select
            value={design.skirtingId}
            onChange={(e) => {
              const skirt = catalog.skirtings.find(
                (s) => s.id === e.target.value,
              )!;
              edit({
                ...design,
                skirtingId: skirt.id,
                skirtingHeight: skirt.heightRates.some(
                  (r) => r.height === design.skirtingHeight,
                )
                  ? design.skirtingHeight
                  : skirt.heightRates[0].height,
              });
            }}
          >
            {catalog.skirtings.map((s) => (
              <option key={s.id} value={s.id}>
                {label(s.name, language)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("heightCm")}>
          <select
            value={design.skirtingHeight}
            onChange={(e) =>
              edit({ ...design, skirtingHeight: Number(e.target.value) })
            }
          >
            {catalog.skirtings
              .find((s) => s.id === design.skirtingId)!
              .heightRates.map((h) => (
                <option key={h.height} value={h.height}>
                  {h.height} cm
                </option>
              ))}
          </select>
        </Field>
        <p className="helper">
          {number(floor.plankLength, language)} ×{" "}
          {number(floor.plankWidth, language)} cm ·{" "}
          {number(floor.m2PerPack, language)} m²/{t("packs")}
        </p>
      </details>
      <details>
        <summary>{t("quoteMeasurements")}</summary>
        <p className="helper">{t("fixedQuoteHint")}</p>
        <div className="dimension-grid">
          <NumberField
            label={t("width")}
            value={design.room.width}
            min={120}
            max={2000}
            onChange={(width) =>
              edit({ ...design, room: { ...design.room, width } })
            }
          />
          <NumberField
            label={t("length")}
            value={design.room.depth}
            min={120}
            max={2000}
            onChange={(depth) =>
              edit({ ...design, room: { ...design.room, depth } })
            }
          />
        </div>
        <div className="interior-quote-doors">
          {design.doors.map((p, i) => (
            <fieldset key={p.id}>
              <legend>
                {t("door")} {i + 1}
              </legend>
              <div className="interior-quote-heading">
                <Field label={t("doorRoomType")}>
                  <select
                    value={p.roomType}
                    onChange={(e) => {
                      const roomType = e.target
                        .value as InteriorDoor["roomType"];
                      doorEdit(p.id, { roomType, width: doorWidths[roomType] });
                    }}
                  >
                    {(["living", "bedroom", "bathroom"] as const).map((r) => (
                      <option key={r} value={r}>
                        {t(r)}
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  className="icon-button"
                  aria-label={`${t("removeDoor")} ${i + 1}`}
                  disabled={design.doors.length === 1}
                  onClick={() =>
                    edit({
                      ...design,
                      doors: design.doors.filter((d) => d.id !== p.id),
                    })
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="dimension-grid">
                <Field label={t("width")}>
                  <select
                    value={p.width}
                    onChange={(e) =>
                      doorEdit(p.id, {
                        width: Number(e.target.value) as 70 | 80 | 90,
                      })
                    }
                  >
                    {[70, 80, 90].map((n) => (
                      <option key={n} value={n}>
                        {n} cm
                      </option>
                    ))}
                  </select>
                </Field>
                <NumberField
                  label={t("leafHeight")}
                  value={p.height}
                  min={180}
                  max={240}
                  onChange={(height) =>
                    doorEdit(p.id, {
                      height,
                      frameHeight: Math.max(p.frameHeight, height + 5),
                    })
                  }
                />
                <NumberField
                  label={t("frameHeight")}
                  value={p.frameHeight}
                  min={p.height}
                  max={250}
                  onChange={(frameHeight) => doorEdit(p.id, { frameHeight })}
                />
                <NumberField
                  label={t("frameDepth")}
                  value={p.frameDepth}
                  min={10}
                  max={25}
                  onChange={(frameDepth) => doorEdit(p.id, { frameDepth })}
                />
              </div>
              <Field label={t("openingType")}>
                <select
                  value={p.opening}
                  onChange={(e) =>
                    doorEdit(p.id, {
                      opening: e.target.value as "left" | "right",
                    })
                  }
                >
                  <option value="left">{t("openingLeft")}</option>
                  <option value="right">{t("openingRight")}</option>
                </select>
              </Field>
            </fieldset>
          ))}
        </div>
        <button
          className="button secondary full"
          disabled={design.doors.length >= 20}
          onClick={() =>
            edit({ ...design, doors: [...design.doors, newQuoteDoor(style)] })
          }
        >
          <Plus size={18} />
          {t("addDoor")}
        </button>
      </details>
    </>
  );
  return (
    <main className="page interior-page interior-photo-page">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{brand.companyName}</div>
          <h1>{t("interior")}</h1>
          <p>{t("photoVisualizerSubtitle")}</p>
        </div>
        <span className="pill">
          {number(price.area, language, 1)} m² · {design.doors.length}{" "}
          {t("doorsCount")}
        </span>
      </div>
      <ErrorNotice message={error} onDismiss={() => setError(null)} />
      <div className="designer-grid">
        <section className="scene-panel">
          <div
            className="interior-room-tabs"
            role="group"
            aria-label={t("roomPreset")}
          >
            {(["hallway", "living", "bedroom"] as const).map((k) => (
              <button
                key={k}
                aria-pressed={design.preset === k}
                className={design.preset === k ? "active" : ""}
                onClick={() => edit(switchInteriorRoom(design, k))}
              >
                {t(k)}
              </button>
            ))}
          </div>
          <Suspense fallback={<p>{t("sceneLoading")}</p>}>
            <Scene
              design={design}
              catalog={catalog}
              capture={register}
              onReady={sceneReady}
            />
          </Suspense>
          <div className="interior-scene-caption">
            <span>{t("photoPanHint")}</span>
            <small>{t("photoIllustrative")}</small>
          </div>
        </section>
        <aside className="designer-controls">
          <button className="button secondary full" onClick={showResult}>
            {t(result ? "backToDesign" : "summary")}
            <ChevronRight size={16} />
          </button>
          {result ? (
            <>
              <h2>{t("parts")}</h2>
              {price.lines.map((l) => (
                <div className="product-line" key={l.id}>
                  <span>
                    {l.name}
                    <small>
                      {" "}
                      · {number(l.quantity, language)}
                      {l.unit === "m2" ? " m²" : l.unit === "m" ? " m" : ""}
                    </small>
                  </span>
                  <strong>{money(l.amount, language)}</strong>
                </div>
              ))}
              {design.offer && (
                <OfferFields
                  details={design.offer}
                  onChange={(offer) => edit({ ...design, offer })}
                />
              )}
              <Toggle
                label={t("exactPrice")}
                checked={design.exact}
                onChange={(exact) => edit({ ...design, exact })}
              />
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
                  aria-label={t("copyFallback")}
                  readOnly
                  value={link}
                />
              )}
              <SendAnyone
                title={brand.companyName}
                text={t("message", { link: "" })}
                url={url}
              />
            </>
          ) : (
            controls
          )}
          <div className="interior-price-options">
            <Toggle
              label={t("installation")}
              checked={design.installation}
              onChange={(installation) => edit({ ...design, installation })}
            />
            <Toggle
              label={t("vat")}
              checked={design.vat}
              onChange={(vat) => edit({ ...design, vat })}
            />
          </div>
          <button
            className="button secondary full"
            disabled={busy || !ready}
            onClick={pdf}
          >
            <Download size={18} />
            {t(busy ? "preparing" : "pdf")}
          </button>
          {pdfDownload?.signature === exportSignature && ready && (
            <a
              className="button secondary full"
              href={pdfDownload.url}
              download={`${brand.slug}-interior-offer.pdf`}
            >
              {t("pdfReady")}
            </a>
          )}
        </aside>
      </div>
      <div className="interior-total-bar">
        <div>
          <small>{t("estimate")}</small>
          <strong>
            {design.exact
              ? money(price.total, language)
              : `${money(price.low, language)} – ${money(price.high, language)}`}
          </strong>
          <span>
            {price.packs} {t("packs")} · {t("indicative")}
          </span>
        </div>
        <div className="interior-total-details">
          <span>
            {t("materials")}: {money(price.subtotal, language)}
          </span>
          <span>
            {t("installation")}: {money(price.installation, language)} ·{" "}
            {t("vat")}: {money(price.vat, language)}
          </span>
        </div>
        <button
          className="button"
          aria-label={t("pdf")}
          disabled={busy || !ready}
          onClick={pdf}
        >
          <Download size={18} />
          <span>{t("pdf")}</span>
        </button>
      </div>
    </main>
  );
}
