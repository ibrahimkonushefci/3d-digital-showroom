import { InteriorEditor } from "./InteriorEditor";
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
  useMemo,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Undo2,
  Redo2,
  Trash2,
  Box,
  LayoutGrid,
  Palette,
  DoorOpen,
  RotateCcw,
  Sliders,
  Copy,
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
import { uid, wallOffset, wallPosition } from "./layout";
import type { Cabinet, DesignDocument, Layout, Wall } from "../catalog/types";
import type { CameraPreset, CameraView } from "./Scene";
import { readDesign } from "../persistence";
import { fpsDiagnostics } from "../scene/diagnostics/enabled";
import { calculatePrice, estimateLabel } from "../pricing";
import { Field, NumberField } from "../app/components";
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
              <CabinetsSection design={design} onChange={edit} />
            )}

            {panel === "cabinets" &&
              state.interactionMode === "edit" &&
              kind === "wardrobe" &&
              design.cabinets.some((c) => c.id === selected) && (
                <InteriorEditor design={design} />
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

function CabinetsSection({
  design,
  onChange,
}: {
  design: DesignDocument;
  onChange: (d: DesignDocument) => boolean;
}) {
  const { catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage(),
    state = useDesigner();

  const c = design.cabinets.find((item) => item.id === state.selected);

  const update = (partial: Partial<Cabinet>) => {
    if (!c) return;
    const next = { ...c, ...partial };
    if (partial.width || partial.wall || partial.depth) {
      Object.assign(
        next,
        wallPosition(
          next.wall,
          wallOffset(c),
          next.width,
          next.depth,
          design.room,
        ),
      );
    }
    onChange({
      ...design,
      cabinets: design.cabinets.map((x) => (x.id === c.id ? next : x)),
    });
  };

  const nudge = (step: number) => {
    if (!c) return;
    const currentOff = wallOffset(c);
    const newOff = Math.max(0, currentOff + step);
    const pos = wallPosition(c.wall, newOff, c.width, c.depth, design.room);
    onChange({
      ...design,
      cabinets: design.cabinets.map((x) =>
        x.id === c.id ? { ...x, ...pos } : x,
      ),
    });
  };

  const duplicate = () => {
    if (!c) return;
    const n: Cabinet = {
      ...c,
      id: uid(),
      ...(c.interior
        ? {
            interior: {
              version: 1 as const,
              components: c.interior.components.map((i) => ({
                ...i,
                id: uid(),
              })),
            },
          }
        : {}),
    };
    const offset = wallOffset(c) + c.width;
    Object.assign(
      n,
      wallPosition(c.wall, offset, n.width, n.depth, design.room),
    );
    if (onChange({ ...design, cabinets: [...design.cabinets, n] })) {
      state.select(n.id);
    }
  };

  const remove = () => {
    if (!c) return;
    if (
      onChange({
        ...design,
        cabinets: design.cabinets.filter((x) => x.id !== c.id),
      })
    ) {
      state.select(null);
    }
  };

  const addModuleToKitchen = (moduleId: string, defaultWidth?: number) => {
    const m = catalog.modules.find((x) => x.id === moduleId);
    if (!m) return;
    const wall: Wall = c?.wall || "back";
    const width =
      defaultWidth || m.widths[0] || (design.kind === "wardrobe" ? 80 : 60);
    const offset = c
      ? wallOffset(c) + c.width
      : design.room.width / 2 - width / 2;
    const n: Cabinet = {
      id: uid(),
      moduleId: m.id,
      width,
      height:
        m.level === "wardrobe"
          ? Math.min(m.height, design.room.height)
          : m.height,
      depth: m.depth,
      level: m.level,
      wall,
      x: 0,
      z: 0,
      rotation: 0,
    };
    Object.assign(n, wallPosition(wall, offset, width, m.depth, design.room));
    if (onChange({ ...design, cabinets: [...design.cabinets, n] })) {
      state.select(n.id);
    }
  };

  const selectedModule = c
    ? catalog.modules.find((m) => m.id === c.moduleId)
    : null;

  const compatibleModules = useMemo(() => {
    if (!c) return [];
    return catalog.modules.filter(
      (m) => m.kind === design.kind && m.level === c.level,
    );
  }, [c, catalog.modules, design.kind]);

  return (
    <>
      {c && selectedModule ? (
        <div className="inspector-card">
          <div className="inspector-header">
            <strong>{label(selectedModule.name, language)}</strong>
            <span className="badge-dims">
              {c.width} × {c.depth} × {c.height} cm
            </span>
          </div>

          {c.interior && (
            <>
              <p className="helper">{t("interiorResizeHelp")}</p>
              <button
                className="button secondary full"
                onClick={() => update({ interior: undefined })}
              >
                {t("interiorReset")}
              </button>
            </>
          )}
          <Field label={t("width")}>
            <div className="segmented-pills">
              {selectedModule.widths.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={
                    "segmented-pill " + (c.width === w ? "active" : "")
                  }
                  onClick={() => update({ width: w })}
                >
                  {w} cm
                </button>
              ))}
            </div>
          </Field>

          {c.level === "wardrobe" && (
            <NumberField
              label={t("height")}
              value={c.height}
              min={180}
              max={selectedModule.height}
              onChange={(height) => update({ height })}
            />
          )}
          {compatibleModules.length > 1 && (
            <Field label={t("swapType")}>
              <div className="segmented-pills">
                {compatibleModules.map((mod) => (
                  <button
                    key={mod.id}
                    type="button"
                    className={
                      "segmented-pill " +
                      (c.moduleId === mod.id ? "active" : "")
                    }
                    onClick={() =>
                      update({
                        moduleId: mod.id,
                        depth: mod.depth,
                        height: mod.height,
                        level: mod.level,
                        width: mod.widths.includes(c.width)
                          ? c.width
                          : mod.widths[0],
                      })
                    }
                  >
                    {label(mod.name, language)}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <div className="nudge-buttons">
            <button type="button" onClick={() => nudge(-10)}>
              ← {t("moveLeft")} 10cm
            </button>
            <button type="button" onClick={() => nudge(+10)}>
              {t("moveRight")} 10cm →
            </button>
          </div>

          <div className="inspector-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => state.toggleOpen(c.id)}
            >
              <DoorOpen size={16} />
              {t("openClose")}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={duplicate}
            >
              <Copy size={16} />
              {t("duplicateUnit")}
            </button>
            <button
              type="button"
              className="button danger full"
              style={{ gridColumn: "span 2" }}
              onClick={remove}
            >
              <Trash2 size={16} />
              {t("deleteUnit")}
            </button>
          </div>
        </div>
      ) : (
        <p className="helper">{t("selectCabinet")}</p>
      )}

      <h3>{t("addUnitCatalog")}</h3>
      <div className="unit-catalog-grid">
        {catalog.modules
          .filter((m) => m.kind === design.kind)
          .map((m) => {
            const width = m.widths.includes(design.kind === "kitchen" ? 60 : 80)
              ? design.kind === "kitchen"
                ? 60
                : 80
              : m.widths[0];
            return (
              <button
                key={m.id}
                className="unit-catalog-card"
                onClick={() => addModuleToKitchen(m.id, width)}
              >
                <strong>{label(m.name, language)}</strong>
                <span>
                  {width} × {m.height} × {m.depth} cm
                </span>
              </button>
            );
          })}
      </div>

      <h3>{t(design.kind === "wardrobe" ? "wardrobes" : "cabinets")}</h3>
      <div className="module-list">
        {design.cabinets.map((x) => (
          <button
            key={x.id}
            type="button"
            className={x.id === state.selected ? "active" : ""}
            onClick={() => state.select(x.id)}
          >
            <span>
              {label(
                catalog.modules.find((m) => m.id === x.moduleId)!.name,
                language,
              )}
            </span>
            <small>{x.width} cm</small>
          </button>
        ))}
      </div>
    </>
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
