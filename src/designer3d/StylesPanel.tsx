import { useState } from "react";
import { Check } from "lucide-react";
import { useBrand } from "../brand";
import { label, useLanguage, useT, type TranslationKey } from "../i18n";
import type {
  Catalog,
  DesignDocument,
  FinishOverride,
  FinishZone,
  Material,
} from "../catalog/types";
import { Toggle } from "../app/components";
import { useDesigner } from "./store";
import {
  applyFinishChoice,
  applyToAll,
  finishZone,
  matchSurroundings,
  scopeValue,
  type FinishScope,
} from "./finishes";
import { KITCHEN_THEMES, WARDROBE_THEMES, type CuratedTheme } from "./looks";
import { previewSrc, type PreviewKind } from "./previews";
import { colourGroups, type ColourGroup } from "./frontColours";

/** One picture choice: a rendered preview, or the colour/texture swatch. */
function PictureTile({
  kind,
  item,
  name,
  active,
  onClick,
  shape = "square",
  caption,
}: {
  kind: PreviewKind;
  item: { id: string; color?: string; texture?: string };
  name: string;
  active: boolean;
  onClick: () => void;
  shape?: "square" | "wide";
  caption?: string;
}) {
  const { assetUrl } = useBrand();
  const src = previewSrc(kind, item.id, item.color);
  return (
    <button
      type="button"
      className={`picture-tile ${shape}${active ? " active" : ""}`}
      aria-pressed={active}
      aria-label={name}
      title={name}
      onClick={onClick}
    >
      <span
        className="picture-tile-image"
        style={{
          backgroundColor: item.color,
          backgroundImage: src
            ? `url(${assetUrl(src)})`
            : item.texture
              ? `url(${assetUrl(item.texture)})`
              : undefined,
        }}
      >
        {active && (
          <span className="picture-tile-check" aria-hidden="true">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="picture-tile-name">{name}</span>
      {caption && <span className="picture-tile-caption">{caption}</span>}
    </button>
  );
}

/** €, €€ … from a tier's price factor: a simple, honest price hint. */
function priceHint(multiplier: number) {
  return multiplier <= 1.05
    ? "€"
    : multiplier <= 1.25
      ? "€€"
      : multiplier <= 1.6
        ? "€€€"
        : "€€€€";
}

type ScopeOption = { scope: FinishScope; key: string; title: string };

/** A small drawing of this design with the parts a choice changes in colour. */
function ScopeDrawing({
  design,
  scope,
  selected,
}: {
  design: DesignDocument;
  scope: FinishScope;
  selected: string | null;
}) {
  const zones = new Set(design.cabinets.map(finishZone));
  const lit = (zone: FinishZone, index = -1) =>
    scope === "all" ||
    scope === zone ||
    (typeof scope === "object" && index === 1 && zone === selectedZone);
  const selectedZone = selected
    ? (() => {
        const c = design.cabinets.find((c) => c.id === selected);
        return c ? finishZone(c) : null;
      })()
    : null;
  const fill = (on: boolean) => (on ? "var(--primary)" : "#dfe2d6");
  const row = (
    zone: FinishZone,
    x: number,
    y: number,
    w: number,
    h: number,
    n: number,
  ) =>
    Array.from({ length: n }, (_, i) => (
      <rect
        key={`${zone}-${i}`}
        x={x + (i * w) / n + 0.6}
        y={y}
        width={w / n - 1.2}
        height={h}
        rx={1}
        fill={fill(lit(zone, i))}
      />
    ));
  if (design.kind === "wardrobe")
    return (
      <svg viewBox="0 0 64 44" aria-hidden="true">
        {row("wardrobe", 6, 4, 52, 36, 4)}
      </svg>
    );
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true">
      {zones.has("tall") && (
        <rect
          x={3}
          y={4}
          width={10}
          height={30}
          rx={1}
          fill={fill(lit("tall", 1))}
        />
      )}
      {zones.has("wall") && row("wall", 15, 4, 46, 9, 4)}
      {zones.has("base") && row("base", 15, 20, 46, 14, 4)}
      {zones.has("island") && row("island", 19, 39, 38, 7, 3)}
    </svg>
  );
}

function ScopePicker({
  design,
  scope,
  selected,
  onChange,
}: {
  design: DesignDocument;
  scope: FinishScope;
  selected: string | null;
  onChange: (scope: FinishScope) => void;
}) {
  const t = useT();
  const kitchen = design.kind === "kitchen";
  const zones = new Set(design.cabinets.map(finishZone));
  const options: ScopeOption[] = [
    {
      scope: "all",
      key: "all",
      title: t(kitchen ? "scopeAllKitchen" : "scopeAllWardrobes"),
    },
    ...(kitchen
      ? (["wall", "base", "tall", "island"] as const)
          .filter((z) => zones.has(z))
          .map((z) => ({
            scope: z,
            key: z,
            title: t(`scope${z}` as TranslationKey),
          }))
      : []),
  ];
  const isActive = (o: FinishScope) =>
    typeof o === "object" ? typeof scope === "object" : o === scope;
  return (
    <div className="scope-picker">
      <h3>{t("scopeTitle")}</h3>
      <div className="scope-options" role="group" aria-label={t("scopeTitle")}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`scope-option${isActive(o.scope) ? " active" : ""}`}
            aria-pressed={isActive(o.scope)}
            onClick={() => onChange(o.scope)}
          >
            <ScopeDrawing design={design} scope={o.scope} selected={selected} />
            <span>{o.title}</span>
          </button>
        ))}
        <button
          type="button"
          className={`scope-option${typeof scope === "object" ? " active" : ""}`}
          aria-pressed={typeof scope === "object"}
          disabled={!selected}
          onClick={() => selected && onChange({ cabinetId: selected })}
        >
          <ScopeDrawing
            design={design}
            scope={{ cabinetId: selected ?? "" }}
            selected={selected ?? design.cabinets[0]?.id ?? null}
          />
          <span>{t("scopeUnit")}</span>
        </button>
      </div>
      <p className="helper scope-help">
        {!selected && typeof scope !== "object"
          ? t("scopeUnitHint")
          : t("scopeAppliesTo")}
      </p>
    </div>
  );
}

/**
 * Fronts by colour first: one picture per colour, then (when the colour
 * comes in several) the material, with a simple price hint. Every
 * catalogue finish stays selectable.
 */
function FrontColours({
  catalog,
  value,
  onChange,
}: {
  catalog: Catalog;
  value: string;
  onChange: (id: string) => void;
}) {
  const t = useT(),
    { language } = useLanguage();
  const groups = colourGroups(catalog, language);
  const current = groups.find((g) => g.items.some((i) => i.front.id === value));
  const currentTier = current?.items.find((i) => i.front.id === value)?.tier;
  const choose = (group: ColourGroup) => {
    if (group === current) return;
    // Keep the material when this colour comes in it.
    const same = group.items.find(
      (i) => currentTier && i.tier?.id === currentTier.id,
    );
    onChange((same ?? group.items[0]).front.id);
  };
  const duplicateTier = (tierId?: string) =>
    (current?.items.filter((i) => i.tier?.id === tierId).length ?? 0) > 1;
  return (
    <>
      <div className="picture-grid colour-grid">
        {groups.map((g) => {
          const shown =
            g.items.find((i) => i.front.id === value)?.front ??
            g.items[0].front;
          return (
            <PictureTile
              key={g.key}
              kind="front"
              item={shown}
              name={g.name}
              active={g === current}
              onClick={() => choose(g)}
            />
          );
        })}
      </div>
      {current && current.items.some((i) => i.tier) && (
        <div className="material-choice">
          <h3>{t("frontMaterial", { colour: current.name })}</h3>
          <div
            className="material-options"
            role="group"
            aria-label={t("frontMaterial", { colour: current.name })}
          >
            {current.items.map(({ front, tier }) => (
              <button
                key={front.id}
                type="button"
                className={front.id === value ? "active" : ""}
                aria-pressed={front.id === value}
                onClick={() => onChange(front.id)}
              >
                <span>
                  {tier
                    ? label(tier.name, language)
                    : label(front.name, language)}
                  {duplicateTier(tier?.id) && (
                    <small>
                      {" "}
                      {front.supplier
                        ? `${front.supplier.manufacturer} ${front.supplier.code}`
                        : label(front.name, language)}
                    </small>
                  )}
                </span>
                {tier && <em>{priceHint(tier.multiplier)}</em>}
              </button>
            ))}
          </div>
          <p className="helper">
            {t(
              current.items.length > 1
                ? "frontMaterialHint"
                : "frontMaterialOnly",
            )}
          </p>
        </div>
      )}
    </>
  );
}

function WorktopGrid({
  catalog,
  value,
  onChange,
}: {
  catalog: Catalog;
  value: string;
  onChange: (id: string) => void;
}) {
  const { language } = useLanguage();
  return (
    <div className="picture-grid">
      {catalog.countertops.map((m) => {
        const tier = catalog.countertopTiers.find((t) =>
          t.decors.includes(m.id),
        );
        return (
          <PictureTile
            key={m.id}
            kind="worktop"
            item={m}
            name={label(m.name, language)}
            caption={tier ? label(tier.name, language) : undefined}
            active={value === m.id}
            onClick={() => onChange(m.id)}
          />
        );
      })}
    </div>
  );
}

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
  const kitchen = design.kind === "kitchen";
  const selectedId = useDesigner((s) => s.selected);
  const selected = design.cabinets.some((c) => c.id === selectedId)
    ? selectedId
    : null;
  const [requestedScope, setScope] = useState<FinishScope>("all");
  // A unit scope follows the selection; a zone that no longer exists falls back.
  const scope: FinishScope = compact
    ? "all"
    : typeof requestedScope === "object"
      ? selected
        ? { cabinetId: selected }
        : "all"
      : requestedScope !== "all" &&
          !design.cabinets.some((c) => finishZone(c) === requestedScope)
        ? "all"
        : requestedScope;
  const value = (key: keyof FinishOverride) => scopeValue(design, scope, key);
  const choose = (patch: FinishOverride) =>
    onChange(applyFinishChoice(design, scope, patch, catalog));
  const selectedCabinet =
    typeof scope === "object"
      ? design.cabinets.find((c) => c.id === scope.cabinetId)
      : undefined;

  const looks = kitchen ? KITCHEN_THEMES : WARDROBE_THEMES;
  const find = <T extends { id: string }>(items: T[], id: string) =>
    items.find((m) => m.id === id)?.id ?? items[0]?.id;
  const applyLook = (look: CuratedTheme) => {
    const base = applyToAll(design);
    onChange({
      ...base,
      style: {
        ...base.style,
        front: find(catalog.fronts, look.front)!,
        carcass: find(catalog.carcasses, look.carcass)!,
        handle: find(catalog.handles, look.handle)!,
        plinth: find(catalog.plinths, look.plinth)!,
        profile: look.profile,
        led: look.led,
        countertop: kitchen
          ? find(catalog.countertops, look.countertop)!
          : base.style.countertop,
      },
      environment: {
        floor: look.floor,
        wallColor: design.environment?.wallColor || "#e5e0d7",
        internalLed:
          design.kind === "wardrobe" ||
          design.environment?.internalLed ||
          false,
      },
    });
  };
  const uniform = (key: keyof FinishOverride) => scopeValue(design, "all", key);
  const mainTop = design.worktopFinishes?.main ?? design.style.countertop;
  const islandTop = design.worktopFinishes?.island;
  const activeLook = looks.find(
    (l) =>
      l.front === uniform("front") &&
      l.handle === uniform("handle") &&
      l.profile === uniform("profile") &&
      (!kitchen || (l.countertop === mainTop && !islandTop)),
  )?.id;
  const hasIsland = design.cabinets.some(
    (c) => c.wall === "island" && c.level === "base",
  );
  const setMainTop = (id: string) => {
    const { main: _, ...rest } = design.worktopFinishes ?? {};
    onChange({
      ...design,
      style: { ...design.style, countertop: id },
      worktopFinishes: Object.keys(rest).length ? rest : undefined,
    });
  };
  const setIslandTop = (id: string | undefined) => {
    const { island: _, ...rest } = design.worktopFinishes ?? {};
    const next = id ? { ...rest, island: id } : rest;
    onChange({
      ...design,
      worktopFinishes: Object.keys(next).length ? next : undefined,
    });
  };
  const thick = (id: string) =>
    ["quartz", "granite"].includes(
      catalog.countertops.find((m) => m.id === id)?.tier || "",
    );

  return (
    <div className="styles-panel">
      {!compact && (
        <section className="panel-section">
          <h2>{t("readyLooks")}</h2>
          <p className="helper">
            {t(kitchen ? "readyLooksHint" : "readyLooksHintWardrobe")}
          </p>
          <div className="look-grid">
            {looks.map((look) => (
              <button
                key={look.id}
                type="button"
                className={`look-card${activeLook === look.id ? " active" : ""}`}
                aria-pressed={activeLook === look.id}
                onClick={() => applyLook(look)}
              >
                <LookImage look={look} />
                <strong>{label(look.name, language)}</strong>
                {activeLook === look.id && (
                  <span className="picture-tile-check" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="panel-section fronts-group">
        <h2>{t(kitchen ? "frontsAndHandles" : "wardrobeFronts")}</h2>
        {!compact && (
          <ScopePicker
            design={design}
            scope={scope}
            selected={selected}
            onChange={setScope}
          />
        )}
        {selectedCabinet?.finishOverride && (
          <button
            type="button"
            className="button secondary full match-rest"
            onClick={() =>
              onChange(matchSurroundings(design, selectedCabinet.id))
            }
          >
            {t(kitchen ? "matchKitchen" : "matchWardrobes")}
          </button>
        )}
        <h3>
          {t("frontColour")}
          {!value("front") && (
            <span className="mixed-note">{t("mixedFinishes")}</span>
          )}
        </h3>
        <FrontColours
          catalog={catalog}
          value={value("front")}
          onChange={(front) => choose({ front })}
        />
        {!compact && (
          <>
            <h3>
              {t("frontStyle")}
              {!value("profile") && (
                <span className="mixed-note">{t("mixedFinishes")}</span>
              )}
            </h3>
            <div className="picture-grid two">
              {(["flat", "panel"] as const).map((profile) => (
                <PictureTile
                  key={profile}
                  kind="profile"
                  shape="wide"
                  item={{ id: `${profile}-${design.kind}`, color: "#e9e4da" }}
                  name={t(profile === "flat" ? "flat" : "classic")}
                  active={value("profile") === profile}
                  onClick={() => choose({ profile })}
                />
              ))}
            </div>
            <h3>
              {t("handle")}
              {!value("handle") && (
                <span className="mixed-note">{t("mixedFinishes")}</span>
              )}
            </h3>
            <div className="picture-grid two">
              {catalog.handles.map((h) => (
                <PictureTile
                  key={h.id}
                  kind="handle"
                  shape="wide"
                  item={{
                    id: kitchen ? h.id : `${h.id}-wardrobe`,
                    color: h.color,
                  }}
                  name={label(h.name, language)}
                  active={value("handle") === h.id}
                  onClick={() => choose({ handle: h.id })}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {kitchen && (
        <section className="panel-section">
          <h2>{t("worktop")}</h2>
          <WorktopGrid
            catalog={catalog}
            value={mainTop}
            onChange={setMainTop}
          />
          {hasIsland && (
            <>
              <Toggle
                label={t("islandWorktopDifferent")}
                checked={!!islandTop}
                onChange={(on) => setIslandTop(on ? mainTop : undefined)}
              />
              {islandTop && (
                <>
                  <h3>{t("islandWorktop")}</h3>
                  <WorktopGrid
                    catalog={catalog}
                    value={islandTop}
                    onChange={setIslandTop}
                  />
                </>
              )}
            </>
          )}
          {(thick(mainTop) || (islandTop && thick(islandTop))) && (
            <p className="helper">{t("illustrativeThickness")}</p>
          )}
        </section>
      )}

      {kitchen && !compact && (
        <section className="panel-section">
          <h2>{t("plinth")}</h2>
          <p className="helper">{t("plinthHint")}</p>
          <div className="picture-grid">
            {catalog.plinths.map((p) => {
              const front = catalog.fronts.find(
                (f) => f.id === design.style.front,
              );
              const shown = p.matches === "front" && front ? front : p;
              return (
                <PictureTile
                  key={p.id}
                  kind="front"
                  item={{
                    id: `plinth-${p.id}`,
                    color: shown.color,
                    texture: shown.texture,
                  }}
                  name={label(p.name, language)}
                  active={uniform("plinth") === p.id}
                  onClick={() =>
                    onChange(applyFinishChoice(design, "all", { plinth: p.id }))
                  }
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function LookImage({ look }: { look: CuratedTheme }) {
  const { assetUrl } = useBrand();
  const src = previewSrc("look", look.id);
  return src ? (
    <span
      className="look-image"
      style={{ backgroundImage: `url(${assetUrl(src)})` }}
    />
  ) : (
    <span className="look-image swatches-only">
      {look.swatches.map((color, i) => (
        <i key={i} style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}
