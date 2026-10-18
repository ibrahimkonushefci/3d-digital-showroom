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
import {
  Settings2,
  ArrowUpRight,
  Moon,
  Sun,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { BrandProvider, useBrand } from "../brand";
import { useT, useLanguage } from "../i18n";
import { useDesigner } from "../designer3d/store";
import { saveDesign } from "../persistence";
import OfflineStatus from "../pwa/Status";
import { usePresentation, usePreferences } from "./preferences";
import { useHomeShowroom } from "./HomeShowroomChooser";
import Home from "./Home";
import { fpsDiagnostics } from "../scene/diagnostics/enabled";
const PreviewStudio = import.meta.env.DEV
  ? lazy(() => import("./PreviewStudio"))
  : null;
const PreviewRender = import.meta.env.DEV
  ? lazy(() => import("./PreviewRender"))
  : null;
const FpsOverlay = fpsDiagnostics
  ? lazy(() => import("../scene/diagnostics/FpsOverlay"))
  : null;
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
  const home = useHomeShowroom((state) => state.mounted);
  const appearance = usePreferences((state) => state.homeAppearance);
  const design = useDesigner((s) => s.design);
  const embed = location.pathname.startsWith("/embed");
  const settingsOpen = location.pathname === "/settings";
  const settingsFrom = location.state?.settingsFrom || {
    pathname: "/",
    search: location.search,
  };
  const hasRooms =
    brand.modules.kitchenDesigner || brand.modules.wardrobeDesigner;
  const materialLinks = (
    <>
      {brand.modules.kitchenDesigner && (
        <Link to={"/material-switcher" + location.search}>
          {t("kitchenMaterials")}
        </Link>
      )}
      {brand.modules.wardrobeDesigner && (
        <Link to={"/wardrobe-materials" + location.search}>
          {t("wardrobeMaterials")}
        </Link>
      )}
    </>
  );
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
        <header className="site-header" id="site-top">
          <Link className="brand-lockup" to={"/" + location.search}>
            <img src={logoUrl} alt="" />
            <div>
              <strong>{brand.companyName}</strong>
              <small>{t(home ? "homeBrandLabel" : "appName")}</small>
            </div>
          </Link>
          <nav aria-label={t("home")}>
            {home ? (
              <>
                {brand.modules.kitchenDesigner && (
                  <a href="#kitchens">{t("kitchens")}</a>
                )}
                {brand.modules.wardrobeDesigner && (
                  <a href="#wardrobes">{t("wardrobes")}</a>
                )}
                {hasRooms && (
                  <details
                    className="home-desktop-materials"
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.currentTarget.open = false;
                        event.currentTarget.querySelector("summary")?.focus();
                      }
                    }}
                  >
                    <summary>
                      {t("materials")}
                      <ChevronDown size={14} />
                    </summary>
                    <div>{materialLinks}</div>
                  </details>
                )}
                {(brand.modules.kitchenDesigner ||
                  brand.modules.wardrobeDesigner) && (
                  <button
                    type="button"
                    className="home-nav-showroom"
                    onClick={useHomeShowroom.getState().open}
                  >
                    {t("showroom")} <ArrowUpRight size={14} />
                  </button>
                )}
              </>
            ) : (
              <>
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
              </>
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
            {home && (
              <>
                <select
                  className="home-language-picker"
                  aria-label={t("language")}
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as typeof language)
                  }
                >
                  {brand.languages.map((l) => (
                    <option value={l} key={l}>
                      {l.toUpperCase()}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="icon-button home-appearance-switch"
                  aria-label={t(
                    appearance === "light" ? "homeUseGreen" : "homeUseLight",
                  )}
                  title={t(
                    appearance === "light" ? "homeUseGreen" : "homeUseLight",
                  )}
                  aria-pressed={appearance === "deep-green"}
                  onClick={() =>
                    usePreferences
                      .getState()
                      .setHomeAppearance(
                        appearance === "light" ? "deep-green" : "light",
                      )
                  }
                >
                  {appearance === "light" ? (
                    <Moon size={19} />
                  ) : (
                    <Sun size={19} />
                  )}
                </button>
              </>
            )}
            <Link
              className="icon-button settings-link"
              aria-label={t(settingsOpen ? "closeSettings" : "settings")}
              aria-expanded={settingsOpen}
              to={settingsOpen ? settingsFrom : "/settings" + location.search}
              state={
                settingsOpen
                  ? undefined
                  : {
                      settingsFrom: {
                        pathname: location.pathname,
                        search: location.search,
                        hash: location.hash,
                      },
                    }
              }
            >
              {settingsOpen ? <X size={21} /> : <Settings2 size={19} />}
            </Link>
          </div>
        </header>
      )}
      {!embed && home && (
        <div className="home-mobile-navigation">
          <details>
            <summary>
              <Menu size={18} />
              {t("menu")}
            </summary>
            <nav
              aria-label={t("catalogNavigation")}
              onClick={(event) =>
                event.currentTarget.closest("details")?.removeAttribute("open")
              }
            >
              {brand.modules.kitchenDesigner && (
                <a href="#kitchens">{t("kitchens")}</a>
              )}
              {brand.modules.wardrobeDesigner && (
                <a href="#wardrobes">{t("wardrobes")}</a>
              )}
              {materialLinks}
            </nav>
          </details>
          {hasRooms && (
            <button
              type="button"
              className="home-nav-showroom"
              onClick={useHomeShowroom.getState().open}
            >
              {t("showroom")}
              <ArrowUpRight size={18} />
            </button>
          )}
        </div>
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
          {PreviewRender && (
            <Route path="/preview-render" element={<PreviewRender />} />
          )}
          <Route path="/" element={<Home />} />
          <Route path="/designer/:kind" element={<ProductRoute />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/settings" element={<Settings />} />
          <Route
            path="/wardrobe-materials"
            element={
              brand.modules.wardrobeDesigner ? (
                <MaterialSwitcher key="wardrobe" kind="wardrobe" />
              ) : (
                <Home />
              )
            }
          />
          <Route
            path="/embed/wardrobe-materials"
            element={
              brand.modules.wardrobeDesigner ? (
                <MaterialSwitcher key="wardrobe-embed" kind="wardrobe" />
              ) : (
                <Home />
              )
            }
          />
          <Route
            path="/material-switcher"
            element={
              brand.modules.kitchenDesigner ? (
                <MaterialSwitcher key="kitchen" />
              ) : (
                <Home />
              )
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
      {FpsOverlay && (
        <Suspense fallback={null}>
          <FpsOverlay />
        </Suspense>
      )}
      {!embed && (
        <footer className="site-footer">
          {!home && (
            <div>
              <strong>{brand.companyName}</strong>
              <span>
                {brand.contact.city} · {t("metric")}
              </span>
            </div>
          )}
          {home && <span>{t("estimateNote")}</span>}
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
