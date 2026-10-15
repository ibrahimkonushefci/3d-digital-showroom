import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BoxGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  BufferGeometry,
  Points,
  Sprite,
} from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { excludedFromAO } from "../src/scene/pipeline/RenderPipeline";

// Phase 1 follow-up regression: selecting one cabinet drew a huge black panel.
// The selection outline (drei Edges → LineSegments2) is a Mesh whose real
// shape exists only in LineMaterial's shader. GTAO's normal/depth pass swaps
// the material, so it rendered the raw instancing quad (2 × 3 m) as a solid
// occluder right in front of the cabinet.
it("keeps screen-space lines and selection helpers out of the AO occluder pass", () => {
  const outline = new LineSegments2(
    new LineSegmentsGeometry(),
    new LineMaterial(),
  );
  // The raw quad really is panel-sized; that is what AO saw.
  outline.geometry.computeBoundingBox();
  const raw = new BufferGeometry().setAttribute(
    "position",
    outline.geometry.getAttribute("position"),
  );
  raw.computeBoundingBox();
  expect(raw.boundingBox!.max.y - raw.boundingBox!.min.y).toBeGreaterThan(2.5);
  expect(excludedFromAO(outline)).toBe(true);
  expect(excludedFromAO(new Line2())).toBe(true);
  // Any mesh drawn by LineMaterial, whatever its class.
  expect(excludedFromAO(new Mesh(new BoxGeometry(), new LineMaterial()))).toBe(
    true,
  );
  expect(
    excludedFromAO(new Line(new BufferGeometry(), new LineBasicMaterial())),
  ).toBe(true);
  expect(excludedFromAO(new LineSegments())).toBe(true);
  expect(excludedFromAO(new Points())).toBe(true);
  expect(excludedFromAO(new Sprite())).toBe(true);
  const helper = new Group();
  helper.userData.exportHidden = true;
  expect(excludedFromAO(helper)).toBe(true);
  // Real furniture still occludes.
  expect(
    excludedFromAO(new Mesh(new BoxGeometry(), new MeshStandardMaterial())),
  ).toBe(false);
});

it("outlines the selected panel itself, not a wrapper group with no geometry", () => {
  // drei Edges reads its parent's geometry; inside a <group> it silently fell
  // back to a 1 m placeholder segment.
  const source = readFileSync("src/scene/Primitives.tsx", "utf8");
  const block = source.slice(source.indexOf("{selected && ("));
  const edges = block.slice(0, block.indexOf("/>"));
  expect(edges).toContain("<Edges");
  expect(edges).not.toContain("<group");
  expect(edges).toContain("aoExclude: true");
  expect(edges).toContain("exportHidden: true");
});
