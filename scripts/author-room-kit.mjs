// Original generic geometry. No supplier, marketplace or external mesh inputs.
// Re-run with Node; large authoring sources stay outside public/runtime assets.
import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((v) => {
      this.result = v;
      this.onloadend?.();
    });
  }
};
const root = "public/shared",
  manifest = { version: 1, revision: "room-kit-v1", assets: [] };
const palette = {
  oak: ["#b99c76", 0.78, 0],
  textile: ["#bdb2a0", 1, 0],
  dark: ["#293333", 0.62, 0.15],
  steel: ["#929fa2", 0.26, 0.86],
  glass: ["#101c22", 0.16, 0.22],
  ceramic: ["#eee8d9", 0.68, 0],
  sage: ["#7c8e80", 1, 0],
  ink: ["#495b66", 1, 0],
  sole: ["#b0a38e", 0.94, 0],
};
function author(id, origin, build) {
  return { id, origin, build };
}
const kit = [
  author("oven", "center", (p) => {
    p.box("dark", [0.58, 0.59, 0.046], [0, 0, 0], 0.006);
    p.box("glass", [0.49, 0.36, 0.007], [0, -0.055, 0.028], 0.012);
    p.box("steel", [0.47, 0.024, 0.044], [0, 0.18, 0.052], 0.008);
    for (const x of [-0.215, 0.215])
      p.cyl(
        "steel",
        0.016,
        0.016,
        0.016,
        [x, 0.247, 0.033],
        [Math.PI / 2, 0, 0],
      );
    p.box("glass", [0.095, 0.039, 0.004], [0, 0.246, 0.026]);
    for (const x of [-0.03, 0, 0.03])
      p.box("ceramic", [0.014, 0.004, 0.001], [x, 0.246, 0.03]);
    for (let i = 0; i < 7; i++)
      p.box("steel", [0.47, 0.002, 0.002], [0, -0.17 + i * 0.026, 0.033]);
    p.box("steel", [0.54, 0.006, 0.005], [0, -0.27, 0.027]);
  }),
  author("fridge", "floor-front", (p) => {
    for (const [y, h] of [
      [1.285, 1.22],
      [0.33, 0.63],
    ]) {
      p.box("steel", [0.575, h, 0.042], [0, y, 0.01], 0.009);
      p.box("dark", [0.016, 0.36, 0.032], [-0.19, y, 0.046], 0.005);
    }
    p.box("glass", [0.06, 0.08, 0.003], [0.18, 1.49, 0.033], 0.002);
    for (let i = 0; i < 4; i++)
      p.box("dark", [0.5, 0.004, 0.005], [0, 0.038 + i * 0.015, 0.034]);
  }),
  author("tap", "countertop", (p) => {
    p.cyl("steel", 0.026, 0.028, 0.015, [0, 0.0075, 0]);
    p.cyl("steel", 0.014, 0.016, 0.185, [0, 0.105, 0]);
    p.tube(
      "steel",
      [
        [0, 0.19, 0],
        [0, 0.29, 0],
        [0, 0.33, 0.035],
        [0, 0.33, 0.12],
        [0, 0.28, 0.15],
      ],
      0.012,
    );
    p.cyl("dark", 0.012, 0.012, 0.009, [0, 0.275, 0.15]);
    p.box("steel", [0.06, 0.011, 0.018], [-0.029, 0.15, 0], 0.003);
  }),
  author("stool", "floor", (p) => {
    p.box("oak", [0.42, 0.052, 0.38], [0, 0.565, 0], 0.024);
    p.box("textile", [0.38, 0.029, 0.34], [0, 0.601, 0], 0.013);
    p.box("oak", [0.42, 0.23, 0.034], [0, 0.707, -0.155], 0.014);
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        p.rod(
          "dark",
          [x * 0.17, 0.018, z * 0.145],
          [x * 0.145, 0.54, z * 0.12],
          0.014,
        );
    for (const x of [-1, 1])
      p.rod("dark", [x * 0.162, 0.23, -0.14], [x * 0.162, 0.23, 0.14], 0.009);
    p.rod("dark", [-0.16, 0.23, 0.14], [0.16, 0.23, 0.14], 0.009);
  }),
  author("pendant", "ceiling", (p) => {
    p.cyl("dark", 0.045, 0.045, 0.025, [0, -0.0125, 0]);
    p.cyl("dark", 0.003, 0.003, 0.44, [0, -0.245, 0]);
    p.cyl("dark", 0.04, 0.17, 0.2, [0, -0.565, 0]);
    p.cyl("ceramic", 0.153, 0.153, 0.004, [0, -0.667, 0]);
  }),
  author("bench", "floor", (p) => {
    p.box("oak", [1.05, 0.055, 0.4], [0, 0.36, 0], 0.012);
    p.box("textile", [1.01, 0.065, 0.38], [0, 0.419, 0], 0.03);
    for (const x of [-0.43, 0.43])
      for (const z of [-0.13, 0.13])
        p.box("oak", [0.036, 0.332, 0.036], [x, 0.166, z], 0.006);
    p.box("oak", [0.9, 0.026, 0.3], [0, 0.13, 0], 0.004);
  }),
  author("counter-set", "countertop", (p) => {
    p.box("oak", [0.28, 0.016, 0.18], [0, 0.008, 0], 0.013);
    p.cyl("ceramic", 0.039, 0.037, 0.1, [-0.075, 0.067, 0]);
    p.tube(
      "ceramic",
      [
        [-0.04, 0.04, 0],
        [-0.017, 0.055, 0],
        [-0.017, 0.09, 0],
        [-0.04, 0.105, 0],
      ],
      0.005,
    );
    p.cyl("ceramic", 0.046, 0.042, 0.13, [0.067, 0.081, 0.025]);
    p.cyl("oak", 0.049, 0.049, 0.009, [0.067, 0.151, 0.025]);
  }),
  ...["shirt", "coat", "trousers"].map((id, i) =>
    author(id, "rail", (p) => {
      // Hangers sit along the X rail; clothing spreads along depth Z.
      p.tube(
        "oak",
        [
          [0, 0, 0],
          [0, 0.029, -0.014],
          [0, 0.04, 0],
          [0, 0.025, 0.018],
          [0, -0.055, 0.2],
          [0, -0.078, 0],
          [0, -0.055, -0.2],
          [0, 0.018, -0.018],
        ],
        0.004,
      );
      if (i === 2) {
        p.box("ink", [0.045, 0.025, 0.28], [0, -0.095, 0], 0.008);
        for (const z of [-0.073, 0.073])
          p.box("ink", [0.045, 0.66, 0.13], [0, -0.43, z], 0.012);
        p.rod("sole", [0.025, -0.12, -0.12], [0.025, -0.74, -0.12], 0.0015);
      } else {
        const len = i === 1 ? 0.86 : 0.6,
          cloth = i === 1 ? "sage" : "textile";
        p.fabric(cloth, len, i === 1 ? 0.37 : 0.34);
        for (const z of [-1, 1])
          p.rod(
            cloth,
            [0, -0.1, z * 0.14],
            [0, -(i === 1 ? 0.59 : 0.36), z * 0.205],
            0.04,
          );
        p.rod("oak", [0.03, -0.08, 0], [0.03, -len * 0.92, 0], 0.0015);
        for (let b = 0; b < 4; b++)
          p.cyl(
            "oak",
            0.003,
            0.003,
            0.002,
            [0.032, -0.19 - b * 0.09, 0],
            [0, 0, Math.PI / 2],
          );
      }
    }),
  ),
  ...["fold", "fold-ribbed"].map((id, i) =>
    author(id, "shelf", (p) => {
      p.box(i ? "sage" : "textile", [0.29, 0.045, 0.23], [0, 0.0225, 0], 0.016);
      p.box(
        i ? "sage" : "textile",
        [0.265, 0.02, 0.215],
        [0.005, 0.052, 0],
        0.01,
      );
      for (let n = 0; n < (i ? 7 : 2); n++)
        p.rod(
          "sole",
          [-0.12 + n * 0.035, 0.064, -0.08],
          [-0.12 + n * 0.035, 0.064, 0.085],
          0.001,
        );
    }),
  ),
  author("shoes", "shelf", (p) => {
    for (const x of [-0.062, 0.062]) {
      p.box("sole", [0.093, 0.025, 0.265], [x, 0.013, 0], 0.012);
      p.sphere("dark", [0.044, 0.04, 0.125], [x, 0.052, 0]);
      p.box("dark", [0.074, 0.065, 0.09], [x, 0.065, -0.062], 0.018);
      for (let n = 0; n < 4; n++)
        p.rod(
          "sole",
          [x - 0.024, 0.087, -0.04 + n * 0.013],
          [x + 0.024, 0.087, -0.034 + n * 0.013],
          0.0015,
        );
    }
  }),
  ...["box-linen", "box-ink"].map((id, i) =>
    author(id, "shelf", (p) => {
      p.box(i ? "ink" : "textile", [0.32, 0.19, 0.28], [0, 0.095, 0], 0.008);
      p.box(i ? "ink" : "textile", [0.332, 0.023, 0.292], [0, 0.196, 0], 0.004);
      p.box("oak", [0.065, 0.025, 0.003], [0, 0.116, 0.142], 0.003);
      p.box("dark", [0.042, 0.004, 0.001], [0, 0.116, 0.144]);
    }),
  ),
];
await mkdir(`${root}/models`, { recursive: true });
for (const asset of kit) {
  const paths = [];
  let highStats;
  for (const lod of ["balanced", "lightweight"]) {
    const buckets = new Map(),
      low = lod === "lightweight";
    function add(key, g, pos = [0, 0, 0], rot = [0, 0, 0]) {
      g = g.index ? g.toNonIndexed() : g;
      // Match attributes; none of this kit requires textures/UVs.
      g.deleteAttribute("uv");
      g.applyMatrix4(
        new T.Matrix4().compose(
          new T.Vector3(...pos),
          new T.Quaternion().setFromEuler(new T.Euler(...rot)),
          new T.Vector3(1, 1, 1),
        ),
      );
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(g);
    }
    const p = {
      box: (k, s, v, r = 0) =>
        add(
          k,
          r && !low
            ? new RoundedBoxGeometry(
                ...s,
                1,
                Math.min(r, ...s.map((n) => n / 3)),
              )
            : new T.BoxGeometry(...s),
          v,
        ),
      cyl: (k, a, b, h, v, r) =>
        add(k, new T.CylinderGeometry(a, b, h, low ? 8 : 16), v, r),
      sphere: (k, s, v) => {
        const g = new T.SphereGeometry(1, low ? 8 : 16, low ? 4 : 8);
        g.scale(...s);
        add(k, g, v);
      },
      tube: (k, points, r) =>
        add(
          k,
          new T.TubeGeometry(
            new T.CatmullRomCurve3(points.map((v) => new T.Vector3(...v))),
            low ? 12 : 24,
            r,
            low ? 5 : 8,
            false,
          ),
        ),
      rod: (k, a, b, r) => {
        const from = new T.Vector3(...a),
          to = new T.Vector3(...b),
          g = new T.CylinderGeometry(r, r, from.distanceTo(to), low ? 5 : 8);
        g.applyQuaternion(
          new T.Quaternion().setFromUnitVectors(
            new T.Vector3(0, 1, 0),
            to.clone().sub(from).normalize(),
          ),
        );
        add(k, g, from.add(to).multiplyScalar(0.5).toArray());
      },
      fabric: (k, len, width) => {
        // Opaque volumetric drape with deterministic folds, rather than flat cards.
        const g = new T.BoxGeometry(
            0.045,
            len - 0.12,
            width,
            2,
            low ? 3 : 8,
            low ? 4 : 12,
          ),
          a = g.getAttribute("position");
        for (let n = 0; n < a.count; n++) {
          const y = a.getY(n),
            z = a.getZ(n),
            t = (y + (len - 0.12) / 2) / (len - 0.12);
          a.setX(n, a.getX(n) + 0.007 * Math.sin(z * 85) * (1 - t));
          a.setZ(n, z * (0.86 + 0.14 * (1 - t)));
        }
        g.computeVertexNormals();
        add(k, g, [0, -len / 2 - 0.045, 0]);
      },
    };
    asset.build(p);
    const scene = new T.Group();
    let triangles = 0;
    for (const [key, gs] of buckets) {
      const [color, roughness, metalness] = palette[key],
        g = mergeGeometries(gs);
      const mesh = new T.Mesh(
        g,
        new T.MeshStandardMaterial({ color, roughness, metalness }),
      );
      mesh.name = key;
      scene.add(mesh);
      triangles += g.getAttribute("position").count / 3;
    }
    const initialBounds = new T.Box3().setFromObject(scene);
    const floorOffsetY = asset.origin === "floor" ? -initialBounds.min.y : 0;
    scene.position.y = floorOffsetY;
    const bounds = new T.Box3().setFromObject(scene),
      size = bounds.getSize(new T.Vector3()).toArray();
    const bytes = await new GLTFExporter().parseAsync(scene, {
      binary: true,
      onlyVisible: true,
    });
    const hash = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
    const path = `shared/models/${asset.id}-${lod}-${hash.slice(0, 10)}.glb`;
    await writeFile(`public/${path}`, Buffer.from(bytes));
    paths.push({
      path,
      sha256: hash,
      bytes: bytes.byteLength,
      triangles,
      drawCalls: buckets.size,
      geometryBytes: triangles * 3 * 24,
      nativeDimensions: size,
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    });
    if (!low)
      highStats = {
        nativeDimensions: size,
        bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
        materialSlots: [...buckets.keys()],
      };
  }
  manifest.assets.push({
    id: asset.id,
    revision: 1,
    ...paths[0],
    lowerDetail: paths[1],
    ...highStats,
    origin: asset.origin,
    up: "+Y",
    forward: "+Z",
    anchors: { attachment: [0, 0, 0] },
    quality: "balanced",
    decodedTextureBytes: 0,
    licenseKey: "original-room-kit-v1",
    source: "scripts/author-room-kit.mjs",
    sourceSha256: createHash("sha256")
      .update(asset.build.toString())
      .digest("hex"),
    quotedProduct: false,
  });
}
// Keep assets registered by other pipelines (e.g. scripts/register-decor.mjs).
const previous = JSON.parse(
  await readFile(`${root}/asset-manifest.json`, "utf8").catch(() => "{}"),
);
manifest.assets.push(
  ...(previous.assets ?? []).filter(
    (a) => a.licenseKey !== "original-room-kit-v1",
  ),
);
if (previous.revision) manifest.revision = previous.revision;
await writeFile(
  `${root}/asset-manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Authored ${kit.length} models, two LODs, ${manifest.assets.reduce((n, a) => n + a.bytes + a.lowerDetail.bytes, 0)} bytes`,
);
