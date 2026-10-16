import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ShaderChunk } from "three";
import { smoothShadowChunk } from "../src/scene/pipeline/smoothShadows";
import {
  AO_DENOISE,
  AO_FRONT_GAP,
  aoFrontScale,
} from "../src/scene/pipeline/RenderPipeline";
import { aoScale } from "../src/scene/quality";

// Phase 1 visual-quality follow-up: grainy shading, dotted seams and blocky
// halos. Causes, each confirmed live by switching it alone: three's 17-tap
// PCF printed stair-stepped shadow copies; half-resolution AO upscaled
// without depth awareness; AO read the 6 mm front gaps from aliased depth.

it("replaces three's stepped PCF with a smooth bilinear kernel", () => {
  const source = ShaderChunk.shadowmap_pars_fragment;
  const next = smoothShadowChunk(source)!;
  expect(next).toBeTruthy();
  const pcf = next.slice(
    next.indexOf("#if defined( SHADOWMAP_TYPE_PCF )"),
    next.indexOf("#elif defined( SHADOWMAP_TYPE_PCF_SOFT )"),
  );
  expect(pcf).toContain("smoothShadowTap");
  expect(pcf).not.toContain("1.0 / 17.0");
  // Same footprint as three's (±radius texels), tent weights summing to 81.
  expect(pcf).toContain("max( shadowRadius, 1.0 ) * 0.5");
  expect(pcf).toContain("1.0 / 81.0");
  // The helper is declared before getShadow uses it; other shadow types and
  // point-light shadows are untouched.
  expect(next.indexOf("float smoothShadowTap")).toBeLessThan(
    next.indexOf("float getShadow("),
  );
  const tail = (s: string) =>
    s.slice(s.indexOf("#elif defined( SHADOWMAP_TYPE_PCF_SOFT )"));
  expect(tail(next)).toBe(tail(source));
  // An unexpected three.js chunk is left alone rather than half-patched.
  expect(smoothShadowChunk("float getShadow() {}")).toBeNull();
});

it("computes AO at full resolution with a dense denoise kernel", () => {
  expect(aoScale("balanced")).toBe(1);
  expect(AO_DENOISE.radius).toBeLessThanOrEqual(4);
});

it("closes front gaps for the AO pass only", () => {
  const [x, y] = aoFrontScale([0.594, 0.714, 0.02]);
  expect(0.594 * x - 0.594).toBeCloseTo(AO_FRONT_GAP);
  expect(0.714 * y - 0.714).toBeCloseTo(AO_FRONT_GAP);
  // Wider than the 6 mm between neighbouring fronts.
  expect(AO_FRONT_GAP).toBeGreaterThan(0.006);
  // Every front panel is tagged; the visible geometry keeps its real gaps.
  const primitives = readFileSync("src/scene/Primitives.tsx", "utf8");
  expect(primitives).toMatch(/aoFront: size/);
  const cabinet = readFileSync(
    "src/designer3d/furniture/CabinetMesh.tsx",
    "utf8",
  );
  expect(cabinet).toContain("size={[w - 0.006, h - 0.006, 0.02]}");
});
