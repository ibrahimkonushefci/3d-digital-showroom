import { useEffect, useMemo, useRef, useState } from "react";
import { Box, DoorOpen, Move, Trash2, X } from "lucide-react";
import type {
  Cabinet,
  Catalog,
  DesignDocument,
  Module,
  Wall,
} from "../catalog/types";
import { useBrand } from "../brand";
import { label, useLanguage, useT, type TranslationKey } from "../i18n";
import { NumberField } from "../app/components";
import { useDesigner } from "./store";
import {
  findSpots,
  makeRoom,
  makeRoomAndPlace,
  placeUnit,
  replaceable,
  replaceUnit,
  resizeUnit,
  type Spot,
} from "./placement";
import { commitPlacement, spotScreen } from "./placementView";
import { previewSrc } from "./previews";
import { InteriorCards } from "./InteriorCards";

const LEVELS: Record<DesignDocument["kind"], Module["level"][]> = {
  kitchen: ["base", "tall", "wall"],
  wardrobe: ["wardrobe"],
};
const LEVEL_TITLE: Record<Module["level"], TranslationKey> = {
  base: "unitsBase",
  tall: "unitsTall",
  wall: "unitsWall",
  wardrobe: "unitsWardrobe",
};
const WALL_NAME: Record<Wall, TranslationKey> = {
  back: "wallBack",
  left: "wallLeft",
  right: "wallRight",
  front: "wallFront",
  island: "wallIsland",
};

function UnitPicture({ module }: { module: Module }) {
  const src = previewSrc("unit", module.id);
  return (
    <span className="unit-picture">
      {src ? <img src={"/" + src} alt="" /> : <Box size={26} />}
    </span>
  );
}

/**
 * Edit mode's Units tab: the selected unit (width, replace, delete), then
 * picture cards of every unit type. Tap a card to see where it fits (here
 * and as boxes in the room), or drag it into the room.
 */
export function UnitsPanel({
  design,
  onChange,
}: {
  design: DesignDocument;
  onChange: (d: DesignDocument) => boolean;
}) {
  const { catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage();
  const selected = useDesigner((s) => s.selected);
  const placing = useDesigner((s) => s.placing);
  const c = design.cabinets.find((x) => x.id === selected);
  const name = (id: string) =>
    label(catalog.modules.find((m) => m.id === id)!.name, language);
  // The corner carousel only belongs in the corner of an L.
  const modules = catalog.modules.filter(
    (m) =>
      m.kind === design.kind && (m.type !== "corner" || design.layout === "l"),
  );
  return (
    <div className="units-panel">
      {c ? (
        <SelectedUnit design={design} cabinet={c} onChange={onChange} />
      ) : (
        <p className="helper units-hint">{t("selectCabinet")}</p>
      )}
      <h3>{t("addUnitCatalog")}</h3>
      <p className="helper">{t("addUnitHint")}</p>
      {LEVELS[design.kind].map((level) => {
        const items = modules.filter((m) => m.level === level);
        if (!items.length) return null;
        return (
          <section key={level} className="unit-group">
            {LEVELS[design.kind].length > 1 && <h4>{t(LEVEL_TITLE[level])}</h4>}
            <div className="unit-cards">
              {items.map((m) => (
                <UnitCard
                  key={m.id}
                  module={m}
                  design={design}
                  catalog={catalog}
                  active={placing === m.id}
                />
              ))}
            </div>
            {placing && items.some((m) => m.id === placing) && (
              <PlacingHelp
                design={design}
                moduleId={placing}
                name={name}
                onChange={onChange}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

function UnitCard({
  module: m,
  design,
  catalog,
  active,
}: {
  module: Module;
  design: DesignDocument;
  catalog: Catalog;
  active: boolean;
}) {
  const t = useT(),
    { language } = useLanguage();
  const spots = findSpots(design, catalog, m.id);
  const name = label(m.name, language);
  const widths =
    m.widths.length > 1
      ? `${Math.min(...m.widths)}–${Math.max(...m.widths)} cm`
      : `${m.widths[0]} cm`;
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
    index: number | null;
  } | null>(null);
  const [ghost, setGhost] = useState<{
    x: number;
    y: number;
    over: boolean;
  } | null>(null);
  const nearest = (x: number, y: number) => {
    const centres = spotScreen.centres?.() ?? [];
    let best: number | null = null,
      distance = 160;
    centres.forEach((p, i) => {
      const d = p ? Math.hypot(p.x - x, p.y - y) : Infinity;
      if (d < distance) {
        distance = d;
        best = i;
      }
    });
    return best as number | null;
  };
  const overCanvas = (x: number, y: number) => {
    const canvas = document.querySelector(".canvas-panel canvas");
    const r = canvas?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  const end = () => {
    drag.current = null;
    setGhost(null);
    const s = useDesigner.getState();
    s.setPlacingHover(null);
    s.cancelDrag();
  };
  useEffect(() => end, []);
  return (
    <>
      <button
        type="button"
        className={"unit-card" + (active ? " active" : "")}
        aria-pressed={active}
        aria-label={`${name}, ${widths}. ${spots.length ? t("fitsPlaces", { n: spots.length }) : t("fitsNowhere")}`}
        onClick={() => {
          if (drag.current?.moved) return;
          const s = useDesigner.getState();
          s.setPlacing(active ? null : m.id);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || !spots.length) return;
          drag.current = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            moved: false,
            index: null,
          };
        }}
        onPointerMove={(e) => {
          const a = drag.current;
          if (!a || a.id !== e.pointerId) return;
          if (!a.moved) {
            if (Math.hypot(e.clientX - a.x, e.clientY - a.y) < 10) return;
            a.moved = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const s = useDesigner.getState();
            s.setPlacing(m.id);
            s.previewDrag(design);
          }
          const over = overCanvas(e.clientX, e.clientY);
          const index = over ? nearest(e.clientX, e.clientY) : null;
          setGhost({ x: e.clientX, y: e.clientY, over });
          if (index === a.index) return;
          a.index = index;
          const s = useDesigner.getState();
          s.setPlacingHover(index);
          const placed =
            index === null
              ? null
              : placeUnit(design, catalog, m.id, spots[index]);
          s.previewDrag(placed ? placed.design : design);
        }}
        onPointerUp={(e) => {
          const a = drag.current;
          if (!a || a.id !== e.pointerId) return;
          if (!a.moved) {
            drag.current = null;
            return;
          }
          const index = a.index;
          end();
          // Keep `moved` until the click that follows this pointerup.
          drag.current = { ...a, moved: true };
          setTimeout(() => (drag.current = null), 0);
          if (index !== null)
            commitPlacement(
              placeUnit(design, catalog, m.id, spots[index]),
              catalog,
              t("unitAdded", { name }),
            );
          else useDesigner.getState().setNotice({ text: t("dropHint") });
        }}
        onPointerCancel={end}
      >
        <UnitPicture module={m} />
        <strong>{name}</strong>
        <span>{widths}</span>
        <small className={spots.length ? "fits" : "full"}>
          {spots.length
            ? t("fitsPlaces", { n: spots.length })
            : t("fitsNowhere")}
        </small>
      </button>
      {ghost && (
        <div
          className={"unit-drag-ghost" + (ghost.over ? " over" : "")}
          style={{ left: ghost.x, top: ghost.y }}
          aria-hidden
        >
          <Move size={14} />
          {drag.current?.index != null
            ? `${name} · ${spots[drag.current.index].options[0].width} cm`
            : t("dropHint")}
        </div>
      )}
    </>
  );
}

/** Where the tapped unit fits, in words, or what to do when it fits nowhere. */
function PlacingHelp({
  design,
  moduleId,
  name,
  onChange,
}: {
  design: DesignDocument;
  moduleId: string;
  name: (moduleId: string) => string;
  onChange: (d: DesignDocument) => boolean;
}) {
  const { catalog } = useBrand(),
    t = useT();
  const spots = findSpots(design, catalog, moduleId);
  const unit = name(moduleId);
  const cabinetName = (id?: string) => {
    const c = design.cabinets.find((x) => x.id === id);
    return c ? name(c.moduleId) : null;
  };
  const where = (s: Spot) => {
    const a = cabinetName(s.before),
      b = cabinetName(s.after);
    const near =
      a && b
        ? t("spotBetween", { a, b })
        : a || b
          ? t("spotNextTo", { name: (a || b)! })
          : t("spotFree");
    return `${t(WALL_NAME[s.wall])} · ${near}`;
  };
  const swaps = useMemo(
    () =>
      spots.length ? [] : replaceable(design, catalog, moduleId).slice(0, 2),
    [design, catalog, moduleId, spots.length],
  );
  const narrow = useMemo(
    () => (spots.length ? [] : makeRoom(design, catalog, moduleId, 2)),
    [design, catalog, moduleId, spots.length],
  );
  // The suggested units light up in the room.
  useEffect(() => {
    useDesigner
      .getState()
      .setHighlight([
        ...swaps.map((s) => s.cabinetId),
        ...narrow.map((s) => s.cabinetId),
      ]);
    return () => useDesigner.getState().setHighlight([]);
  }, [swaps, narrow]);
  const box = useRef<HTMLDivElement>(null);
  // Bring the answer into view after a tap (not while dragging a card).
  useEffect(() => {
    if (!useDesigner.getState().dragging)
      box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [moduleId]);
  const close = () => useDesigner.getState().setPlacing(null);
  // Pointing at a suggestion lights up only the unit it is about.
  const all = [...swaps, ...narrow].map((s) => s.cabinetId);
  const point = (id: string) => ({
    onMouseEnter: () => useDesigner.getState().setHighlight([id]),
    onMouseLeave: () => useDesigner.getState().setHighlight(all),
    onFocus: () => useDesigner.getState().setHighlight([id]),
    onBlur: () => useDesigner.getState().setHighlight(all),
  });
  const added = t("unitAdded", { name: unit });
  return (
    <div ref={box} className="placing-help" role="region" aria-label={unit}>
      <div className="placing-help-head">
        <strong>
          {spots.length
            ? t("placeWhere", { name: unit })
            : t("noSpace", { name: unit })}
        </strong>
        <button
          type="button"
          className="icon-button small"
          aria-label={t("close")}
          onClick={close}
        >
          <X size={16} />
        </button>
      </div>
      {spots.length > 0 ? (
        <>
          <p className="helper">{t("placeHint")}</p>
          <ul className="spot-list">
            {spots.map((s) => (
              <li key={`${s.wall}:${s.gap[0]}`}>
                <button
                  type="button"
                  className="spot-row"
                  onClick={() =>
                    commitPlacement(
                      placeUnit(design, catalog, moduleId, s),
                      catalog,
                      added,
                    )
                  }
                >
                  <span>{where(s)}</span>
                  <strong>+ {s.options[0].width} cm</strong>
                </button>
                {s.options.length > 1 && (
                  <div className="spot-widths">
                    <span>{t("otherWidths")}</span>
                    {s.options.slice(1, 5).map((o) => (
                      <button
                        key={o.width}
                        type="button"
                        className="segmented-pill"
                        onClick={() =>
                          commitPlacement(
                            placeUnit(design, catalog, moduleId, s, o.width),
                            catalog,
                            added,
                          )
                        }
                      >
                        {o.width}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="helper">
            {swaps.length || narrow.length
              ? t("noSpaceHelp")
              : t("noSpaceNothing")}
          </p>
          <ul className="spot-list">
            {swaps.map((s) => (
              <li key={"r" + s.cabinetId}>
                <button
                  type="button"
                  className="spot-row"
                  {...point(s.cabinetId)}
                  onClick={() => {
                    const next = replaceUnit(
                      design,
                      catalog,
                      s.cabinetId,
                      moduleId,
                    );
                    if (next && onChange(next)) {
                      const st = useDesigner.getState();
                      st.select(s.cabinetId);
                      st.setPlacing(null);
                      st.setNotice({
                        text: t("unitReplaced", { name: unit }),
                        undo: true,
                      });
                    }
                  }}
                >
                  <span>
                    {t("replaceSuggestion", {
                      name: cabinetName(s.cabinetId)!,
                    })}
                  </span>
                  <strong>{s.width} cm</strong>
                </button>
              </li>
            ))}
            {narrow.map((s) => {
              const c = design.cabinets.find((x) => x.id === s.cabinetId)!;
              return (
                <li key={"n" + s.cabinetId}>
                  <button
                    type="button"
                    className="spot-row"
                    {...point(s.cabinetId)}
                    onClick={() =>
                      commitPlacement(
                        makeRoomAndPlace(design, catalog, moduleId, s),
                        catalog,
                        added,
                      )
                    }
                  >
                    <span>
                      {t("narrowSuggestion", {
                        name: name(c.moduleId),
                        from: c.width,
                        to: s.width,
                      })}
                    </span>
                    <strong>+ {s.spot.options[0].width} cm</strong>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function SelectedUnit({
  design,
  cabinet: c,
  onChange,
}: {
  design: DesignDocument;
  cabinet: Cabinet;
  onChange: (d: DesignDocument) => boolean;
}) {
  const { catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage();
  const opened = useDesigner((s) => s.opened.includes(c.id));
  const m = catalog.modules.find((x) => x.id === c.moduleId)!;
  const name = label(m.name, language);
  const widths = m.widths.map((w) => ({
    w,
    next: w === c.width ? design : resizeUnit(design, catalog, c.id, w),
  }));
  const swaps = catalog.modules
    .filter(
      (x) =>
        x.kind === design.kind &&
        x.level === c.level &&
        (x.type !== "corner" || (design.layout === "l" && c.wall !== "island")),
    )
    .map((x) => ({
      m: x,
      next:
        x.id === c.moduleId ? design : replaceUnit(design, catalog, c.id, x.id),
    }));
  return (
    <section className="unit-selected" aria-label={name}>
      <div className="unit-selected-head">
        <UnitPicture module={m} />
        <div>
          <strong>{name}</strong>
          <span>
            {c.width} × {c.depth} × {c.height} cm
          </span>
        </div>
        <button
          type="button"
          className="icon-button small"
          aria-label={t("close")}
          onClick={() => useDesigner.getState().select(null)}
        >
          <X size={16} />
        </button>
      </div>
      <h4>{t("width")}</h4>
      <div className="segmented-pills">
        {widths.map(({ w, next }) => (
          <button
            key={w}
            type="button"
            className={"segmented-pill" + (c.width === w ? " active" : "")}
            aria-pressed={c.width === w}
            disabled={!next}
            title={next ? undefined : t("widthNoSpace")}
            onClick={() => next && next !== design && onChange(next)}
          >
            {w}
          </button>
        ))}
      </div>
      {c.level === "wardrobe" && (
        <NumberField
          label={t("height")}
          value={c.height}
          min={180}
          max={m.height}
          onChange={(height) => {
            const next = {
              ...design,
              cabinets: design.cabinets.map((x) =>
                x.id === c.id ? { ...x, height } : x,
              ),
            };
            onChange(next);
          }}
        />
      )}
      {swaps.length > 1 && (
        <>
          <h4>{t("replaceWith")}</h4>
          <div className="unit-swaps">
            {swaps.map(({ m: x, next }) => {
              const current = x.id === c.moduleId;
              return (
                <button
                  key={x.id}
                  type="button"
                  className={"unit-swap" + (current ? " active" : "")}
                  aria-pressed={current}
                  disabled={!next}
                  title={next ? undefined : t("replaceNoSpace")}
                  onClick={() => {
                    if (!next || current || !onChange(next)) return;
                    useDesigner.getState().setNotice({
                      text: t("unitReplaced", {
                        name: label(x.name, language),
                      }),
                      undo: true,
                    });
                  }}
                >
                  <UnitPicture module={x} />
                  <span>{label(x.name, language)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="unit-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => useDesigner.getState().toggleOpen(c.id)}
        >
          <DoorOpen size={16} />
          {t(opened ? "closeUnit" : "openUnit")}
        </button>
        <button
          type="button"
          className="button danger"
          onClick={() =>
            deleteUnit(design, c.id, onChange, t("unitDeleted", { name }))
          }
        >
          <Trash2 size={16} />
          {t("deleteUnit")}
        </button>
      </div>
      <p className="helper">{t("unitMoveHint")}</p>
      {design.kind === "wardrobe" && (
        <InteriorCards design={design} cabinet={c} />
      )}
    </section>
  );
}

/** Delete (button or Delete key): one undoable edit with an Undo notice. */
export function deleteUnit(
  design: DesignDocument,
  id: string,
  onChange: (d: DesignDocument) => boolean,
  text: string,
) {
  if (
    !onChange({
      ...design,
      cabinets: design.cabinets.filter((x) => x.id !== id),
    })
  )
    return false;
  const s = useDesigner.getState();
  s.select(null);
  s.setNotice({ text, undo: true });
  return true;
}

/**
 * The "+ 40 cm" labels over the highlighted places in the room, as plain
 * buttons that follow the 3D boxes while a unit is being placed.
 */
export function SpotLabels({ design }: { design: DesignDocument }) {
  const { catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage();
  const placing = useDesigner((s) => s.placing);
  const hover = useDesigner((s) => s.placingHover);
  const [points, setPoints] = useState<Array<{ x: number; y: number } | null>>(
    [],
  );
  useEffect(() => {
    if (!placing) return setPoints([]);
    let frame = 0,
      last = "";
    const tick = () => {
      const next = spotScreen.centres?.() ?? [];
      const key = next
        .map((p) => (p ? `${Math.round(p.x)},${Math.round(p.y)}` : "-"))
        .join(" ");
      if (key !== last) {
        last = key;
        setPoints(next);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [placing]);
  if (!placing) return null;
  const spots = findSpots(design, catalog, placing);
  const m = catalog.modules.find((x) => x.id === placing)!;
  const text = t("unitAdded", { name: label(m.name, language) });
  return (
    <>
      {spots.map((spot, i) =>
        points[i] ? (
          <button
            key={`${spot.wall}:${spot.gap[0]}`}
            type="button"
            className={"spot-label" + (hover === i ? " active" : "")}
            style={{ left: points[i]!.x, top: points[i]!.y }}
            onClick={() =>
              commitPlacement(
                placeUnit(design, catalog, placing, spot),
                catalog,
                text,
              )
            }
          >
            + {spot.options[0].width} cm
          </button>
        ) : null,
      )}
    </>
  );
}
