import { UnitsPanel, SpotLabels, deleteUnit } from "./UnitsPanel";
import { movedCabinet } from "./drag";
import { validateDesign } from "./layout";
import { Materials } from "./StylesPanel";
import { RoomAndLayoutSection, type RoomChange } from "./RoomPanel";
import { liveCamera } from "./liveCamera";
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Undo2,
  Redo2,
  Box,
  LayoutGrid,
  Palette,
  DoorOpen,
  RotateCcw,
  Sliders,
  Maximize2,
  Minimize2,
  RefreshCcw,
  ScanSearch,
  PencilRuler,
  X,
} from "lucide-react";
import { useBrand } from "../brand";
import { useT, useLanguage, label } from "../i18n";
import { useDesigner } from "./store";
import { defaultDesign, resetConfiguration } from "./presets";
import { storageMeasurements } from "./storage";
import { uid } from "./layout";
import type { DesignDocument, Layout } from "../catalog/types";
import type { CameraPreset, CameraView } from "./Scene";
import { readDesign } from "../persistence";
import { fpsDiagnostics } from "../scene/diagnostics/enabled";
import { calculatePrice, estimateLabel } from "../pricing";
import { Toasts, type Toast } from "./Toasts";

export { Materials };

const Scene = lazy(() => import("./Scene"));
const FrameProbe = fpsDiagnostics
  ? lazy(() => import("../scene/diagnostics/FrameProbe"))
  : null;

export default function Designer() {
  const { kind: rawKind } = useParams(),
    kind = rawKind === "wardrobe" ? "wardrobe" : "kitchen";
  const { brand, catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage(),
    navigate = useNavigate();
  const state = useDesigner();
  const { design, selected, past, future } = state;
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = (toast: Omit<Toast, "id"> & { id?: string }) =>
    setToasts((list) => [
      ...list.filter((n) => n.id !== toast.id),
      { ...toast, id: toast.id ?? uid() },
    ]);
  const closeToast = (id: string) =>
    setToasts((list) => list.filter((n) => n.id !== id));
  const [panel, setPanel] = useState<"styles" | "layout" | "cabinets">(
    "styles",
  );
  // Showroom opens standing in the room; editing needs the whole layout.
  const [preset, setPreset] = useState<CameraPreset>(() =>
    useDesigner.getState().interactionMode === "edit" ? "overall" : "hero",
  );
  // Showroom presentation: canvas fills the screen, options in a sheet.
  const [immersive, setImmersive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reframe, setReframe] = useState(0);
  // The customer's own view before "Inspect up close", restored on the
  // second press.
  const [inspectReturn, setInspectReturn] = useState<CameraView | null>(null);
  // Each tab keeps its own scroll position; a tab not visited yet starts at
  // the top.
  const panelBody = useRef<HTMLDivElement>(null);
  const scrolls = useRef(new Map<string, number>());
  const scrollKey = `${state.interactionMode}:${panel}`;
  useLayoutEffect(() => {
    const body = panelBody.current;
    if (body) body.scrollTop = scrolls.current.get(scrollKey) ?? 0;
  }, [scrollKey, design?.kind]);

  useEffect(() => {
    if (useDesigner.getState().design?.kind !== kind) {
      const previousError = useDesigner.getState().error;
      const saved = readDesign(brand.slug, kind, catalog);
      if (saved.error) notify({ id: "replaced", text: t("designReplaced") });
      state.setDesign(saved.design || defaultDesign(kind, catalog));
      if (previousError) state.setError(previousError);
    }
  }, [kind, catalog, brand.slug]);
  useEffect(() => {
    scrolls.current.clear();
  }, [kind]);

  useEffect(() => {
    if (selected && state.interactionMode === "edit") {
      setPanel("cabinets");
    }
  }, [selected, state.interactionMode]);

  useEffect(() => {
    if (state.selectedInterior && state.interactionMode === "edit")
      setPanel("cabinets");
  }, [state.selectedInterior?.cabinetId, state.selectedInterior?.componentId]);
  // Showroom has no Units tab.
  useEffect(() => {
    if (state.interactionMode === "showroom" && panel === "cabinets")
      setPanel("styles");
  }, [state.interactionMode, panel]);
  const focused = state.focused;
  useEffect(() => {
    if (!focused) setInspectReturn(null);
  }, [focused]);
  // Fit problems and other errors: a toast that does not move the page.
  useEffect(() => {
    if (!state.error) return;
    notify({
      id: "error",
      tone: "error",
      text: t(state.error as Parameters<typeof t>[0]),
    });
    state.setError(null);
  }, [state.error]);
  // Notices from editing (added, replaced, deleted): with Undo.
  useEffect(() => {
    if (!state.notice) return;
    const { text, undo } = state.notice;
    notify({
      id: "edit",
      text,
      timeout: 8000,
      ...(undo
        ? {
            action: {
              label: t("undo"),
              run: () => useDesigner.getState().undo(),
            },
          }
        : {}),
    });
    state.setNotice(null);
  }, [state.notice]);
  // Edit mode keys: Delete removes the selected unit, arrows move it along
  // its wall by 10 cm, Escape stops placing.
  useEffect(() => {
    if (state.interactionMode !== "edit") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (
        e.defaultPrevented ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        target?.closest("input, select, textarea, [contenteditable]")
      )
        return;
      const s = useDesigner.getState();
      if (e.key === "Escape" && s.placing) {
        s.setPlacing(null);
        return;
      }
      const d = s.design,
        id = s.selected;
      if (!d || !id || s.dragging) return;
      const c = d.cabinets.find((x) => x.id === id);
      if (!c) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const m = catalog.modules.find((x) => x.id === c.moduleId)!;
        deleteUnit(
          d,
          id,
          (next) => s.edit(next, catalog),
          t("unitDeleted", { name: label(m.name, language) }),
        );
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = movedCabinet(d, id, e.key === "ArrowLeft" ? -10 : 10);
        if (validateDesign(next, catalog)) s.edit(next, catalog);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.interactionMode, catalog, language]);
  useEffect(() => {
    if (!immersive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (sheetOpen) setSheetOpen(false);
      else setImmersive(false);
    };
    // Leaving browser full screen (Esc, system gesture) leaves the mode too.
    const onFullscreen = () => {
      if (!document.fullscreenElement) setImmersive(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [immersive, sheetOpen]);
  useEffect(() => {
    setReframe((n) => n + 1);
    setSheetOpen(false);
  }, [immersive]);
  useEffect(
    () => () => {
      if (document.fullscreenElement) void document.exitFullscreen?.();
    },
    [],
  );
  if (!design || design.kind !== kind)
    return <div className="startup">{t("sceneLoading")}</div>;

  const edit = (next: DesignDocument) => {
    const losesCustomInterior = design.cabinets.some(
      (c) => c.interior && !next.cabinets.some((n) => n.id === c.id),
    );
    const regenerated = next.cabinets.every(
      (c) => !design.cabinets.some((n) => n.id === c.id),
    );
    if (losesCustomInterior && regenerated) {
      const before = design;
      notify({
        id: "interior",
        text: t("interiorRegenerateWarning"),
        action: { label: t("cancel"), run: () => {} },
        confirm: {
          label: t("interiorRebuild"),
          run: () => {
            if (useDesigner.getState().design === before)
              state.edit(next, catalog);
          },
        },
      });
      return false;
    }
    return state.edit(next, catalog);
  };
  const roomChange: RoomChange = (result, message) => {
    if (!edit(result.design)) return;
    notify({
      id: "room",
      text: message,
      timeout: 8000,
      action: { label: t("undo"), run: () => useDesigner.getState().undo() },
    });
    setReframe((n) => n + 1);
  };
  const price = calculatePrice(design, catalog, language);
  const priceText = estimateLabel(price, design.exact, language);
  const layouts: Layout[] =
    kind === "kitchen" ? ["straight", "l", "island"] : ["straight", "corner"];

  const overallView = () => {
    state.select(null);
    state.focus(null);
    state.setCameraView(null);
    setReframe((n) => n + 1);
  };
  const inspect = (id: string) => {
    const back = liveCamera.read?.();
    setInspectReturn(back ? { ...back, exact: true } : null);
    state.select(id);
    state.focus(id);
    setReframe((n) => n + 1);
    setSheetOpen(false);
  };
  // Second press: back to exactly where the customer was looking from.
  const leaveInspection = () => {
    state.focus(null);
    if (inspectReturn) state.setCameraView(inspectReturn);
    else setReframe((n) => n + 1);
    setInspectReturn(null);
  };
  const toggleInspect = (id: string | null) => {
    if (focused) leaveInspection();
    else if (id) inspect(id);
  };
  const resetConfigurationClick = () => {
    if (state.resetDesign(resetConfiguration(design, catalog), catalog)) {
      setPreset(state.interactionMode === "edit" ? "overall" : "hero");
      setReframe((n) => n + 1);
      notify({
        id: "reset",
        text: t("resetDesignDone"),
        timeout: 8000,
        action: { label: t("undo"), run: () => useDesigner.getState().undo() },
      });
    }
  };
  const editInside = (id: string) => {
    state.setInteractionMode("edit");
    state.setCameraView(null);
    setPreset("overall");
    state.select(id);
    setPanel("cabinets");
    setReframe((n) => n + 1);
  };
  const toggleImmersive = () => {
    const next = !immersive;
    setImmersive(next);
    // Real full screen where the browser allows it (not iPhone Safari);
    // the fixed overlay alone is enough everywhere else.
    try {
      if (next && !document.fullscreenElement)
        void document.documentElement.requestFullscreen?.()?.catch(() => {});
      else if (!next && document.fullscreenElement)
        void document.exitFullscreen?.()?.catch(() => {});
    } catch {
      /* Full screen is an enhancement only. */
    }
  };
  const selectedModule =
    state.interactionMode === "showroom" && selected
      ? design.cabinets.find((c) => c.id === selected)
      : undefined;

  // Summary owns its closed overall capture; navigation never waits on the
  // live inspection camera or reuses an image of an older configuration.
  const summary = () => {
    const query = new URLSearchParams(location.search);
    query.set("kind", design.kind);
    navigate("/summary?" + query.toString());
  };
  type Panel = "styles" | "layout" | "cabinets";
  const tabs: Array<{ key: Panel; icon: typeof Palette; label: string }> = [
    { key: "styles", icon: Palette, label: t("styles") },
    { key: "layout", icon: LayoutGrid, label: t("roomAndLayout") },
  ];
  if (state.interactionMode === "edit")
    tabs.push({
      key: "cabinets",
      icon: Box,
      label: t(kind === "kitchen" ? "cabinets" : "wardrobes"),
    });

  return (
    <main
      className={
        "designer-page" +
        (immersive ? " is-immersive" : "") +
        (immersive && sheetOpen ? " sheet-open" : "")
      }
    >
      <div className="designer-heading">
        <div>
          <div className="eyebrow">{t("madeForYou")}</div>
          <h1>{t(kind === "kitchen" ? "kitchens" : "wardrobes")}</h1>
        </div>
        <div className="history-buttons">
          <div className="segmented-pills">
            {(["showroom", "edit"] as const).map((mode) => (
              <button
                key={mode}
                className={
                  "segmented-pill " +
                  (state.interactionMode === mode ? "active" : "")
                }
                aria-pressed={state.interactionMode === mode}
                onClick={() => {
                  state.setInteractionMode(mode);
                  if (mode === "edit") setPanel("cabinets");
                  state.select(null);
                  state.setCameraView(null);
                  state.focus(null);
                  setPreset(mode === "edit" ? "overall" : "hero");
                  setReframe((n) => n + 1);
                }}
              >
                {t(mode)}
              </button>
            ))}
          </div>
          <button
            className="icon-button"
            onClick={state.undo}
            disabled={!past.length}
            aria-label={t("undo")}
          >
            <Undo2 size={20} />
          </button>
          <button
            className="icon-button"
            onClick={state.redo}
            disabled={!future.length}
            aria-label={t("redo")}
          >
            <Redo2 size={20} />
          </button>
          <button
            className="button secondary reset-design"
            onClick={resetConfigurationClick}
            title={t("resetDesignHelp")}
          >
            <RefreshCcw size={16} />
            <span>{t("resetDesign")}</span>
          </button>
        </div>
      </div>
      <Toasts toasts={toasts} onClose={closeToast} />

      <div className="designer-workspace">
        <section className="canvas-panel">
          <div className="canvas-controls">
            <div className="canvas-controls-group">
              {(["hero", "front", "top"] as const).map((p) => (
                <button
                  key={p}
                  aria-pressed={preset === p && !focused}
                  className={preset === p && !focused ? "active" : ""}
                  onClick={() => {
                    setPreset(p);
                    overallView();
                  }}
                >
                  {t(
                    p === "front"
                      ? "frontCamera"
                      : p === "hero"
                        ? "heroCamera"
                        : p,
                  )}
                </button>
              ))}
            </div>
            <div className="canvas-divider" />
            <button
              title={t("resetCamera")}
              onClick={() => {
                setPreset("overall");
                overallView();
              }}
            >
              <RotateCcw size={14} />
              <span>{t("overallView")}</span>
            </button>
            <button
              disabled={
                (!selected && !focused) || state.interactionMode !== "showroom"
              }
              aria-pressed={!!focused}
              className={focused ? "active" : ""}
              title={t(focused ? "inspectBackHint" : "inspectHint")}
              onClick={() => toggleInspect(selected)}
            >
              <ScanSearch size={15} />
              <span>{t("inspect")}</span>
            </button>
            {kind === "wardrobe" && (
              <button
                aria-pressed={state.interior}
                className={state.interior ? "active" : ""}
                onClick={() => state.setInterior(!state.interior)}
              >
                {t("interiorView")}
              </button>
            )}
            <button
              className="canvas-btn-special"
              title={state.opened.length > 0 ? t("closeAll") : t("openAll")}
              onClick={state.toggleAllOpen}
            >
              <DoorOpen size={15} />
              <span>
                {state.opened.length > 0 ? t("closeAll") : t("openAll")}
              </span>
            </button>
          </div>

          <Suspense
            fallback={<div className="scene-fallback">{t("sceneLoading")}</div>}
          >
            <Scene
              design={design}
              catalog={catalog}
              preset={preset}
              cameraView={state.cameraView || undefined}
              interactive
              reframe={reframe}
              diagnostics={
                FrameProbe && (
                  <FrameProbe
                    design={`${design.kind} ${design.layout} ${design.style.front}`}
                  />
                )
              }
            />
          </Suspense>
          <button
            className="immersive-toggle"
            aria-pressed={immersive}
            aria-label={t(immersive ? "exitShowroomMode" : "showroomMode")}
            title={t(immersive ? "exitShowroomMode" : "showroomMode")}
            onClick={toggleImmersive}
          >
            {immersive ? <X size={20} /> : <Maximize2 size={18} />}
          </button>
          {immersive && !sheetOpen && (
            <div className="immersive-dock">
              {selectedModule && (
                <div className="immersive-selection">
                  <span>
                    {label(
                      catalog.modules.find(
                        (m) => m.id === selectedModule.moduleId,
                      )!.name,
                      language,
                    )}
                  </span>
                  {focused ? (
                    <button onClick={leaveInspection}>
                      <Minimize2 size={15} />
                      {t("inspectBack")}
                    </button>
                  ) : (
                    <button onClick={() => inspect(selectedModule.id)}>
                      <ScanSearch size={15} />
                      {t("inspect")}
                    </button>
                  )}
                </div>
              )}
              <div className="immersive-bar">
                <button
                  className="immersive-options"
                  onClick={() => setSheetOpen(true)}
                >
                  <Sliders size={17} />
                  {t("options")}
                </button>
                <strong>{priceText}</strong>
                <button className="button primary" onClick={summary}>
                  {t("summary")}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {state.interactionMode === "edit" && <SpotLabels design={design} />}
          <div className="canvas-caption">
            <span>
              {design.layout === "l" || design.layout === "corner"
                ? `${design.room.width} × ${design.room.depth} cm`
                : `${design.room.width} cm`}{" "}
              · {t("ceilingHeight")} {design.room.height} cm
            </span>
            <span>
              {design.cabinets.length}{" "}
              {t(
                design.cabinets.length === 1 ? "moduleSingular" : "modules",
              ).toLowerCase()}
            </span>
          </div>
          <p className="orbit-hint">
            {t(
              state.interactionMode === "showroom"
                ? "showroomHint"
                : "orbitHint",
            )}
          </p>
        </section>

        <aside className="design-controls">
          {immersive && (
            <button
              className="sheet-close"
              aria-label={t("cancel")}
              onClick={() => setSheetOpen(false)}
            >
              <span />
            </button>
          )}
          <div className={`panel-tabs n${tabs.length}`}>
            {tabs.map((p) => (
              <button
                key={p.key}
                className={panel === p.key ? "active" : ""}
                aria-pressed={panel === p.key}
                onClick={() => setPanel(p.key)}
              >
                <p.icon size={18} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <div
            className="panel-body"
            ref={panelBody}
            onScroll={(e) =>
              scrolls.current.set(scrollKey, e.currentTarget.scrollTop)
            }
          >
            {state.interactionMode === "showroom" && selected && (
              <Inspection
                design={design}
                onToggleInspect={() => toggleInspect(selected)}
                onEditInside={editInside}
              />
            )}
            {panel === "styles" && (
              <Materials design={design} onChange={edit} />
            )}

            {panel === "layout" && (
              <RoomAndLayoutSection
                design={design}
                catalog={catalog}
                layouts={layouts}
                onChange={edit}
                onRoomChange={roomChange}
              />
            )}

            {panel === "cabinets" && state.interactionMode === "edit" && (
              <UnitsPanel design={design} onChange={edit} />
            )}
          </div>

          <div className="price-bar">
            <span>{t("estimate")}</span>
            <strong>{priceText}</strong>
            <small>{t("indicative")}</small>
            <button className="button primary" onClick={summary}>
              {t("summary")}
              <ArrowRight size={18} />
            </button>
          </div>
        </aside>
      </div>
      <div className="mobile-offer-bar">
        <div>
          <span>{t("estimate")}</span>
          <strong>{priceText}</strong>
        </div>
        <button className="button" onClick={summary}>
          {t("summary")}
          <ArrowRight size={18} />
        </button>
      </div>
    </main>
  );
}

function Inspection({
  design,
  onToggleInspect,
  onEditInside,
}: {
  design: DesignDocument;
  onToggleInspect: () => void;
  onEditInside: (id: string) => void;
}) {
  const { catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage(),
    state = useDesigner();
  const c = design.cabinets.find((c) => c.id === state.selected);
  if (!c) return null;
  const m = catalog.modules.find((m) => m.id === c.moduleId)!;
  const storage = storageMeasurements(c, m, catalog),
    cm = (m: number) => Math.round(m * 1000) / 10;
  const focused = state.focused === c.id;
  return (
    <section className="inspection-card">
      <h3>{label(m.name, language)}</h3>
      <p>
        {c.width} × {c.height} × {c.depth} cm
      </p>
      {design.kind === "wardrobe" && (
        <>
          <p>
            {t("shelfCount")}: {storage.shelves.length} · {t("drawerCount")}:{" "}
            {storage.drawers}
          </p>
          {storage.rail && (
            <p>
              {t("railHeight")}: {cm(storage.rail)} cm
            </p>
          )}
        </>
      )}
      <div className="inspection-actions">
        <button
          className="button secondary"
          onClick={() => state.toggleOpen(c.id)}
        >
          <DoorOpen size={16} />
          {t(state.opened.includes(c.id) ? "closeUnit" : "openUnit")}
        </button>
        <button
          className={"button " + (focused ? "primary" : "secondary")}
          aria-pressed={focused}
          onClick={onToggleInspect}
        >
          {focused ? <Minimize2 size={16} /> : <ScanSearch size={16} />}
          {t(focused ? "inspectBack" : "inspect")}
        </button>
        {design.kind === "wardrobe" && (
          <button
            className="button secondary full"
            onClick={() => onEditInside(c.id)}
          >
            <PencilRuler size={16} />
            {t("editInside")}
          </button>
        )}
      </div>
    </section>
  );
}
