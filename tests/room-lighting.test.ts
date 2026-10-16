import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { Box3, Euler, Matrix4, Ray, Vector3 } from "three";
import { CatalogSchema } from "../src/catalog/types";
import { presentationPresets } from "../src/designer3d/presets";
import { resolveRoom } from "../src/scene/rooms/resolveRoom";
import { boundsCorners } from "../src/designer3d/framing";
import {
  resolveLighting,
  lightingSignature,
  wallPieces,
  openingPosition,
  openingShadowPieces,
  windowFittings,
} from "../src/scene/lighting/lightingRecipe";
import {
  cavityContrast,
  applyCavity,
} from "../src/scene/lighting/InteriorOcclusion";
import { authoredEnvironment } from "../src/scene/lighting/RoomEnvironment";
import { ledRuns } from "../src/scene/RunLights";
const catalog = CatalogSchema.parse(
  JSON.parse(readFileSync("public/brands/default/catalog.json", "utf8")),
);
const presets = presentationPresets(catalog);

it("keeps exact window fittings and closed room-door casters independent of cutaway visibility", () => {
  for (const wall of ["back", "left", "right", "front"] as const) {
    const room = {
      ...presets[0].design.room,
      openings: [
        {
          id: "window",
          wall,
          type: "window" as const,
          offset: 80,
          width: 100,
          height: 120,
          sill: 100,
        },
        {
          id: "door",
          wall,
          type: "door" as const,
          offset: 220,
          width: 80,
          height: 210,
          sill: 0,
        },
      ],
    };
    const parts = openingShadowPieces(room);
    const window = windowFittings(1, 1.2);
    expect(parts.length).toBe(
      window.reveal.length + window.trim.length + window.frame.length + 6,
    );
    const centre = openingPosition(room, room.openings[0]).add(
      new Vector3(room.width / 200, 0, room.depth / 200),
    );
    const bar = parts.find((p) => p.size[0] === 0.024 && p.size[1] === 1.2)!;
    expect(bar.position[1]).toBeCloseTo(centre.y);
    expect(new Vector3(...bar.position).distanceTo(centre)).toBeLessThan(0.1);
    expect(
      parts.some(
        (p) => Math.abs(p.size[0] - 0.78) < 1e-8 && p.size[2] === 0.044,
      ),
    ).toBe(true);
  }
});

it("keys daylight to real apertures on every wall and keeps legacy solid rooms solid", () => {
  const original = presets[0].design;
  const before = JSON.stringify(original);
  for (const wall of ["back", "left", "right", "front"] as const) {
    const room = {
      ...original.room,
      openings: [
        {
          id: wall,
          wall,
          type: "window" as const,
          offset: 100,
          width: 100,
          height: 100,
          sill: 110,
        },
      ],
    };
    const design = { ...original, room };
    const light = resolveLighting(design, catalog, "balanced");
    const ray = new Ray(light.position, light.direction.clone().negate());
    // Daylight comes through the largest window of the presentation room
    // (the design's window or the garden door the envelope adds).
    const envelope = resolveRoom(design).envelope.room;
    const largest = [...envelope.openings]
      .filter((o) => o.type === "window")
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    expect(light.window?.id).toBe(largest.id);
    expect(
      ray.distanceToPoint(
        openingPosition(envelope, largest).add(
          new Vector3(envelope.cx, 0, envelope.cz),
        ),
      ),
    ).toBeLessThan(1e-8);
    expect(light.shadowSize).toBe(1024);
    expect(light.direction.y).toBeGreaterThan(0);
  }
  const solid = { ...original, room: { ...original.room, openings: [] } };
  // The design itself stays solid; daylight then comes from the garden
  // door of the presentation room.
  expect(resolveLighting(solid, catalog, "high").window?.id).toBe(
    resolveRoom(solid).envelope.room.openings.some((o) => o.id === "envelope-garden")
      ? "envelope-garden"
      : undefined,
  );
  expect(solid.room.openings).toEqual([]);
  expect(JSON.stringify(original)).toBe(before);
});

it("leaves holes in the shadow shell, including overlapping apertures, and bounds the whole room", () => {
  for (const p of presets) {
    const { room } = p.design;
    for (const o of room.openings) {
      const pieces = wallPieces(room, o.wall);
      const point = openingPosition(room, o).add(
        new Vector3(room.width / 200, 0, room.depth / 200),
      );
      for (const piece of pieces) {
        const local = point
          .clone()
          .sub(new Vector3(...piece.position))
          .applyEuler(new Euler(0, -piece.rotation[1], 0));
        expect(
          Math.abs(local.x) < piece.size[0] / 2 &&
            Math.abs(local.y) < piece.size[1] / 2,
        ).toBe(false);
      }
      const length =
        (o.wall === "back" || o.wall === "front" ? room.width : room.depth) /
        100;
      const area = pieces.reduce(
        (a, piece) => a + piece.size[0] * piece.size[1],
        0,
      );
      expect(area).toBeCloseTo(
        (length * room.height) / 100 - (o.width * o.height) / 10000,
      );
    }
    const l = resolveLighting(p.design, catalog, "balanced");
    const view = new Matrix4().lookAt(
      l.position,
      l.target,
      new Vector3(0, 1, 0),
    );
    const right = new Vector3().setFromMatrixColumn(view, 0),
      up = new Vector3().setFromMatrixColumn(view, 1);
    const bounds = new Box3(
      new Vector3(-room.width / 200, 0, -room.depth / 200),
      new Vector3(room.width / 200, room.height / 100, room.depth / 200),
    );
    for (const point of boundsCorners(bounds)) {
      point.sub(l.target);
      expect(point.dot(right)).toBeGreaterThan(l.bounds.left);
      expect(point.dot(right)).toBeLessThan(l.bounds.right);
      expect(point.dot(up)).toBeGreaterThan(l.bounds.bottom);
      expect(point.dot(up)).toBeLessThan(l.bounds.top);
    }
  }
  const room = {
    ...presets[0].design.room,
    openings: [
      {
        id: "a",
        wall: "back" as const,
        type: "window" as const,
        offset: 100,
        width: 100,
        height: 100,
        sill: 100,
      },
      {
        id: "b",
        wall: "back" as const,
        type: "window" as const,
        offset: 150,
        width: 100,
        height: 100,
        sill: 100,
      },
    ],
  };
  expect(
    wallPieces(room, "back").reduce((sum, p) => sum + p.size[0] * p.size[1], 0),
  ).toBeCloseTo((room.width * room.height) / 10000 - 1.5);
});

it("refreshes reflection geometry on structural changes while finishes/LEDs never refresh it", () => {
  for (const p of presets) {
    const d = p.design,
      signature = lightingSignature(d);
    expect(
      lightingSignature({
        ...d,
        style: { ...d.style, front: "black", led: !d.style.led },
      }),
    ).toBe(signature);
    expect(
      lightingSignature({
        ...d,
        room: { ...d.room, width: d.room.width + 20 },
      }),
    ).not.toBe(signature);
    expect(
      lightingSignature({
        ...d,
        room: {
          ...d.room,
          openings: [
            ...d.room.openings,
            {
              id: "extra-window",
              wall: "back",
              type: "window",
              offset: 10,
              width: 60,
              height: 60,
              sill: 150,
            },
          ],
        },
      }),
    ).not.toBe(signature);
    expect(
      lightingSignature({
        ...d,
        cabinets: d.cabinets.map((c, i) =>
          i ? c : { ...c, width: c.width + 10 },
        ),
      }),
    ).not.toBe(signature);
    const env = authoredEnvironment(d);
    expect(env.env.children.length).toBeGreaterThan(6);
    expect(env.env.environment).toBeNull();
    env.dispose();
  }
});

it("keeps cavity contact/depth readable with no baked front/drawer pose and responds to stationary shelf changes", () => {
  const cavity = {
    size: [0.8, 2.3, 0.6] as [number, number, number],
    shelves: [0.8, 1.5],
  };
  expect(cavityContrast([0, 1.1, 0.23], cavity)).toBeGreaterThan(
    cavityContrast([0, 1.1, -0.25], cavity),
  );
  expect(cavityContrast([0, 0.805, -0.25], cavity)).toBeLessThan(
    cavityContrast([0, 0.805, -0.25], { ...cavity, shelves: [] }),
  );
  expect(cavityContrast([0, 1.1, 0.31], cavity)).toBe(1);
  expect(cavityContrast([0.4, 1.1, -0.25], cavity)).toBe(1);
  for (const x of [-0.382, 0, 0.382])
    for (const y of [0.02, 0.8, 1.5, 2.28])
      for (const z of [-0.29, 0, 0.26])
        expect(cavityContrast([x, y, z], cavity)).toBeGreaterThanOrEqual(0.6);
  const shader = {
    uniforms: {},
    vertexShader: "#include <common>\n#include <begin_vertex>",
    fragmentShader: "#include <common>\n#include <aomap_fragment>",
  };
  applyCavity(shader as Parameters<typeof applyCavity>[0], cavity);
  expect(shader.fragmentShader).toContain(
    "reflectedLight.indirectDiffuse *= cavityAO",
  );
  expect(shader.fragmentShader).not.toContain("diffuseColor *=");
});

it("combines wardrobe LED runs and caps fill cost for a 200-cabinet valid-schema stress design", () => {
  const d = presets.find((p) => p.design.kind === "wardrobe")!.design;
  const stress = {
    ...d,
    environment: {
      floor: "laminate" as const,
      wallColor: "#e5e0d7",
      internalLed: true,
    },
    cabinets: Array.from({ length: 200 }, (_, i) => ({
      ...d.cabinets[0],
      id: String(i),
      x: 100 + i * 120,
      height: 200 + (i % 3),
    })),
  };
  expect(ledRuns(stress)).toHaveLength(3);
  expect(
    ledRuns({
      ...stress,
      environment: { ...stress.environment, internalLed: false },
    }),
  ).toEqual([]);
  const adjacent = {
    ...stress,
    cabinets: [0, 1, 2].map((i) => ({
      ...stress.cabinets[0],
      id: String(i),
      x: 80 + i * 80,
      width: 80,
    })),
  };
  expect(ledRuns(adjacent)).toHaveLength(1);
});
