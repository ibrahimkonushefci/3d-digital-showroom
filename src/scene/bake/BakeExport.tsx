/**
 * DEV only (never in a production bundle): hands the live scene to the Blender
 * lightmap bake (art/blender/bake_room.py, driven by scripts/bake-rooms.mjs).
 *
 * window.__bakeExport() returns the furniture, decor and window fittings as a
 * GLB (world space, metres, one flat material per mesh carrying its average
 * albedo, roughness and emission) plus the room, the bake signature and the
 * lights exactly as RoomLighting/RunLights resolve them. The room shell
 * itself is not exported: Blender rebuilds it with the lightmap atlas UVs.
 */
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import {
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Vector3,
  type Material,
  type PerspectiveCamera,
  type Object3D,
  type Texture,
} from "three";
import type { Catalog, DesignDocument } from "../../catalog/types";
import { resolveLighting } from "../lighting/lightingRecipe";
import { resolveRoom } from "../rooms/resolveRoom";
import { downlights } from "../rooms/RoomShell";
import { ledRuns } from "../RunLights";
import { wallPosition } from "../../designer3d/layout";
import { bakeKey, bakeSignature } from "./signature";

/** Mean linear colour of a texture's image (sRGB maps decoded). */
function textureMean(texture: Texture, cache: Map<unknown, Color>) {
  const image = texture.image as CanvasImageSource & { width?: number };
  if (!image || !image.width) return null;
  const known = cache.get(image);
  if (known) return known;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 16;
  const context = canvas.getContext("2d")!;
  context.drawImage(image, 0, 0, 16, 16);
  const data = context.getImageData(0, 0, 16, 16).data;
  const sum = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4)
    for (let c = 0; c < 3; c++) {
      const v = data[i + c] / 255;
      sum[c] += v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
  const mean = new Color(sum[0] / 256, sum[1] / 256, sum[2] / 256);
  cache.set(image, mean);
  return mean;
}

type Surface = MeshStandardMaterial & {
  color?: Color;
  map?: Texture | null;
  emissive?: Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
};
function flatMaterial(source: Material, cache: Map<unknown, Color>) {
  const m = source as Surface;
  const albedo = (m.color?.clone() ?? new Color(0.8, 0.8, 0.8)).multiply(
    (m.map && textureMean(m.map, cache)) || new Color(1, 1, 1),
  );
  const emission = m.emissive
    ? m.emissive.clone().multiplyScalar(m.emissiveIntensity ?? 1)
    : new Color(0, 0, 0);
  const flat = new MeshStandardMaterial({
    color: albedo,
    roughness: m.roughness ?? 0.6,
    metalness: m.metalness ?? 0,
  });
  // Emission strength travels in userData: glTF clamps emissiveFactor to 1.
  flat.userData.emission = emission.toArray();
  flat.name = source.name || source.type;
  return flat;
}

function shown(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent)
    if (!p.visible && !p.userData.bakeIgnoreVisibility) return false;
  return true;
}
function skipped(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) {
    if (p.userData.bakeSkip || p.userData.exportHidden) return true;
    // Inside the room shell only what is explicitly kept (window fittings).
    if (p.userData.bakeKeep) return false;
    if (p.userData.bakeShell) return true;
  }
  return false;
}

export async function exportBakeScene(
  scene: Scene,
  design: DesignDocument,
  catalog: Catalog,
) {
  const { GLTFExporter } =
    await import("three/addons/exporters/GLTFExporter.js");
  scene.updateMatrixWorld(true);
  const out = new Scene();
  const means = new Map<unknown, Color>();
  const flats = new Map<Material, MeshStandardMaterial>();
  const flat = (m: Material) => {
    let f = flats.get(m);
    if (!f) flats.set(m, (f = flatMaterial(m, means)));
    return f;
  };
  let meshes = 0;
  const add = (mesh: Mesh, matrix: Matrix4) => {
    const copy = new Mesh(
      mesh.geometry,
      Array.isArray(mesh.material)
        ? mesh.material.map(flat)
        : flat(mesh.material),
    );
    copy.name = mesh.name || mesh.parent?.name || "part";
    copy.matrixAutoUpdate = false;
    copy.matrix.copy(matrix);
    out.add(copy);
    meshes++;
  };
  scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || !shown(o) || skipped(o)) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    // Glass, shadow-only shells, contact-shadow planes, outlines: no occluders.
    if (
      materials.some(
        (m) =>
          !m.colorWrite ||
          (m.transparent && m.opacity < 0.9) ||
          (m as { isLineMaterial?: boolean }).isLineMaterial,
      )
    )
      return;
    if ((o as InstancedMesh).isInstancedMesh) {
      const instanced = o as InstancedMesh,
        local = new Matrix4();
      for (let i = 0; i < instanced.count; i++) {
        instanced.getMatrixAt(i, local);
        add(mesh, new Matrix4().multiplyMatrices(o.matrixWorld, local));
      }
    } else add(mesh, o.matrixWorld);
  });
  const glb = (await new GLTFExporter().parseAsync(out, {
    binary: true,
    includeCustomExtensions: false,
  })) as ArrayBuffer;

  // Shell albedos for the bounce colour (the shell is rebuilt in Blender).
  const shell: Record<string, number[]> = {};
  scene.traverse((o) => {
    const surface = o.userData.bakeSurface as string | undefined;
    if (!surface || shell[surface]) return;
    let mesh: Mesh | undefined;
    o.traverse((c) => {
      if (!mesh && (c as Mesh).isMesh) mesh = c as Mesh;
    });
    if (!mesh) return;
    const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    shell[surface] = flatMaterial(m, means).color.toArray();
  });

  // The shell is the presentation room; its corner sits at the envelope
  // origin (design-room corner frame) of the room group at (-w/2, 0, -d/2).
  const { envelope } = resolveRoom(design);
  const room = envelope.room,
    w = room.width / 100,
    d = room.depth / 100,
    origin = [
      envelope.origin[0] - design.room.width / 200,
      0,
      envelope.origin[1] - design.room.depth / 200,
    ];
  const light = resolveLighting(design, catalog, "balanced");
  const wardrobe = design.kind === "wardrobe";
  const leds = ledRuns(design).map(({ wall, a, b, depth, height }) => {
    const p = wallPosition(wall, a, b - a, depth, design.room);
    return {
      // RunLights' group frame: centre, yaw, emitter offset and tilt.
      // Run frame (design-room corner) → envelope corner frame.
      centre: [
        p.x / 100 - envelope.origin[0],
        wardrobe ? height / 100 - 0.045 : 1.385,
        p.z / 100 - envelope.origin[1],
      ],
      yaw: p.rotation,
      offset: [0, 0, wardrobe ? depth / 200 - 0.045 : 0.1],
      tilt: wardrobe ? -Math.PI / 4 : -Math.PI / 2,
      width: (b - a) / 100,
      height: 0.06,
      intensity: wardrobe ? 1.8 : 4,
      color: "#ffd1a1",
    };
  });
  const json = {
    signature: bakeSignature(design, catalog),
    key: bakeKey(design, catalog),
    kind: design.kind,
    recipe: resolveRoom(design).recipe.id,
    room: {
      width: w,
      depth: d,
      height: room.height / 100,
      openings: room.openings,
    },
    /** Room-corner frame → world: add this. */
    origin,
    shell,
    meshes,
    sun: light.window
      ? {
          direction: light.direction.toArray(),
          intensity: light.keyIntensity,
          color: light.color,
        }
      : null,
    ceilingKey: light.window
      ? null
      : { direction: light.direction.toArray(), intensity: light.keyIntensity },
    interiorKey: {
      position: light.interiorKey.position.toArray(),
      target: light.interiorKey.target.toArray(),
      intensity: light.interiorKey.intensity,
      angle: 1.05,
      penumbra: 1,
      color: "#fff4e6",
    },
    fill: light.fillIntensity,
    environmentIntensity: light.environmentIntensity,
    downlights: downlights(room).map(([x, z]) => [
      x + origin[0],
      room.height / 100,
      z + origin[2],
    ]),
    leds,
  };
  return { glb, json };
}

export default function BakeExport({
  design,
  catalog,
}: {
  design: DesignDocument;
  catalog: Catalog;
}) {
  const { scene, camera } = useThree();
  useEffect(() => {
    const target = window as unknown as Record<string, unknown>;
    target.__bakeExport = async () => {
      const { glb, json } = await exportBakeScene(scene, design, catalog);
      // The current view, for the Blender preview render only.
      const look = camera.getWorldDirection(new Vector3()).multiplyScalar(3);
      Object.assign(json, {
        camera: {
          position: camera.position.toArray(),
          target: camera.position.clone().add(look).toArray(),
          fov: (camera as PerspectiveCamera).fov,
        },
      });
      let binary = "";
      const bytes = new Uint8Array(glb);
      for (let i = 0; i < bytes.length; i += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { glb: btoa(binary), json };
    };
    return () => {
      delete target.__bakeExport;
    };
  }, [scene, camera, design, catalog]);
  return null;
}
