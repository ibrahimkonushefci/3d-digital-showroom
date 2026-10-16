import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useBrand } from "../brand";
import { label, useLanguage, useT, type TranslationKey } from "../i18n";
import type { Catalog, DesignDocument, Layout } from "../catalog/types";
import { presentationPresets } from "./presets";
import { useDesigner } from "./store";
import {
  resizeRoom,
  smallestRoom,
  switchLayout,
  type ResizeResult,
} from "./resize";
import { previewSrc } from "./previews";

/** What the Room tab reports back: the change and a sentence about it. */
export type RoomChange = (result: ResizeResult, message: string) => void;

/** Kitchen and wardrobe runs along one wall show only its width; L
 * kitchens and corner wardrobes also have a second side (the left wall,
 * which is the room's depth). Ceiling height is always shown. */
const twoSided = (layout: Layout) => layout === "l" || layout === "corner";
const ROOM_SIZES = {
  kitchen: {
    one: [320, 420, 500],
    island: [400, 480, 560],
    two: [
      [320, 260],
      [420, 360],
      [500, 400],
    ],
  },
  wardrobe: {
    one: [280, 360, 440],
    island: [280, 360, 440],
    two: [
      [280, 240],
      [360, 300],
      [440, 360],
    ],
  },
} as const;
const SIZE_KEYS = ["compact", "standard", "spacious"] as const;
/** The three size buttons for this layout; a hidden depth stays as it is. */
function roomSizes(design: DesignDocument) {
  const sizes = ROOM_SIZES[design.kind];
  return SIZE_KEYS.map((key, i) =>
    twoSided(design.layout)
      ? { key, width: sizes.two[i][0], depth: sizes.two[i][1] }
      : {
          key,
          width: (design.layout === "island" ? sizes.island : sizes.one)[i],
          depth: design.room.depth,
        },
  );
}
const LIMITS = {
  width: [200, 800],
  depth: [200, 800],
  height: [220, 330],
} as const;
type Dimension = keyof typeof LIMITS;

/** A short list of wall colours that suit kitchens and dressing rooms. */
export const WALL_COLORS: Array<{
  color: string;
  name: { en: string; sq: string; de: string };
}> = [
  {
    color: "#f1eee8",
    name: { en: "Off-white", sq: "E bardhë e butë", de: "Altweiß" },
  },
  {
    color: "#e5e0d7",
    name: { en: "Warm white", sq: "E bardhë e ngrohtë", de: "Warmweiß" },
  },
  {
    color: "#d6d1c8",
    name: { en: "Warm grey", sq: "Gri e ngrohtë", de: "Warmgrau" },
  },
  {
    color: "#c9cfc2",
    name: { en: "Sage grey", sq: "Gri sherebele", de: "Salbeigrau" },
  },
  {
    color: "#5d615f",
    name: { en: "Charcoal", sq: "Qymyr", de: "Anthrazit" },
  },
];
const FLOORS = ["laminate", "tiles", "concrete"] as const;
const FLOOR_COLORS = {
  laminate: "#c49a6c",
  tiles: "#d9d6cf",
  concrete: "#a6a39c",
};

export function RoomAndLayoutSection({
  design,
  catalog,
  layouts,
  onChange,
  onRoomChange,
}: {
  design: DesignDocument;
  catalog: Catalog;
  layouts: Layout[];
  onChange: (d: DesignDocument) => boolean;
  onRoomChange: RoomChange;
}) {
  const t = useT();
  const prepared = useMemo(() => presentationPresets(catalog), [catalog]);
  const cm = (n: number) =>
    (n / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

  const sizeText = (s: { width: number; depth: number }) =>
    twoSided(design.layout) ? `${s.width} × ${s.depth} cm` : `${s.width} cm`;
  const describe = (r: ResizeResult) => {
    const parts = [
      t("roomNowSize", {
        size: sizeText(r.design.room),
        height: r.design.room.height,
      }),
    ];
    if (r.added) parts.push(t("unitsAdded", { n: r.added }));
    if (r.removed) parts.push(t("unitsRemoved", { n: r.removed }));
    if (r.resized) parts.push(t("unitsResized", { n: r.resized }));
    const tallest = (d: DesignDocument) =>
      Math.max(
        0,
        ...d.cabinets
          .filter((c) => c.level === "wardrobe")
          .map((c) => c.height),
      );
    const height = tallest(r.design);
    if (height !== tallest(design))
      parts.push(t("wardrobesHeightNow", { height }));
    else if (!r.added && !r.removed && !r.resized)
      parts.push(t("unitsUnchanged"));
    return parts.join(" ");
  };
  const changeLayout = (layout: Layout) => {
    if (layout === design.layout) return;
    const preset = prepared.find(
      (p) => p.design.kind === design.kind && p.design.layout === layout,
    )?.design;
    const r = switchLayout(design, layout, catalog, preset);
    if (!r) return void useDesigner.getState().setError("noModules");
    onRoomChange(
      r,
      r.roomChanged
        ? t("layoutNeedsRoom", {
            layout: t(layout),
            size: `${r.design.room.width} × ${r.design.room.depth} cm`,
          })
        : t("layoutChanged", { layout: t(layout) }),
    );
  };
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => setProblem(null), [design.layout, design.kind]);
  const resize = (size: { width: number; depth: number; height: number }) => {
    const r = resizeRoom(design, size, catalog);
    if (!r) {
      // Rejected: say why and which size would work.
      const smallest = smallestRoom(design, size, catalog);
      setProblem(
        smallest
          ? t(
              design.kind === "kitchen"
                ? "roomTooSmallKitchen"
                : "roomTooSmallWardrobe",
              { size: sizeText(smallest) },
            )
          : t("roomTooSmall"),
      );
      return false;
    }
    setProblem(null);
    onRoomChange(r, describe(r));
    return true;
  };
  const sizes = roomSizes(design);
  const activeSize = sizes.find(
    (s) => s.width === design.room.width && s.depth === design.room.depth,
  )?.key;

  return (
    <div className="room-panel">
      <section className="panel-section">
        <h2>{t("layout")}</h2>
        <div className={`layout-options n${layouts.length}`}>
          {layouts.map((l) => (
            <button
              key={l}
              type="button"
              className={design.layout === l ? "active" : ""}
              aria-pressed={design.layout === l}
              onClick={() => changeLayout(l)}
            >
              <LayoutIcon layout={l} />
              <span>{t(l)}</span>
              {design.layout === l && (
                <Check size={13} className="layout-check" />
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h2>{t(design.kind === "kitchen" ? "kitchenSize" : "wardrobeSize")}</h2>
        <div className="size-options">
          {sizes.map((s) => (
            <button
              key={s.key}
              type="button"
              className={activeSize === s.key ? "active" : ""}
              aria-pressed={activeSize === s.key}
              onClick={() =>
                resize({
                  width: s.width,
                  depth: s.depth,
                  height: design.room.height,
                })
              }
            >
              <strong>{t(s.key)}</strong>
              <small>
                {twoSided(design.layout)
                  ? `${cm(s.width)} × ${cm(s.depth)} m`
                  : `${cm(s.width)} m`}
              </small>
            </button>
          ))}
        </div>
        <CustomDimensions
          design={design}
          catalog={catalog}
          problem={problem}
          onEdit={() => setProblem(null)}
          onApply={resize}
        />
      </section>

      <RoomFinishes design={design} onChange={onChange} />
    </div>
  );
}

/**
 * The kitchen (or wardrobe) width along its wall, the second side for L
 * kitchens and corner wardrobes, and the ceiling height, applied together
 * (button or Enter). Kitchen units keep their heights; wardrobes are full
 * height and only get shorter under a low ceiling.
 */
function CustomDimensions({
  design,
  catalog,
  problem,
  onEdit,
  onApply,
}: {
  design: DesignDocument;
  catalog: Catalog;
  problem: string | null;
  onEdit: () => void;
  onApply: (size: { width: number; depth: number; height: number }) => boolean;
}) {
  const t = useT();
  const kitchen = design.kind === "kitchen";
  const fields: Array<{ key: Dimension; label: TranslationKey }> = [
    { key: "width", label: kitchen ? "kitchenWidth" : "wardrobeWidth" },
    ...(twoSided(design.layout)
      ? [{ key: "depth" as const, label: "secondSide" as const }]
      : []),
    { key: "height", label: "ceilingHeight" },
  ];
  const current = {
    width: design.room.width,
    depth: design.room.depth,
    height: design.room.height,
  };
  const [draft, setDraft] = useState<Record<Dimension, string>>({
    width: String(current.width),
    depth: String(current.depth),
    height: String(current.height),
  });
  useEffect(() => {
    setDraft({
      width: String(design.room.width),
      depth: String(design.room.depth),
      height: String(design.room.height),
    });
  }, [design.room.width, design.room.depth, design.room.height]);
  const values = {
    width: Number(draft.width),
    depth: Number(draft.depth),
    height: Number(draft.height),
  };
  const invalid = fields.find(
    ({ key: k }) =>
      !Number.isFinite(values[k]) ||
      draft[k].trim() === "" ||
      values[k] < LIMITS[k][0] ||
      values[k] > LIMITS[k][1],
  );
  const changed = fields.some(({ key: k }) => values[k] !== current[k]);
  const apply = () => {
    if (invalid || !changed) return;
    onApply(values);
  };
  // Full wardrobe height, and what the ceiling being entered leaves of it.
  const fullHeight = Math.max(
    0,
    ...design.cabinets
      .filter((c) => c.level === "wardrobe")
      .map(
        (c) => catalog.modules.find((m) => m.id === c.moduleId)?.height ?? 0,
      ),
  );
  const ceiling =
    invalid?.key === "height" ? design.room.height : values.height;
  const wardrobeHeight = Math.min(fullHeight, Math.floor(ceiling / 10) * 10);
  return (
    <form
      className="custom-dimensions"
      // Any whole centimetre is fine; the range is checked above.
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <h3>{t("customDimensions")}</h3>
      <div className={`dimension-row n${fields.length}`}>
        {fields.map(({ key: k, label: name }) => (
          <label
            key={k}
            className={`field${invalid?.key === k ? " invalid" : ""}`}
          >
            <span>{t(name)}</span>
            <div className="number-input">
              <input
                type="number"
                inputMode="numeric"
                min={LIMITS[k][0]}
                max={LIMITS[k][1]}
                step={10}
                value={draft[k]}
                aria-invalid={invalid?.key === k}
                onChange={(e) => {
                  setDraft({ ...draft, [k]: e.target.value });
                  onEdit();
                }}
              />
              <span>cm</span>
            </div>
          </label>
        ))}
      </div>
      {invalid ? (
        <p className="helper warning">
          {t("dimensionRange", {
            what: t(invalid.label),
            min: LIMITS[invalid.key][0],
            max: LIMITS[invalid.key][1],
          })}
        </p>
      ) : problem ? (
        <p className="helper warning" role="alert">
          {problem}
        </p>
      ) : (
        <p className="helper">
          {t(kitchen ? "dimensionsHintKitchen" : "dimensionsHintWardrobe")}
        </p>
      )}
      <p className="helper">
        {kitchen
          ? t("kitchenHeightsFixed")
          : wardrobeHeight < fullHeight
            ? t("wardrobeHeightLowered", {
                height: wardrobeHeight,
                max: fullHeight,
              })
            : t("wardrobeHeightFull", { max: fullHeight })}
      </p>
      <button
        type="submit"
        className="button primary full"
        disabled={!!invalid || !changed}
      >
        {t("applyRoom")}
      </button>
    </form>
  );
}

/** Floor and wall colour, part of the room rather than the furniture. */
function RoomFinishes({
  design,
  onChange,
}: {
  design: DesignDocument;
  onChange: (d: DesignDocument) => void;
}) {
  const t = useT(),
    { language } = useLanguage(),
    { assetUrl } = useBrand();
  const environment = {
    floor: design.environment?.floor || ("laminate" as const),
    wallColor: design.environment?.wallColor || "#e5e0d7",
    internalLed: design.environment?.internalLed ?? design.kind === "wardrobe",
  };
  const set = (patch: Partial<typeof environment>) =>
    onChange({ ...design, environment: { ...environment, ...patch } });
  const wall = environment.wallColor.toLowerCase();
  // A colour from an older design stays visible (and chosen) until changed.
  const colours = WALL_COLORS.some((c) => c.color === wall)
    ? WALL_COLORS
    : [
        ...WALL_COLORS,
        {
          color: wall,
          name: {
            en: "Current colour",
            sq: "Ngjyra aktuale",
            de: "Aktuelle Farbe",
          },
        },
      ];
  return (
    <>
      <section className="panel-section">
        <h2>{t("floorMaterial")}</h2>
        <div className="picture-grid three">
          {FLOORS.map((k) => {
            const src = previewSrc("floor", k);
            return (
              <button
                key={k}
                type="button"
                className={`picture-tile${environment.floor === k ? " active" : ""}`}
                aria-pressed={environment.floor === k}
                onClick={() => set({ floor: k })}
              >
                <span
                  className="picture-tile-image"
                  style={{
                    backgroundColor: FLOOR_COLORS[k],
                    backgroundImage: src ? `url(${assetUrl(src)})` : undefined,
                  }}
                >
                  {environment.floor === k && (
                    <span className="picture-tile-check" aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="picture-tile-name">{t(k)}</span>
              </button>
            );
          })}
        </div>
      </section>
      <section className="panel-section">
        <h2>{t("wallColor")}</h2>
        <div className="wall-colours" role="group" aria-label={t("wallColor")}>
          {colours.map((c) => (
            <button
              key={c.color}
              type="button"
              className={wall === c.color ? "active" : ""}
              aria-pressed={wall === c.color}
              aria-label={label(c.name, language)}
              title={label(c.name, language)}
              style={{ backgroundColor: c.color }}
              onClick={() => set({ wallColor: c.color })}
            >
              {wall === c.color && (
                <Check
                  size={14}
                  strokeWidth={3}
                  aria-hidden="true"
                  color={isDark(c.color) ? "#ffffff" : "#2f3a2c"}
                />
              )}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

/** A dark swatch gets a white tick. */
function isDark(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (
    ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 <
    128
  );
}

function LayoutIcon({ layout }: { layout: Layout }) {
  const path =
    layout === "straight"
      ? "M7 10H33"
      : layout === "l" || layout === "corner"
        ? "M7 10V30H33"
        : "M7 10H33M12 26H28";
  return (
    <svg width="40" height="36" viewBox="0 0 40 40" aria-hidden="true">
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="6"
        fill="none"
        strokeLinecap="square"
      />
    </svg>
  );
}
