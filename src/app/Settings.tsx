import { useState } from "react";
import { brandSetting, saveBrandSetting } from "../documents/details";
import { usePresentation, usePreferences } from "./preferences";
import { Link } from "react-router-dom";
import { useBrand } from "../brand";
import { useT, useLanguage } from "../i18n";
import { Field, Toggle } from "./components";
import { useDesigner } from "../designer3d/store";
import { presentationPresets } from "../designer3d/presets";
import { clearComparisons } from "../designer3d/comparison";
import type { Language } from "../catalog/types";
export default function Settings() {
  const { brand, catalog, local, clearLocal } = useBrand(),
    t = useT(),
    { language, setLanguage } = useLanguage(),
    state = useDesigner();
  const [salesperson, setSalesperson] = useState(() =>
      brandSetting(brand.slug, "salesperson", ""),
    ),
    [validity, setValidity] = useState(() =>
      brandSetting(
        brand.slug,
        "validity",
        String(catalog.pricing.validityDays),
      ),
    );
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
            {["default", "druri-design"].map((slug) => (
              <option key={slug} value={slug}>
                {slug === "default" ? "Forma Studio" : "Druri Design"}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("salesperson")}>
          <input
            maxLength={100}
            value={salesperson}
            onChange={(e) => {
              setSalesperson(e.target.value);
              saveBrandSetting(brand.slug, "salesperson", e.target.value);
            }}
          />
        </Field>
        <Field label={t("validityDays")}>
          <input
            type="number"
            min={1}
            value={validity}
            onChange={(e) => {
              const v = String(Math.max(1, Number(e.target.value)));
              setValidity(v);
              saveBrandSetting(brand.slug, "validity", v);
            }}
          />
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
          onClick={async () => {
            try {
              await clearComparisons(brand.slug);
              for (const kind of ["kitchen", "wardrobe"])
                localStorage.removeItem(
                  `showroom-design-${brand.slug}-${kind}`,
                );
              localStorage.removeItem(`showroom-recent-${brand.slug}`);
              const example = presentationPresets(catalog)[0]?.design;
              if (example) state.setDesign(example);
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
