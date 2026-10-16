import { expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  ModelManifestSchema,
  modelManifest,
} from "../src/scene/assets/manifest";
it("records local, original, hash-verified metre models and reduced-cost LODs under the kit allocation", () => {
  let bytes = 0;
  const counted = new Set<string>();
  for (const a of modelManifest.assets) {
    expect(
      readFileSync(`public/shared/licenses/${a.licenseKey}.txt`, "utf8"),
    ).toContain("white-label");
    expect(a.quotedProduct).toBe(false);
    expect(a.lowerDetail.triangles).toBeLessThanOrEqual(a.triangles);
    expect(a.lowerDetail.drawCalls).toBeLessThanOrEqual(a.drawCalls);
    for (const v of [a, a.lowerDetail]) {
      const file = readFileSync(`public/${v.path}`);
      // Hard-surface pieces may share one file for both levels; count it once.
      if (!counted.has(v.path)) bytes += file.length;
      counted.add(v.path);
      expect(file.length).toBe(v.bytes);
      expect(file.length).toBeLessThan(1_000_000);
      expect(createHash("sha256").update(file).digest("hex")).toBe(v.sha256);
      expect(file.readUInt32LE(0)).toBe(0x46546c67);
      const doc = JSON.parse(
        file.subarray(20, 20 + file.readUInt32LE(12)).toString(),
      );
      // Original kits: untextured. CC0 decor: embedded WebP only, no URIs.
      if (a.licenseKey.startsWith("original-room-kit"))
        expect(doc.images).toBeUndefined();
      else
        for (const image of doc.images ?? []) {
          expect(image.uri).toBeUndefined();
          expect(image.mimeType).toBe("image/webp");
        }
      expect(
        (doc.extensionsRequired ?? []).every((e: string) =>
          [
            "EXT_texture_webp",
            "KHR_mesh_quantization",
            "EXT_meshopt_compression",
          ].includes(e),
        ),
      ).toBe(true);
      expect(doc.cameras).toBeUndefined();
      expect(doc.animations).toBeUndefined();
      expect(doc.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
      // Quantised meshes keep integer accessor bounds and carry their
      // dequantising scale/offset on the node; apply it (no rotation is used).
      type Node = { mesh?: number; scale?: number[]; translation?: number[] };
      const positions = (doc.nodes as Node[])
        .filter((n) => n.mesh !== undefined)
        .flatMap((n) =>
          doc.meshes[n.mesh!].primitives.map(
            (p: { attributes: { POSITION: number } }) => {
              const acc = doc.accessors[p.attributes.POSITION];
              const k = acc.normalized
                ? acc.componentType === 5122
                  ? 1 / 32767
                  : acc.componentType === 5123
                    ? 1 / 65535
                    : acc.componentType === 5120
                      ? 1 / 127
                      : 1 / 255
                : 1;
              const at = (q: number[], i: number) =>
                q[i] * k * (n.scale?.[i] ?? 1) + (n.translation?.[i] ?? 0);
              return {
                min: [0, 1, 2].map((i) => at(acc.min, i)),
                max: [0, 1, 2].map((i) => at(acc.max, i)),
              };
            },
          ),
        );
      for (let axis = 0; axis < 3; axis++) {
        const min = Math.min(...positions.map((p) => p.min[axis])),
          max = Math.max(...positions.map((p) => p.max[axis]));
        expect(max - min).toBeCloseTo(v.nativeDimensions[axis], 3);
      }
    }
  }
  // Phase 2 rooms (owner raised the shipped working limit to about 11 MB).
  expect(bytes).toBeLessThan(3_500_000);
});
it("rejects remote paths, unknown coordinate conventions and billable decor metadata", () => {
  for (const patch of [
    { path: "https://example.test/model.glb" },
    { path: "shared/models/../escape.glb" },
    { up: "+Z" },
    { quotedProduct: true },
    { nativeDimensions: [0, 1, 1] },
  ]) {
    expect(
      ModelManifestSchema.safeParse({
        ...modelManifest,
        assets: [{ ...modelManifest.assets[0], ...patch }],
      }).success,
    ).toBe(false);
  }
});

it("every material texture in every shipped model resolves to an image", () => {
  // The wall art's artwork roughness map once pointed at a texture with no
  // image; GLTFLoader rejected the whole file and the print never appeared.
  const manifest = JSON.parse(
    readFileSync("public/shared/asset-manifest.json", "utf8"),
  ) as { assets: Array<{ path: string; lowerDetail?: { path: string } }> };
  const paths = manifest.assets
    .flatMap((a) => [a.path, a.lowerDetail?.path])
    .filter((p): p is string => !!p && p.endsWith(".glb"));
  expect(paths.length).toBeGreaterThan(0);
  for (const path of paths) {
    const bytes = readFileSync("public/" + path);
    const json = JSON.parse(
      bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
    );
    const resolves = (index: number) => {
      const t = json.textures?.[index];
      const source = t?.source ?? t?.extensions?.EXT_texture_webp?.source;
      return source !== undefined && !!json.images?.[source];
    };
    for (const m of json.materials ?? [])
      for (const slot of [
        m.normalTexture,
        m.occlusionTexture,
        m.emissiveTexture,
        m.pbrMetallicRoughness?.baseColorTexture,
        m.pbrMetallicRoughness?.metallicRoughnessTexture,
      ])
        if (slot) expect(resolves(slot.index), `${path} ${m.name}`).toBe(true);
    // A blended glass layer must actually be see-through (it once hid the
    // print as an opaque pane).
    for (const m of json.materials ?? [])
      if (m.alphaMode === "BLEND" && /glass/i.test(m.name ?? ""))
        expect(
          m.pbrMetallicRoughness?.baseColorFactor?.[3] ?? 1,
          `${path} ${m.name}`,
        ).toBeLessThan(0.5);
  }
});
