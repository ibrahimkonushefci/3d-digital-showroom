import {
  useState,
  useEffect,
  useRef,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { useBrand } from "../brand";
import { useT, useLanguage, label, money, number } from "../i18n";
import { Field, NumberField, Toggle, ErrorNotice } from "../app/components";
import { OfferFields } from "../app/OfferFields";
import { SendAnyone } from "../app/SendAnyone";
import { shareUrl, messageUrl } from "../sharing";
import { newOffer } from "../documents/details";
import { useInterior, loadInterior } from "./store";
import { interiorPrice } from "./pricing";
import { newInterior, validInterior } from "./layout";
import type { InteriorDesign, InteriorDoor } from "./types";
const Scene = lazy(() => import("./Scene"));
export default function InteriorDesigner() {
  const { brand, catalog, local, logoUrl } = useBrand(),
    t = useT(),
    { language } = useLanguage(),
    { design, set } = useInterior();
  const [selected, select] = useState<string | null>(null),
    [opened, setOpened] = useState<string[]>([]),
    [preset, setPreset] = useState("perspective"),
    [move, setMove] = useState(0),
    [result, setResult] = useState(false),
    [error, setError] = useState<string | null>(null),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false);
  const capture = useRef<() => Promise<string>>(null),
    register = useCallback((fn: () => Promise<string>) => {
      capture.current = fn;
    }, []);
  useEffect(() => {
    if (!useInterior.getState().design) set(loadInterior(brand.slug, catalog));
  }, [brand.slug, catalog]);
  useEffect(() => {
    if (design)
      try {
        localStorage.setItem(
          `showroom-interior-${brand.slug}`,
          JSON.stringify(design),
        );
      } catch {
        /* optional device storage */
      }
  }, [design, brand.slug]);
  if (!design) return <div className="startup">{t("sceneLoading")}</div>;
  const price = interiorPrice(design, catalog, language),
    active = design.doors.find((p) => p.id === selected) || design.doors[0],
    floor = catalog.laminates.find((f) => f.id === design.laminateId)!,
    url = shareUrl(design, brand, catalog.id, local);
  const edit = (d: InteriorDesign) => {
    if (validInterior(d, catalog)) {
      set(d);
      setError(null);
    } else setError("fitError");
  };
  const doorEdit = (v: Partial<InteriorDoor>) =>
    edit({
      ...design,
      doors: design.doors.map((p) => (p.id === active.id ? { ...p, ...v } : p)),
    });
  const resize = (key: "width" | "depth" | "height", v: number) => {
    const room = {
      ...design.room,
      [key]: Math.max(
        key === "height" ? 220 : 120,
        Math.min(key === "height" ? 400 : 1200, v),
      ),
    };
    edit({
      ...design,
      room,
      doors: design.doors.map((p) => ({
        ...p,
        offset: Math.max(
          0,
          Math.min(
            p.offset,
            (["left", "right"].includes(p.wall) ? room.depth : room.width) -
              p.width,
          ),
        ),
      })),
    });
  };
  const toggleDoor = (id: string) => {
    if (id === selected)
      setOpened((o) =>
        o.includes(id) ? o.filter((i) => i !== id) : [...o, id],
      );
    else select(id);
  };
  const showResult = () => {
    if (!design.offer)
      set({ ...design, offer: newOffer(brand, catalog, language) });
    setResult(!result);
  };
  const pdf = async () => {
    setBusy(true);
    try {
      const { createOffer } = await import("../documents/offer");
      const doc = await createOffer({
        design,
        brand,
        catalog,
        language,
        screenshot: (await capture.current?.().catch(() => null)) || null,
        logoUrl,
        t,
        priceOverride: price,
        description: `${t("interior")} · ${t(design.preset)} · ${number(price.area, language, 1)} m²`,
      });
      doc.save(`${brand.slug}-interior-offer.pdf`);
    } catch {
      setError("exportError");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page interior-page">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{brand.companyName}</div>
          <h1>{t("interior")}</h1>
        </div>
        <span className="pill">
          {number(price.area, language, 1)} m² · {price.packs} {t("packs")}
        </span>
      </div>
      <ErrorNotice message={error} onDismiss={() => setError(null)} />
      <div className="designer-grid">
        <section className="scene-panel">
          <div className="scene-toolbar">
            {(["perspective", "top", "walkthrough"] as const).map((k) => (
              <button
                key={k}
                className="button secondary"
                onClick={() => setPreset(k)}
              >
                {t(k)}
              </button>
            ))}
            {preset === "walkthrough" && (
              <>
                <button
                  className="button secondary"
                  onClick={() => setMove((v) => v + 1)}
                >
                  {t("walkForward")}
                </button>
                <button
                  className="button secondary"
                  onClick={() => setMove((v) => v - 1)}
                >
                  {t("walkBack")}
                </button>
              </>
            )}
          </div>
          <div className="designer-canvas">
            <Suspense fallback={<p>{t("sceneLoading")}</p>}>
              <Scene
                design={design}
                catalog={catalog}
                selected={selected}
                opened={opened}
                onDoor={toggleDoor}
                preset={preset}
                move={move}
                capture={register}
              />
            </Suspense>
          </div>
          <p className="helper">{t("interiorHint")}</p>
        </section>
        <aside className="designer-controls">
          <button className="button secondary full" onClick={showResult}>
            {t(result ? "backToDesign" : "summary")}
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
              {design.installation && (
                <>
                  <div className="product-line">
                    <span>{t("floorInstallation")}</span>
                    <strong>{money(price.floorInstallation, language)}</strong>
                  </div>
                  <div className="product-line">
                    <span>{t("doorInstallation")}</span>
                    <strong>{money(price.doorInstallation, language)}</strong>
                  </div>
                </>
              )}
              {design.offer && (
                <OfferFields
                  details={design.offer}
                  onChange={(offer) => edit({ ...design, offer })}
                />
              )}
              <Toggle
                label={t("installation")}
                checked={design.installation}
                onChange={(v) => edit({ ...design, installation: v })}
              />
              <Toggle
                label={t("vat")}
                checked={design.vat}
                onChange={(v) => edit({ ...design, vat: v })}
              />
              <Toggle
                label={t("exactPrice")}
                checked={design.exact}
                onChange={(v) => edit({ ...design, exact: v })}
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
              <button
                className="button primary full"
                onClick={() =>
                  window.open(
                    messageUrl(
                      "whatsapp",
                      brand,
                      `${t("bookingMessage")} ${Object.values(design.offer?.customer || {}).join(" · ")}\n${price.lines.map((l) => l.name).join("\n")}`,
                    ),
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                {t("bookMeasure")}
              </button>
            </>
          ) : (
            <>
              <Field label={t("roomPreset")}>
                <select
                  value={design.preset}
                  onChange={(e) => {
                    set(
                      newInterior(
                        catalog,
                        e.target.value as InteriorDesign["preset"],
                      ),
                    );
                    select(null);
                    setOpened([]);
                  }}
                >
                  {(["hallway", "living", "bedroom"] as const).map((k) => (
                    <option key={k} value={k}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="dimension-grid">
                <NumberField
                  label={t("width")}
                  value={design.room.width}
                  min={120}
                  onChange={(v) => resize("width", v)}
                />
                <NumberField
                  label={t("length")}
                  value={design.room.depth}
                  min={120}
                  onChange={(v) => resize("depth", v)}
                />
                <NumberField
                  label={t("height")}
                  value={design.room.height}
                  min={220}
                  onChange={(v) => resize("height", v)}
                />
              </div>
              <Field label={t("quickCombos")}>
                <select
                  value=""
                  onChange={(e) => {
                    const p = catalog.quickCombos.find(
                      (p) => p.id === e.target.value,
                    )!;
                    edit({
                      ...design,
                      laminateId: p.laminateId,
                      doors: design.doors.map((d) => ({
                        ...d,
                        finishId: p.doorFinishId,
                        finishTier: p.finishTier,
                      })),
                    });
                  }}
                >
                  <option value="" disabled>
                    {t("quickCombos")}
                  </option>
                  {catalog.quickCombos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {label(p.name, language)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("laminate")}>
                <select
                  value={design.laminateId}
                  onChange={(e) =>
                    edit({ ...design, laminateId: e.target.value })
                  }
                >
                  {catalog.laminates.map((f) => (
                    <option key={f.id} value={f.id}>
                      {label(f.name, language)} ·{" "}
                      {money(f.pricePerM2, language)}/m²
                    </option>
                  ))}
                </select>
              </Field>
              <p className="helper">
                {floor.class} · {floor.thickness} mm ·{" "}
                {number(floor.plankLength, language)} ×{" "}
                {number(floor.plankWidth, language)} cm ·{" "}
                {number(floor.m2PerPack, language)} m²/{t("packs")} · 4V{" "}
                {floor.groove ? "✓" : "—"}
              </p>
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
                  {(["straight", "diagonal", "herringbone"] as const).map(
                    (k) => (
                      <option key={k} value={k}>
                        {t(k === "straight" ? "straightPattern" : k)} ·{" "}
                        {catalog.interiorPricing!.waste[k] * 100}% {t("waste")}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Toggle
                label={t("floorDirection")}
                checked={design.direction}
                onChange={(v) => edit({ ...design, direction: v })}
              />
              <Toggle
                label={t("underlay")}
                checked={design.underlay}
                onChange={(v) => edit({ ...design, underlay: v })}
              />
              <Field label={t("skirting")}>
                <select
                  value={design.skirtingId}
                  onChange={(e) =>
                    edit({ ...design, skirtingId: e.target.value })
                  }
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
              <details open>
                <summary>{t("door")}</summary>
                <Field label={t("selection")}>
                  <select
                    value={active.id}
                    onChange={(e) => select(e.target.value)}
                  >
                    {design.doors.map((p, i) => (
                      <option key={p.id} value={p.id}>
                        {t("door")} {i + 1}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("model")}>
                  <select
                    value={active.modelId}
                    onChange={(e) => doorEdit({ modelId: e.target.value })}
                  >
                    {catalog.interiorDoors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {label(m.name, language)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("finish")}>
                  <select
                    value={active.finishTier}
                    onChange={(e) => doorEdit({ finishTier: e.target.value })}
                  >
                    {catalog.interiorFinishes.map((m) => (
                      <option key={m.id} value={m.id}>
                        {label(m.name, language)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("color")}>
                  <select
                    value={active.finishId}
                    onChange={(e) => doorEdit({ finishId: e.target.value })}
                  >
                    {catalog.productFinishes.map((f) => (
                      <option key={f.id} value={f.id}>
                        {label(f.name, language)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("handle")}>
                  <select
                    value={active.handleId}
                    onChange={(e) => doorEdit({ handleId: e.target.value })}
                  >
                    {catalog.interiorHandles.map((h) => (
                      <option key={h.id} value={h.id}>
                        {label(h.name, language)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("width")}>
                  <select
                    value={active.width}
                    onChange={(e) =>
                      doorEdit({
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
                <Field label={t("openingType")}>
                  <select
                    value={active.opening}
                    onChange={(e) =>
                      doorEdit({ opening: e.target.value as "left" | "right" })
                    }
                  >
                    <option value="left">{t("openingLeft")}</option>
                    <option value="right">{t("openingRight")}</option>
                  </select>
                </Field>
                <Toggle
                  label={t("hiddenHinges")}
                  checked={active.hiddenHinges}
                  onChange={(v) => doorEdit({ hiddenHinges: v })}
                />
                <button
                  className="button secondary full"
                  onClick={() => {
                    select(active.id);
                    setOpened((o) =>
                      o.includes(active.id)
                        ? o.filter((i) => i !== active.id)
                        : [...o, active.id],
                    );
                  }}
                >
                  {t("openClose")}
                </button>
                <button
                  className="button secondary full"
                  onClick={() =>
                    edit({
                      ...design,
                      doors: design.doors.map((p) => ({
                        ...active,
                        id: p.id,
                        wall: p.wall,
                        offset: p.offset,
                      })),
                    })
                  }
                >
                  {t("applyAll")}
                </button>
              </details>
              <Toggle
                label={t("furniture")}
                checked={design.furniture}
                onChange={(v) => edit({ ...design, furniture: v })}
              />
              <Toggle
                label={t("evening")}
                checked={design.evening}
                onChange={(v) => edit({ ...design, evening: v })}
              />
            </>
          )}
          <div className="price-sticky">
            <span>{t("estimate")}</span>
            <strong>
              {design.exact
                ? money(price.total, language)
                : `${money(price.low, language)} – ${money(price.high, language)}`}
            </strong>
            <small>
              {price.packs} {t("packs")} · {t("indicative")}
            </small>
          </div>
        </aside>
      </div>
    </main>
  );
}
