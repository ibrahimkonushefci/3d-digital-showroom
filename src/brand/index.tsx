import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  BrandSchema,
  CatalogSchema,
  validateCatalogForBrand,
  type BrandConfig,
  type Catalog,
} from "../catalog/types";
import { useInterior } from "../interior/store";
import { validInterior } from "../interior/layout";
import { useFacade, validFacade } from "../doorPreview/store";
import { decodeShare, SnapshotSchema } from "../sharing";
import { useT, useLanguage } from "../i18n";
import { useDesigner } from "../designer3d/store";
import { withDemoContacts } from "./contacts";
import { usePreferences } from "../app/preferences";
import { validateDesign } from "../designer3d/layout";
export function resolveBrand(
  search: string,
  host: string,
  defaultBrand = "default",
  baseDomain = "",
) {
  const slug = new URLSearchParams(search).get("brand");
  if (slug && /^[a-z0-9-]+$/.test(slug)) return slug;
  if (baseDomain && host.endsWith("." + baseDomain)) {
    const sub = host.slice(0, -baseDomain.length - 1);
    if (/^[a-z0-9-]+$/.test(sub)) return sub;
  }
  return /^[a-z0-9-]+$/.test(defaultBrand) ? defaultBrand : "default";
}
export type BrandContextType = {
  brand: BrandConfig;
  catalog: Catalog;
  logoUrl: string;
  local: boolean;
  setLocal: (b: BrandConfig, logo: string) => void;
  clearLocal: () => void;
  assetUrl: (path: string) => string;
};
const Context = createContext<BrandContextType | null>(null);
export function useBrand() {
  const c = useContext(Context);
  if (!c) throw Error("Brand context unavailable");
  return c;
}
const key = (slug: string) => "showroom-brand-" + slug;
async function loadFiles(slug: string) {
  const responses = await Promise.all([
    fetch(`/brands/${slug}/brand.json`),
    fetch(`/brands/${slug}/catalog.json`),
  ]);
  if (responses.some((r) => !r.ok)) throw Error("brandLoadError");
  const [b, c] = await Promise.all(responses.map((r) => r.json()));
  const brand = withDemoContacts(BrandSchema.parse(b)),
    catalog = CatalogSchema.parse(c);
  if (!validateCatalogForBrand(catalog, brand)) throw Error("brandLoadError");
  return { brand, catalog };
}
export function BrandProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<BrandContextType | null>(null),
    [error, setError] = useState(false);
  const t = useT();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let active = resolveBrand(
          location.search,
          location.hostname,
          import.meta.env.VITE_DEFAULT_BRAND,
          import.meta.env.VITE_BRAND_BASE_DOMAIN,
        );
        let loaded;
        try {
          loaded = await loadFiles(active);
        } catch {
          active = "default";
          loaded = await loadFiles(active);
        }
        let { brand, catalog } = loaded;
        let logoUrl = `/brands/${active}/${brand.logo}`,
          local = false,
          initialError: string | null = null;
        let assetBrand = active;
        const sharedKey = "showroom-shared-brand-" + active;
        try {
          const saved = localStorage.getItem(key(active));
          if (saved) {
            const data = JSON.parse(saved);
            brand = BrandSchema.parse(data.brand);
            logoUrl =
              typeof data.logo === "string" &&
              (data.logo.startsWith("data:image/png") ||
                data.logo.startsWith("/brands/"))
                ? data.logo
                : logoUrl;
            local = true;
          }
          const shared = sessionStorage.getItem(sharedKey);
          if (shared) {
            const basic = SnapshotSchema.parse(JSON.parse(shared));
            brand = BrandSchema.parse({ ...basic, logo: "logo.svg" });
            logoUrl = "/icon.svg";
            local = true;
          }
        } catch {
          initialError = "storageError";
        }
        const encoded = new URLSearchParams(location.hash.slice(1)).get(
          "design",
        );
        if (encoded) {
          try {
            const payload = decodeShare(encoded);
            const linkedCatalog = CatalogSchema.parse(
              await (
                await fetch(`/brands/${payload.catalogId}/catalog.json`)
              ).json(),
            );
            if (
              (["kitchen", "wardrobe"].includes(payload.design.kind) &&
                !validateDesign(
                  payload.design as import("../catalog/types").DesignDocument,
                  linkedCatalog,
                )) ||
              (payload.design.kind === "interior" &&
                !validInterior(payload.design, linkedCatalog)) ||
              (payload.design.kind === "facade" &&
                !validFacade(payload.design, linkedCatalog))
            )
              throw Error("invalidLink");
            catalog = linkedCatalog;
            assetBrand = payload.catalogId;
            if (payload.brand) {
              brand = BrandSchema.parse({ ...payload.brand, logo: "logo.svg" });
              logoUrl = "/icon.svg";
              local = true;
              try {
                sessionStorage.setItem(
                  sharedKey,
                  JSON.stringify(payload.brand),
                );
              } catch {
                initialError = "storageError";
              }
            }
            if (payload.design.kind === "facade")
              useFacade.getState().set(payload.design);
            else if (payload.design.kind === "interior")
              useInterior.getState().set(payload.design);
            else useDesigner.getState().setDesign(payload.design);
          } catch {
            initialError = "invalidLink";
          }
        }
        if (
          !localStorage.getItem("showroom-language") ||
          !brand.languages.includes(useLanguage.getState().language)
        )
          useLanguage.getState().setLanguage(brand.defaultLanguage);
        const assetUrl = (path: string) =>
          path.startsWith("shared/")
            ? "/" + path
            : `/brands/${assetBrand}/${path}`;
        const setLocal = (b: BrandConfig, logo: string) => {
          const next = BrandSchema.parse({
            ...b,
            catalogId: catalog.id,
            demo: false,
            presentationMode: true,
          });
          try {
            localStorage.setItem(
              key(active),
              JSON.stringify({ brand: next, logo }),
            );
            sessionStorage.removeItem(sharedKey);
          } catch {
            useDesigner.getState().setError("storageError");
            throw Error("storageError");
          }
          usePreferences.getState().setPresentation(next.slug, true);
          setValue((v) =>
            v ? { ...v, brand: next, logoUrl: logo, local: true } : v,
          );
        };
        if (!cancelled) {
          setValue({
            brand,
            catalog,
            logoUrl,
            local,
            setLocal,
            assetUrl,
            clearLocal: () => {
              localStorage.removeItem(key(active));
              sessionStorage.removeItem(sharedKey);
              location.reload();
            },
          });
          if (initialError) useDesigner.getState().setError(initialError);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!value) return;
    const { brand } = value;
    Object.entries(brand.colors).forEach(([k, v]) =>
      document.documentElement.style.setProperty("--" + k, v),
    );
    document.title = brand.companyName + " · Digital Showroom";
  }, [value]);
  if (error)
    return (
      <div className="startup">
        <h1>{t("brandLoadError")}</h1>
        <button onClick={() => location.reload()}>{t("retry")}</button>
      </div>
    );
  if (!value)
    return (
      <div className="startup">
        <div className="spinner" />
        <p>{t("sceneLoading")}</p>
      </div>
    );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
