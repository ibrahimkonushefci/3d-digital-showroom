import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowRight, MoveUpRight } from "lucide-react";
import { useBrand } from "../brand";
import { useT, label, useLanguage, type TranslationKey } from "../i18n";
import { portalPresentation } from "../doorPreview/presentation";
import { presentationPresets } from "../designer3d/presets";
import { useDesigner } from "../designer3d/store";
const Scene = lazy(() => import("../designer3d/Scene"));
const House = lazy(() => import("../doorPreview/House"));
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
  const exterior = useMemo(
    () => (catalog.doors.length ? portalPresentation(catalog) : null),
    [catalog],
  );
  const designs = presets.map((p) => p.design);
  const [front, setFront] = useState("");
  const furniture =
    (brand.modules.kitchenDesigner || brand.modules.wardrobeDesigner) &&
    designs.length > 0;
  const featured = designs[0];
  const hero = {
    ...featured,
    style: {
      ...featured?.style,
      front: catalog.fronts.some((m) => m.id === front)
        ? front
        : featured?.style.front,
    },
  };
  const tools = [
    {
      key: "kitchens",
      desc: "kitchenDescription",
      route: "/designer/kitchen",
      enabled: brand.modules.kitchenDesigner,
      img: "kitchen",
    },
    {
      key: "wardrobes",
      desc: "wardrobeDescription",
      route: "/designer/wardrobe",
      enabled: brand.modules.wardrobeDesigner,
      img: "wardrobe",
    },
    {
      key: "interior",
      desc: "interiorDescription",
      route: "/designer/interior",
      enabled: brand.modules.interiorDesigner,
      img: "interior",
    },
    {
      key: "doorsWindows",
      desc: "doorDescription",
      route: "/preview",
      enabled: brand.modules.doorPreview,
      img: "door",
    },
  ].filter((x) => x.enabled);
  const load = (i: number) => {
    useDesigner.getState().setDesign(designs[i]);
    useDesigner.getState().setCameraView(presets[i].camera);
    navigate("/designer/" + designs[i].kind + location.search);
  };
  return (
    <main className="home page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span />
            {t("heroEyebrow")}
          </div>
          <h1>{t("heroTitle")}</h1>
          <p>{t("heroBody")}</p>
          <div className="quick-tools">
            {tools.map((tool) => (
              <Link key={tool.key} to={tool.route + location.search}>
                <span>{t(tool.key as TranslationKey)}</span>
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </div>
          <div className="hero-meta">
            <span>01 — {String(tools.length).padStart(2, "0")}</span>
            <span>{t("madeForYou")}</span>
          </div>
        </div>
        <div className="hero-scene">
          {furniture && featured ? (
            <Suspense
              fallback={
                <img
                  className="hero-loading-preview"
                  src={"/" + presets[0]?.thumbnail}
                  alt={t("sceneLoading")}
                />
              }
            >
              <Scene
                design={hero}
                catalog={catalog}
                cameraView={presets[0]?.camera}
              />
            </Suspense>
          ) : (
            <Suspense
              fallback={
                <img
                  className="hero-loading-preview"
                  src="/shared/showroom/exterior.webp"
                  alt={t("sceneLoading")}
                />
              }
            >
              {brand.modules.doorPreview && catalog.doors.length ? (
                <House design={exterior!} catalog={catalog} preset="full" />
              ) : (
                <img
                  className="hero-loading-preview"
                  src="/shared/showroom/interior.webp"
                  alt={t("madeForYou")}
                />
              )}
            </Suspense>
          )}
          <div className="hero-scene-label">
            <span>{brand.companyName}</span>
            <small>
              {t(
                furniture
                  ? hero.kind === "kitchen"
                    ? "kitchens"
                    : "wardrobes"
                  : "doorsWindows",
              )}
            </small>
          </div>
          {furniture && featured && (
            <div className="hero-swatch-card">
              <span>{t("front")}</span>
              <div>
                {catalog.fronts.slice(0, 6).map((m) => (
                  <button
                    key={m.id}
                    title={label(m.name, language)}
                    aria-label={label(m.name, language)}
                    aria-pressed={hero.style.front === m.id}
                    onClick={() => setFront(m.id)}
                    className={hero.style.front === m.id ? "active" : ""}
                    style={{ background: m.color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      <section className="tool-section">
        <div className="section-heading">
          <h2>{t("madeForYou")}</h2>
          <p>{t("estimateNote")}</p>
        </div>
        <div
          className={
            "tool-grid " +
            (tools.length === 2 ? "two" : tools.length === 1 ? "one" : "")
          }
        >
          {tools.map((tool, i) => (
            <Link
              key={tool.key}
              className="tool-card"
              to={tool.route + location.search}
            >
              <div className={"tool-art " + tool.img}>
                <img
                  src={
                    "/shared/showroom/" +
                    (tool.img === "kitchen"
                      ? "japandi"
                      : tool.img === "door"
                        ? "exterior"
                        : tool.img) +
                    ".webp"
                  }
                  alt=""
                  loading="lazy"
                />
                <span className="tool-number">0{i + 1}</span>
              </div>
              <div className="tool-card-copy">
                <div>
                  <h3>{t(tool.key as TranslationKey)}</h3>
                  <p>{t(tool.desc as TranslationKey)}</p>
                </div>
                <div className="round-arrow">
                  <ArrowUpRight size={21} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      {furniture && (
        <section className="inspiration">
          <div className="section-heading">
            <h2>{t("examples")}</h2>
            <Link
              to={
                "/designer/" +
                (brand.modules.kitchenDesigner ? "kitchen" : "wardrobe") +
                location.search
              }
            >
              {t("startDesign")}
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="examples-grid">
            {designs.map(
              (design, i) =>
                (design.kind === "kitchen"
                  ? brand.modules.kitchenDesigner
                  : brand.modules.wardrobeDesigner) && (
                  <button
                    className="example-card"
                    key={i}
                    onClick={() => load(i)}
                  >
                    <img src={"/" + presets[i].thumbnail} alt="" />
                    <div>
                      <span>{label(presets[i].name, language)}</span>
                      <MoveUpRight size={18} />
                    </div>
                    <small>
                      {t(design.layout)} · {design.room.width} ×{" "}
                      {design.room.depth} cm
                    </small>
                  </button>
                ),
            )}
          </div>
        </section>
      )}
    </main>
  );
}
