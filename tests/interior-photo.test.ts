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

it("verifies POT repeat dimensions for all door and floor interior textures", () => {
  function getWebpSize(buf: Buffer) {
    const format = buf.toString("ascii", 12, 16);
    if (format === "VP8 ") {
      return {
        width: buf.readUInt16LE(26) & 0x3fff,
        height: buf.readUInt16LE(28) & 0x3fff,
      };
    } else if (format === "VP8L") {
      const b0 = buf[21],
        b1 = buf[22],
        b2 = buf[23],
        b3 = buf[24];
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    } else if (format === "VP8X") {
      return {
        width: 1 + buf.readUIntLE(24, 3),
        height: 1 + buf.readUIntLE(27, 3),
      };
    }
    throw Error("Unknown webp chunk: " + format);
  }

  const isPowerOfTwo = (n: number) => !(n & (n - 1)) && n > 0;

  for (const file of [
    "door-golden-oak.webp",
    "door-walnut.webp",
    "floor-dark-oak.webp",
    "floor-grey.webp",
    "floor-herringbone-oak.webp",
    "floor-natural.webp",
    "floor-rustic.webp",
    "floor-walnut-floor.webp",
    "floor-white-oak.webp",
  ]) {
    const fullPath = `public/shared/interior/${file}`;
    expect(existsSync(fullPath)).toBe(true);
    const buf = readFileSync(fullPath);
    const size = getWebpSize(buf);
    expect(isPowerOfTwo(size.width)).toBe(true);
    expect(isPowerOfTwo(size.height)).toBe(true);
    expect(size.width).toBe(1024);
    expect(size.height).toBe(1024);
  }
});

it("ensures Sallon floor mask spans full visible foreground and defines rug occlusion", () => {
  const living = interiorPhotos.living;
  expect(living.floorPolygons.length).toBeGreaterThan(0);
  const floorPts = living.floorPolygons[0];
  const maxX = Math.max(...floorPts.map((p) => p.x));
  const minX = Math.min(...floorPts.map((p) => p.x));
  expect(minX).toBe(0.0);
  expect(maxX).toBe(1.0);
  expect(living.occlusions.length).toBeGreaterThan(0);
});

it("ensures Bedroom door has true sloping perspective edges, full floor span and rug occlusion", () => {
  const bedroom = interiorPhotos.bedroom;
  expect(bedroom.doors.length).toBeGreaterThan(0);
  const door = bedroom.doors[0];
  // Sloping edges verification: top and bottom edges must not be horizontal
  expect(Math.abs(door.leaf[0].y - door.leaf[1].y)).toBeGreaterThan(0.04);
  expect(Math.abs(door.leaf[3].y - door.leaf[2].y)).toBeGreaterThan(0.04);
  expect(Math.abs(door.frame[0].y - door.frame[1].y)).toBeGreaterThan(0.05);
  expect(Math.abs(door.frame[3].y - door.frame[2].y)).toBeGreaterThan(0.05);

  // Full floor coverage
  const floorPts = bedroom.floorPolygons[0];
  const minX = Math.min(...floorPts.map((p) => p.x));
  const maxX = Math.max(...floorPts.map((p) => p.x));
  expect(minX).toBe(0.0);
  expect(maxX).toBe(1.0);

  // Occlusion preserving rug
  expect(bedroom.occlusions.length).toBeGreaterThan(0);
  expect(validCorners(bedroom.floorPlane)).toBe(true);
});

it("ensures Hallway floor calibration matches corridor vanishing lines and scale", () => {
  const hallway = interiorPhotos.hallway;
  expect(validCorners(hallway.floorPlane)).toBe(true);
  const [bl, tl, tr, br] = hallway.floorPlane;
  // Floor plane must recede into the corridor (top points have significantly smaller y than bottom points)
  expect(tl.y).toBeLessThan(0.75);
  expect(tr.y).toBeLessThan(0.75);
  expect(bl.y).toBe(1.0);
  expect(br.y).toBe(1.0);
  // Planks run longitudinally down hall: floorMeters.x > floorMeters.y
  expect(hallway.floorMeters[0]).toBeGreaterThan(hallway.floorMeters[1]);
});

it("ensures renderer shader discards casing shadow below bottom boundary", () => {
  const rendererSource = readFileSync("src/interior/renderer.ts", "utf8");
  expect(rendererSource).toContain("if(uv.y>1.)discard;");
});


