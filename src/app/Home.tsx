import { useLayoutEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { type ShowroomPreset } from "../designer3d/presets";
import { homeCatalog } from "./homeCatalog";
import { useDesigner } from "../designer3d/store";
import { calculatePrice, estimateLabel } from "../pricing";
import { loadDesign } from "../persistence";
import type { DesignDocument } from "../catalog/types";
import { usePreferences } from "./preferences";
import HomeShowroomChooser, { useHomeShowroom } from "./HomeShowroomChooser";
import "./home.css";

/** The Room Edit: a picture-led catalogue. Only selecting a room loads 3D. */
export default function Home() {
  const { brand, catalog } = useBrand();
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const appearance = usePreferences((state) => state.homeAppearance);
  const presets = useMemo(
    () =>
      homeCatalog(catalog).filter((preset) =>
        preset.design.kind === "kitchen"
          ? brand.modules.kitchenDesigner
          : brand.modules.wardrobeDesigner,
      ),
    [catalog, brand.modules],
  );
  const kitchens = presets.filter((preset) => preset.design.kind === "kitchen");
  const wardrobes = presets.filter(
    (preset) => preset.design.kind === "wardrobe",
  );
  const island = kitchens.find((preset) => preset.id === "classic");
  const inside = wardrobes.find((preset) => preset.id === "wardrobe-straight");
  const hero = island || kitchens[0] || wardrobes[0];
  const detail = inside || (kitchens.length ? wardrobes[0] : undefined);
  const recent = useMemo(() => {
    try {
      const kind = localStorage.getItem(`showroom-recent-${brand.slug}`);
      if (
        (kind === "kitchen" && brand.modules.kitchenDesigner) ||
        (kind === "wardrobe" && brand.modules.wardrobeDesigner)
      )
        return loadDesign(brand.slug, kind, catalog);
    } catch {
      /* A catalogue remains useful when device storage is unavailable. */
    }
    return null;
  }, [brand.slug, brand.modules, catalog]);
  useLayoutEffect(() => {
    document.documentElement.dataset.homeAppearance = appearance;
    return () => {
      delete document.documentElement.dataset.homeAppearance;
    };
  }, [appearance]);
  useLayoutEffect(() => {
    useHomeShowroom.getState().setMounted(true);
    return () => {
      useHomeShowroom.getState().close();
      useHomeShowroom.getState().setMounted(false);
    };
  }, []);

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
  const size = (design: DesignDocument) =>
    design.layout === "l" || design.layout === "corner"
      ? t("homeSides", { first: design.room.width, second: design.room.depth })
      : `${t(design.kind === "kitchen" ? "kitchenWidth" : "wardrobeWidth")} ${design.room.width} cm`;
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

  return (
    <main className="home page" id="home-top">
      {!hero ? (
        <p className="empty-state">{t("noFurniture")}</p>
      ) : (
        <>
          <section className="home-edit-hero">
            <div className="home-edit-copy">
              <p className="home-eyebrow">
                {t("homeEyebrow", { count: presets.length })}
              </p>
              <h1>
                {t("homeTitle")}
                <br />
                <em>{t("homeTitleAccent")}</em>
              </h1>
              <p className="home-edit-intro">
                {t("homeBody")} <br />
                {t("homeBodySecond")}
              </p>
              <button
                type="button"
                className="home-primary"
                onClick={useHomeShowroom.getState().open}
              >
                {t("homeExploreShowroom")} <ArrowUpRight size={21} />
              </button>
              {recent && (
                <button
                  type="button"
                  className="home-continue"
                  onClick={() =>
                    navigate("/designer/" + recent.kind + location.search)
                  }
                >
                  {t("continueDesign")} <ArrowRight size={14} />
                </button>
              )}
              <div className="home-category-links">
                {kitchens.length > 0 && (
                  <a href="#kitchens">
                    {t("kitchens")}{" "}
                    <small>{String(kitchens.length).padStart(2, "0")}</small> ↓
                  </a>
                )}
                {wardrobes.length > 0 && (
                  <a href="#wardrobes">
                    {t("wardrobes")}{" "}
                    <small>{String(wardrobes.length).padStart(2, "0")}</small> ↓
                  </a>
                )}
              </div>
            </div>
            <div className="home-edit-composition">
              <button
                type="button"
                className="home-hero-room"
                onClick={() => open(hero)}
                aria-label={`${label(hero.name, language)} — ${t("openInShowroom")}`}
              >
                <img
                  className="home-edit-main-image"
                  src={
                    island
                      ? "/shared/showroom/home-island-front.webp"
                      : "/" + hero.thumbnail
                  }
                  alt={label(hero.name, language)}
                  fetchPriority="high"
                />
                <span>
                  {t("homeExploreRoom")}
                  <ArrowUpRight size={18} />
                </span>
              </button>
              {detail && (
                <button
                  type="button"
                  className="home-edit-detail"
                  onClick={() => open(detail)}
                  aria-label={`${label(detail.name, language)} — ${t("openInShowroom")}`}
                >
                  <img
                    src={
                      inside
                        ? "/shared/showroom/home-wardrobe-interior.webp"
                        : "/" + detail.thumbnail
                    }
                    alt={
                      inside
                        ? t("homeWardrobeInterior")
                        : label(detail.name, language)
                    }
                  />
                  <span>{t("homeDetailCaption")}</span>
                </button>
              )}
              <span className="home-image-caption">
                {t("homeImageCaption")}
              </span>
            </div>
          </section>
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
                  <h2 id={"home-" + group.key}>
                    {t(group.key as TranslationKey)}{" "}
                    <sup>{String(group.items.length).padStart(2, "0")}</sup>
                  </h2>
                  <p>{t(group.intro as TranslationKey)}</p>
                </div>
                <div className="home-cards">
                  {group.items.map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      className="home-card"
                      data-preset={preset.id}
                      onClick={() => open(preset)}
                      aria-label={`${label(preset.name, language)} — ${size(preset.design)} — ${t("shownPrice")} ${price(preset.design)} — ${t("openInShowroom")}`}
                    >
                      <span className="home-card-image">
                        <img
                          src={"/" + preset.thumbnail}
                          alt=""
                          loading="lazy"
                        />
                      </span>
                      <span className="home-card-body">
                        <span className="home-card-heading">
                          <strong>{label(preset.name, language)}</strong>
                          <ArrowUpRight size={20} />
                        </span>
                        <span className="home-card-meta">
                          {t(preset.design.layout)}
                          {preset.id.startsWith("home-") && (
                            <> · {t("homeFinishEdition")}</>
                          )}
                        </span>
                        <span className="home-card-meta">
                          {size(preset.design)}
                        </span>
                        <span className="home-card-price">
                          <span>{t("shownPrice")}</span>
                          {price(preset.design)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          <section
            className="home-materials"
            id="materials"
            aria-labelledby="home-materials-title"
          >
            <div className="home-collection-heading">
              <h2 id="home-materials-title">{t("exploreMaterials")}</h2>
              <p>{t("homeMaterialsIntro")}</p>
            </div>
            <div className="home-material-cards">
              {kitchens.length > 0 && (
                <Link
                  to={"/material-switcher" + location.search}
                  className="home-material-card"
                >
                  <img
                    src="/shared/previews/look-sage.webp"
                    alt=""
                    loading="lazy"
                  />
                  <div>
                    <span className="home-eyebrow">{t("homeLivePreview")}</span>
                    <h3>{t("kitchenMaterials")}</h3>
                    <p>{t("homeKitchenMaterialsBody")}</p>
                    <span className="home-material-action">
                      {t("homeTryMaterials")}
                      <ArrowUpRight size={20} />
                    </span>
                  </div>
                </Link>
              )}
              {wardrobes.length > 0 && (
                <Link
                  to={"/wardrobe-materials" + location.search}
                  className="home-material-card"
                >
                  <img
                    src="/shared/showroom/home-wardrobe-interior.webp"
                    alt=""
                    loading="lazy"
                  />
                  <div>
                    <span className="home-eyebrow">{t("homeLivePreview")}</span>
                    <h3>{t("wardrobeMaterials")}</h3>
                    <p>{t("homeWardrobeMaterialsBody")}</p>
                    <span className="home-material-action">
                      {t("homeTryMaterials")}
                      <ArrowUpRight size={20} />
                    </span>
                  </div>
                </Link>
              )}
            </div>
          </section>
          <div className="home-quiet-guide" aria-label={t("howItWorks")}>
            <span>{t("homeYourRoom")}</span>
            <ol>
              <li>{t("step1Title")}</li>
              <li>{t("homeGuideAdjust")}</li>
              <li>{t("homeGuideOffer")}</li>
            </ol>
          </div>
        </>
      )}
      <section className="home-contact" aria-label={t("contactTitle")}>
        <div>
          <strong>{brand.companyName}</strong>
          <p>{t("homeBrandLine")}</p>
        </div>
        {contacts.length > 0 && (
          <div className="home-contact-details">
            {contacts.map(({ icon: Icon, text, href }) =>
              href ? (
                <a key={text} href={href}>
                  <Icon size={14} />
                  {text}
                </a>
              ) : (
                <span key={text}>
                  <Icon size={14} />
                  {text}
                </span>
              ),
            )}
          </div>
        )}
        <a
          className="home-back-top"
          href="#site-top"
          onClick={(event) => {
            event.preventDefault();
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
            });
          }}
        >
          {t("homeBackTop")} ↑
        </a>
      </section>
      <HomeShowroomChooser presets={presets} onSelect={open} />
    </main>
  );
}
