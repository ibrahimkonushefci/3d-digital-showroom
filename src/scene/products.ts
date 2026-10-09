import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  TextureLoader,
  SRGBColorSpace,
  WebGLRenderer,
  Scene,
  OrthographicCamera,
  AmbientLight,
  DirectionalLight,
  Box3,
  Vector3,
  Color,
} from "three";
import type { Catalog, Material } from "../catalog/types";
import type { Placement } from "../doorPreview/types";
const loader = new TextureLoader();
const textures = new Map<string, ReturnType<TextureLoader["load"]>>();
function texture(path: string, assetUrl: (s: string) => string, color = false) {
  const url = assetUrl(path);
  if (!textures.has(url)) {
    const t = loader.load(url);
    if (color) t.colorSpace = SRGBColorSpace;
    textures.set(url, t);
  }
  return textures.get(url)!;
}
function finishMaterial(
  f: Material | undefined,
  color: string,
  assetUrl: (s: string) => string,
  performance: boolean,
) {
  return new MeshStandardMaterial({
    color: f?.texture ? "#ffffff" : color,
    map: f?.texture ? texture(f.texture, assetUrl, true) : null,
    normalMap:
      !performance && f?.normalMap ? texture(f.normalMap, assetUrl) : null,
    roughnessMap:
      !performance && f?.roughnessMap
        ? texture(f.roughnessMap, assetUrl)
        : null,
    roughness: f?.roughness ?? 0.45,
    metalness: f?.texture ? 0 : 0.2,
  });
}
/** Shared physical model: local origin is opening bottom center; positive Z faces the viewer. */
export function createProduct(
  p: Placement,
  c: Catalog,
  assetUrl: (s: string) => string,
  performance = false,
) {
  const g = new Group(),
    w = p.width / 100,
    h = p.height / 100,
    depth = 0.12;
  const f = c.productFinishes.find((f) => f.id === p.finishId),
    m = finishMaterial(f, p.color, assetUrl, performance),
    inside = new MeshStandardMaterial({
      color: p.colorInside || p.color,
      roughness: 0.55,
    }),
    metal = new MeshStandardMaterial({
      color: p.options.includes("black-handle") ? "#24282b" : "#adb8be",
      metalness: 0.95,
      roughness: 0.23,
    }),
    glass = new MeshPhysicalMaterial({
      color: "#8faeb9",
      metalness: 0.15,
      roughness: p.options.includes("satin") ? 0.55 : 0.08,
      transparent: true,
      opacity: p.options.includes("satin") ? 0.65 : 0.45,
      transmission: performance ? 0 : 0.25,
      envMapIntensity: 1.2,
    });
  const frame = new Group();
  frame.name = "frame";
  g.add(frame);
  const leaf = new Group();
  leaf.name = "leaf";
  g.add(leaf);
  const add = (
    parent: Group,
    size: [number, number, number],
    pos: [number, number, number],
    mat = m,
    tag = "solid",
  ) => {
    const mesh = new Mesh(new BoxGeometry(...size), mat);
    mesh.position.set(...pos);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.surface = tag;
    parent.add(mesh);
    return mesh;
  };
  add(frame, [0.07, h + 0.04, depth], [-w / 2 + 0.025, h / 2, 0]);
  add(frame, [0.07, h + 0.04, depth], [w / 2 - 0.025, h / 2, 0]);
  add(frame, [w, 0.07, depth], [0, h - 0.025, 0]);
  add(frame, [w, 0.028, 0.18], [0, 0.01, 0.02], metal);
  if (p.kind === "door") {
    const model = c.doors.find((d) => d.id === p.modelId);
    const style = model?.style || 0;
    if ([2, 4, 6].includes(style)) {
      const gw = style === 2 ? w * 0.16 : w * 0.38,
        gx = -w * 0.21,
        gh = h * 0.78,
        gy = h * 0.54,
        L = -(w - 0.115) / 2,
        R = (w - 0.115) / 2,
        B = 0.0425,
        T = h - 0.0425;
      for (const [a, b] of [
        [L, gx - gw / 2],
        [gx + gw / 2, R],
      ])
        if (b > a)
          add(leaf, [b - a, h - 0.085, 0.06], [(a + b) / 2, h / 2, 0.016]);
      for (const [a, b] of [
        [B, gy - gh / 2],
        [gy + gh / 2, T],
      ])
        if (b > a) add(leaf, [gw, b - a, 0.06], [gx, (a + b) / 2, 0.016]);
    } else add(leaf, [w - 0.115, h - 0.085, 0.06], [0, h / 2, 0.016]);
    if (style === 1 || style === 5)
      for (let i = 0; i < (style === 5 ? 9 : 5); i++)
        add(
          leaf,
          style === 5 ? [0.005, h - 0.2, 0.005] : [w - 0.2, 0.008, 0.005],
          style === 5
            ? [-w * 0.35 + i * w * 0.08, h / 2, 0.05]
            : [0, 0.4 + (i * (h - 0.6)) / 5, 0.051],
          new MeshStandardMaterial({ color: "#242b2b", roughness: 0.8 }),
        );
    if ([2, 4, 6].includes(style)) {
      const gw = style === 2 ? w * 0.16 : w * 0.38;
      add(
        leaf,
        [gw, h * 0.78, 0.012],
        [-w * 0.21, h * 0.54, 0.054],
        glass,
        "glass",
      );
      for (const x of [-1, 1])
        add(
          leaf,
          [0.012, h * 0.8, 0.01],
          [-w * 0.21 + (x * gw) / 2, h * 0.54, 0.057],
          metal,
        );
    }
    if (style === 3)
      for (const y of [0.32, 0.72]) {
        const pw = w * 0.7,
          ph = h * 0.29;
        for (const x of [-1, 1])
          add(leaf, [0.022, ph, 0.014], [(x * pw) / 2, h * y, 0.055]);
        for (const v of [-1, 1])
          add(leaf, [pw, 0.022, 0.014], [0, h * y + (v * ph) / 2, 0.055]);
      }
    const len = p.options.includes("handle-160")
      ? 1.6
      : p.options.includes("handle-120")
        ? 1.2
        : 0.8;
    add(leaf, [0.025, len, 0.035], [w * 0.32, h * 0.51, 0.11], metal);
    for (const y of [-1, 1])
      add(
        leaf,
        [0.025, 0.028, 0.065],
        [w * 0.32, h * 0.51 + y * len * 0.42, 0.08],
        metal,
      );
    if (p.options.includes("fingerprint")) {
      add(
        leaf,
        [0.06, 0.09, 0.012],
        [w * 0.31, h * 0.74, 0.058],
        new MeshStandardMaterial({ color: "#171c1f" }),
      );
      add(
        leaf,
        [0.035, 0.03, 0.006],
        [w * 0.31, h * 0.75, 0.067],
        new MeshStandardMaterial({
          color: "#68a5a6",
          emissive: "#327c82",
          emissiveIntensity: 0.7,
        }),
      );
    }
    if (p.options.includes("led-handle"))
      add(
        leaf,
        [0.009, len - 0.03, 0.005],
        [w * 0.32 + 0.018, h * 0.51, 0.127],
        new MeshStandardMaterial({
          color: "#fff0cb",
          emissive: "#ffcc77",
          emissiveIntensity: 2,
        }),
      );
    for (const y of [0.25, 0.75]) {
      const hinge = new Mesh(
        new CylinderGeometry(0.012, 0.012, 0.07, 10),
        metal,
      );
      hinge.position.set(-w / 2 + 0.065, h * y, 0.045);
      leaf.add(hinge);
    }
    for (const side of [-1, 1])
      if (p.options.includes(side === -1 ? "side-left" : "side-right")) {
        const cx = side * (w / 2 + 0.16);
        for (const edge of [-1, 1]) {
          add(frame, [0.035, h, 0.09], [cx + edge * 0.14, h / 2, 0]);
          add(
            frame,
            [0.3, 0.035, 0.09],
            [cx, edge === 1 ? h - 0.0175 : 0.0175, 0],
          );
        }
        add(
          frame,
          [0.23, h - 0.14, 0.012],
          [side * (w / 2 + 0.16), h / 2, 0.04],
          glass,
          "glass",
        );
      }
    if (p.options.includes("transom")) {
      for (const side of [-1, 1]) {
        add(frame, [0.035, 0.3, 0.09], [side * (w / 2 - 0.0175), h + 0.15, 0]);
        add(frame, [w, 0.035, 0.09], [0, h + 0.15 + side * 0.1325, 0]);
      }
      add(frame, [w - 0.12, 0.21, 0.012], [0, h + 0.15, 0.04], glass, "glass");
    }
  } else {
    const model = c.windows.find((d) => d.id === p.modelId);
    const panes = p.panes;
    for (let i = 0; i < panes; i++) {
      const sw = (w - 0.13) / panes,
        x = -w / 2 + 0.065 + sw * (i + 0.5);
      add(leaf, [sw - 0.045, h - 0.16, 0.015], [x, h / 2, 0], glass, "glass");
      for (const s of [-1, 1]) {
        add(
          leaf,
          [0.035, h - 0.1, 0.075],
          [x + s * (sw / 2 - 0.025), h / 2, 0.026],
        );
        add(leaf, [sw, 0.035, 0.075], [x, s === 1 ? h - 0.065 : 0.065, 0.026]);
      }
      if (model?.style !== "fixed") {
        add(
          leaf,
          [0.014, 0.11, 0.026],
          [x + sw / 2 - 0.06, h / 2, 0.086],
          metal,
        );
        add(
          leaf,
          [0.04, 0.025, 0.018],
          [x + sw / 2 - 0.056, h / 2 + 0.05, 0.07],
          metal,
        );
      }
    }
    for (const side of [-1, 1]) {
      add(
        frame,
        [0.07, h + 0.04, 0.012],
        [side * (w / 2 - 0.025), h / 2, -0.066],
        inside,
      );
      add(
        frame,
        [w, 0.07, 0.012],
        [0, side === 1 ? h - 0.025 : 0.025, -0.066],
        inside,
      );
    }
    if (p.options.includes("sill"))
      add(
        frame,
        [w + 0.1, 0.035, 0.25],
        [0, -0.027, 0.04],
        new MeshStandardMaterial({ color: "#d9d9d0" }),
      );
    if (p.options.some((o) => o.startsWith("shutter-"))) {
      add(frame, [w + 0.1, 0.18, 0.24], [0, h + 0.095, -0.015]);
      if (!p.shutterOpen)
        for (let i = 0; i < Math.ceil(h / 0.05); i++)
          add(
            frame,
            [w - 0.06, 0.045, 0.025],
            [0, 0.035 + i * 0.05, 0.09],
            new MeshStandardMaterial({ color: p.color, roughness: 0.65 }),
          );
    }
    if (p.options.includes("insect-screen"))
      add(
        frame,
        [w - 0.1, h - 0.1, 0.005],
        [0, h / 2, 0.11],
        new MeshStandardMaterial({
          color: "#354548",
          transparent: true,
          opacity: 0.18,
          wireframe: true,
        }),
      );
  }
  return g;
}
export function disposeProduct(g: Group) {
  const mats = new Set<MeshStandardMaterial>();
  g.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      const list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach((m) => mats.add(m as MeshStandardMaterial));
    }
  });
  mats.forEach((m) => m.dispose());
}
let offscreen: WebGLRenderer | undefined;
async function renderProductImage(
  p: Placement,
  c: Catalog,
  assetUrl: (s: string) => string,
): Promise<{
  image: HTMLImageElement;
  frame: HTMLImageElement;
  glass: HTMLImageElement;
}> {
  offscreen ||= new WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  offscreen.toneMapping = ACESFilmicToneMapping;
  offscreen.outputColorSpace = SRGBColorSpace;
  offscreen.toneMappingExposure = 1.02;
  const g = createProduct(p, c, assetUrl),
    scene = new Scene();
  scene.add(g, new AmbientLight("#fff9ef", 1.1));
  const key = new DirectionalLight("#ffffff", 2.2);
  key.position.set(-2, 4, 5);
  scene.add(key);
  // Wait for local texture images, with a bounded fallback to material colours.
  await Promise.all(
    [...textures.values()].map(
      (t) =>
        new Promise<void>((resolve) => {
          if (t.image?.complete) resolve();
          else {
            const start = Date.now();
            const check = () =>
              t.image?.complete || Date.now() - start > 2500
                ? resolve()
                : setTimeout(check, 30);
            check();
          }
        }),
    ),
  );
  const b = new Box3().setFromObject(g),
    size = b.getSize(new Vector3()),
    center = b.getCenter(new Vector3());
  const camera = new OrthographicCamera(
    -size.x / 2,
    size.x / 2,
    size.y / 2,
    -size.y / 2,
    0.1,
    20,
  );
  camera.position.set(center.x, center.y, 5);
  camera.lookAt(center.x, center.y, 0);
  offscreen.setSize(Math.round((1024 * size.x) / size.y), 1024, false);
  offscreen.setClearColor(new Color("#000000"), 0);
  const render = async (layer: string) => {
    g.traverse((o) => {
      if (o instanceof Mesh)
        o.visible =
          layer === "all" ||
          (layer === "frame"
            ? g.getObjectByName("frame")!.children.includes(o)
            : o.userData.surface === "glass");
    });
    offscreen!.render(scene, camera);
    const im = new Image();
    im.src = offscreen!.domElement.toDataURL("image/png");
    await im.decode();
    return im;
  };
  const image = await render("all"),
    frame = await render("frame"),
    mask = await render("glass");
  disposeProduct(g);
  return { image, frame, glass: mask };
}

// Serialize access to the shared renderer across rapid material changes.
let productQueue: Promise<unknown> = Promise.resolve();
export function productImage(...args: Parameters<typeof renderProductImage>) {
  const result = productQueue.then(() => renderProductImage(...args));
  productQueue = result.catch(() => undefined);
  return result;
}
