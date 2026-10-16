import { useEffect, useRef } from "react";
import { create } from "zustand";
import { ArrowUpRight, X } from "lucide-react";
import { label, useLanguage, useT } from "../i18n";
import type { ShowroomPreset } from "../designer3d/presets";

// Home and the shared header coordinate presentation only. Opening the
// chooser never touches the current design or device draft.
export const useHomeShowroom = create<{
  mounted: boolean;
  setMounted: (mounted: boolean) => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
}>((set) => ({
  mounted: false,
  setMounted: (mounted) => set({ mounted }),
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

export default function HomeShowroomChooser({
  presets,
  onSelect,
}: {
  presets: ShowroomPreset[];
  onSelect: (preset: ShowroomPreset) => void;
}) {
  const { isOpen, close } = useHomeShowroom();
  const dialog = useRef<HTMLDialogElement>(null);
  const t = useT();
  const { language } = useLanguage();
  useEffect(() => {
    const node = dialog.current;
    if (!node || !isOpen) return;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [isOpen]);
  return (
    <dialog
      ref={dialog}
      className="home-showroom-chooser"
      aria-labelledby="home-chooser-title"
      aria-describedby="home-chooser-intro"
      onCancel={close}
      onClose={close}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          close();
      }}
    >
      <div className="home-chooser-heading">
        <div>
          <p className="home-eyebrow">{t("showroom")}</p>
          <h2 id="home-chooser-title">{t("homeChooserTitle")}</h2>
        </div>
        <button
          type="button"
          className="home-icon-button"
          onClick={close}
          aria-label={t("close")}
          autoFocus
        >
          <X size={21} />
        </button>
      </div>
      <p id="home-chooser-intro">{t("homeChooserBody")}</p>
      <div className="home-chooser-grid">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.id}
            onClick={() => {
              close();
              onSelect(preset);
            }}
          >
            <img src={"/" + preset.thumbnail} alt="" />
            <strong>{label(preset.name, language)}</strong>
            <span>
              {t("openInShowroom")} <ArrowUpRight size={15} />
            </span>
          </button>
        ))}
      </div>
      {!presets.length && <p>{t("noFurniture")}</p>}
    </dialog>
  );
}
