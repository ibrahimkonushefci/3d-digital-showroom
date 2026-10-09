import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Undo2,
  Redo2,
  Trash2,
  Plus,
  Box,
  LayoutGrid,
  Ruler,
  Palette,
  Check,
} from "lucide-react";
import { useBrand } from "../brand";
import { useT, useLanguage, label, money, type TranslationKey } from "../i18n";
import { useDesigner } from "./store";
import {
  examples,
  generateLayout,
  newDesign,
  uid,
  wallOffset,
  wallPosition,
} from "./layout";
import type {
  Material,
  Catalog,
  Cabinet,
  DesignDocument,
  Layout,
  Opening,
  Room,
  Wall,
} from "../catalog/types";
import type { CameraPreset } from "./Scene";
import { loadDesign } from "../persistence";
import { calculatePrice } from "../pricing";
import {
  ErrorNotice,
  Field,
  NumberField,
  Swatches,
  Toggle,
} from "../app/components";
const Scene = lazy(() => import("./Scene"));
export function Materials({
  design,
  onChange,
  compact = false,
}: {
  design: DesignDocument;
  onChange: (d: DesignDocument) => void;
  compact?: boolean;
}) {
  const { catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage();
  const style = (key: keyof DesignDocument["style"], value: string | boolean) =>
    onChange({ ...design, style: { ...design.style, [key]: value } });
  return (
    <>
      <TierSwatches
        title={t("front")}
        items={catalog.fronts}
        tiers={catalog.frontTiers}
        value={design.style.front}
        onChange={(v) => style("front", v)}
      />
      {design.kind === "kitchen" && (
        <TierSwatches
          title={t("countertop")}
          items={catalog.countertops}
          tiers={catalog.countertopTiers}
          value={design.style.countertop}
          onChange={(v) => style("countertop", v)}
        />
      )}
      {[
        catalog.fronts.find((m) => m.id === design.style.front),
        catalog.countertops.find((m) => m.id === design.style.countertop),
      ]
        .filter((m) => m?.supplier)
        .map((m) => (
          <p key={m!.id} className="helper">
            {m!.supplier!.manufacturer} · {m!.supplier!.code}
            <br />
            {t("illustrativeFinish")}
          </p>
        ))}
      {!compact && (
        <>
          <Field label={t("floorMaterial")}>
            <select
              value={design.environment?.floor || "laminate"}
              onChange={(e) =>
                onChange({
                  ...design,
                  environment: {
                    floor: e.target.value as "laminate" | "tiles" | "concrete",
                    wallColor: design.environment?.wallColor || "#d4d8df",
                    internalLed: design.environment?.internalLed || false,
                  },
                })
              }
            >
              {(["laminate", "tiles", "concrete"] as const).map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("wallColor")}>
            <input
              type="color"
              value={design.environment?.wallColor || "#d4d8df"}
              onChange={(e) =>
                onChange({
                  ...design,
                  environment: {
                    floor: design.environment?.floor || "laminate",
                    wallColor: e.target.value,
                    internalLed: design.environment?.internalLed || false,
                  },
                })
              }
            />
          </Field>
          {design.kind === "wardrobe" && (
            <Toggle
              label={t("internalLed")}
              checked={!!design.environment?.internalLed}
              onChange={(v) =>
                onChange({
                  ...design,
                  environment: {
                    floor: design.environment?.floor || "laminate",
                    wallColor: design.environment?.wallColor || "#d4d8df",
                    internalLed: v,
                  },
                })
              }
            />
          )}
        </>
      )}
      {!compact && (
        <>
          <Field label={t("frontStyle")}>
            <select
              value={design.style.profile}
              onChange={(e) => style("profile", e.target.value)}
            >
              <option value="flat">{t("flat")}</option>
              <option value="panel">{t("classic")}</option>
            </select>
          </Field>
          <Swatches
            title={t("carcass")}
            items={catalog.carcasses}
            value={design.style.carcass}
            onChange={(v) => style("carcass", v)}
          />
          <Field label={t("handle")}>
            <select
              value={design.style.handle}
              onChange={(e) => style("handle", e.target.value)}
            >
              {catalog.handles.map((h) => (
                <option key={h.id} value={h.id}>
                  {label(h.name, language)}
                </option>
              ))}
            </select>
          </Field>
          {design.kind === "kitchen" && (
            <>
              <Field label={t("backsplash")}>
                <select
                  value={design.style.backsplash}
                  onChange={(e) => style("backsplash", e.target.value)}
                >
                  {catalog.backsplashes.map((h) => (
                    <option key={h.id} value={h.id}>
                      {label(h.name, language)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("plinth")}>
                <select
                  value={design.style.plinth}
                  onChange={(e) => style("plinth", e.target.value)}
                >
                  {catalog.plinths.map((h) => (
                    <option key={h.id} value={h.id}>
                      {label(h.name, language)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("appliancePackage")}>
                <select
                  value={design.appliancePackage || "none"}
                  onChange={(e) =>
                    onChange({ ...design, appliancePackage: e.target.value })
                  }
                >
                  {catalog.appliancePackages.map((p) => (
                    <option value={p.id} key={p.id}>
                      {label(p.name, language)}
                      {p.price ? ` · ${money(p.price, language)}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Toggle
                label={t("led")}
                checked={design.style.led}
                onChange={(v) => style("led", v)}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
function TierSwatches({
  title,
  items,
  tiers,
  value,
  onChange,
}: {
  title: string;
  items: Material[];
  tiers: Catalog["frontTiers"] | Catalog["countertopTiers"];
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT(),
    { language } = useLanguage();
  const tier = items.find((m) => m.id === value)?.tier;
  return (
    <>
      <Field label={`${title} · ${t("materialTier")}`}>
        <select
          value={tier}
          onChange={(e) =>
            onChange(tiers.find((t) => t.id === e.target.value)!.decors[0])
          }
        >
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>
              {label(t.name, language)}
            </option>
          ))}
        </select>
      </Field>
      <Swatches
        title={t("color")}
        items={items.filter((m) => !tier || m.tier === tier)}
        value={value}
        onChange={onChange}
      />
    </>
  );
}
export default function Designer() {
  const { kind: rawKind } = useParams(),
    kind = rawKind === "wardrobe" ? "wardrobe" : "kitchen";
  const { brand, catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage(),
    navigate = useNavigate();
  const state = useDesigner();
  const { design, selected, past, future } = state;
  const [panel, setPanel] = useState<"room" | "layout" | "materials" | "edit">(
      "materials",
    ),
    [preset, setPreset] = useState<CameraPreset>("perspective");
  const capture = useRef<(() => Promise<string>) | null>(null);
  const registerCapture = useCallback((fn: () => Promise<string>) => {
    capture.current = fn;
  }, []);
  useEffect(() => {
    if (useDesigner.getState().design?.kind !== kind) {
      const previousError = useDesigner.getState().error;
      const saved = loadDesign(brand.slug, kind, catalog);
      const example = examples(catalog).find((d) => d.kind === kind);
      state.setDesign(
        saved ||
          example ||
          generateLayout(
            newDesign(kind, kind === "kitchen" ? "l" : "straight"),
            catalog,
          )!,
      );
      if (previousError) state.setError(previousError);
    }
  }, [kind, catalog, brand.slug]);
  useEffect(() => {
    if (selected && state.interactionMode === "edit") setPanel("edit");
  }, [selected, state.interactionMode]);
  if (!design || design.kind !== kind)
    return <div className="startup">{t("sceneLoading")}</div>;
  const edit = (next: DesignDocument) => state.edit(next, catalog);
  const price = calculatePrice(design, catalog, language);
  const layouts: Layout[] =
    kind === "kitchen"
      ? ["straight", "l", "u", "parallel", "island"]
      : ["straight", "corner", "walkin"];
  const summary = async () => {
    if (capture.current) {
      try {
        state.setScreenshot(await capture.current());
      } catch {
        /* Summary can retry capture. */
      }
    }
    navigate("/summary" + location.search);
  };
  return (
    <main className={"designer-page mode-" + state.interactionMode}>
      <div className="designer-heading">
        <div>
          <div className="eyebrow">{t("madeForYou")}</div>
          <h1>{t(kind === "kitchen" ? "kitchens" : "wardrobes")}</h1>
        </div>
        <div className="history-buttons">
          <div className="mode-switch">
            {(["showroom", "edit"] as const).map((mode) => (
              <button
                key={mode}
                aria-pressed={state.interactionMode === mode}
                onClick={() => {
                  state.setInteractionMode(mode);
                  setPanel(mode === "showroom" ? "materials" : "edit");
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
        </div>
      </div>
      <ErrorNotice
        message={state.error}
        onDismiss={() => state.setError(null)}
      />
      <div className="designer-workspace">
        <section className="canvas-panel">
          <div className="canvas-controls">
            {(["perspective", "front", "top"] as const).map((p) => (
              <button
                key={p}
                className={preset === p ? "active" : ""}
                onClick={() => setPreset(p)}
              >
                {t(p === "front" ? "frontCamera" : p)}
              </button>
            ))}
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
              capture={registerCapture}
            />
          </Suspense>
          <div className="canvas-caption">
            <span>
              {design.room.width} × {design.room.depth} × {design.room.height}{" "}
              cm
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
                : "editHint",
            )}
          </p>
        </section>
        <aside className="design-controls">
          {state.interactionMode === "edit" && (
            <div className="panel-tabs">
              {(
                [
                  { key: "room", icon: Ruler },
                  { key: "layout", icon: LayoutGrid },
                  { key: "materials", icon: Palette },
                  { key: "edit", icon: Box },
                ] as const
              ).map((p) => (
                <button
                  key={p.key}
                  className={panel === p.key ? "active" : ""}
                  onClick={() => setPanel(p.key)}
                >
                  <p.icon size={18} />
                  <span>{t(p.key)}</span>
                </button>
              ))}
            </div>
          )}
          <div className="panel-body">
            {panel === "materials" && (
              <Materials
                design={design}
                onChange={edit}
                compact={state.interactionMode === "showroom"}
              />
            )}{" "}
            {panel === "layout" && (
              <>
                <h2>{t("layout")}</h2>
                <div className="layout-options">
                  {layouts.map((l) => (
                    <button
                      key={l}
                      className={design.layout === l ? "active" : ""}
                      onClick={() => {
                        const next = generateLayout(
                          { ...design, layout: l },
                          catalog,
                        );
                        if (next) edit(next);
                        else state.setError("noModules");
                      }}
                    >
                      <LayoutIcon layout={l} />
                      <span>{t(l)}</span>
                      {design.layout === l && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <p className="helper">{t("regenerateWarning")}</p>
              </>
            )}
            {panel === "room" && <RoomPanel design={design} onChange={edit} />}{" "}
            {panel === "edit" && (
              <CabinetPanel design={design} onChange={edit} />
            )}
          </div>
          <div className="price-bar">
            <span>{t("estimate")}</span>
            <strong>
              {design.exact
                ? money(price.total, language)
                : `${money(price.low, language)} – ${money(price.high, language)}`}
            </strong>
            <small>{t("indicative")}</small>
            <button className="button primary" onClick={summary}>
              {t("summary")}
              <ArrowRight size={18} />
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
function LayoutIcon({ layout }: { layout: Layout }) {
  const path =
    layout === "straight"
      ? "M8 12H42"
      : layout === "l" || layout === "corner"
        ? "M8 12V40H42"
        : layout === "u" || layout === "walkin"
          ? "M8 38V12H42V38"
          : layout === "parallel"
            ? "M8 12H42M8 36H42"
            : "M8 12H42M16 34H34";
  return (
    <svg width="50" height="45" viewBox="0 0 50 50" aria-hidden="true">
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="8"
        fill="none"
        strokeLinecap="square"
      />
    </svg>
  );
}
function RoomPanel({
  design,
  onChange,
}: {
  design: DesignDocument;
  onChange: (d: DesignDocument) => boolean;
}) {
  const { catalog } = useBrand(),
    t = useT();
  const [room, setRoom] = useState<Room>(structuredClone(design.room));
  useEffect(() => setRoom(structuredClone(design.room)), [design.room]);
  const update = (key: "width" | "depth" | "height", value: number) =>
    setRoom({ ...room, [key]: value });
  const openingUpdate = (id: string, key: keyof Opening, v: string | number) =>
    setRoom({
      ...room,
      openings: room.openings.map((o) =>
        o.id === id ? { ...o, [key]: v } : o,
      ),
    });
  const apply = () => {
    const next = generateLayout({ ...design, room }, catalog);
    if (next) onChange(next);
    else useDesigner.getState().setError("fitError");
  };
  return (
    <>
      <h2>{t("room")}</h2>
      <div className="dimension-grid">
        <NumberField
          label={t("width")}
          value={room.width}
          min={120}
          onChange={(v) => update("width", v)}
        />
        <NumberField
          label={t("depth")}
          value={room.depth}
          min={120}
          onChange={(v) => update("depth", v)}
        />
        <NumberField
          label={t("height")}
          value={room.height}
          min={180}
          max={600}
          onChange={(v) => update("height", v)}
        />
      </div>
      <h3>{t("opening")}</h3>
      {room.openings.map((o) => (
        <div key={o.id} className="opening-card">
          <div className="opening-head">
            <Field label={t("opening")}>
              <select
                value={o.type}
                onChange={(e) => openingUpdate(o.id, "type", e.target.value)}
              >
                <option value="window">{t("window")}</option>
                <option value="door">{t("door")}</option>
              </select>
            </Field>
            <button
              className="icon-button danger"
              aria-label={t("delete")}
              onClick={() =>
                setRoom({
                  ...room,
                  openings: room.openings.filter((x) => x.id !== o.id),
                })
              }
            >
              <Trash2 size={18} />
            </button>
          </div>
          <Field label={t("wall")}>
            <select
              value={o.wall}
              onChange={(e) => openingUpdate(o.id, "wall", e.target.value)}
            >
              {["back", "left", "right", "front"].map((w) => (
                <option value={w} key={w}>
                  {t(w === "front" ? "frontWall" : (w as TranslationKey))}
                </option>
              ))}
            </select>
          </Field>
          <div className="dimension-grid">
            <NumberField
              label={t("offset")}
              value={o.offset}
              onChange={(v) => openingUpdate(o.id, "offset", v)}
            />
            <NumberField
              label={t("width")}
              value={o.width}
              onChange={(v) => openingUpdate(o.id, "width", v)}
            />
            <NumberField
              label={t("height")}
              value={o.height}
              onChange={(v) => openingUpdate(o.id, "height", v)}
            />
            <NumberField
              label={t("sill")}
              value={o.sill}
              onChange={(v) => openingUpdate(o.id, "sill", v)}
            />
          </div>
        </div>
      ))}
      <button
        className="button secondary full"
        onClick={() =>
          setRoom({
            ...room,
            openings: [
              ...room.openings,
              {
                id: uid(),
                wall: "back",
                type: "window",
                offset: 150,
                width: 100,
                height: 100,
                sill: 100,
              },
            ],
          })
        }
      >
        <Plus size={17} />
        {t("addOpening")}
      </button>
      <p className="helper">{t("regenerateWarning")}</p>
      <button className="button primary full" onClick={apply}>
        {t("applyRoom")}
      </button>
    </>
  );
}
function CabinetPanel({
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
  const c = design.cabinets.find((c) => c.id === state.selected);
  const [adding, setAdding] = useState(false),
    [addId, setAddId] = useState(
      design.kind === "kitchen" ? "base-doors" : "wardrobe-hanging",
    ),
    [addWall, setAddWall] = useState<Wall>("back"),
    [addOffset, setAddOffset] = useState(0);
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
  const add = () => {
    const m = catalog.modules.find((m) => m.id === addId)!;
    const wall = c?.wall || addWall,
      offset = c ? wallOffset(c) + c.width : addOffset;
    const n: Cabinet = {
      id: uid(),
      moduleId: m.id,
      width: m.widths.includes(c?.width || 60) ? c?.width || 60 : m.widths[0],
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
    Object.assign(n, wallPosition(wall, offset, n.width, n.depth, design.room));
    if (onChange({ ...design, cabinets: [...design.cabinets, n] })) {
      state.select(n.id);
      setAdding(false);
    }
  };
  return (
    <>
      <h2>{t("edit")}</h2>
      {!c ? (
        <p className="helper">{t("selectCabinet")}</p>
      ) : (
        <>
          <div className="selected-title">
            <span>
              {label(
                catalog.modules.find((m) => m.id === c.moduleId)!.name,
                language,
              )}
            </span>
            <small>
              {c.width} × {c.depth} × {c.height} cm
            </small>
          </div>
          <Field label={t("moduleType")}>
            <select
              value={c.moduleId}
              onChange={(e) => {
                const m = catalog.modules.find((m) => m.id === e.target.value)!;
                update({
                  moduleId: m.id,
                  depth: m.depth,
                  height: m.height,
                  level: m.level,
                  width: m.widths.includes(c.width) ? c.width : m.widths[0],
                });
              }}
            >
              {catalog.modules
                .filter((m) => m.kind === design.kind)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {label(m.name, language)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("width")}>
            <select
              value={c.width}
              onChange={(e) => update({ width: Number(e.target.value) })}
            >
              {catalog.modules
                .find((m) => m.id === c.moduleId)!
                .widths.map((w) => (
                  <option key={w} value={w}>
                    {w} cm
                  </option>
                ))}
            </select>
          </Field>
          {c.level === "wall" && (
            <Field label={t("wallHeight")}>
              <select
                value={c.height}
                onChange={(e) => update({ height: Number(e.target.value) })}
              >
                <option value={72}>72 cm</option>
                <option value={90}>90 cm</option>
              </select>
            </Field>
          )}
          <Field label={t("wall")}>
            <select
              value={c.wall}
              onChange={(e) => update({ wall: e.target.value as Wall })}
            >
              {[
                "back",
                "left",
                "right",
                "front",
                ...(design.kind === "kitchen" ? ["island"] : []),
              ].map((w) => (
                <option key={w} value={w}>
                  {t(w === "front" ? "frontWall" : (w as TranslationKey))}
                </option>
              ))}
            </select>
          </Field>
          <NumberField
            label={t("position")}
            value={Math.round(wallOffset(c))}
            step={10}
            onChange={(v) =>
              update(
                wallPosition(
                  c.wall,
                  Math.round(v / 10) * 10,
                  c.width,
                  c.depth,
                  design.room,
                ),
              )
            }
          />
          <button
            className="button secondary full"
            onClick={() => state.toggleOpen(c.id)}
          >
            {t("openClose")}
          </button>
          <button
            className="button danger full"
            onClick={() => {
              if (
                onChange({
                  ...design,
                  cabinets: design.cabinets.filter((x) => x.id !== c.id),
                })
              )
                state.select(null);
            }}
          >
            <Trash2 size={17} />
            {t("delete")}
          </button>
        </>
      )}
      <button
        className="button secondary full"
        onClick={() => setAdding(!adding)}
      >
        <Plus size={17} />
        {t(c ? "addNext" : "addModule")}
      </button>
      {adding && (
        <div className="opening-card">
          <Field label={t("moduleType")}>
            <select value={addId} onChange={(e) => setAddId(e.target.value)}>
              {catalog.modules
                .filter((m) => m.kind === design.kind)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {label(m.name, language)}
                  </option>
                ))}
            </select>
          </Field>
          {!c && (
            <>
              <Field label={t("wall")}>
                <select
                  value={addWall}
                  onChange={(e) => setAddWall(e.target.value as Wall)}
                >
                  {["back", "left", "right", "front"].map((w) => (
                    <option key={w} value={w}>
                      {t(w === "front" ? "frontWall" : (w as TranslationKey))}
                    </option>
                  ))}
                </select>
              </Field>
              <NumberField
                label={t("position")}
                value={addOffset}
                step={10}
                onChange={setAddOffset}
              />
            </>
          )}
          <button className="button primary full" onClick={add}>
            {t("addModule")}
          </button>
        </div>
      )}
      <p className="helper">{t("fitHint")}</p>
      <div className="module-list">
        {design.cabinets.map((x) => (
          <button
            key={x.id}
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
