import { InteriorEditor } from "./InteriorEditor";
import { FinishScopeControl } from "./FinishScopeControl";
import {
  applyFinishChange,
  applyToAll,
  scopeValue,
  type FinishScope,
} from "./finishes";
import { selectFamily } from "../scene/furnitureMaterials";
import { lazy, Suspense, useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Undo2,
  Redo2,
  Trash2,
  Plus,
  Box,
  LayoutGrid,
  Palette,
  Check,
  DoorOpen,
  RotateCcw,
  Sliders,
  Copy,
  ChevronDown,
  Maximize2,
  Minimize2,
  RefreshCcw,
  ScanSearch,
  X,
} from "lucide-react";
import { useBrand } from "../brand";
import { useT, useLanguage, label, money, type TranslationKey } from "../i18n";
import { useDesigner } from "./store";
import { defaultDesign, resetConfiguration } from "./presets";
import { storageMeasurements } from "./storage";
import { inspectionCamera } from "./framing";
import CaptureAlternative from "./CaptureAlternative";
import { saveAlternative } from "./comparison";
import {
  examples,
  generateLayout,
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
  FinishOverride,
} from "../catalog/types";
import type { CameraPreset } from "./Scene";
import { readDesign } from "../persistence";
import { calculatePrice, estimateLabel } from "../pricing";
import {
  ErrorNotice,
  Field,
  NumberField,
  Swatches,
  Toggle,
} from "../app/components";

const Scene = lazy(() => import("./Scene"));

interface CuratedTheme {
  id: string;
  name: { en: string; sq: string; de: string };
  desc: { en: string; sq: string; de: string };
  front: string;
  countertop: string;
  carcass: string;
  handle: string;
  plinth: string;
  led: boolean;
  profile: "flat" | "panel";
  floor: "laminate" | "tiles" | "concrete";
  swatches: string[];
}

const KITCHEN_THEMES: CuratedTheme[] = [
  {
    id: "japandi",
    name: {
      en: "Japandi Minimal",
      sq: "Japandi Minimal",
      de: "Japandi Minimal",
    },
    desc: {
      en: "Cashmere matte & Travertine stone",
      sq: "Kashmir mat & gur Travertin",
      de: "Kaschmir matt & Travertinstein",
    },
    front: "cashmere",
    countertop: "travertine",
    carcass: "oak",
    handle: "none",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#d7ccba", "#c8bca8", "#bb8a55", "#202227"],
  },
  {
    id: "anthracite",
    name: {
      en: "Modern Anthracite",
      sq: "Antracit Modern",
      de: "Modernes Anthrazit",
    },
    desc: {
      en: "Deep charcoal & Granite stone",
      sq: "Antracit i errët & Granit",
      de: "Tiefes Anthrazit & Granit",
    },
    front: "anthracite",
    countertop: "granite",
    carcass: "dark",
    handle: "profile",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "concrete",
    swatches: ["#343e3e", "#232927", "#1a1c20", "#202227"],
  },
  {
    id: "sage",
    name: {
      en: "Nordic Sage",
      sq: "Sherebele Nordike",
      de: "Nordisches Salbei",
    },
    desc: {
      en: "Sage green & Carrara marble",
      sq: "Gjelbër sherebele & Mermer Carrara",
      de: "Salbeigrün & Carrara-Marmor",
    },
    front: "sage",
    countertop: "marble",
    carcass: "white",
    handle: "bar",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#7e927a", "#dedad3", "#1a1c20", "#202227"],
  },
  {
    id: "white-brass",
    name: {
      en: "Warm White & Oak",
      sq: "E bardhë e ngrohtë & Lis",
      de: "Warmweiß & Eiche",
    },
    desc: {
      en: "Warm white & Natural oak countertop",
      sq: "E bardhë e ngrohtë & Banak lisi",
      de: "Warmweiß & Eichenplatte",
    },
    front: "white",
    countertop: "oak",
    carcass: "oak",
    handle: "bar",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#f3f0e6", "#bb8a55", "#1a1c20", "#202227"],
  },
  {
    id: "oak",
    name: { en: "Natural Oak", sq: "Lis Natyral", de: "Eichendekor" },
    desc: {
      en: "Oak decor & Travertine",
      sq: "Lis natyral & Gur Travertin",
      de: "Natureiche & Travertin",
    },
    front: "oak",
    countertop: "travertine",
    carcass: "dark",
    handle: "none",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#bb8a55", "#c8bca8", "#232927", "#202227"],
  },
];

const WARDROBE_THEMES: CuratedTheme[] = [
  {
    id: "milano-oak",
    name: {
      en: "Milano Oak",
      sq: "Lis Milano",
      de: "Milano Eiche",
    },
    desc: {
      en: "Oak decor & stainless handles",
      sq: "Dekor lisi & doreza inox",
      de: "Eichendekor & Edelstahlgriffe",
    },
    front: "oak",
    countertop: "travertine",
    carcass: "dark",
    handle: "bar",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#bb8a55", "#343e3e", "#1a1c20", "#202227"],
  },
  {
    id: "nordic-cashmere",
    name: {
      en: "Nordic Cashmere",
      sq: "Kashmir Nordik",
      de: "Nordisches Kaschmir",
    },
    desc: {
      en: "Cashmere matte & warm oak carcass",
      sq: "Kashmir mat & korpus lisi të ngrohtë",
      de: "Kaschmir matt & warmer Eichenkorpus",
    },
    front: "cashmere",
    countertop: "travertine",
    carcass: "oak",
    handle: "profile",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#d7ccba", "#bb8a55", "#1a1c20", "#202227"],
  },
  {
    id: "metropolitan-anthracite",
    name: {
      en: "Metropolitan Anthracite",
      sq: "Antracit Metropol",
      de: "Metropolitan Anthrazit",
    },
    desc: {
      en: "Deep matte anthracite & black profiles",
      sq: "Antracit mat & profile të zeza",
      de: "Mattes Anthrazit & schwarze Profile",
    },
    front: "anthracite",
    countertop: "granite",
    carcass: "dark",
    handle: "profile",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "concrete",
    swatches: ["#343e3e", "#232927", "#1a1c20", "#202227"],
  },
  {
    id: "modern-white",
    name: {
      en: "Modern White & Oak",
      sq: "E Bardhë & Lis",
      de: "Modernes Weiß & Eiche",
    },
    desc: {
      en: "Warm white & natural oak interior",
      sq: "E bardhë e ngrohtë & brendësi lisi",
      de: "Warmweiß & Eichen-Innenleben",
    },
    front: "white",
    countertop: "travertine",
    carcass: "oak",
    handle: "bar",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#f3f0e6", "#bb8a55", "#1a1c20", "#202227"],
  },
  {
    id: "boutique-walnut",
    name: { en: "Boutique Walnut", sq: "Arrë Luksoze", de: "Boutique Walnuss" },
    desc: {
      en: "Rich walnut fronts & dark interior",
      sq: "Arrë e pasur & brendësi e errët",
      de: "Edles Walnuss & dunkler Korpus",
    },
    front: "walnut",
    countertop: "travertine",
    carcass: "dark",
    handle: "none",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#74533a", "#232927", "#1a1c20", "#202227"],
  },
];

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
  const selectedId = useDesigner((s) => s.selected);
  const selected = design.cabinets.some((c) => c.id === selectedId)
    ? selectedId
    : null;
  const [requestedScope, setScope] = useState<FinishScope>("all");
  const scope: FinishScope =
    typeof requestedScope === "object"
      ? selected
        ? { cabinetId: selected }
        : "all"
      : requestedScope !== "all" &&
          !design.cabinets.some(
            (c) =>
              (c.wall === "island" ? "island" : c.level) === requestedScope,
          )
        ? "all"
        : requestedScope;
  const [worktopZone, setWorktopZone] = useState<"default" | "main" | "island">(
    "default",
  );
  const hasIsland = design.cabinets.some(
    (c) => c.wall === "island" && c.level === "base",
  );
  const topZone = worktopZone === "island" && !hasIsland ? "main" : worktopZone;
  const countertop =
    (topZone === "default" ? undefined : design.worktopFinishes?.[topZone]) ??
    design.style.countertop;
  const value = (key: keyof FinishOverride) => scopeValue(design, scope, key);
  const style = (key: keyof FinishOverride, next: string) =>
    onChange(applyFinishChange(design, scope, { [key]: next }));
  const clearScope = () => {
    if (scope === "all") return onChange(applyToAll(design));
    if (typeof scope === "object")
      return onChange({
        ...design,
        cabinets: design.cabinets.map((c) => {
          if (c.id !== scope.cabinetId) return c;
          const { finishOverride: _, ...rest } = c;
          return rest;
        }),
      });
    const zones = { ...design.finishZones };
    delete zones[scope];
    onChange({ ...design, finishZones: zones });
  };

  const currentThemes =
    design.kind === "wardrobe" ? WARDROBE_THEMES : KITCHEN_THEMES;

  const applyTheme = (theme: CuratedTheme) => {
    const validFront =
      catalog.fronts.find((f) => f.id === theme.front)?.id ||
      catalog.fronts[0]?.id;
    const validCountertop =
      design.kind === "kitchen"
        ? catalog.countertops.find((c) => c.id === theme.countertop)?.id ||
          catalog.countertops[0]?.id
        : design.style.countertop;
    const validCarcass =
      catalog.carcasses.find((c) => c.id === theme.carcass)?.id ||
      catalog.carcasses[0]?.id;
    const validHandle =
      catalog.handles.find((h) => h.id === theme.handle)?.id ||
      catalog.handles[0]?.id;
    const validPlinth =
      catalog.plinths.find((p) => p.id === theme.plinth)?.id ||
      catalog.plinths[0]?.id;

    // Collections explicitly cover the displayed scope. All resets overrides in one edit.
    const base = scope === "all" ? applyToAll(design) : design;
    let next = applyFinishChange(base, scope, {
      front: validFront,
      carcass: validCarcass,
      handle: validHandle,
      plinth: validPlinth,
      profile: theme.profile,
    });
    if (scope === "all")
      next = {
        ...next,
        style: { ...next.style, countertop: validCountertop, led: theme.led },
        environment: {
          floor: theme.floor,
          wallColor: design.environment?.wallColor || "#e5e0d7",
          internalLed:
            design.kind === "wardrobe" ||
            design.environment?.internalLed ||
            false,
        },
      };
    else if (scope === "base" || scope === "island")
      next = {
        ...next,
        worktopFinishes: {
          ...next.worktopFinishes,
          [scope === "island" ? "island" : "main"]: validCountertop,
        },
      };
    onChange(next);
  };
  const activeThemeId = currentThemes.find(
    (th) =>
      th.front === value("front") &&
      th.carcass === value("carcass") &&
      th.handle === value("handle") &&
      th.plinth === value("plinth") &&
      th.profile === value("profile") &&
      (design.kind === "wardrobe" ||
        (scope === "island"
          ? (design.worktopFinishes?.island ?? design.style.countertop)
          : (design.worktopFinishes?.main ?? design.style.countertop)) ===
          th.countertop),
  )?.id;

  return (
    <>
      <FinishScopeControl
        design={design}
        selected={selected}
        value={scope}
        onChange={setScope}
      />
      <button className="button secondary full" onClick={clearScope}>
        {t(scope === "all" ? "applyAllFinishes" : "inheritFinishes")}
      </button>
      {scope === "all" && (
        <p className="helper">
          {t("globalDefault")} · {t("front")}:{" "}
          {label(
            catalog.fronts.find((m) => m.id === design.style.front)!.name,
            language,
          )}
        </p>
      )}
      <h3>{t("front")}</h3>
      <TierSwatches
        tiers={catalog.frontTiers}
        title={t("front")}
        items={catalog.fronts}
        value={value("front")}
        onChange={(v) => style("front", v)}
      />

      {design.kind === "kitchen" && (
        <>
          <h3>{t("countertop")}</h3>
          <p className="helper">{t("worktopScopeHint")}</p>
          {
            <Field label={t("worktopScope")}>
              <select
                value={topZone}
                onChange={(e) =>
                  setWorktopZone(
                    e.target.value as "default" | "main" | "island",
                  )
                }
              >
                <option value="default">{t("globalDefault")}</option>
                <option value="main">{t("mainWorktop")}</option>
                {hasIsland && (
                  <option value="island">{t("islandWorktop")}</option>
                )}
              </select>
            </Field>
          }
          <TierSwatches
            tiers={catalog.countertopTiers}
            title={t("countertop")}
            items={catalog.countertops}
            value={countertop}
            onChange={(v) =>
              onChange(
                topZone === "default"
                  ? { ...design, style: { ...design.style, countertop: v } }
                  : {
                      ...design,
                      worktopFinishes: {
                        ...design.worktopFinishes,
                        [topZone]: v,
                      },
                    },
              )
            }
          />
          {topZone !== "default" && design.worktopFinishes?.[topZone] && (
            <button
              className="button secondary"
              onClick={() => {
                const next = { ...design.worktopFinishes };
                delete next[topZone];
                onChange({ ...design, worktopFinishes: next });
              }}
            >
              {t("useGlobalFinish")}
            </button>
          )}
          {["quartz", "granite"].includes(
            catalog.countertops.find((m) => m.id === countertop)?.tier || "",
          ) && <p className="helper">{t("illustrativeThickness")}</p>}
        </>
      )}

      {!compact && (
        <>
          <h3>{t("curatedThemes")}</h3>
          <p className="helper">
            {t(
              scope === "all"
                ? "collectionAllHint"
                : typeof scope === "object"
                  ? "collectionSelectedHint"
                  : "collectionScopeHint",
            )}
          </p>
          <div className="theme-card-grid">
            {currentThemes.map((th) => {
              const active = activeThemeId === th.id;
              return (
                <button
                  key={th.id}
                  type="button"
                  className={"theme-card " + (active ? "active" : "")}
                  onClick={() => applyTheme(th)}
                >
                  <div className="theme-card-info">
                    <strong>{label(th.name, language)}</strong>
                    <span>{label(th.desc, language)}</span>
                  </div>
                  <div className="theme-card-swatches">
                    {th.swatches.map((color, i) => (
                      <span
                        key={i}
                        className="theme-swatch-dot"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    {active && <Check size={16} color="var(--primary)" />}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {!compact && (
        <>
          <h3>
            {t("handle")}{" "}
            {!value("handle") && <span>{t("mixedFinishes")}</span>}
          </h3>
          <div className="segmented-pills">
            {catalog.handles.map((h) => (
              <button
                key={h.id}
                type="button"
                className={
                  "segmented-pill " + (value("handle") === h.id ? "active" : "")
                }
                aria-pressed={value("handle") === h.id}
                onClick={() => style("handle", h.id)}
              >
                {label(h.name, language)}
              </button>
            ))}
          </div>

          <Field
            label={`${t("frontStyle")}${!value("profile") ? " · " + t("mixedFinishes") : ""}`}
          >
            <div className="segmented-pills">
              <button
                type="button"
                className={
                  "segmented-pill " +
                  (value("profile") === "flat" ? "active" : "")
                }
                aria-label={t("flat")}
                aria-pressed={value("profile") === "flat"}
                onClick={() => style("profile", "flat")}
              >
                {t("flat")}
              </button>
              <button
                type="button"
                className={
                  "segmented-pill " +
                  (value("profile") === "panel" ? "active" : "")
                }
                aria-pressed={value("profile") === "panel"}
                onClick={() => style("profile", "panel")}
              >
                {t("classic")}
              </button>
            </div>
          </Field>

          <Swatches
            title={t("plinth")}
            items={catalog.plinths}
            value={value("plinth")}
            onChange={(v) => style("plinth", v)}
          />
          {design.kind === "kitchen" && (
            <Swatches
              title={t("backsplash")}
              items={catalog.backsplashes}
              value={design.style.backsplash}
              onChange={(v) =>
                onChange({
                  ...design,
                  style: { ...design.style, backsplash: v },
                })
              }
            />
          )}
          <Swatches
            title={t("carcass")}
            items={catalog.carcasses}
            value={value("carcass")}
            onChange={(v) => style("carcass", v)}
          />
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
  const tier = tiers.find((t) => t.decors.includes(value));
  if (!tiers.length)
    return (
      <Swatches title={title} items={items} value={value} onChange={onChange} />
    );
  return (
    <>
      <Field label={`${title} · ${t("materialTier")}`}>
        <select
          value={tier?.id || ""}
          onChange={(e) =>
            onChange(
              selectFamily(
                value,
                tiers.find((t) => t.id === e.target.value)!.decors,
                items,
              ),
            )
          }
        >
          {!tier && <option value="">{t("mixedFinishes")}</option>}
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>
              {label(t.name, language)}
            </option>
          ))}
        </select>
      </Field>
      <Swatches
        title={t("color")}
        items={items.filter((m) => !!tier && tier.decors.includes(m.id))}
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
  const [replacement, setReplacement] = useState<{
    before: DesignDocument;
    next: DesignDocument;
  } | null>(null);
  const replacementRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (replacement && replacement.before !== design) setReplacement(null);
  }, [design, replacement]);
  useEffect(() => {
    replacementRef.current?.scrollIntoView({ block: "center" });
  }, [replacement]);
  const [loadFailure, setLoadFailure] = useState<string | null>(null);
  const [panel, setPanel] = useState<
    "styles" | "layout" | "cabinets" | "details"
  >("styles");
  // Showroom opens standing in the room; editing needs the whole layout.
  const [preset, setPreset] = useState<CameraPreset>(() =>
    useDesigner.getState().interactionMode === "edit" ? "overall" : "hero",
  );
  // Showroom presentation: canvas fills the screen, options in a sheet.
  const [immersive, setImmersive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reframe, setReframe] = useState(0);
  const [resetDone, setResetDone] = useState(false);
  const [saving, setSaving] = useState<{
    slot: "A" | "B";
    design: DesignDocument;
    name: string;
  } | null>(null);
  const [alternativeName, setAlternativeName] = useState("");
  const [comparisonStatus, setComparisonStatus] = useState<
    "comparisonSaved" | "comparisonError" | null
  >(null);

  useEffect(() => {
    setLoadFailure(null);
    if (useDesigner.getState().design?.kind !== kind) {
      const previousError = useDesigner.getState().error;
      const saved = readDesign(brand.slug, kind, catalog);
      setLoadFailure(saved.error);
      if (saved.error) return;
      state.setDesign(saved.design || defaultDesign(kind, catalog));
      if (previousError) state.setError(previousError);
    }
  }, [kind, catalog, brand.slug]);

  useEffect(() => {
    if (selected && state.interactionMode === "edit") {
      setPanel("cabinets");
    }
  }, [selected, state.interactionMode]);

  useEffect(() => {
    if (state.selectedInterior) setPanel("details");
  }, [state.selectedInterior?.cabinetId, state.selectedInterior?.componentId]);
  // Only a deliberate inspection moves the camera; a tap just opens the unit.
  const focused = state.focused;
  useEffect(() => {
    if (state.interactionMode === "showroom" && focused && design)
      state.setCameraView(inspectionCamera(design, focused));
  }, [focused, state.interactionMode]);
  useEffect(() => {
    if (!resetDone) return;
    const timer = setTimeout(() => setResetDone(false), 6000);
    return () => clearTimeout(timer);
  }, [resetDone]);
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
  useEffect(() => {
    setSaving(null);
    setComparisonStatus(null);
    setAlternativeName("");
  }, [kind, brand.slug]);
  if (loadFailure)
    return (
      <main className="page">
        <ErrorNotice message={loadFailure} />
      </main>
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
      setReplacement({ before: design, next });
      return false;
    }
    return state.edit(next, catalog);
  };
  const price = calculatePrice(design, catalog, language);
  const priceText = estimateLabel(price, design.exact, language);
  const layouts: Layout[] =
    kind === "kitchen"
      ? ["straight", "l", "u", "parallel", "island"]
      : ["straight", "corner", "walkin"];

  const overallView = () => {
    state.select(null);
    state.focus(null);
    state.setCameraView(null);
    setReframe((n) => n + 1);
  };
  const inspect = (id: string) => {
    state.select(id);
    setPreset("hero");
    state.focus(id);
    setReframe((n) => n + 1);
    setSheetOpen(false);
  };
  const resetConfigurationClick = () => {
    if (state.resetDesign(resetConfiguration(design, catalog), catalog)) {
      setPreset(state.interactionMode === "edit" ? "overall" : "hero");
      setReframe((n) => n + 1);
      setResetDone(true);
    }
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

  return (
    <main
      className={
        "designer-page" +
        (immersive ? " is-immersive" : "") +
        (immersive && sheetOpen ? " sheet-open" : "")
      }
    >
      {saving && (
        <CaptureAlternative
          design={saving.design}
          catalog={catalog}
          onCapture={async (image) => {
            try {
              await saveAlternative(
                brand.slug,
                saving.design,
                catalog,
                saving.slot,
                saving.name,
                async () => image,
              );
              setComparisonStatus("comparisonSaved");
            } catch {
              setComparisonStatus("comparisonError");
            }
            setSaving(null);
          }}
          onError={() => {
            setComparisonStatus("comparisonError");
            setSaving(null);
          }}
        />
      )}
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
      {resetDone && (
        <div className="notice" role="status">
          <span>{t("resetDesignDone")}</span>
          <button
            className="button secondary"
            onClick={() => {
              state.undo();
              setResetDone(false);
            }}
          >
            {t("undo")}
          </button>
        </div>
      )}

      {replacement && (
        <div
          className="notice interior-replacement"
          role="alert"
          ref={replacementRef}
        >
          <p>{t("interiorRegenerateWarning")}</p>
          <button
            className="button secondary"
            onClick={() => setReplacement(null)}
          >
            {t("cancel")}
          </button>
          <button
            className="button primary"
            onClick={() => {
              if (state.edit(replacement.next, catalog)) setReplacement(null);
            }}
          >
            {t("interiorRebuild")}
          </button>
        </div>
      )}
      <ErrorNotice
        message={state.error}
        onDismiss={() => state.setError(null)}
      />

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
              disabled={!selected || state.interactionMode !== "showroom"}
              aria-pressed={!!focused}
              onClick={() => selected && inspect(selected)}
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
              suspended={!!saving}
              reframe={reframe}
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
                    <button onClick={overallView}>
                      <Minimize2 size={15} />
                      {t("overallView")}
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
          <div className="panel-tabs">
            {(
              [
                { key: "styles", icon: Palette, label: t("styles") },
                { key: "layout", icon: LayoutGrid, label: t("roomAndLayout") },
                {
                  key: "cabinets",
                  icon: Box,
                  label: t(kind === "kitchen" ? "cabinets" : "wardrobes"),
                },
                {
                  key: "details",
                  icon: Sliders,
                  label: t(
                    kind === "wardrobe" ? "storageLighting" : "appliances",
                  ),
                },
              ] as const
            ).map((p) => (
              <button
                key={p.key}
                className={panel === p.key ? "active" : ""}
                onClick={() => setPanel(p.key)}
              >
                <p.icon size={18} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <div className="panel-body">
            {state.interactionMode === "showroom" && selected && (
              <Inspection
                design={design}
                onInspect={inspect}
                onClose={overallView}
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
              />
            )}

            {panel === "cabinets" && state.interactionMode === "edit" && (
              <CabinetsSection design={design} onChange={edit} />
            )}

            {panel === "cabinets" && state.interactionMode === "showroom" && (
              <>
                <p>{t("inspectionHelp")}</p>
                <div className="module-list">
                  {design.cabinets.map((c) => (
                    <button key={c.id} onClick={() => inspect(c.id)}>
                      {label(
                        catalog.modules.find((m) => m.id === c.moduleId)!.name,
                        language,
                      )}{" "}
                      · {c.width} cm
                    </button>
                  ))}
                </div>
              </>
            )}
            {panel === "details" && (
              <>
                <DetailsSection design={design} onChange={edit} />
                <InteriorEditor design={design} />
              </>
            )}
          </div>

          <div className="price-bar">
            <label className="alternative-name">
              {t("comparisonName")}
              <input
                maxLength={80}
                value={alternativeName}
                onChange={(e) => setAlternativeName(e.target.value)}
                placeholder={t(design.layout)}
              />
            </label>
            <div className="comparison-actions">
              {(["A", "B"] as const).map((slot) => (
                <button
                  className="button secondary"
                  key={slot}
                  disabled={!!saving}
                  onClick={() => {
                    setComparisonStatus(null);
                    setSaving({
                      slot,
                      design: structuredClone(design),
                      name: alternativeName || t(design.layout),
                    });
                  }}
                >
                  {t(slot === "A" ? "saveA" : "saveB")}
                </button>
              ))}
              <button
                className="button secondary"
                disabled={!!saving}
                onClick={() =>
                  navigate(
                    `/compare?brand=${encodeURIComponent(brand.slug)}&kind=${kind}`,
                  )
                }
              >
                {t("compare")}
              </button>
            </div>
            {(saving || comparisonStatus) && (
              <small role="status">
                {t(saving ? "sceneLoading" : comparisonStatus!)}
              </small>
            )}
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

function RoomAndLayoutSection({
  design,
  catalog,
  layouts,
  onChange,
}: {
  design: DesignDocument;
  catalog: Catalog;
  layouts: Layout[];
  onChange: (d: DesignDocument) => boolean;
}) {
  const t = useT();
  const state = useDesigner();

  const changeLayout = (l: Layout) => {
    const next = generateLayout({ ...design, layout: l }, catalog);
    if (next) onChange(next);
    else state.setError("noModules");
  };

  const applyRoomSize = (w: number, d: number, h: number = 270) => {
    const nextRoom = { ...design.room, width: w, depth: d, height: h };
    const next = generateLayout({ ...design, room: nextRoom }, catalog);
    if (next) onChange(next);
    else state.setError("fitError");
  };

  const setWindowPreset = (pos: "none" | "center" | "left" | "right") => {
    const nonWindows = design.room.openings.filter((o) => o.type !== "window");
    if (pos === "none") {
      onChange({
        ...design,
        room: { ...design.room, openings: nonWindows },
      });
      return;
    }
    const winWidth = 120;
    const offset =
      pos === "center"
        ? Math.max(20, Math.round(design.room.width / 2 - winWidth / 2))
        : pos === "left"
          ? 40
          : Math.max(20, design.room.width - winWidth - 40);
    const win: Opening = {
      id: uid(),
      wall: "back",
      type: "window",
      offset,
      width: winWidth,
      height: 130,
      sill: 100,
    };
    onChange({
      ...design,
      room: { ...design.room, openings: [...nonWindows, win] },
    });
  };

  const setDoorPreset = (pos: "none" | "left" | "right") => {
    const nonDoors = design.room.openings.filter((o) => o.type !== "door");
    if (pos === "none") {
      onChange({
        ...design,
        room: { ...design.room, openings: nonDoors },
      });
      return;
    }
    const door: Opening = {
      id: uid(),
      wall: pos === "left" ? "left" : "right",
      type: "door",
      offset: 30,
      width: 90,
      height: 210,
      sill: 0,
    };
    onChange({
      ...design,
      room: { ...design.room, openings: [...nonDoors, door] },
    });
  };

  const currentWindowPos = useMemo(() => {
    const w = design.room.openings.find((o) => o.type === "window");
    if (!w) return "none";
    if (w.offset < design.room.width * 0.3) return "left";
    if (w.offset > design.room.width * 0.6) return "right";
    return "center";
  }, [design.room.openings, design.room.width]);

  const currentDoorPos = useMemo(() => {
    const d = design.room.openings.find((o) => o.type === "door");
    if (!d) return "none";
    return d.wall === "left" ? "left" : "right";
  }, [design.room.openings]);

  const activeRoomSize = useMemo(() => {
    if (design.kind === "wardrobe") {
      if (design.room.width <= 300) return "compact";
      if (design.room.width >= 400) return "spacious";
      return "standard";
    }
    if (design.room.width <= 340) return "compact";
    if (design.room.width >= 480) return "spacious";
    return "standard";
  }, [design.room.width, design.kind]);

  return (
    <>
      <h2>{t("layout")}</h2>
      <div className="layout-options">
        {layouts.map((l) => (
          <button
            key={l}
            type="button"
            className={design.layout === l ? "active" : ""}
            onClick={() => changeLayout(l)}
          >
            <LayoutIcon layout={l} />
            <span>{t(l)}</span>
            {design.layout === l && <Check size={16} />}
          </button>
        ))}
      </div>

      <h3>{t("roomSize")}</h3>
      <div className="segmented-pills">
        {design.kind === "wardrobe" ? (
          <>
            <button
              type="button"
              className={
                "segmented-pill " +
                (activeRoomSize === "compact" ? "active" : "")
              }
              onClick={() => applyRoomSize(280, 240)}
            >
              {t("compact")} (2.8 × 2.4 m)
            </button>
            <button
              type="button"
              className={
                "segmented-pill " +
                (activeRoomSize === "standard" ? "active" : "")
              }
              onClick={() => applyRoomSize(360, 300)}
            >
              {t("standard")} (3.6 × 3.0 m)
            </button>
            <button
              type="button"
              className={
                "segmented-pill " +
                (activeRoomSize === "spacious" ? "active" : "")
              }
              onClick={() => applyRoomSize(440, 360)}
            >
              {t("spacious")} (4.4 × 3.6 m)
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={
                "segmented-pill " +
                (activeRoomSize === "compact" ? "active" : "")
              }
              onClick={() => applyRoomSize(320, 260)}
            >
              {t("compact")} (3.2 × 2.6 m)
            </button>
            <button
              type="button"
              className={
                "segmented-pill " +
                (activeRoomSize === "standard" ? "active" : "")
              }
              onClick={() => applyRoomSize(420, 360)}
            >
              {t("standard")} (4.2 × 3.6 m)
            </button>
            <button
              type="button"
              className={
                "segmented-pill " +
                (activeRoomSize === "spacious" ? "active" : "")
              }
              onClick={() => applyRoomSize(500, 400)}
            >
              {t("spacious")} (5.0 × 4.0 m)
            </button>
          </>
        )}
      </div>

      <h3>{t("windowPosition")}</h3>
      <div className="segmented-pills">
        <button
          type="button"
          className={
            "segmented-pill " + (currentWindowPos === "none" ? "active" : "")
          }
          onClick={() => setWindowPreset("none")}
        >
          {t("none")}
        </button>
        <button
          type="button"
          className={
            "segmented-pill " + (currentWindowPos === "center" ? "active" : "")
          }
          onClick={() => setWindowPreset("center")}
        >
          {t("center")}
        </button>
        <button
          type="button"
          className={
            "segmented-pill " + (currentWindowPos === "left" ? "active" : "")
          }
          onClick={() => setWindowPreset("left")}
        >
          {t("left")}
        </button>
        <button
          type="button"
          className={
            "segmented-pill " + (currentWindowPos === "right" ? "active" : "")
          }
          onClick={() => setWindowPreset("right")}
        >
          {t("right")}
        </button>
      </div>

      <h3>{t("doorPosition")}</h3>
      <div className="segmented-pills">
        <button
          type="button"
          className={
            "segmented-pill " + (currentDoorPos === "none" ? "active" : "")
          }
          onClick={() => setDoorPreset("none")}
        >
          {t("none")}
        </button>
        <button
          type="button"
          className={
            "segmented-pill " + (currentDoorPos === "left" ? "active" : "")
          }
          onClick={() => setDoorPreset("left")}
        >
          {t("left")}
        </button>
        <button
          type="button"
          className={
            "segmented-pill " + (currentDoorPos === "right" ? "active" : "")
          }
          onClick={() => setDoorPreset("right")}
        >
          {t("right")}
        </button>
      </div>

      <details style={{ marginTop: 20 }}>
        <summary
          style={{
            cursor: "pointer",
            fontSize: 12,
            color: "#6b7762",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <ChevronDown size={14} />
          {t("customDimensions")}
        </summary>
        <div style={{ marginTop: 12 }}>
          <RoomPanel design={design} onChange={onChange} />
        </div>
      </details>
    </>
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

function DetailsSection({
  design,
  onChange,
}: {
  design: DesignDocument;
  onChange: (d: DesignDocument) => void;
}) {
  const { catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage();

  return (
    <>
      <h2>
        {t(design.kind === "wardrobe" ? "storageLighting" : "appliances")}
      </h2>
      {design.kind === "kitchen" && (
        <>
          <Field label={t("appliancePackage")}>
            <div className="segmented-pills">
              {catalog.appliancePackages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={
                    "segmented-pill " +
                    (design.appliancePackage === p.id ? "active" : "")
                  }
                  onClick={() =>
                    onChange({ ...design, appliancePackage: p.id })
                  }
                >
                  {label(p.name, language)}
                  {p.price ? ` · ${money(p.price, language)}` : ""}
                </button>
              ))}
            </div>
          </Field>
          <Toggle
            label={t("led")}
            checked={design.style.led}
            onChange={(v) =>
              onChange({ ...design, style: { ...design.style, led: v } })
            }
          />
        </>
      )}

      {design.kind === "wardrobe" && (
        <Toggle
          label={t("internalLed")}
          checked={!!design.environment?.internalLed}
          onChange={(v) =>
            onChange({
              ...design,
              environment: {
                floor: design.environment?.floor || "laminate",
                wallColor: design.environment?.wallColor || "#e5e0d7",
                internalLed: v,
              },
            })
          }
        />
      )}

      <h3>{t("floorMaterial")}</h3>
      <div className="segmented-pills">
        {(["laminate", "tiles", "concrete"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={
              "segmented-pill " +
              (design.environment?.floor === k ? "active" : "")
            }
            onClick={() =>
              onChange({
                ...design,
                environment: {
                  floor: k,
                  wallColor: design.environment?.wallColor || "#e5e0d7",
                  internalLed:
                    design.environment?.internalLed ??
                    design.kind === "wardrobe",
                },
              })
            }
          >
            {t(k)}
          </button>
        ))}
      </div>

      <Field label={t("wallColor")}>
        <input
          type="color"
          value={design.environment?.wallColor || "#e5e0d7"}
          onChange={(e) =>
            onChange({
              ...design,
              environment: {
                floor: design.environment?.floor || "laminate",
                wallColor: e.target.value,
                internalLed:
                  design.environment?.internalLed ?? design.kind === "wardrobe",
              },
            })
          }
        />
      </Field>
    </>
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
      <button
        className="button primary full"
        style={{ marginTop: 12 }}
        onClick={apply}
      >
        {t("applyRoom")}
      </button>
    </>
  );
}

function Inspection({
  design,
  onInspect,
  onClose,
}: {
  design: DesignDocument;
  onInspect: (id: string) => void;
  onClose: () => void;
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
  return (
    <section className="inspection-card">
      <h3>{label(m.name, language)}</h3>
      <p>
        {c.width} × {c.height} × {c.depth} cm
      </p>
      {design.kind === "wardrobe" && (
        <>
          <p>
            {t("storageClearance")}: {cm(storage.width)} × {cm(storage.depth)}{" "}
            cm
          </p>
          <p>
            {t("shelfCount")}: {storage.shelves.length} · {t("drawerCount")}:{" "}
            {storage.drawers}
          </p>
          {storage.rail && (
            <p>
              {t("railHeight")}: {cm(storage.rail)} cm
            </p>
          )}
          {!!storage.shelves.length && (
            <p>
              {t("storageClearance")}: {storage.clearances.map(cm).join(" / ")}{" "}
              cm
            </p>
          )}
        </>
      )}
      <button
        className="button secondary"
        onClick={() => state.toggleOpen(c.id)}
      >
        {t(state.opened.includes(c.id) ? "closeUnit" : "openUnit")}
      </button>
      {state.focused === c.id ? (
        <button className="button secondary" onClick={onClose}>
          {t("overallView")}
        </button>
      ) : (
        <button className="button secondary" onClick={() => onInspect(c.id)}>
          <ScanSearch size={16} />
          {t("inspect")}
        </button>
      )}
    </section>
  );
}
