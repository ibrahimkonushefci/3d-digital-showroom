import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowUpRight, Eye, PanelsTopLeft } from "lucide-react";
import { useBrand } from "../brand";
import { label, useLanguage, useT } from "../i18n";
import type { DesignDocument } from "../catalog/types";
import type { ShowroomPreset } from "../designer3d/presets";
import { useDesigner } from "../designer3d/store";
import { Materials } from "../designer3d/StylesPanel";
import { WARDROBE_THEMES } from "../designer3d/looks";
import { applyCatalogLook, homeCatalog } from "./homeCatalog";
import "./materials.css";
const Scene = lazy(() => import("../designer3d/Scene"));

export default function MaterialSwitcher({
  kind = "kitchen",
}: {
  kind?: DesignDocument["kind"];
}) {
  const { catalog } = useBrand();
  const location = useLocation();
  const requested = new URLSearchParams(location.search).get("look");
  const example = useMemo(() => {
    const options = homeCatalog(catalog).filter((p) => p.design.kind === kind);
    return options.find((p) => p.id === requested) || options[0];
  }, [catalog, kind, requested]);
  return example ? (
    <MaterialStudy
      key={`${catalog.id}-${kind}-${example.id}`}
      example={example}
      framed={!!requested}
    />
  ) : null;
}

/** A local material study. Drafts change only on the explicit designer action. */
function MaterialStudy({
  example,
  framed,
}: {
  example: ShowroomPreset;
  framed: boolean;
}) {
  const { brand, catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage(),
    navigate = useNavigate(),
    location = useLocation();
  const [design, setDesign] = useState(example.design);
  const [interior, setInterior] = useState(false);
  const [look, setLook] = useState<string | null>(null);
  const kitchen = design.kind === "kitchen";
  const embedded = location.pathname.startsWith("/embed");
  const looks = WARDROBE_THEMES.filter(
    (theme) =>
      catalog.fronts.some((m) => m.id === theme.front) &&
      catalog.carcasses.some((m) => m.id === theme.carcass) &&
      catalog.handles.some((m) => m.id === theme.handle) &&
      catalog.plinths.some((m) => m.id === theme.plinth),
  );
  return (
    <main className={"material-page " + (embedded ? "embedded" : "page")}>
      <div className="material-heading">
        <div className="eyebrow">
          {t(kitchen ? "kitchenMaterials" : "wardrobeMaterials")}
        </div>
        <h1>{t(kitchen ? "materialTitle" : "wardrobeMaterialTitle")}</h1>
        <p>{t("materialBody")}</p>
      </div>
      {!embedded && (
        <nav className="material-page-tabs" aria-label={t("exploreMaterials")}>
          {brand.modules.kitchenDesigner && (
            <Link
              aria-current={kitchen ? "page" : undefined}
              to={"/material-switcher" + location.search}
            >
              {t("kitchens")}
            </Link>
          )}
          {brand.modules.wardrobeDesigner && (
            <Link
              aria-current={!kitchen ? "page" : undefined}
              to={"/wardrobe-materials" + location.search}
            >
              {t("wardrobes")}
            </Link>
          )}
        </nav>
      )}
      <div className="material-grid">
        <div className="material-visual">
          {!kitchen && (
            <div
              className="material-view-toggle"
              role="group"
              aria-label={t("previewView")}
            >
              <button
                type="button"
                aria-pressed={!interior}
                onClick={() => setInterior(false)}
              >
                <PanelsTopLeft size={16} />
                {t("wardrobeDoorsView")}
              </button>
              <button
                type="button"
                aria-pressed={interior}
                onClick={() => setInterior(true)}
              >
                <Eye size={16} />
                {t("interiorView")}
              </button>
            </div>
          )}
          <div className="material-scene">
            <Suspense fallback={<p>{t("sceneLoading")}</p>}>
              <Scene
                design={design}
                catalog={catalog}
                preset={interior ? "front" : "hero"}
                cameraView={!interior && framed ? example.camera : undefined}
                inspection={{ opened: [], interior }}
                reframe={interior}
              />
            </Suspense>
          </div>
        </div>
        <div className="material-controls">
          {!kitchen && (
            <section className="material-wardrobe-looks">
              <h2>{t("readyLooks")}</h2>
              <div className="material-look-options">
                {looks.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={look === theme.id}
                    onClick={() => {
                      setDesign(applyCatalogLook(design, theme));
                      setLook(theme.id);
                    }}
                  >
                    <img
                      src={`/shared/previews/look-${theme.id}.webp`}
                      alt=""
                    />
                    <span>{label(theme.name, language)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <Materials
            design={design}
            onChange={(next) => {
              setDesign(next);
              setLook(null);
            }}
            compact
          />
          {!kitchen && (
            <section className="material-handles">
              <h2>{t("handle")}</h2>
              <div className="picture-grid">
                {catalog.handles.map((handle) => (
                  <button
                    className="picture-tile"
                    type="button"
                    key={handle.id}
                    aria-pressed={design.style.handle === handle.id}
                    onClick={() => {
                      setDesign({
                        ...design,
                        style: { ...design.style, handle: handle.id },
                      });
                      setLook(null);
                    }}
                  >
                    <span
                      className="picture-tile-image"
                      style={{
                        backgroundImage: `url(/shared/previews/handle-${handle.id}-wardrobe.webp)`,
                      }}
                    />
                    <span className="picture-tile-name">
                      {label(handle.name, language)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <button
            className="button primary full"
            onClick={() => {
              useDesigner.getState().setDesign(design);
              navigate("/designer/" + design.kind + location.search);
            }}
          >
            {t(kitchen ? "designYourOwn" : "designYourWardrobe")}
            <ArrowUpRight size={18} />
          </button>
        </div>
      </div>
    </main>
  );
}
