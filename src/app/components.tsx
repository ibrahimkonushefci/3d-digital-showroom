import type { ReactNode } from "react";
import { useBrand } from "../brand";
import { label, useLanguage, useT } from "../i18n";
import type { Material } from "../catalog/types";
export function Field({
  label: caption,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{caption}</span>
      {children}
    </label>
  );
}
export function NumberField({
  label: caption,
  value,
  onChange,
  min = 0,
  max = 2000,
  step = 1,
  unit = "cm",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <Field label={caption}>
      <div className="number-input">
        <input
          aria-label={caption}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {unit && <span>{unit}</span>}
      </div>
    </Field>
  );
}
export function Toggle({
  label: caption,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="toggle">
      <span>{caption}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}
export function Swatches({
  items,
  value,
  onChange,
  title,
  selectedLabel,
}: {
  items: Material[];
  value: string;
  onChange: (v: string) => void;
  title: string;
  selectedLabel?: string;
}) {
  const { language } = useLanguage();
  const { assetUrl } = useBrand();
  return (
    <div className="swatch-section">
      <h3>
        {title}
        <span>
          {selectedLabel ||
            label(
              items.find((m) => m.id === value)?.name || items[0].name,
              language,
            )}
        </span>
      </h3>
      <div className="swatches">
        {items.map((m) => (
          <button
            key={m.id}
            className={"swatch " + (value === m.id ? "active" : "")}
            aria-label={label(m.name, language)}
            aria-pressed={value === m.id}
            title={label(m.name, language)}
            onClick={() => onChange(m.id)}
            style={{
              backgroundColor: m.color,
              ...(m.texture
                ? { backgroundImage: `url(${assetUrl(m.texture)})` }
                : {}),
            }}
          >
            {value === m.id && <span>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
export function ErrorNotice({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss?: () => void;
}) {
  const t = useT();
  if (!message) return null;
  return (
    <div className="notice error" role="alert">
      <span>{t(message as Parameters<typeof t>[0])}</span>
      {onDismiss && (
        <button
          className="icon-button"
          aria-label={t("cancel")}
          onClick={onDismiss}
        >
          ×
        </button>
      )}
    </div>
  );
}
