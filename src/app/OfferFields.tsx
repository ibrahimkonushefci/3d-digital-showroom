import type { OfferDetails } from "../catalog/types";
import { useT } from "../i18n";
import { Field, NumberField } from "./components";
export function OfferFields({
  details,
  onChange,
}: {
  details: OfferDetails;
  onChange: (d: OfferDetails) => void;
}) {
  const t = useT();
  return (
    <details className="offer-details">
      <summary>{t("customer")}</summary>
      <p className="helper">{t("optionalDetails")}</p>
      {(["name", "phone", "city"] as const).map((k) => (
        <Field key={k} label={t(k === "name" ? "customerName" : k)}>
          <input
            maxLength={k === "name" ? 100 : k === "phone" ? 60 : 80}
            value={details.customer[k]}
            onChange={(e) =>
              onChange({
                ...details,
                customer: { ...details.customer, [k]: e.target.value },
              })
            }
          />
        </Field>
      ))}
      <Field label={t("offerNumber")}>
        <input readOnly value={details.number} />
      </Field>
      <Field label={t("offerDate")}>
        <input
          type="date"
          value={details.date}
          onChange={(e) => onChange({ ...details, date: e.target.value })}
        />
      </Field>
      <Field label={t("salesperson")}>
        <input
          maxLength={100}
          value={details.salesperson}
          onChange={(e) =>
            onChange({ ...details, salesperson: e.target.value })
          }
        />
      </Field>
      <NumberField
        label={t("validityDays")}
        unit=""
        min={1}
        value={details.validityDays}
        onChange={(v) => onChange({ ...details, validityDays: Math.max(1, v) })}
      />
      <NumberField
        label={t("discount")}
        unit="%"
        min={0}
        max={30}
        value={details.discountPercent ?? 0}
        onChange={(v) =>
          onChange({
            ...details,
            discountPercent: Math.min(30, Math.max(0, v)),
          })
        }
      />
      <Field label={t("paymentTerms")}>
        <input
          maxLength={200}
          value={details.paymentTerms}
          onChange={(e) =>
            onChange({ ...details, paymentTerms: e.target.value })
          }
        />
      </Field>
      <Field label={t("notes")}>
        <textarea
          maxLength={1500}
          value={details.notes}
          onChange={(e) => onChange({ ...details, notes: e.target.value })}
        />
      </Field>
    </details>
  );
}
