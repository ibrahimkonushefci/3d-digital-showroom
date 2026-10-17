import { ChevronDown, ChevronUp, Eye, Trash2 } from "lucide-react";
import type { Cabinet, DesignDocument } from "../catalog/types";
import { useBrand } from "../brand";
import { label, money, useLanguage, useT, type TranslationKey } from "../i18n";
import { useDesigner } from "./store";
import {
  canEditInterior,
  interiorAdjustments,
  presetComponents,
  resolveInterior,
  withInterior,
  type InteriorItem,
} from "./interiors";
import {
  interiorPositions,
  preferredPosition,
  pullOutBlocked,
} from "./interiorValidation";
import { previewSrc } from "./previews";
import { uid } from "./layout";

const HINT: Record<InteriorItem["kind"], TranslationKey> = {
  shelf: "interiorShelfHint",
  rail: "interiorRailHint",
  drawer: "interiorDrawerHint",
  basket: "interiorBasketHint",
  divider: "interiorShelfHint",
};

function InteriorPicture({ kind }: { kind: string }) {
  const src = previewSrc("interior", kind);
  return (
    <span className="interior-picture">
      {src ? <img src={"/" + src} alt="" /> : <i className={"glyph " + kind} />}
    </span>
  );
}

/**
 * "Inside this unit" for the selected wardrobe: what is inside as picture
 * rows (move, open, remove), the parts that can be added as picture cards
 * with where they fit, and the ready-made interiors. Every change goes
 * through the store's edit, so it is validated and undoable.
 */
export function InteriorCards({
  design,
  cabinet: c,
}: {
  design: DesignDocument;
  cabinet: Cabinet;
}) {
  const { catalog } = useBrand(),
    t = useT(),
    { language } = useLanguage(),
    state = useDesigner();
  const m = catalog.modules.find((x) => x.id === c.moduleId)!;
  if (!canEditInterior(m, catalog))
    return <p className="helper">{t("interiorUnavailable")}</p>;
  const parts = resolveInterior(c, m, catalog);
  const items = catalog.interiorItems!.filter(
    (i) => i.kind !== "divider" && i.compatibleModuleTypes.includes(m.type),
  );
  const commit = (next: Cabinet, text?: string) => {
    const ok = state.edit(
      {
        ...design,
        cabinets: design.cabinets.map((x) => (x.id === c.id ? next : x)),
      },
      catalog,
    );
    if (ok && text) state.setNotice({ text, undo: true });
    return ok;
  };
  const plain = parts.map(({ id, productId, yCm }) => ({ id, productId, yCm }));
  const blocked = (i: InteriorItem) =>
    m.type === "sliding" && (i.kind === "drawer" || i.kind === "basket");
  const show = (componentId: string) => {
    state.setInterior(true);
    state.selectInterior({ cabinetId: c.id, componentId });
  };
  const add = (i: InteriorItem) => {
    const positions = interiorPositions(c, m, catalog, i.id);
    const y = preferredPosition(
      positions,
      i.kind,
      parts.map((p) => p.yCm),
      c.height - 3.6,
    );
    if (y === undefined) return;
    const id = `${c.id}:${uid()}`;
    if (
      commit(
        withInterior(c, [...plain, { id, productId: i.id, yCm: y }]),
        t("interiorAdded", { name: label(i.name, language) }),
      )
    )
      show(id);
  };
  // One step up or down: the next height at least 10 cm away that fits.
  const moveTarget = (partId: string, dir: 1 | -1) => {
    const part = parts.find((p) => p.id === partId)!;
    const positions = interiorPositions(c, m, catalog, part.productId, partId);
    return dir > 0
      ? positions.find((y) => y >= part.yCm + 10)
      : [...positions].reverse().find((y) => y <= part.yCm - 10);
  };
  const move = (partId: string, y: number) =>
    commit(
      withInterior(
        c,
        plain.map((p) => (p.id === partId ? { ...p, yCm: y } : p)),
      ),
    ) && show(partId);
  // When a part fits nowhere: swap an existing part of another kind for it.
  const swapsFor = (i: InteriorItem) =>
    parts
      .filter((p) => p.productId !== i.id)
      .map((p) => {
        const y = interiorPositions(c, m, catalog, i.id, p.id).reduce<
          number | undefined
        >(
          (best, y) =>
            best === undefined || Math.abs(y - p.yCm) < Math.abs(best - p.yCm)
              ? y
              : best,
          undefined,
        );
        return y === undefined ? null : { part: p, y };
      })
      .filter(Boolean)
      .slice(0, 2) as Array<{ part: (typeof parts)[number]; y: number }>;
  const adjustment = interiorAdjustments(c, m, catalog).reduce(
    (n, i) => n + i.quantity * i.unitPrice,
    0,
  );
  const selectedPart =
    state.selectedInterior?.cabinetId === c.id
      ? state.selectedInterior.componentId
      : null;
  return (
    <div className="interior-cards">
      <div className="interior-cards-head">
        <h4>{t("insideThisUnit")}</h4>
        <button
          type="button"
          className={"segmented-pill" + (state.interior ? " active" : "")}
          aria-pressed={state.interior}
          onClick={() => state.setInterior(!state.interior)}
        >
          <Eye size={14} />
          {t("interiorView")}
        </button>
      </div>
      <ul className="interior-rows" aria-label={t("interiorComponents")}>
        {[...parts]
          .sort((a, b) => b.yCm - a.yCm)
          .map((p) => {
            const up = moveTarget(p.id, 1),
              down = moveTarget(p.id, -1);
            const name = p.item ? label(p.item.name, language) : p.kind;
            const pulls = p.kind === "drawer" || p.kind === "basket";
            return (
              <li key={p.id} className={selectedPart === p.id ? "active" : ""}>
                <button
                  type="button"
                  className="interior-row-main"
                  onClick={() => show(p.id)}
                >
                  <InteriorPicture kind={p.kind} />
                  <span>
                    <strong>{name}</strong>
                    <small>{t("interiorAt", { cm: Math.round(p.yCm) })}</small>
                  </span>
                </button>
                <div className="interior-row-actions">
                  <button
                    type="button"
                    className="icon-button small"
                    aria-label={t("interiorMoveUp")}
                    title={t("interiorMoveUp")}
                    disabled={up === undefined}
                    onClick={() => up !== undefined && move(p.id, up)}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-button small"
                    aria-label={t("interiorMoveDown")}
                    title={t("interiorMoveDown")}
                    disabled={down === undefined}
                    onClick={() => down !== undefined && move(p.id, down)}
                  >
                    <ChevronDown size={16} />
                  </button>
                  {pulls && (
                    <button
                      type="button"
                      className="segmented-pill"
                      onClick={() => {
                        state.setInterior(true);
                        state.toggleInteriorOpen({
                          cabinetId: c.id,
                          componentId: p.id,
                        });
                      }}
                    >
                      {t(
                        state.openedInterior.some(
                          (i) => i.cabinetId === c.id && i.componentId === p.id,
                        )
                          ? "closeUnit"
                          : "openUnit",
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button small danger"
                    aria-label={t("interiorRemove")}
                    title={t("interiorRemove")}
                    onClick={() =>
                      commit(
                        withInterior(
                          c,
                          plain.filter((x) => x.id !== p.id),
                        ),
                        t("interiorRemoved", { name }),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        {!parts.length && <li className="helper">{t("interiorEmpty")}</li>}
      </ul>
      <h4>{t("interiorAddTitle")}</h4>
      <div className="interior-add">
        {items.map((i) => {
          const name = label(i.name, language);
          const positions = blocked(i)
            ? []
            : interiorPositions(c, m, catalog, i.id);
          // A neighbouring unit in front of this one leaves no pull-out room.
          const noPull =
            (i.kind === "drawer" || i.kind === "basket") &&
            positions.length > 0 &&
            pullOutBlocked(design, c, m, catalog, i.id, positions[0]);
          const fits = noPull ? [] : positions;
          const swaps = fits.length || blocked(i) || noPull ? [] : swapsFor(i);
          return (
            <div key={i.id} className="interior-add-item">
              <button
                type="button"
                className="unit-card compact"
                disabled={!fits.length}
                onClick={() => add(i)}
              >
                <InteriorPicture kind={i.kind} />
                <strong>{name}</strong>
                <span>{t(HINT[i.kind])}</span>
                <small className={fits.length ? "fits" : "full"}>
                  {blocked(i)
                    ? t("interiorSlidingNo")
                    : noPull
                      ? t("interiorPullBlocked")
                      : fits.length
                        ? t("interiorFits")
                        : t("interiorNoRoom")}
                </small>
              </button>
              {swaps.map(({ part, y }) => (
                <button
                  key={part.id}
                  type="button"
                  className="spot-row small"
                  onClick={() =>
                    commit(
                      withInterior(
                        c,
                        plain.map((x) =>
                          x.id === part.id
                            ? { ...x, productId: i.id, yCm: y }
                            : x,
                        ),
                      ),
                      t("interiorAdded", { name }),
                    ) && show(part.id)
                  }
                >
                  <span>
                    {t("interiorSwap", {
                      from: part.item
                        ? label(part.item.name, language)
                        : part.kind,
                      cm: Math.round(part.yCm),
                    })}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <h4>{t("interiorPreset")}</h4>
      <div className="segmented-pills">
        {catalog
          .interiorPresets!.filter((p) =>
            p.compatibleModuleTypes.includes(m.type),
          )
          .map((p) => (
            <button
              key={p.id}
              type="button"
              className="segmented-pill"
              onClick={() =>
                commit(
                  withInterior(c, presetComponents(c, m, catalog, p.id)),
                  t("interiorPresetDone", { name: label(p.name, language) }),
                ) && state.selectInterior(null)
              }
            >
              {label(p.name, language)}
            </button>
          ))}
        {c.interior && (
          <button
            type="button"
            className="segmented-pill"
            onClick={() => {
              const { interior: _, ...rest } = c;
              commit(rest, t("interiorReset"));
            }}
          >
            {t("interiorReset")}
          </button>
        )}
      </div>
      <p className="helper">
        {t("interiorAdjustment")}: {money(adjustment, language)}
      </p>
      <label className="toggle">
        <span>{t("interiorDecoration")}</span>
        <input
          type="checkbox"
          checked={state.interiorDecoration}
          onChange={(e) => state.setInteriorDecoration(e.target.checked)}
        />
        <i aria-hidden="true" />
      </label>
    </div>
  );
}
