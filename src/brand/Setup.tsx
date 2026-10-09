import { usePresentation } from "../app/preferences";
import { useState, useRef } from "react";
import { Upload, Download, Check, LockKeyhole } from "lucide-react";
import { BrandSchema, type BrandConfig } from "../catalog/types";
import { useBrand } from ".";
import { useT } from "../i18n";
import { Field, ErrorNotice } from "../app/components";
import { downloadBlob, imageToPng } from "../documents/offer";
export default function Setup() {
  const ctx = useBrand(),
    t = useT();
  const presentation = usePresentation(ctx.brand);
  const [unlocked, setUnlocked] = useState(false),
    [pin, setPin] = useState(""),
    [draft, setDraft] = useState<BrandConfig>({
      ...ctx.brand,
      catalogId: ctx.catalog.id,
    }),
    [logo, setLogo] = useState(ctx.logoUrl),
    [colors, setColors] = useState<string[]>([]),
    [notice, setNotice] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const change = (key: "slug" | "companyName" | "tagline", value: string) =>
    setDraft({ ...draft, [key]: value });
  const editedContacts = useRef(new Set<string>());
  const contact = (key: keyof BrandConfig["contact"], value: string) => {
    if (key === "whatsapp" || key === "viber") editedContacts.current.add(key);
    setDraft((d) => ({
      ...d,
      contact: {
        ...d.contact,
        [key]: value,
        ...(key === "phone"
          ? Object.fromEntries(
              ["whatsapp", "viber"]
                .filter((k) => !editedContacts.current.has(k))
                .map((k) => [k, value]),
            )
          : {}),
      },
    }));
  };
  const upload = async (file: File) => {
    try {
      if (file.size > 8 * 1024 * 1024) throw Error();
      const url = URL.createObjectURL(file);
      try {
        const png = await imageToPng(url);
        setLogo(png);
        const img = new Image();
        img.src = png;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 60;
        const c = canvas.getContext("2d")!;
        c.drawImage(img, 0, 0, 60, 60);
        const pixels = c.getImageData(0, 0, 60, 60).data;
        const buckets = new Map<string, number>();
        for (let i = 0; i < pixels.length; i += 4) {
          if (
            pixels[i + 3] < 128 ||
            (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 235 &&
              Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 210)
          )
            continue;
          const hex =
            "#" +
            [pixels[i], pixels[i + 1], pixels[i + 2]]
              .map((v) =>
                Math.min(255, Math.round(v / 32) * 32)
                  .toString(16)
                  .padStart(2, "0"),
              )
              .join("");
          buckets.set(hex, (buckets.get(hex) || 0) + 1);
        }
        setColors(
          [...buckets]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([hex]) => hex),
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setNotice("invalidBrand");
    }
  };
  const validated = () =>
    BrandSchema.parse({
      ...draft,
      logo: "logo.png",
      catalogId: ctx.catalog.id,
      demo: false,
      presentationMode: true,
    });
  const use = () => {
    try {
      ctx.setLocal(validated(), logo);
      setNotice("brandSaved");
    } catch (e) {
      setNotice(
        e instanceof Error && e.message === "storageError"
          ? "storageError"
          : "invalidBrand",
      );
    }
  };
  const exportZip = async () => {
    setBusy(true);
    try {
      const brand = validated();
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip(),
        folder = zip.folder(brand.slug)!;
      folder.file(
        "brand.json",
        JSON.stringify({ ...brand, catalogId: brand.slug }, null, 2),
      );
      folder.file(
        "catalog.json",
        JSON.stringify({ ...ctx.catalog, id: brand.slug }, null, 2),
      );
      const png = await imageToPng(logo);
      folder.file("logo.png", png.split(",")[1], { base64: true });
      downloadBlob(
        await zip.generateAsync({ type: "blob" }),
        brand.slug + "-brand.zip",
      );
    } catch {
      setNotice("invalidBrand");
    } finally {
      setBusy(false);
    }
  };
  if (!unlocked)
    return (
      <main className="page pin-page">
        <LockKeyhole size={32} />
        <h1>{t("brandSetup")}</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pin === (import.meta.env.VITE_SETUP_PIN || "2468")) {
              setUnlocked(true);
              setNotice(null);
            } else setNotice("wrongPin");
          }}
        >
          <Field label={t("pin")}>
            <input
              aria-label={t("pin")}
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </Field>
          <button className="button primary full">{t("unlock")}</button>
        </form>
        {!presentation && <p className="helper">{t("pinNotice")}</p>}
        <ErrorNotice message={notice} />
      </main>
    );
  return (
    <main className="page setup-page">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{t("madeForYou")}</div>
          <h1>{t("brandSetup")}</h1>
          <p>{t("setupHelp")}</p>
        </div>
      </div>
      <div className="setup-grid">
        <section className="setup-form">
          <div className="logo-upload">
            <img src={logo} alt="" />
            <label className="button secondary">
              <Upload size={17} />
              {t("uploadLogo")}
              <input
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) =>
                  e.target.files?.[0] && upload(e.target.files[0])
                }
              />
            </label>
          </div>
          <div className="form-grid">
            {(["companyName", "slug", "tagline"] as const).map((k) => (
              <Field key={k} label={t(k)}>
                <input
                  value={draft[k]}
                  onChange={(e) => change(k, e.target.value)}
                />
              </Field>
            ))}
            {(
              [
                "phone",
                "whatsapp",
                "viber",
                "city",
                "email",
                "address",
              ] as const
            ).map((k) => (
              <Field key={k} label={t(k)}>
                <input
                  value={draft.contact[k]}
                  onChange={(e) => contact(k, e.target.value)}
                />
              </Field>
            ))}
          </div>
          <div className="color-fields">
            {(["primary", "accent"] as const).map((k) => (
              <Field key={k} label={t(k)}>
                <div>
                  <input
                    type="color"
                    aria-label={t(k)}
                    value={draft.colors[k]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        colors: { ...draft.colors, [k]: e.target.value },
                      })
                    }
                  />
                  <span>{draft.colors[k]}</span>
                </div>
              </Field>
            ))}
          </div>
          {colors.length > 0 && (
            <div>
              <h3>{t("suggestedColors")}</h3>
              <div className="suggested-colors">
                {colors.map((c) => (
                  <button
                    key={c}
                    aria-label={c}
                    title={c}
                    style={{ background: c }}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        colors: { ...draft.colors, primary: c },
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}
          <div className="two-buttons">
            <button className="button primary" onClick={use}>
              <Check size={18} />
              {t("useDevice")}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={exportZip}
            >
              <Download size={18} />
              {t(busy ? "preparing" : "exportBrand")}
            </button>
          </div>
          {notice && (
            <div className="notice" role="status">
              {t(notice as Parameters<typeof t>[0])}
            </div>
          )}
          {!presentation && <p className="helper">{t("sharedBrandNote")}</p>}
        </section>
        <section
          className="brand-preview"
          style={
            {
              "--primary": draft.colors.primary,
              "--accent": draft.colors.accent,
            } as React.CSSProperties
          }
        >
          <span className="eyebrow">{t("livePreview")}</span>
          <div className="preview-brand-header">
            <img src={logo} alt="" />
            <strong>{draft.companyName}</strong>
          </div>
          <img className="preview-kitchen" src="/shared/kitchen.svg" alt="" />
          <h2>{t("heroTitle")}</h2>
          <p>{draft.tagline}</p>
          <div className="button primary">{t("startDesign")}</div>
          <small>
            {draft.contact.phone} · {draft.contact.city}
          </small>
        </section>
      </div>
    </main>
  );
}
