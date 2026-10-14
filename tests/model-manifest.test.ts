import { expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  ModelManifestSchema,
  modelManifest,
} from "../src/scene/assets/manifest";
it("records local, original, hash-verified metre models and reduced-cost LODs under the kit allocation", () => {
  let bytes = 0;
  for (const a of modelManifest.assets) {
    expect(
      readFileSync(`public/shared/licenses/${a.licenseKey}.txt`, "utf8"),
    ).toContain("white-label");
    expect(a.quotedProduct).toBe(false);
    expect(a.lowerDetail.triangles).toBeLessThanOrEqual(a.triangles);
    expect(a.lowerDetail.drawCalls).toBeLessThanOrEqual(a.drawCalls);
    for (const v of [a, a.lowerDetail]) {
      const file = readFileSync(`public/${v.path}`);
      bytes += file.length;
      expect(file.length).toBe(v.bytes);
      expect(file.length).toBeLessThan(1_000_000);
      expect(createHash("sha256").update(file).digest("hex")).toBe(v.sha256);
      expect(file.readUInt32LE(0)).toBe(0x46546c67);
      const doc = JSON.parse(
        file.subarray(20, 20 + file.readUInt32LE(12)).toString(),
      );
      expect(doc.images).toBeUndefined();
      expect(doc.cameras).toBeUndefined();
      expect(doc.animations).toBeUndefined();
      expect(doc.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
      const positions = doc.meshes.flatMap(
        (m: { primitives: { attributes: { POSITION: number } }[] }) =>
          m.primitives.map((p) => doc.accessors[p.attributes.POSITION]),
      );
      for (let axis = 0; axis < 3; axis++) {
        const min = Math.min(
            ...positions.map((p: { min: number[] }) => p.min[axis]),
          ),
          max = Math.max(
            ...positions.map((p: { max: number[] }) => p.max[axis]),
          );
        expect(max - min).toBeCloseTo(v.nativeDimensions[axis], 4);
      }
    }
  }
  expect(bytes).toBeLessThan(2_500_000);
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
