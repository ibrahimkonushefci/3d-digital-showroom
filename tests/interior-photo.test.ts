import { afterEach, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { CatalogSchema, BrandSchema } from "../src/catalog/types";
import { InteriorSchema } from "../src/interior/types";
import {
  newInterior,
  changeDoorStyle,
  switchInteriorRoom,
  newQuoteDoor,
  validInterior,
} from "../src/interior/layout";
import { interiorPrice } from "../src/interior/pricing";
import {
  interiorPhotos,
  boundedPhotoView,
  supportedPhotoDoor,
} from "../src/interior/scenes";
import { interiorDoorChoices } from "../src/interior/products";
import { validCorners } from "../src/doorPreview/homography";
import { encodeShare, decodeShare } from "../src/sharing";
import { loadInterior, useInterior } from "../src/interior/store";
const c = CatalogSchema.parse(
    JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
  ),
  b = BrandSchema.parse(
    JSON.parse(readFileSync("public/brands/default/brand.json", "utf8")),
  );
afterEach(() => vi.unstubAllGlobals());
it("changes products across all quoted doors without changing their dimensions", () => {
  const d = newInterior(c),
    next = changeDoorStyle(d, {
      finishId: "walnut",
      finishTier: "cpl",
      modelId: "flat",
      handleId: "black",
      hiddenHinges: true,
    });
  expect(validInterior(next, c)).toBe(true);
  expect(
    next.doors.map((p) => [p.width, p.height, p.frameDepth, p.opening]),
  ).toEqual(d.doors.map((p) => [p.width, p.height, p.frameDepth, p.opening]));
  expect(
    next.doors.every(
      (p) =>
        p.finishId === "walnut" && p.hiddenHinges && p.handleId === "black",
    ),
  ).toBe(true);
});
it("room switching preserves quote area, quantities, offer fields and exact price", () => {
  const d = newInterior(c),
    q = interiorPrice(d, c, "sq");
  for (const room of ["living", "bedroom", "hallway"] as const) {
    const next = switchInteriorRoom(d, room);
    expect(next.room).toEqual(d.room);
    expect(next.doors).toEqual(d.doors);
    expect(next.doorStyle).toEqual(d.doorStyle);
    expect(interiorPrice(next, c, "sq")).toEqual(q);
  }
});
it("uses Kosovo quote sizes and permits quantity edits without photographic placement constraints", () => {
  const d = newInterior(c);
  expect(d.doors.map((p) => p.width)).toEqual([90, 80, 80, 70]);
  expect(
    d.doors.every(
      (p) => p.height === 200 && p.frameHeight === 205 && p.frameDepth === 15,
    ),
  ).toBe(true);
  const next = {
    ...d,
    doors: [...d.doors, newQuoteDoor(d.doorStyle, "bathroom")],
  };
  expect(validInterior(next, c)).toBe(true);
  expect(
    interiorPrice(next, c, "sq").doorInstallation -
      interiorPrice(d, c, "sq").doorInstallation,
  ).toBe(c.interiorPricing!.doorInstallationPerPiece);
  expect(
    validInterior(
      { ...next, doors: next.doors.map((p) => ({ ...p, frameDepth: 26 })) },
      c,
    ),
  ).toBe(false);
});
it("migrates mixed version-1 quotes without repricing or losing offer metadata", () => {
  const d = newInterior(c);
  const raw = {
    ...d,
    version: 1,
    doorStyle: undefined,
    doors: d.doors.map((p, i) => ({
      ...p,
      height: undefined,
      frameHeight: undefined,
      frameDepth: undefined,
      roomType: undefined,
      finishId: i === 0 ? "white" : "walnut",
    })),
    offer: {
      number: "OLD-1",
      date: "2026-10-08",
      validityDays: 15,
      customer: { name: "Ëndrra", phone: "", city: "Prishtinë" },
      salesperson: "",
      paymentTerms: "",
      notes: "Keep this",
    },
  };
  const next = InteriorSchema.parse(raw);
  expect(next.version).toBe(2);
  expect(next.legacyMixed).toBe(true);
  expect(next.doors.every((p) => p.height === 210)).toBe(true);
  expect(next.offer?.notes).toBe("Keep this");
  expect(interiorPrice(next, c, "sq").total).toBe(
    interiorPrice({ ...d, doors: next.doors }, c, "sq").total,
  );
  expect(changeDoorStyle(next, { finishId: "golden-oak" }).legacyMixed).toBe(
    false,
  );
  expect(
    changeDoorStyle(next, { finishId: "golden-oak" }).doors.every(
      (p) => p.finishId === "golden-oak",
    ),
  ).toBe(true);
});
it("persists version-2 shared styles and dimensions through share encoding", () => {
  const d = changeDoorStyle(newInterior(c), { finishId: "walnut" });
  expect(decodeShare(encodeShare(d, b, c.id, false)).design).toEqual(d);
});
it("isolates saved quotes by brand and records store ownership", () => {
  const a = newInterior(c),
    other = {
      ...changeDoorStyle(newInterior(c), { finishId: "walnut" }),
      doors: [newQuoteDoor(a.doorStyle)],
    };
  const saved = new Map([
    ["showroom-interior-a", JSON.stringify(a)],
    ["showroom-interior-b", JSON.stringify(other)],
  ]);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => saved.get(key) || null,
  });
  expect(loadInterior("a", c).doors).toHaveLength(4);
  expect(loadInterior("b", c).doors).toHaveLength(1);
  useInterior.getState().set(a, "a");
  useInterior.getState().set(other, "b");
  expect(useInterior.getState().brandSlug).toBe("b");
  useInterior.setState({ design: null, brandSlug: null });
});
it("calibrates all photographs with valid door/floor quadrilaterals and local masks", () => {
  for (const s of Object.values(interiorPhotos)) {
    expect(validCorners(s.floorPlane)).toBe(true);
    expect(existsSync(`public/${s.image}`)).toBe(true);
    for (const suffix of ["-mask.webp", "-light.webp"])
      expect(existsSync(`public/${s.image.replace(".webp", suffix)}`)).toBe(
        true,
      );
    for (const p of [...s.floorPolygons, ...s.occlusions])
      expect(
        p.every(
          (v) =>
            Number.isFinite(v.x) &&
            v.x >= 0 &&
            v.x <= 1 &&
            v.y >= 0 &&
            v.y <= 1,
        ),
      ).toBe(true);
    for (const d of s.doors) {
      expect(validCorners(d.leaf)).toBe(true);
      expect(validCorners(d.frame)).toBe(true);
      expect(
        d.hardwareSize.every((n) => Number.isFinite(n) && n > 0 && n < 0.1),
      ).toBe(true);
      if (d.opening) expect(validCorners(d.opening)).toBe(true);
    }
  }
});
it("bounds photo navigation and excludes unsupported door presentations", () => {
  expect(boundedPhotoView({ zoom: 4, x: 9, y: -9 })).toEqual({
    zoom: 1.8,
    x: (1 - 1 / 1.8) / 2,
    y: -(1 - 1 / 1.8) / 2,
  });
  expect(boundedPhotoView({ zoom: 0.2, x: 1, y: 1 })).toEqual({
    zoom: 1,
    x: 0,
    y: 0,
  });
  expect(supportedPhotoDoor("pocket")).toBe(false);
  expect(supportedPhotoDoor("classic")).toBe(false);
  expect(interiorDoorChoices(c)).toHaveLength(5);
});

it("round trips legacy share links and preserves prices until a global product is chosen", () => {
  const design = newInterior(c);
  const legacy = {
    ...design,
    version: 1,
    doorStyle: undefined,
    doors: design.doors.map((p, i) => ({
      ...p,
      modelId: i ? "flat" : "glass",
      height: undefined,
      frameHeight: undefined,
    })),
  };
  const decoded = decodeShare(
    encodeShare(legacy as unknown as typeof design, b, c.id, false),
  ).design;
  expect(decoded.kind).toBe("interior");
  if (decoded.kind !== "interior") throw Error("Wrong module");
  expect(decoded.legacyMixed).toBe(true);
  expect(decoded.doors.map((p) => p.modelId)).toEqual([
    "glass",
    "flat",
    "flat",
    "flat",
  ]);
  expect(
    interiorPrice(switchInteriorRoom(decoded, "bedroom"), c, "sq").total,
  ).toBe(interiorPrice(decoded, c, "sq").total);
});

it("validates every brand's photo material assets without changing existing catalog identifiers", () => {
  for (const brand of ["default", "drita-home"]) {
    const catalog = CatalogSchema.parse(
      JSON.parse(readFileSync(`public/brands/${brand}/catalog.json`, "utf8")),
    );
    expect(interiorDoorChoices(catalog)).toHaveLength(5);
    for (const product of [...catalog.laminates, ...catalog.productFinishes]) {
      if (product.previewTexture)
        expect(existsSync(`public/${product.previewTexture}`)).toBe(true);
    }
    for (const choice of interiorDoorChoices(catalog))
      expect(
        validInterior(
          changeDoorStyle(newInterior(catalog), choice.style),
          catalog,
        ),
      ).toBe(true);
  }
  for (const s of Object.values(interiorPhotos)) {
    for (const polygon of s.skirtingPolygons)
      expect(
        polygon.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1),
      ).toBe(true);
  }
});

it("reports unavailable WebGL instead of accepting an incomplete renderer", async () => {
  const { InteriorRenderer } = await import("../src/interior/renderer");
  expect(
    () =>
      new InteriorRenderer({
        getContext: () => null,
      } as unknown as HTMLCanvasElement),
  ).toThrow("webglError");
});
