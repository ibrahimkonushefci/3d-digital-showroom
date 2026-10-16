import { useEffect } from "react";
import { X } from "lucide-react";
import { useT } from "../i18n";

export type Toast = {
  id: string;
  text: string;
  tone?: "info" | "error";
  /** e.g. Undo; the toast closes after the action. */
  action?: { label: string; run: () => void };
  /** A second action, for a question (Cancel / Continue). */
  confirm?: { label: string; run: () => void };
  /** Milliseconds; questions and errors stay until answered or closed. */
  timeout?: number;
};

/** Small notices at the bottom right, above the page: they never push the
 * showroom down or change its size. */
export function Toasts({
  toasts,
  onClose,
}: {
  toasts: Toast[];
  onClose: (id: string) => void;
}) {
  const t = useT();
  useEffect(() => {
    const timers = toasts
      .filter((n) => n.timeout)
      .map((n) => setTimeout(() => onClose(n.id), n.timeout));
    return () => timers.forEach(clearTimeout);
  }, [toasts]);
  if (!toasts.length) return null;
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((n) => (
        <div
          key={n.id}
          className={`toast${n.tone === "error" ? " error" : ""}`}
          role={n.tone === "error" || n.confirm ? "alert" : "status"}
        >
          <span className="toast-text">{n.text}</span>
          {n.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                n.action!.run();
                onClose(n.id);
              }}
            >
              {n.action.label}
            </button>
          )}
          {n.confirm && (
            <button
              type="button"
              className="toast-action primary"
              onClick={() => {
                n.confirm!.run();
                onClose(n.id);
              }}
            >
              {n.confirm.label}
            </button>
          )}
          <button
            type="button"
            className="toast-close"
            aria-label={t("cancel")}
            onClick={() => onClose(n.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
