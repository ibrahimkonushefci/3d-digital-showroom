import { usePresentation, usePreferences } from "./preferences";
import { Link } from "react-router-dom";
import { useBrand } from "../brand";
import { useT, useLanguage } from "../i18n";
import { Field, Toggle } from "./components";
import { useDesigner } from "../designer3d/store";
import { clearDesigns } from "../persistence";
import { deployedBrands } from "../brand/deployed";
import type { Language } from "../catalog/types";
export default function Settings() {
  const { brand, catalog, local, clearLocal } = useBrand(),
    t = useT(),
    { language, setLanguage } = useLanguage(),
    state = useDesigner();
  const presentation = usePresentation(brand);
  return (
    <main className="page settings-page">
      <h1>{t("settings")}</h1>
      <div className="settings-card">
        <Field label={t("language")}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          >
            {brand.languages.map((l) => (
              <option key={l} value={l}>
                {l === "sq" ? "Shqip" : l === "en" ? "English" : "Deutsch"}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("brand")}>
          <select
            value={catalog.id}
            onChange={(e) => (location.href = "/?brand=" + e.target.value)}
          >
            {deployedBrands.map(({ slug, name }) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Toggle
          label={t("presentation")}
          checked={presentation}
          onChange={(v) =>
            usePreferences.getState().setPresentation(brand.slug, v)
          }
        />
        <Toggle
          label={t("performance")}
          checked={state.performance}
          onChange={state.setPerformance}
        />
        <p className="helper">{t("performanceHelp")}</p>
        <button
          className="button secondary full"
          onClick={() => {
            try {
              clearDesigns(brand.slug);
              // No open design, so autosave writes nothing back; the
              // designer opens the prepared design next time.
              state.setDesign(null);
            } catch {
              state.setError("storageError");
            }
          }}
        >
          {t("reset")}
        </button>
        <p className="helper">{t("resetHelp")}</p>
        {local && (
          <button className="button secondary full" onClick={clearLocal}>
            {t("clearDeviceBrand")}
          </button>
        )}
        <Link className="button secondary full" to={"/setup" + location.search}>
          {t("brandSetup")}
        </Link>
        {!presentation && <p className="helper">{t("demoNotice")}</p>}
      </div>
    </main>
  );
}
