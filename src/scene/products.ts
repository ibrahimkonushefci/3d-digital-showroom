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
  PMREMGenerator,
  Vector2,
  type Texture,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Catalog, Material } from "../catalog/types";
import type { Placement } from "../doorPreview/types";
const loader = new TextureLoader();
const textures = new Map<string, Texture>();
const readiness = new Map<Texture, Promise<void>>();
function texture(path: string, assetUrl: (s: string) => string, color = false) {
  const url = assetUrl(path),
    key = url + (color ? ":color" : ":data");
  if (!textures.has(key)) {
    let done!: () => void;
    const ready = new Promise<void>((resolve) => {
      done = resolve;
    });
    const t = loader.load(url, done, undefined, done);
    if (color) t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    textures.set(key, t);
    readiness.set(t, ready);
  }
  return textures.get(key)!;
}
export function surfaceResponse(materialType: string, grain: boolean) {
  if (grain)
    return {
      roughness: materialType === "wood" ? 0.48 : 0.52,
      metalness: 0,
      clearcoat: materialType === "wood" ? 0.18 : 0.08,
    };
  switch (materialType) {
    case "aluminium":
      return { roughness: 0.42, metalness: 0.04, clearcoat: 0.22 };
    case "security":
      return { roughness: 0.52, metalness: 0.03, clearcoat: 0.12 };
    case "wood":
      return { roughness: 0.46, metalness: 0, clearcoat: 0.18 };
    default:
      return { roughness: 0.34, metalness: 0, clearcoat: 0.1 };
  }
}
function finishMaterial(
  f: Material | undefined,
  color: string,
  materialType: string,
  assetUrl: (s: string) => string,
  performance: boolean,
) {
  return new MeshPhysicalMaterial({
    color: f?.texture ? "#ffffff" : color,
    map: f?.texture ? texture(f.texture, assetUrl, true) : null,
    normalMap:
      !performance && f?.normalMap ? texture(f.normalMap, assetUrl) : null,
    normalScale: new Vector2(0.16, 0.16),
    roughnessMap:
      !performance && f?.roughnessMap
        ? texture(f.roughnessMap, assetUrl)
        : null,
    ...surfaceResponse(materialType, !!f?.texture),
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.85,
  });
}
export function productReady(g: Group): Promise<void> {
  return g.userData.ready || Promise.resolve();
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
    m = finishMaterial(f, p.color, p.materialType, assetUrl, performance),
    insideFinish = p.finishInsideId
      ? c.productFinishes.find((f) => f.id === p.finishInsideId)
      : p.colorInside
        ? undefined
        : f,
    inside = finishMaterial(
      insideFinish,
      insideFinish?.color || p.colorInside || p.color,
      p.materialType,
      assetUrl,
      performance,
    ),
    metal = new MeshStandardMaterial({
      color: "#adb8be",
      metalness: 0.95,
      roughness: 0.23,
    }),
    handleMetal = new MeshStandardMaterial({
      color: p.options.includes("black-handle") ? "#202426" : "#bdc3c4",
      metalness: p.options.includes("black-handle") ? 0.08 : 0.9,
      roughness: 0.28,
    }),
    seal = new MeshStandardMaterial({ color: "#222625", roughness: 0.88 }),
    glass = new MeshPhysicalMaterial({
      color: "#d0dfdf",
      metalness: 0,
      roughness: p.options.includes("satin") ? 0.55 : 0.08,
      transparent: true,
      opacity: p.options.includes("satin") ? 0.75 : 0.38,
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
    mat: MeshStandardMaterial = m,
    tag = "solid",
  ) => {
    const geometry =
      performance || tag === "glass"
        ? new BoxGeometry(...size)
        : new RoundedBoxGeometry(
            ...size,
            2,
            Math.min(0.0018, ...size.map((n) => n / 5)),
          );
    // Continuous product-space UVs keep one grain sheet across glass cutouts.
    if (mat === m || mat === inside) {
      const vertices = geometry.attributes.position,
        uv = geometry.attributes.uv;
      for (let i = 0; i < vertices.count; i++)
        uv.setXY(
          i,
          (vertices.getY(i) + pos[1]) / h,
          (vertices.getX(i) + pos[0] + w / 2) / w,
        );
    }
    const mesh = new Mesh(geometry, mat === m ? [m, m, m, m, m, inside] : mat);
    mesh.position.set(...pos);
    mesh.castShadow = tag !== "glass";
    mesh.receiveShadow = true;
    mesh.userData.surface = tag;
    mesh.userData.layer = parent === frame ? "frame" : "leaf";
    parent.add(mesh);
    return mesh;
  };
  add(frame, [0.07, h + 0.04, depth], [-w / 2 + 0.025, h / 2, 0]);
  add(frame, [0.07, h + 0.04, depth], [w / 2 - 0.025, h / 2, 0]);
  add(frame, [w, 0.07, depth], [0, h - 0.025, 0]);
  add(frame, [w, 0.028, 0.18], [0, 0.01, 0.02], metal);
  for (const side of [-1, 1]) {
    add(
      frame,
      [0.015, h - 0.075, 0.014],
      [side * (w / 2 - 0.057), h / 2, -0.045],
      seal,
    );
    add(
      frame,
      [0.07, h + 0.04, 0.012],
      [side * (w / 2 - 0.025), h / 2, -0.066],
      inside,
    );
  }
  add(frame, [w - 0.08, 0.015, 0.014], [0, h - 0.057, -0.045], seal);
  add(frame, [w, 0.07, 0.012], [0, h - 0.025, -0.066], inside);
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
    add(leaf, [0.025, len, 0.035], [w * 0.32, h * 0.51, 0.11], handleMetal);
    for (const y of [-1, 1])
      add(
        leaf,
        [0.025, 0.028, 0.065],
        [w * 0.32, h * 0.51 + y * len * 0.42, 0.08],
        handleMetal,
      );
    if (p.options.includes("fingerprint")) {
      add(
        leaf,
        [0.06, 0.09, 0.012],
        [w * 0.32 - 0.09, h * 0.74, 0.058],
        new MeshStandardMaterial({ color: "#171c1f" }),
      );
      add(
        leaf,
        [0.035, 0.03, 0.006],
        [w * 0.32 - 0.09, h * 0.75, 0.067],
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
      hinge.userData.layer = "frame";
      frame.add(hinge);
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
    const sliding = p.options.includes("sliding");
    if (sliding) {
      for (const y of [0.045, h - 0.045]) {
        for (const z of [-0.01, 0.07])
          add(frame, [w - 0.1, 0.01, 0.012], [0, y, z], metal);
      }
    }
    for (let i = 0; i < panes; i++) {
      const pitch = (w - 0.13) / panes,
        sw = pitch + (sliding && panes > 1 ? 0.035 : 0),
        x = -w / 2 + 0.065 + pitch * (i + 0.5);
      const sashZ = sliding ? (i % 2 ? -0.025 : 0.045) : 0.026;
      const glazingLayers = p.options.includes("triple-glass") ? 3 : 2;
      for (let layer = 0; layer < glazingLayers; layer++) {
        const pane = add(
          leaf,
          [sw - 0.045, h - 0.16, 0.003],
          [x, h / 2, sashZ - 0.05 + layer * 0.012],
          glass,
          "glass",
        );
        pane.userData.glazingLayers = glazingLayers;
      }
      // Spacers expose the insulation stack from the profile/detail cameras.
      for (let layer = 0; layer < glazingLayers; layer++) {
        const z = sashZ - 0.05 + layer * 0.012;
        for (const side of [-1, 1]) {
          add(
            leaf,
            [0.008, h - 0.14, 0.006],
            [x + side * (sw / 2 - 0.034), h / 2, z],
            metal,
          );
          add(
            leaf,
            [sw - 0.07, 0.008, 0.006],
            [x, side === 1 ? h - 0.074 : 0.074, z],
            metal,
          );
        }
      }
      for (const s of [-1, 1]) {
        add(
          leaf,
          [0.035, h - 0.1, 0.075],
          [x + s * (sw / 2 - 0.025), h / 2, sashZ],
        );
        add(leaf, [sw, 0.035, 0.075], [x, s === 1 ? h - 0.065 : 0.065, sashZ]);
      }
      if (sliding || model?.style !== "fixed") {
        add(
          leaf,
          [0.014, 0.11, 0.026],
          [x + sw / 2 - 0.06, h / 2, sashZ + 0.06],
          metal,
        );
        add(
          leaf,
          [0.04, 0.025, 0.018],
          [x + sw / 2 - 0.056, h / 2 + 0.05, sashZ + 0.045],
          metal,
        );
      }
    }
    if (p.options.includes("sill"))
      add(
        frame,
        [w + 0.1, 0.035, 0.25],
        [0, -0.027, 0.04],
        new MeshStandardMaterial({ color: "#d9d9d0" }),
      );
    if (p.options.some((o) => o.startsWith("shutter-"))) {
      add(frame, [w + 0.1, 0.18, 0.32], [0, h + 0.095, 0.04]);
      if (!p.shutterOpen)
        for (let i = 0; i < Math.ceil(h / 0.05); i++)
          add(
            frame,
            [w - 0.06, 0.045, 0.025],
            [0, 0.035 + i * 0.05, 0.18],
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
  if (p.kind === "door") {
    add(
      leaf,
      [0.095, 0.025, 0.025],
      [w * 0.32 - 0.025, h * 0.48, -0.06],
      handleMetal,
    );
    leaf.position.set(-w / 2 + 0.065, 0, 0.045);
    leaf.children.forEach((o) => o.position.sub(leaf.position));
    g.userData.hinge = leaf.position.toArray();
  }
  const pending = new Set<Promise<void>>();
  for (const material of [m, inside])
    for (const map of [material.map, material.normalMap, material.roughnessMap])
      if (map && readiness.has(map)) pending.add(readiness.get(map)!);
  g.userData.materials = [m, inside, metal, handleMetal, seal, glass];
  g.userData.ready = Promise.all([...pending]).then(() => undefined);
  return g;
}
export function disposeProduct(g: Group) {
  const mats = new Set<MeshStandardMaterial>(g.userData.materials || []);
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
let photoEnvironment: Texture | undefined;
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
  if (!photoEnvironment) {
    const room = new RoomEnvironment(),
      pmrem = new PMREMGenerator(offscreen);
    photoEnvironment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
  }
  scene.environment = photoEnvironment;
  scene.add(g, new AmbientLight("#fff9ef", 1.1));
  const key = new DirectionalLight("#ffffff", 2.2);
  key.position.set(-2, 4, 5);
  scene.add(key);
  try {
    await Promise.race([
      productReady(g),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(Error("Product textures still loading")),
          10000,
        ),
      ),
    ]);
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
              ? o.userData.layer === "frame"
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
    return { image, frame, glass: mask };
  } finally {
    disposeProduct(g);
  }
}

// Serialize access to the shared renderer across rapid material changes.
let productQueue: Promise<unknown> = Promise.resolve();
export function productImage(...args: Parameters<typeof renderProductImage>) {
  const result = productQueue.then(() => renderProductImage(...args));
  productQueue = result.catch(() => undefined);
  return result;
}
