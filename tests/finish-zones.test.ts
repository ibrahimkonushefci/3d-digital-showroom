import { lightingSignature } from "../src/scene/lighting/lightingRecipe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { BrandSchema, CatalogSchema, DesignSchema } from "../src/catalog/types";
import { parseDesignDocument } from "../src/catalog/migrations";
import { presentationPresets } from "../src/designer3d/presets";
import {
  applyFinishChange,
  applyToAll,
  effectiveCabinetStyle,
  finishZone,
  resolveCabinetStyle,
  resolveRunStyle,
  scopeValue,
  validateFinishReferences,
} from "../src/designer3d/finishes";
import { useDesigner } from "../src/designer3d/store";
import { validateDesign } from "../src/designer3d/layout";
import { calculatePrice } from "../src/pricing";
import { decodeShare, encodeShare } from "../src/sharing";
import { loadDesign, readDesign, saveDesign } from "../src/persistence";
import {
  restoreAlternative,
  compatibleAlternative,
  type Alternative,
} from "../src/designer3d/comparison";
import { assembleRenderInput } from "../src/scene/renderInput";
import { worktopRuns } from "../src/scene/countertopGeometry";
import {
  finishAssociations,
  proposalFinishes,
} from "../src/documents/finishes";
import { createOffer } from "../src/documents/offer";
import { translate } from "../src/i18n";
afterEach(() => {
  vi.unstubAllGlobals();
  useDesigner.getState().setDesign(null);
});
for (const slug of ["default", "druri-design"]) {
  const catalog = CatalogSchema.parse(
    JSON.parse(readFileSync(`public/brands/${slug}/catalog.json`, "utf8")),
  );
  const brand = BrandSchema.parse(
    JSON.parse(readFileSync(`public/brands/${slug}/brand.json`, "utf8")),
  );
  const kitchen = () =>
    presentationPresets(catalog).find((p) => p.design.layout === "island")!
      .design;
  const wardrobe = () =>
    presentationPresets(catalog).find((p) => p.id === "wardrobe-straight")!
      .design;
  const mixed = () => {
    let d = applyFinishChange(kitchen(), "base", {
      front: "oak",
      carcass: "oak",
      plinth: "matching",
    });
    d = applyFinishChange(d, "wall", { front: "white" });
    d = applyFinishChange(d, "island", {
      front: "fenix-anthracite",
      handle: "bar",
    });
    d = applyFinishChange(
      d,
      { cabinetId: d.cabinets.find((c) => c.wall === "island")!.id },
      { front: "walnut", profile: "panel" },
    );
    return { ...d, worktopFinishes: { main: "travertine", island: "quartz" } };
  };
  describe(`${slug} finish zones`, () => {
    it("migrates v1/v2 idempotently, rejects future versions and unsupported per-cabinet worktops", () => {
      const d = kitchen();
      for (const version of [1, 2, 3]) {
        const migrated = parseDesignDocument({ ...d, version });
        expect(migrated.version).toBe(3);
        expect(migrated.cabinets).toEqual(d.cabinets);
        expect(parseDesignDocument(migrated)).toEqual(migrated);
      }
      expect(() => parseDesignDocument({ ...d, version: 4 })).toThrow();
      expect(
        DesignSchema.safeParse({
          ...d,
          cabinets: d.cabinets.map((c) => ({
            ...c,
            finishOverride: { countertop: "quartz" },
          })),
        }).success,
      ).toBe(false);
    });
    it("honors cabinet → island-before-level/zone → default precedence, matching appearance and history", () => {
      const d = mixed(),
        c = d.cabinets.find((c) => c.wall === "island")!;
      expect(finishZone(c)).toBe("island");
      expect(resolveCabinetStyle(d, c, catalog).front.id).toBe("walnut");
      const base = d.cabinets.find(
        (c) => c.level === "base" && c.wall !== "island",
      )!;
      expect(resolveCabinetStyle(d, base, catalog).plinthAppearance.id).toBe(
        "oak",
      );
      const changed = applyFinishChange(d, "all", { front: "cashmere" });
      expect(changed.finishZones).toEqual(d.finishZones);
      expect(resolveCabinetStyle(changed, c, catalog).front.id).toBe("walnut");
      expect(scopeValue(d, "all", "front")).toBe("");
      const state = useDesigner.getState();
      state.setDesign(d);
      expect(state.edit(applyToAll(changed), catalog)).toBe(true);
      expect(useDesigner.getState().past).toHaveLength(1);
      expect(
        useDesigner.getState().design!.cabinets.every((c) => !c.finishOverride),
      ).toBe(true);
      state.undo();
      expect(useDesigner.getState().design).toEqual(d);
      state.redo();
      expect(scopeValue(useDesigner.getState().design!, "all", "front")).toBe(
        "cashmere",
      );
    });
    it("changes only island price/material, preserves slabs/holes, and uses run-specific thickness", () => {
      const d = mixed(),
        next = {
          ...d,
          worktopFinishes: { ...d.worktopFinishes, island: "granite" },
        };
      const islandMeters = d.cabinets
        .filter((c) => c.wall === "island" && c.level === "base")
        .reduce((n, c) => n + c.width / 100, 0);
      expect(resolveRunStyle(d, "main", catalog).thickness).toBe(0.012);
      expect(resolveRunStyle(d, "island", catalog).thickness).toBe(0.02);
      expect(resolveRunStyle(next, "main", catalog)).toEqual(
        resolveRunStyle(d, "main", catalog),
      );
      const before = calculatePrice(d, catalog, "en"),
        after = calculatePrice(next, catalog, "en");
      expect(after.subtotal - before.subtotal).toBeCloseTo(
        islandMeters *
          (resolveRunStyle(next, "island", catalog).tier!.perMeter -
            resolveRunStyle(d, "island", catalog).tier!.perMeter),
      );
      expect(after.lines.filter((l) => !l.id.startsWith("countertop"))).toEqual(
        before.lines.filter((l) => !l.id.startsWith("countertop")),
      );
      const runs = worktopRuns(d.cabinets, catalog);
      expect(runs.map((r) => r.zone)).toEqual(["main", "island"]);
      expect(runs.flatMap((r) => r.holes)).toHaveLength(
        d.cabinets.filter(
          (c) =>
            catalog.modules.find((m) => m.id === c.moduleId)?.type === "sink",
        ).length,
      );
      expect(lightingSignature(d)).toBe(lightingSignature(applyToAll(d)));
      const input = assembleRenderInput(d, catalog);
      for (const f of input.furniture.cabinets)
        expect(f.style).toEqual(resolveCabinetStyle(d, f.cabinet, catalog));
      const bad = applyFinishChange(d, "wall", { front: "unavailable" });
      expect(validateFinishReferences(bad, catalog)).not.toHaveLength(0);
      expect(validateDesign(bad, catalog)).toBe(false);
      expect(() => assembleRenderInput(bad, catalog)).toThrow();
    });
    it("does not merge equal modules with different effective finishes and preserves quote ordering", () => {
      const d = mixed(),
        price = calculatePrice(d, catalog, "en");
      const goods = price.lines.reduce((s, l) => s + l.amount, 0);
      const offer = {
        number: "PRIVATE",
        date: "2026-10-14",
        validityDays: 15,
        customer: { name: "Private synthetic", phone: "", city: "" },
        salesperson: "",
        paymentTerms: "",
        notes: "SECRET",
        discountPercent: 12,
      };
      const priced = calculatePrice(
        { ...d, offer, installation: true, vat: true },
        catalog,
        "en",
      );
      expect(priced.subtotal).toBe(goods);
      expect(priced.discount).toBe(goods * 0.12);
      expect(priced.installation).toBe(
        ((goods - priced.discount) * catalog.pricing.installationPercent) / 100,
      );
      expect(priced.vat).toBe(
        ((goods - priced.discount + priced.installation) *
          catalog.pricing.vatPercent) /
          100,
      );
      const same = d.cabinets.find((c) => c.level === "base")!;
      const fake = {
        ...d,
        cabinets: [
          same,
          { ...same, id: "second", finishOverride: { front: "white" } },
        ],
      };
      expect(
        calculatePrice(fake, catalog, "en").lines.filter((l) => l.size),
      ).toHaveLength(2);
    });
    it("round-trips zones through drafts, share and A/B restoration without private data or cross-brand writes", () => {
      const offer = {
        number: "PRIVATE",
        date: "2026-10-14",
        validityDays: 15,
        customer: { name: "Private synthetic", phone: "", city: "" },
        salesperson: "",
        paymentTerms: "",
        notes: "SECRET",
      };
      for (const initial of [mixed(), wardrobe()]) {
        const d =
          initial.kind === "wardrobe"
            ? applyFinishChange(
                initial,
                { cabinetId: initial.cabinets[0].id },
                { front: "walnut", carcass: "dark" },
              )
            : initial;
        const data = new Map<string, string>();
        vi.stubGlobal("localStorage", {
          getItem: (k: string) => data.get(k) ?? null,
          setItem: (k: string, v: string) => data.set(k, v),
        });
        saveDesign(slug, { ...d, offer });
        expect(loadDesign(slug, d.kind, catalog)).toEqual({ ...d, offer });
        expect(loadDesign("other-brand", d.kind, catalog)).toBeNull();
        const key = `showroom-design-${slug}-${d.kind}`;
        const original = data.get(key)!;
        const invalid = JSON.stringify(
          applyFinishChange(d, "base", { front: "missing-product" }),
        );
        data.set(key, invalid);
        expect(readDesign(slug, d.kind, catalog).error).toBe(
          "incompatibleDesign",
        );
        expect(data.get(key)).toBe(invalid);
        data.set(key, original);

        const share = decodeShare(
          encodeShare({ ...d, offer }, brand, slug, true),
        );
        expect(share.design).toEqual(d);
        expect(JSON.stringify(share)).not.toContain("SECRET");
        const record: Alternative = {
          version: 1,
          name: "Mixed",
          design: share.design,
          image: "data:image/png;base64,a",
          catalogSignature: "old",
          savedAt: "now",
        };
        expect(restoreAlternative(record, catalog, { ...d, offer })).toEqual({
          ...d,
          offer,
        });
        const bad = {
          ...record,
          design: applyFinishChange(d, "all", { front: "unavailable" }),
        };
        expect(compatibleAlternative(bad, catalog)).toBe(false);
      }
    });
    it("exports complete material associations and multilingual mixed kitchen/wardrobe PDFs", async () => {
      vi.stubGlobal("fetch", async (url: string) => {
        const b = readFileSync("public" + url);
        return {
          arrayBuffer: async () =>
            b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
        };
      });
      const w = wardrobe();
      const designs = [
        mixed(),
        applyFinishChange(
          w,
          { cabinetId: w.cabinets[0].id },
          {
            front: "walnut",
            carcass: "dark",
            handle: "bar",
            plinth: "matching",
          },
        ),
      ];
      for (const d of designs)
        for (const language of ["sq", "en", "de"] as const) {
          const rows = finishAssociations(d, catalog, language);
          expect(rows.map((r) => r.scope).join(" ")).toContain(
            translate(language, "positions"),
          );
          expect(
            proposalFinishes(d, catalog).some((m) => m.id === "walnut"),
          ).toBe(true);
          if (d.kind === "wardrobe")
            expect(
              proposalFinishes(d, catalog).find((m) => m.id === "oak")?.name[
                language
              ],
            ).toBe(
              catalog.carcasses.find((m) => m.id === "oak")!.name[language],
            );
          const doc = await createOffer({
            design: d,
            brand,
            catalog,
            language,
            screenshot: null,
            logoUrl: "missing",
            t: (k, v) => translate(language, k, v),
          });
          expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
          expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(10000);
          if (process.env.PHASE4_ARTIFACTS) {
            const root = "verification/showroom-realism/phase-4";
            writeFileSync(
              `${root}/${slug}-${d.kind}-${language}.pdf`,
              Buffer.from(doc.output("arraybuffer")),
            );
            writeFileSync(
              `${root}/${slug}-${d.kind}.json`,
              JSON.stringify(d, null, 2),
            );
            writeFileSync(
              `${root}/${slug}-${d.kind}-share.txt`,
              encodeShare(d, brand, slug, false),
            );
          }
        }
    });
  });
}
it("enforces share encode limits before generating an unreadable link", () => {
  const catalog = CatalogSchema.parse(
    JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
  );
  const brand = BrandSchema.parse(
    JSON.parse(readFileSync("public/brands/default/brand.json", "utf8")),
  );
  const d = presentationPresets(catalog)[0].design;
  expect(() =>
    encodeShare({ ...d, id: "x".repeat(150001) }, brand, "default", false),
  ).toThrow("shareTooLarge");
});
