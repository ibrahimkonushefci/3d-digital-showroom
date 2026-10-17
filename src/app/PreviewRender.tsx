/** Development only: stages one finish, handle, front style, floor or look
 * in the real scene for scripts/review/render-previews.mjs to photograph.
 * Eliminated from production routing. */
import { useMemo, useState } from "react";
import { useBrand } from "../brand";
import Scene from "../designer3d/Scene";
import type { CameraView } from "../designer3d/Scene";
import { presentationPresets } from "../designer3d/presets";
import { newDesign, uid, wallPosition } from "../designer3d/layout";
import { applyToAll } from "../designer3d/finishes";
import { KITCHEN_THEMES, WARDROBE_THEMES } from "../designer3d/looks";
import { QualityOverride } from "../scene/quality";
import type { Cabinet, Catalog, DesignDocument } from "../catalog/types";

type Stage = {
  design: DesignDocument;
  camera?: CameraView;
  size: [number, number];
};

function unit(
  catalog: Catalog,
  moduleId: string,
  width: number,
  room: DesignDocument["room"],
): Cabinet {
  const m = catalog.modules.find((m) => m.id === moduleId)!;
  const offset = (room.width - width) / 2;
  return {
    id: uid(),
    moduleId,
    width,
    height: Math.min(m.height, room.height - 10),
    depth: m.depth,
    level: m.level,
    wall: "back",
    ...wallPosition("back", offset, width, m.depth, room),
  };
}

/** Rooms under 240 cm get no decor, so close-ups show only the unit. */
function single(
  catalog: Catalog,
  kind: "kitchen" | "wardrobe",
  moduleId: string,
  width: number,
  style: Partial<DesignDocument["style"]>,
  room = { width: 200, depth: 230, height: 250 },
): DesignDocument {
  const base = newDesign(kind, "straight");
  const r = { ...room, openings: [] };
  return {
    ...base,
    room: r,
    style: { ...base.style, handle: "none", ...style },
    environment: {
      floor: "laminate",
      wallColor: "#e9e5dd",
      internalLed: false,
    },
    cabinets: [unit(catalog, moduleId, width, r)],
  };
}

/** Cameras are kept at least 1.6 m from their target (orbit limits): for a
 * closer view, put the target further along the same line of sight. */
export function previewStage(item: string, catalog: Catalog): Stage | null {
  const [kind, id] = item.split(":");
  // Centred room: the unit's front is at z = −depth/2 + 0.6.
  const front = -1.15 + 0.6;
  switch (kind) {
    case "front":
      return {
        design: single(catalog, "kitchen", "base-doors", 60, { front: id }),
        // Where two doors meet under the worktop: the gap, the edge and
        // the light across the surface show the material.
        camera: {
          position: [0.3, 0.98, front + 0.62],
          target: [0.03, 0.66, front],
          fov: 30,
        },
        size: [300, 300],
      };
    case "handle":
      if (id.endsWith("-wardrobe"))
        return {
          design: single(
            catalog,
            "wardrobe",
            "wardrobe-shelves",
            80,
            { front: "cashmere", handle: id.replace(/-wardrobe$/, "") },
            { width: 200, depth: 300, height: 250 },
          ),
          // Three-quarters at handle height: bars stand out, the Gola
          // channel runs the full door height.
          camera: {
            position: [0.8, 1.45, 0.45],
            target: [0, 1.12, -1.5 + 0.6],
            fov: 36,
          },
          size: [420, 300],
        };
      return {
        design: single(catalog, "kitchen", "base-drawers", 60, {
          front: "cashmere",
          handle: id,
        }),
        // The whole drawer unit at three-quarters: each handle's shape,
        // colour and position (top edge for Gola) reads at a glance.
        camera: {
          position: [0.55, 1.15, front + 0.7],
          target: [0, 0.6, front],
          fov: 36,
        },
        size: [420, 300],
      };
    case "profile": {
      const [profile, furniture] = id.split("-") as [
        "flat" | "panel",
        "kitchen" | "wardrobe",
      ];
      return furniture === "wardrobe"
        ? {
            design: single(
              catalog,
              "wardrobe",
              "wardrobe-shelves",
              100,
              { front: "sage", profile },
              { width: 300, depth: 300, height: 250 },
            ),
            camera: {
              // Looking up at the top corners of both doors: on a tall
              // door the panel frame is a fine groove that only reads close.
              position: [0.45, 1.7, -0.15],
              target: [0, 1.95, -1.5 + 0.6],
              fov: 40,
            },
            size: [420, 300],
          }
        : {
            // Three-quarter view from above, like a product photo; sage
            // shows the panel frame's edges more clearly than a pale front.
            design: single(catalog, "kitchen", "base-doors", 60, {
              front: "sage",
              profile,
            }),
            camera: {
              position: [0.8, 1.25, front + 0.95],
              target: [0, 0.45, front],
              fov: 36,
            },
            size: [420, 300],
          };
    }
    case "worktop":
      return {
        design: single(catalog, "kitchen", "base-doors", 60, {
          front: "white",
          countertop: id,
        }),
        camera: {
          position: [0.2, 1.32, front + 0.42],
          target: [0.02, 0.9, front - 0.22],
          fov: 30,
        },
        size: [300, 300],
      };
    case "floor": {
      // An empty corner: the floor running up to the skirting boards.
      const d = single(catalog, "kitchen", "base-doors", 60, {});
      return {
        design: {
          ...d,
          cabinets: [],
          environment: { ...d.environment!, floor: id as "laminate" },
        },
        camera: {
          position: [-0.55, 0.95, 0.95],
          target: [0.35, 0, -0.45],
          fov: 48,
        },
        size: [300, 300],
      };
    }
    case "unit": {
      // Each unit type as a small product photo: cashmere fronts, steel bar
      // handles, three-quarters from the front at the unit's own height.
      const m = catalog.modules.find((x) => x.id === id);
      if (!m) return null;
      const wardrobe = m.kind === "wardrobe";
      const width = m.widths.includes(wardrobe ? 80 : 60)
        ? wardrobe
          ? 80
          : 60
        : m.widths[0];
      const room = wardrobe
        ? { width: 230, depth: 300, height: 250 }
        : { width: 230, depth: 230, height: 250 };
      const back = -room.depth / 200;
      const centre =
        m.level === "wall" ? 1.76 : m.level === "base" ? 0.5 : 1.12;
      const target: [number, number, number] = [
        0,
        centre,
        back + m.depth / 200,
      ];
      const far = m.level === "base" || m.level === "wall" ? 1.9 : 3.9;
      return {
        design: single(
          catalog,
          wardrobe ? "wardrobe" : "kitchen",
          id,
          width,
          { front: "cashmere", handle: "bar" },
          room,
        ),
        camera: {
          position: [
            far * 0.42,
            centre + (m.level === "wall" ? -0.25 : 0.45),
            target[2] + far * 0.9,
          ],
          target,
          fov: m.level === "base" || m.level === "wall" ? 34 : 40,
        },
        size: [360, 300],
      };
    }
    case "interior": {
      // One interior part in an open wardrobe, seen from the front.
      const item = catalog.interiorItems?.find((i) => i.kind === id);
      if (!item) return null;
      const room = { width: 300, depth: 300, height: 250 };
      const d = single(
        catalog,
        "wardrobe",
        "wardrobe-open",
        80,
        { front: "white", carcass: "oak" },
        room,
      );
      const y = id === "rail" ? 150 : id === "shelf" ? 100 : 40;
      d.cabinets[0].interior = {
        version: 1,
        components: [{ id: "preview", productId: item.id, yCm: y }],
      };
      const look = (y + (id === "rail" ? -20 : 10)) / 100;
      return {
        design: d,
        camera: {
          position: [0.5, look + 0.35, 0.3],
          target: [0, look, -1.5 + 0.3],
          fov: 34,
        },
        size: [360, 300],
      };
    }
    case "look": {
      const kitchen = KITCHEN_THEMES.find((t) => t.id === id);
      const look = kitchen ?? WARDROBE_THEMES.find((t) => t.id === id);
      if (!look) return null;
      const preset = presentationPresets(catalog).find((p) =>
        kitchen
          ? p.design.kind === "kitchen" && p.design.layout === "l"
          : p.design.kind === "wardrobe" && p.design.layout === "straight",
      );
      if (!preset) return null;
      const d = applyToAll(preset.design);
      return {
        design: {
          ...d,
          style: {
            ...d.style,
            front: look.front,
            carcass: look.carcass,
            handle: look.handle,
            plinth: look.plinth,
            profile: look.profile,
            countertop: kitchen ? look.countertop : d.style.countertop,
          },
          environment: {
            floor: look.floor,
            wallColor: d.environment?.wallColor || "#e5e0d7",
            internalLed: !kitchen,
          },
        },
        size: [640, 400],
      };
    }
  }
  return null;
}

export default function PreviewRender() {
  const { catalog } = useBrand();
  const item = new URLSearchParams(location.search).get("item") || "";
  const cam = new URLSearchParams(location.search).get("cam");
  const stage = useMemo(() => {
    const s = previewStage(item, catalog);
    // Trying a composition (render-previews.mjs PREVIEW_CAM).
    const v = cam?.split(",").map(Number);
    return s && v?.length === 7
      ? {
          ...s,
          camera: {
            position: [v[0], v[1], v[2]] as [number, number, number],
            target: [v[3], v[4], v[5]] as [number, number, number],
            fov: v[6],
          },
        }
      : s;
  }, [item, catalog, cam]);
  const [drawn, setDrawn] = useState(false);
  if (!stage) return <p data-error="unknown item">Unknown item {item}</p>;
  return (
    <QualityOverride.Provider value="high">
      <div
        className="preview-render"
        data-ready={drawn ? "1" : "0"}
        style={{
          width: stage.size[0],
          height: stage.size[1],
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: 1000,
          background: "#eee9df",
        }}
      >
        <Scene
          design={stage.design}
          catalog={catalog}
          preset="hero"
          cameraView={
            stage.camera ? { ...stage.camera, exact: true } : undefined
          }
          onFirstFrame={() => setDrawn(true)}
        />
      </div>
    </QualityOverride.Provider>
  );
}
