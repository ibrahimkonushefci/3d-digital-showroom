import { lazy, Suspense, useEffect, Component, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { Settings2, ArrowUpRight } from "lucide-react";
import { BrandProvider, useBrand } from "../brand";
import { useT, useLanguage } from "../i18n";
import { useDesigner } from "../designer3d/store";
import { saveDesign } from "../persistence";
import OfflineStatus from "../pwa/Status";
import { usePresentation } from "./preferences";
import Home from "./Home";
const PreviewStudio = import.meta.env.DEV
  ? lazy(() => import("./PreviewStudio"))
  : null;
const Compare = lazy(() => import("./Compare"));
const Designer = lazy(() => import("../designer3d/Designer")),
  Summary = lazy(() => import("./Summary")),
  Setup = lazy(() => import("../brand/Setup")),
  Settings = lazy(() => import("./Settings")),
  MaterialSwitcher = lazy(() => import("./MaterialSwitcher"));
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <FatalError /> : this.props.children;
  }
}
function FatalError() {
  const t = useT();
  return (
    <div className="startup">
      <p>{t("brandLoadError")}</p>
      <button className="button primary" onClick={() => location.reload()}>
        {t("retry")}
      </button>
    </div>
  );
}
function ProductRoute() {
  const { kind } = useParams(),
    { brand } = useBrand();
  return (kind === "kitchen" && brand.modules.kitchenDesigner) ||
    (kind === "wardrobe" && brand.modules.wardrobeDesigner) ? (
    <Designer />
  ) : (
    <Home />
  );
}
function Shell() {
  const { brand, logoUrl, local } = useBrand(),
    t = useT(),
    { language, setLanguage } = useLanguage(),
    location = useLocation();
  const presentation = usePresentation(brand);
  const design = useDesigner((s) => s.design);
  const embed = location.pathname.startsWith("/embed");
  useEffect(() => {
    if (!design) return;
    try {
      saveDesign(brand.slug, design);
    } catch {
      useDesigner.getState().setError("storageError");
    }
  }, [design, brand.slug]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      {!embed && (
        <header className="site-header">
          <Link className="brand-lockup" to={"/" + location.search}>
            <img src={logoUrl} alt="" />
            <div>
              <strong>{brand.companyName}</strong>
              <small>{t("appName")}</small>
            </div>
          </Link>
          <nav aria-label={t("home")}>
            <NavLink end to={"/" + location.search}>
              {t("home")}
            </NavLink>
            {brand.modules.kitchenDesigner && (
              <NavLink to={"/designer/kitchen" + location.search}>
                {t("kitchens")}
              </NavLink>
            )}
            {brand.modules.wardrobeDesigner && (
              <NavLink to={"/designer/wardrobe" + location.search}>
                {t("wardrobes")}
              </NavLink>
            )}
          </nav>
          <div className="header-right">
            <OfflineStatus hideBadge={presentation} />
            <div className="language-switch">
              {brand.languages.map((l) => (
                <button
                  key={l}
                  className={language === l ? "active" : ""}
                  aria-label={
                    l === "sq" ? "Shqip" : l === "en" ? "English" : "Deutsch"
                  }
                  aria-pressed={language === l}
                  onClick={() => setLanguage(l)}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <Link
              className="icon-button settings-link"
              aria-label={t("settings")}
              to={"/settings" + location.search}
            >
              <Settings2 size={19} />
            </Link>
          </div>
        </header>
      )}
      <Suspense
        fallback={
          <div className="startup">
            <div className="spinner" />
            <p>{t("sceneLoading")}</p>
          </div>
        }
      >
        <Routes>
          {PreviewStudio && (
            <Route path="/preview-studio" element={<PreviewStudio />} />
          )}
          <Route path="/" element={<Home />} />
          <Route path="/designer/:kind" element={<ProductRoute />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/settings" element={<Settings />} />
          <Route
            path="/material-switcher"
            element={
              brand.modules.kitchenDesigner ? <MaterialSwitcher /> : <Home />
            }
          />
          <Route
            path="/embed/material-switcher"
            element={
              brand.modules.kitchenDesigner ? <MaterialSwitcher /> : <Home />
            }
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
      {!embed && (
        <footer className="site-footer">
          <div>
            <strong>{brand.companyName}</strong>
            <span>
              {brand.contact.city} · {t("metric")}
            </span>
          </div>
          {!presentation && (
            <span>
              {local
                ? t("localOnly")
                : brand.demo
                  ? t("demoNotice")
                  : brand.tagline}
            </span>
          )}
          {brand.modules.kitchenDesigner && (
            <Link to={"/material-switcher" + location.search}>
              {t("exploreMaterials")}
              <ArrowUpRight size={15} />
            </Link>
          )}
        </footer>
      )}
    </>
  );
}
export default function App() {
  return (
    <Boundary>
      <BrowserRouter>
        <BrandProvider>
          <Shell />
        </BrandProvider>
      </BrowserRouter>
    </Boundary>
  );
}
