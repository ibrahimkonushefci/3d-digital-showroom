import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import { useBrand } from "../brand";
import { useT, label, useLanguage, type TranslationKey } from "../i18n";
import { presentationPresets, type ShowroomPreset } from "../designer3d/presets";
import { useDesigner } from "../designer3d/store";
import { calculatePrice, estimateLabel } from "../pricing";
import { loadDesign } from "../persistence";
import type { DesignDocument } from "../catalog/types";

/**
 * Home: a small furniture catalogue in front of the Showroom. A large
 * photograph of the first prepared room with one clear way in, the three
 * steps, the prepared kitchens and wardrobes as picture cards (each opens
 * its design in the Showroom) and the company's contact details. No 3D here:
 * the scene loads only when the Showroom opens.
 */
const HERO_IMAGE: Record<DesignDocument["kind"], string> = {
  kitchen: "shared/showroom/hero-kitchen.webp",
  wardrobe: "shared/showroom/hero-wardrobe.webp",
};

export default function Home() {
  const { brand, catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage(),
    navigate = useNavigate();
  const presets = useMemo(
    () =>
      presentationPresets(catalog).filter((p) =>
        p.design.kind === "kitchen"
          ? brand.modules.kitchenDesigner
          : brand.modules.wardrobeDesigner,
      ),
    [catalog, brand.modules],
  );
  const kitchens = presets.filter((p) => p.design.kind === "kitchen");
  const wardrobes = presets.filter((p) => p.design.kind === "wardrobe");
  const featured = presets[0];
  // A design this device already worked on: offered as "continue".
  const recent = useMemo(() => {
    try {
      const kind = localStorage.getItem(`showroom-recent-${brand.slug}`);
      if (kind !== "kitchen" && kind !== "wardrobe") return null;
      return loadDesign(brand.slug, kind, catalog);
    } catch {
      return null;
    }
  }, [brand.slug, catalog]);
  const open = (preset: ShowroomPreset) => {
    useDesigner.getState().setDesign(preset.design);
    useDesigner.getState().setCameraView(preset.camera);
    navigate("/designer/" + preset.design.kind + location.search);
  };
  const price = (design: DesignDocument) =>
    estimateLabel(
      calculatePrice(design, catalog, language),
      design.exact,
      language,
    );
  const contact = brand.contact;
  const contacts = [
    contact.phone && {
      icon: Phone,
      text: contact.phone,
      href: "tel:" + contact.phone.replace(/\s/g, ""),
    },
    contact.whatsapp && {
      icon: MessageCircle,
      text: "WhatsApp",
      href: "https://wa.me/" + contact.whatsapp.replace(/[^\d]/g, ""),
    },
    contact.email && {
      icon: Mail,
      text: contact.email,
      href: "mailto:" + contact.email,
    },
    (contact.address || contact.city) && {
      icon: MapPin,
      text: [contact.address, contact.city].filter(Boolean).join(", "),
    },
  ].filter(Boolean) as Array<{
    icon: typeof Phone;
    text: string;
    href?: string;
  }>;

  if (!featured)
    return (
      <main className="home page">
        <p className="empty-state">{t("noFurniture")}</p>
      </main>
    );
  return (
    <main className="home page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div>
            <div className="eyebrow">
              <span />
              {t("homeEyebrow")}
            </div>
            <h1>{t("homeTitle")}</h1>
          </div>
          <div className="home-hero-side">
            <p>{t("homeBody")}</p>
            <div className="home-hero-actions">
              <button
                type="button"
                className="button primary home-cta"
                onClick={() => open(featured)}
              >
                {t("enterShowroom")}
                <ArrowRight size={18} />
              </button>
              {recent && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    navigate("/designer/" + recent.kind + location.search)
                  }
                >
                  {t("continueDesign")}
                </button>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="home-hero-picture"
          onClick={() => open(featured)}
          aria-label={t("enterShowroom")}
        >
          <img
            src={"/" + HERO_IMAGE[featured.design.kind]}
            alt=""
            fetchPriority="high"
          />
        </button>
      </section>

      <ol className="home-steps" aria-label={t("howItWorks")}>
        {(["1", "2", "3"] as const).map((n) => (
          <li key={n}>
            <span className="home-step-number">0{n}</span>
            <div>
              <strong>{t(("step" + n + "Title") as TranslationKey)}</strong>
              <p>{t(("step" + n + "Body") as TranslationKey)}</p>
            </div>
          </li>
        ))}
      </ol>

      {[
        { key: "kitchens", intro: "kitchensIntro", items: kitchens },
        { key: "wardrobes", intro: "wardrobesIntro", items: wardrobes },
      ]
        .filter((group) => group.items.length)
        .map((group) => (
          <section
            key={group.key}
            className="home-collection"
            id={group.key}
            aria-labelledby={"home-" + group.key}
          >
            <div className="home-collection-heading">
              <div>
                <h2 id={"home-" + group.key}>
                  {t(group.key as TranslationKey)}
                </h2>
                <p>{t(group.intro as TranslationKey)}</p>
              </div>
              <span className="home-collection-note">
                {t("estimateNote")}
              </span>
            </div>
            <div
              className={
                "home-cards" + (group.items.length < 3 ? " two" : "")
              }
            >
              {group.items.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  // Name first in the markup (read first by screen readers
                  // and review scripts); the picture shows above it.
                  className="home-card"
                  onClick={() => open(preset)}
                >
                  <span className="home-card-body">
                    <strong>{label(preset.name, language)}</strong>
                    <span className="home-card-meta">
                      {t(preset.design.layout)} · {preset.design.room.width} ×{" "}
                      {preset.design.room.depth} cm
                    </span>
                    <span className="home-card-price">
                      <span>{t("shownPrice")}</span>
                      {price(preset.design)}
                    </span>
                  </span>
                  <span className="home-card-image">
                    <img src={"/" + preset.thumbnail} alt="" loading="lazy" />
                    <span className="home-card-open">
                      {t("openInShowroom")}
                      <ArrowUpRight size={15} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}

      {wardrobes[0] && kitchens[0] && (
        <section className="home-band">
          <img
            src={"/" + HERO_IMAGE.wardrobe}
            alt={label(wardrobes[0].name, language)}
            loading="lazy"
          />
          <div className="home-band-copy">
            <h2>{t("showroomBandTitle")}</h2>
            <p>{t("showroomBandBody")}</p>
            <button
              type="button"
              className="button primary"
              onClick={() => open(wardrobes[0])}
            >
              {t("enterShowroom")}
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      )}

      <section className="home-contact">
        <div>
          <h2>{t("contactTitle")}</h2>
          <p>{t("contactBody")}</p>
        </div>
        <div className="home-contact-details">
          <strong>{brand.companyName}</strong>
          {contacts.map(({ icon: Icon, text, href }) =>
            href ? (
              <a key={text} href={href}>
                <Icon size={16} />
                {text}
              </a>
            ) : (
              <span key={text}>
                <Icon size={16} />
                {text}
              </span>
            ),
          )}
        </div>
      </section>
    </main>
  );
}
