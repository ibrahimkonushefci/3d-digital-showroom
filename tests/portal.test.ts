import { beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  Box3,
  Mesh,
  MeshStandardMaterial,
  Texture,
  TextureLoader,
  Vector3,
} from "three";
import { CatalogSchema } from "../src/catalog/types";
import {
  newFacade,
  product,
  validFacade,
  loadFacade,
  loadPhotoDraft,
  persistStudio,
  useFacade,
  restoredView,
} from "../src/doorPreview/store";
import { FacadeSchema } from "../src/doorPreview/types";
import {
  changeMaterial,
  changeModel,
  applyWindowConfiguration,
  setOption,
} from "../src/doorPreview/configuration";
import { studioCamera, STUDIO_FOV } from "../src/doorPreview/studioLayout";
import { partitionWall } from "../src/doorPreview/houseLayout";
import { createProduct, disposeProduct } from "../src/scene/products";
import { facadePrice } from "../src/doorPreview/pricing";
const c = CatalogSchema.parse(
  JSON.parse(readFileSync("public/brands/drita-home/catalog.json", "utf8")),
);
beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) || null,
    setItem: (k: string, v: string) => storage.set(k, v),
  });
  useFacade.setState({ design: null, photoDesign: null, pendingView: null });
  vi.spyOn(TextureLoader.prototype, "load").mockImplementation(
    (_url, onLoad) => {
      const texture = new Texture();
      queueMicrotask(() => onLoad?.(texture));
      return texture;
    },
  );
});
it("creates one default door and dispatches shared photo independently", () => {
  const studio = newFacade(c),
    photo = {
      ...newFacade(c),
      view: "photo" as const,
      items: [product(c, "window", "custom-window")],
    };
  expect(studio.items).toHaveLength(1);
  expect(studio.items[0]).toMatchObject({
    width: 100,
    height: 210,
    materialType: "pvc",
    finishId: "anthracite",
    options: [],
  });
  useFacade.getState().set(studio);
  useFacade.getState().set(photo);
  expect(useFacade.getState().design).toEqual(studio);
  expect(useFacade.getState().photoDesign).toEqual(photo);
});
it("restores six custom IDs and backs up a legacy photo before replacing its key", () => {
  const d = {
    ...newFacade(c),
    view: "photo" as const,
    items: Array.from({ length: 6 }, (_, i) =>
      product(c, i ? "window" : "door", `legacy-${i}`),
    ),
  };
  localStorage.setItem("showroom-facade-test", JSON.stringify(d));
  expect(loadPhotoDraft("test", c)).toEqual(d);
  const studio = loadFacade("test", c);
  persistStudio("test", studio);
  expect(
    JSON.parse(localStorage.getItem("showroom-facade-photo-backup-test")!),
  ).toEqual(d);
  expect(loadPhotoDraft("test", c)).toEqual(d);
  localStorage.setItem(
    "showroom-facade-test",
    JSON.stringify({ ...d, view: "house" }),
  );
  expect(loadFacade("test", c).items).toEqual(d.items);
});
it("preserves legacy colour, validates inside finishes and does not normalize imports", () => {
  const d = newFacade(c);
  d.items[0] = {
    ...d.items[0],
    colorInside: "#ffffff",
    options: ["handle-120", "handle-160"],
  };
  expect(FacadeSchema.parse(d).items[0]).toEqual(d.items[0]);
  expect(validFacade(d, c)).toBe(true);
  expect(
    validFacade(
      { ...d, items: [{ ...d.items[0], finishInsideId: "missing" }] },
      c,
    ),
  ).toBe(false);
  expect(setOption(d.items[0], "handle-120", true).options).toEqual([
    "handle-120",
  ]);
});
it("wood defaults on explicit selection only and window application preserves placements", () => {
  const door = product(c, "door");
  expect(changeMaterial(door, "wood", c).finishId).toBe("golden-oak");
  const walnut = { ...door, finishId: "walnut" };
  expect(changeMaterial(walnut, "wood", c).finishId).toBe("walnut");
  expect(
    changeMaterial(
      { ...door, materialType: "wood", finishId: "white" },
      "wood",
      c,
    ).finishId,
  ).toBe("white");
  expect(door.finishId).toBe("anthracite");
  const a = { ...product(c, "window"), width: 200 },
    b = { ...product(c, "window"), width: 85, height: 120, brightness: 0.8 };
  b.corners = b.corners.map((point) => ({
    ...point,
    x: point.x * 0.5,
  })) as typeof b.corners;
  const applied = applyWindowConfiguration([door, a, b], {
    ...a,
    options: ["triple-glass"],
  });
  expect(applied[2]).toMatchObject({
    id: b.id,
    width: 85,
    height: 120,
    corners: b.corners,
    brightness: 0.8,
    options: ["triple-glass"],
  });
  expect(
    changeModel(a, c.windows.find((m) => m.style === "triple")!.id, c).panes,
  ).toBe(3);
});
it("keeps numeric catalog totals stable with inside finishes and restored schema", () => {
  const door = {
      ...product(c, "door"),
      materialType: "wood",
      options: ["handle-160", "fingerprint", "side-left"],
    },
    win = {
      ...product(c, "window"),
      profile: "veka",
      options: ["triple-glass", "shutter-electric", "sill"],
    };
  const d = {
    ...newFacade(c),
    items: [door, win],
    installation: true,
    removal: true,
    vat: true,
  };
  const before = facadePrice(d, c, "en"),
    after = facadePrice(
      FacadeSchema.parse({
        ...d,
        items: d.items.map((p) => ({ ...p, finishInsideId: "white" })),
      }),
      c,
      "de",
    );
  for (const key of [
    "subtotal",
    "installation",
    "vat",
    "total",
    "low",
    "high",
  ] as const)
    expect(after[key]).toBe(before[key]);
  const costs = d.items.map((p) => {
    const m = (p.kind === "door" ? c.doors : c.windows).find(
      (m) => m.id === p.modelId,
    )!;
    const area = (p.width * p.height) / 10000;
    return (
      (p.kind === "door"
        ? ("price" in m ? (m.price * area) / m.referenceArea : 0) *
          c.doorTypes.find((t) => t.id === p.materialType)!.multiplier
        : Math.max(
            "minimumPrice" in m ? m.minimumPrice : 0,
            area *
              ("perSquareMeter" in m ? m.perSquareMeter : 0) *
              c.windowMaterials.find((t) => t.id === p.materialType)!
                .multiplier *
              c.windowProfiles.find((t) => t.id === p.profile)!.multiplier,
          )) +
      p.options.reduce(
        (n, id) => n + (m.options.find((o) => o.id === id)?.price || 0),
        0,
      )
    );
  });
  expect(before.subtotal).toBeCloseTo(
    costs.reduce((a, b) => a + b, 0) + 2 * c.pricing.removalPerPiece,
  );
});
it("rotates around a fixed hinge and keeps frame, glass and hardware layers stationary", () => {
  const p = {
      ...product(c, "door"),
      finishInsideId: "white",
      options: ["side-left", "transom", "black-handle", "fingerprint"],
    },
    g = createProduct(p, c, (s) => s),
    leaf = g.getObjectByName("leaf")!,
    frame = g.getObjectByName("frame")!;
  g.updateMatrixWorld(true);
  const hinge = leaf.getWorldPosition(new Vector3()).clone(),
    frameBefore = new Box3().setFromObject(frame).clone();
  const panel = leaf.children.find(
    (o) => o instanceof Mesh && (o as Mesh).material instanceof Array,
  ) as Mesh;
  const closed = panel.getWorldPosition(new Vector3());
  expect(closed.z).toBeCloseTo(0.016);
  const materials = panel.material as MeshStandardMaterial[];
  expect(materials[4].color.getHexString()).toBe("383e42");
  expect(materials[5].color.getHexString()).toBe(
    c.productFinishes.find((f) => f.id === "white")!.color.slice(1),
  );
  leaf.rotation.y = -1.2;
  g.updateMatrixWorld(true);
  expect(leaf.getWorldPosition(new Vector3()).distanceTo(hinge)).toBe(0);
  expect(new Box3().setFromObject(frame)).toEqual(frameBefore);
  expect(panel.getWorldPosition(new Vector3()).z).toBeGreaterThan(closed.z);
  const metals: MeshStandardMaterial[] = [];
  g.traverse((o) => {
    if (o instanceof Mesh && !Array.isArray(o.material))
      metals.push(o.material);
  });
  expect(metals.some((m) => m.color.getHexString() === "adb8be")).toBe(true);
  expect(metals.some((m) => m.color.getHexString() === "202426")).toBe(true);
  disposeProduct(g);
});
it("partitions arbitrary opening rectangles without filling the aperture", () => {
  const hole = { left: -0.75, right: 0.6, bottom: 0.15, top: 2.6 };
  for (const p of partitionWall({ left: -2, right: 2, bottom: 0, top: 3 }, [
    hole,
  ])) {
    const [x, y] = p.position,
      [w, h] = p.size;
    expect(
      x + w / 2 <= hole.left + 1e-8 ||
        x - w / 2 >= hole.right - 1e-8 ||
        y + h / 2 <= hole.bottom + 1e-8 ||
        y - h / 2 >= hole.top - 1e-8,
    ).toBe(true);
  }
});
it("fits full camera bounds at every required aspect ratio and supported dimension extremes", () => {
  for (const [width, height] of [
    [40, 60],
    [100, 210],
    [300, 300],
    [600, 600],
  ])
    for (const aspect of [1440 / 660, 1024 / 410, 768 / 540, 390 / 440]) {
      const p = {
          ...product(c, "door"),
          width,
          height,
          options: ["side-left", "side-right", "transom"],
        },
        v = studioCamera(p, c, "full", aspect),
        position = new Vector3(...v.position),
        target = new Vector3(...v.target),
        direction = position.clone().sub(target).normalize(),
        right = new Vector3()
          .crossVectors(new Vector3(0, 1, 0), direction)
          .normalize(),
        up = new Vector3().crossVectors(direction, right),
        tan = Math.tan((STUDIO_FOV * Math.PI) / 360);
      for (const x of [v.bounds.min.x, v.bounds.max.x])
        for (const y of [v.bounds.min.y, v.bounds.max.y])
          for (const z of [v.bounds.min.z, v.bounds.max.z]) {
            const delta = new Vector3(x, y, z).sub(position),
              depth = -delta.dot(direction);
            expect(Math.abs(delta.dot(right))).toBeLessThan(
              depth * tan * aspect,
            );
            expect(Math.abs(delta.dot(up))).toBeLessThan(depth * tan);
          }
    }
});
it("renders real glazing stacks and overlapping sliding sashes", () => {
  const p = {
      ...product(c, "window"),
      options: ["sliding", "triple-glass", "sill"],
    },
    g = createProduct(p, c, (s) => s),
    leaf = g.getObjectByName("leaf")!;
  const panes = leaf.children.filter((o) => o.userData.surface === "glass");
  expect(panes).toHaveLength(p.panes * 3);
  expect(new Set(panes.map((o) => o.position.z)).size).toBe(6);
  expect(
    panes.every(
      (o) => o.userData.layer === "leaf" && o.userData.glazingLayers === 3,
    ),
  ).toBe(true);
  const tracks = g
    .getObjectByName("frame")!
    .children.filter(
      (o) => o instanceof Mesh && Math.abs(o.position.y - 0.045) < 1e-6,
    );
  expect(tracks).toHaveLength(2);
  disposeProduct(g);
});
it("uses continuous product-space grain and retains shared texture sources after disposal", async () => {
  const p = {
      ...product(c, "door"),
      modelId: c.doors.find((m) => m.style === 6)!.id,
      finishId: "golden-oak",
      materialType: "wood",
    },
    g = createProduct(p, c, (s) => s);
  const meshes = g
    .getObjectByName("leaf")!
    .children.filter(
      (o) => o instanceof Mesh && Array.isArray(o.material),
    ) as Mesh[];
  expect(meshes.length).toBeGreaterThan(1);
  const map = (meshes[0].material as MeshStandardMaterial[])[0].map!;
  expect(map).toBeTruthy();
  const disposed = vi.spyOn(map, "dispose");
  for (const mesh of meshes) {
    const uv = mesh.geometry.attributes.uv,
      vertices = mesh.geometry.attributes.position;
    const x =
      vertices.getX(0) +
      mesh.position.x +
      g.getObjectByName("leaf")!.position.x;
    expect(uv.getY(0)).toBeCloseTo((x + p.width / 200) / (p.width / 100));
  }
  disposeProduct(g);
  expect(disposed).not.toHaveBeenCalled();
});
it("keeps the wall above sidelights filled when a door-only transom is present", async () => {
  const { studioOpenings, studioLayout } =
    await import("../src/doorPreview/studioLayout");
  const p = {
      ...product(c, "door"),
      options: ["side-left", "side-right", "transom"],
    },
    l = studioLayout(p),
    holes = studioOpenings(p);
  const point = { x: l.left + 0.1, y: l.bottom + l.h + 0.15 };
  expect(
    holes.some(
      (h) =>
        point.x > h.left &&
        point.x < h.right &&
        point.y > h.bottom &&
        point.y < h.top,
    ),
  ).toBe(false);
  const panels = partitionWall(
    { left: -2, right: 2, bottom: 0, top: 3 },
    holes,
  );
  expect(
    panels.some(
      (p) =>
        Math.abs(point.x - p.position[0]) < p.size[0] / 2 &&
        Math.abs(point.y - p.position[1]) < p.size[1] / 2,
    ),
  ).toBe(true);
});

it("incoming links override the saved presentation mode in both directions", () => {
  localStorage.setItem("showroom-preview-mode-test", "photo");
  expect(restoredView("test", null)).toBe("photo");
  const studio = newFacade(c);
  useFacade.getState().receive(studio);
  expect(restoredView("test", useFacade.getState().pendingView)).toBe("house");
  useFacade.getState().receive({ ...studio, view: "photo" });
  expect(useFacade.getState().design).toEqual(studio);
  expect(restoredView("test", useFacade.getState().pendingView)).toBe("photo");
});
