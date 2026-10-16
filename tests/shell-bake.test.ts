import { expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { ShaderLib } from "three";
import { CatalogSchema } from "../src/catalog/types";
import { presentationPresets } from "../src/designer3d/presets";
import { bakeSignature } from "../src/scene/bake/signature";
import {
  applyShellBake,
  BAKES,
  SURFACES,
  shellBakeUniforms,
} from "../src/scene/bake/shellBake";
import { resolveRoom } from "../src/scene/rooms/resolveRoom";

const catalog = CatalogSchema.parse(
  JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
);
const presets = presentationPresets(catalog);

it("ships a lightmap for every prepared design, found again on each load", () => {
  for (const preset of presets) {
    // Cabinet ids are regenerated on every load; the signature must not care.
    const again = presentationPresets(catalog).find((p) => p.id === preset.id)!;
    expect(again.design.cabinets[0].id).not.toBe(preset.design.cabinets[0].id);
    const signature = bakeSignature(preset.design, catalog);
    expect(bakeSignature(again.design, catalog)).toBe(signature);
    const entry = BAKES[signature];
    expect(entry, preset.id).toBeDefined();
    const file = `public/shared/bakes/${entry.file}`;
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBe(entry.bytes);
    expect(entry.bytes).toBeLessThan(250_000);
    // The shell is the presentation room around the design.
    const room = resolveRoom(preset.design).envelope.room;
    expect(entry.room).toEqual([
      room.width / 100,
      room.height / 100,
      room.depth / 100,
    ]);
    for (const s of SURFACES) {
      const [x, y, w, h] = entry.rects[s];
      expect(x >= 0 && y >= 0 && x + w <= 1 && y + h <= 1).toBe(true);
    }
    expect(entry.gain).toBeGreaterThan(0.5);
    expect(entry.gain).toBeLessThan(3);
  }
});

it("keeps the bake through finish changes and drops it on structural edits", () => {
  const design = presets[0].design;
  const signature = bakeSignature(design, catalog);
  const refinished = {
    ...design,
    style: { ...design.style, front: "white", countertop: "oak" },
    environment: { ...design.environment, wallColor: "#d8e0e4" },
  } as typeof design;
  expect(bakeSignature(refinished, catalog)).toBe(signature);
  const moved = {
    ...design,
    cabinets: design.cabinets.map((c, i) => (i ? c : { ...c, x: c.x + 10 })),
  };
  expect(bakeSignature(moved, catalog)).not.toBe(signature);
  const resized = {
    ...design,
    room: { ...design.room, width: design.room.width + 20 },
  };
  expect(bakeSignature(resized, catalog)).not.toBe(signature);
  const removed = { ...design, cabinets: design.cabinets.slice(1) };
  expect(bakeSignature(removed, catalog)).not.toBe(signature);
});

it("swaps only the diffuse term of the shell shader, behind a weight", () => {
  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.physical.vertexShader,
    fragmentShader: ShaderLib.physical.fragmentShader,
  } as never as Parameters<typeof applyShellBake>[0];
  const uniforms = shellBakeUniforms();
  applyShellBake(shader, uniforms);
  // Every replacement point exists in this three.js version.
  expect(shader.vertexShader).toContain("vBakeWorld = (modelMatrix");
  expect(shader.fragmentShader).toContain("vec4 shellBake()");
  expect(shader.fragmentShader).toContain(
    "outgoingLight += (bakedDiffuse - totalDiffuse - totalEmissiveRadiance)",
  );
  // Shared objects: fading the weight needs no recompile.
  expect((shader.uniforms as Record<string, unknown>).bakeWeight).toBe(
    uniforms.bakeWeight,
  );
});
