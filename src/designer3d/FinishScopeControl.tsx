import type { DesignDocument } from "../catalog/types";
import { useT } from "../i18n";
import { finishZone, type FinishScope } from "./finishes";

export function FinishScopeControl({
  design,
  selected,
  value,
  onChange,
}: {
  design: DesignDocument;
  selected: string | null;
  value: FinishScope;
  onChange: (scope: FinishScope) => void;
}) {
  const t = useT();
  const zones = [...new Set(design.cabinets.map(finishZone))];
  return (
    <div className="finish-scope">
      <h3>{t("finishScope")}</h3>
      <div
        className="segmented-pills"
        role="group"
        aria-label={t("finishScope")}
      >
        <button
          className={`segmented-pill ${value === "all" ? "active" : ""}`}
          aria-pressed={value === "all"}
          onClick={() => onChange("all")}
        >
          {t("allFinishes")}
        </button>
        {zones.map((zone) => (
          <button
            key={zone}
            className={`segmented-pill ${value === zone ? "active" : ""}`}
            aria-pressed={value === zone}
            onClick={() => onChange(zone)}
          >
            {t(`zone${zone}`)}
          </button>
        ))}
        {selected && (
          <button
            className={`segmented-pill ${typeof value === "object" ? "active" : ""}`}
            aria-pressed={typeof value === "object"}
            onClick={() => onChange({ cabinetId: selected })}
          >
            {t("selectedFinish")}
          </button>
        )}
      </div>
      <p className="helper">
        {t(value === "all" ? "finishDefaultsHint" : "finishOverrideHint")}
      </p>
    </div>
  );
}
