import { beforeEach, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CatalogSchema, type DesignDocument } from "../src/catalog/types";
import { generateLayout, newDesign } from "../src/designer3d/layout";
import { reconcileCabinets, useDesigner } from "../src/designer3d/store";
import { defaultDesign, resetConfiguration } from "../src/designer3d/presets";

const catalog = CatalogSchema.parse(
  JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
);
const offer: NonNullable<DesignDocument["offer"]> = {
  number: "OF-17",
  date: "2026-10-13",
  validityDays: 30,
  customer: { name: "Arta K.", phone: "+383 44 000 000", city: "Prishtinë" },
  salesperson: "Showroom",
  paymentTerms: "50% avans",
  notes: "",
};
beforeEach(() => {
  useDesigner
    .getState()
    .setDesign(generateLayout(newDesign("kitchen", "l"), catalog)!);
  useDesigner.getState().setInteractionMode("showroom");
});

it("keeps selecting and opening a unit separate from camera focus", () => {
  const s = useDesigner.getState();
  const id = s.design!.cabinets[0].id;
  // What a showroom tap does: highlight and open, nothing else.
  s.select(id);
  s.toggleOpen(id);
  expect(useDesigner.getState().selected).toBe(id);
  expect(useDesigner.getState().opened).toContain(id);
  expect(useDesigner.getState().focused).toBeNull();
  expect(useDesigner.getState().cameraView).toBeNull();
  // Inspection is a deliberate, separate step.
  s.focus(id);
  expect(useDesigner.getState().focused).toBe(id);
  s.setInteractionMode("edit");
  expect(useDesigner.getState().focused).toBeNull();
});

it("drops focus on a unit that no longer exists", () => {
  const d = useDesigner.getState().design!;
  const [gone, kept] = d.cabinets;
  expect(
    reconcileCabinets({ ...d, cabinets: [kept] }, gone.id, [gone.id], gone.id),
  ).toEqual({ selected: null, opened: [], focused: null });
  expect(reconcileCabinets(d, kept.id, [kept.id], kept.id).focused).toBe(
    kept.id,
  );
});

it("resets to the authored default as one undoable step, keeping client data", () => {
  for (const kind of ["kitchen", "wardrobe"] as const) {
    const s = useDesigner.getState();
    s.setDesign({
      ...generateLayout(newDesign(kind, "straight"), catalog)!,
      offer,
      vat: true,
      installation: false,
    });
    const edited = {
      ...useDesigner.getState().design!,
      style: {
        ...useDesigner.getState().design!.style,
        front: catalog.fronts.at(-1)!.id,
      },
    };
    expect(s.edit(edited, catalog)).toBe(true);
    const id = edited.cabinets[0].id;
    s.select(id);
    s.focus(id);
    s.toggleOpen(id);

    expect(s.resetDesign(resetConfiguration(edited, catalog), catalog)).toBe(
      true,
    );
    const after = useDesigner.getState();
    const preset = defaultDesign(kind, catalog);
    expect(after.design!.id).toBe(edited.id);
    expect(after.design!.offer).toEqual(offer);
    expect(after.design!.vat).toBe(true);
    expect(after.design!.installation).toBe(false);
    expect(after.design!.style).toEqual(preset.style);
    expect(after.design!.layout).toBe(preset.layout);
    expect(after.design!.cabinets.map((c) => c.moduleId)).toEqual(
      preset.cabinets.map((c) => c.moduleId),
    );
    expect(after.selected).toBeNull();
    expect(after.focused).toBeNull();
    expect(after.opened).toEqual([]);

    after.undo();
    expect(useDesigner.getState().design).toEqual(edited);
  }
});
