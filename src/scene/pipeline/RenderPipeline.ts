import {
  HalfFloatType,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Material,
  type Mesh,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/** Colour targets the scene pass renders into (development metrics only). */
export const pipelineSceneTargets = new WeakSet<WebGLRenderTarget>();
/** Default fraction of the drawing buffer AO is computed at. The pipeline
 * takes the quality's own scale, see aoScale() in quality.ts. */
export const AO_SCALE = 1;
/** World-space tuning for cabinet/room scale contact darkening. */
export const AO_SETTINGS = {
  radius: 0.3,
  distanceExponent: 1.6,
  thickness: 1,
  scale: 1,
  samples: 16,
  distanceFallOff: 1,
  screenSpaceRadius: false,
};
/** A dense 4 px kernel: the old sparse 8 px one left GTAO's dither visible
 * as speckle in deep narrow slots (fridge door gap, between tall units).
 * The tight depth limit keeps it from bleeding across silhouettes. */
export const AO_DENOISE = {
  lumaPhi: 1000,
  depthPhi: 0.05,
  normalPhi: 3,
  radius: 4,
  radiusExponent: 1,
  rings: 2,
  samples: 16,
};

/** Shadow-only shells, glass and other non-opaque surfaces must not occlude:
 * they write no colour, so they would draw phantom AO edges.
 *
 * Screen-space lines (drei Edges/Line → LineSegments2) are meshes too, but
 * their real shape exists only in LineMaterial's vertex shader. The AO
 * normal/depth pass replaces that material, so it would draw the raw
 * instancing quad: a 2 × 3 m solid panel that turns the AO black around a
 * selected cabinet. Selection/UI helpers never occlude either. */
export function excludedFromAO(object: Object3D) {
  if (object.userData.aoExclude || object.userData.exportHidden) return true;
  const flags = object as Object3D & {
    isLine?: boolean;
    isPoints?: boolean;
    isSprite?: boolean;
    isLineSegments2?: boolean;
  };
  if (flags.isLine || flags.isPoints || flags.isSprite || flags.isLineSegments2)
    return true;
  const mesh = object as Mesh;
  if (!mesh.isMesh) return false;
  const materials = (
    Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  ) as Array<Material & { isLineMaterial?: boolean }>;
  return materials.some(
    (m) => !m.colorWrite || m.transparent || m.isLineMaterial,
  );
}

/** Fronts sit a few millimetres apart: 6 mm between doors and drawers, about
 * one pixel at normal viewing distance. The AO pass reads depth without
 * anti-aliasing, so it found the deep slot at some pixels along a seam and
 * not at others, and drew seams as dotted dark lines. For that pass only,
 * each front grows by its gap so neighbouring fronts meet; the visible
 * render keeps the real gaps (and their dark GapShade). */
export const AO_FRONT_GAP = 0.008;
export function aoFrontScale(size: readonly number[]): [number, number] {
  return [(size[0] + AO_FRONT_GAP) / size[0], (size[1] + AO_FRONT_GAP) / size[1]];
}

class ScaledGTAOPass extends GTAOPass {
  private hidden: Object3D[] = [];
  private grown: Object3D[] = [];
  scale = AO_SCALE;
  render(...args: Parameters<GTAOPass["render"]>) {
    this.hidden.length = 0;
    this.grown.length = 0;
    this.scene.traverseVisible((object) => {
      if (excludedFromAO(object)) this.hidden.push(object);
      else if (object.userData.aoFront) this.grown.push(object);
    });
    for (const object of this.hidden) object.visible = false;
    for (const object of this.grown) {
      const [x, y] = aoFrontScale(object.userData.aoFront);
      object.scale.x *= x;
      object.scale.y *= y;
    }
    // The scene pass of this frame already updated the shadow maps; the
    // normal/depth pass has no use for them.
    const [renderer] = args;
    const shadowUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    try {
      super.render(...args);
    } finally {
      renderer.shadowMap.autoUpdate = shadowUpdate;
      for (const object of this.hidden) object.visible = true;
      for (const object of this.grown) {
        const [x, y] = aoFrontScale(object.userData.aoFront);
        object.scale.x /= x;
        object.scale.y /= y;
        object.updateMatrixWorld();
      }
    }
  }
  setSize(width: number, height: number) {
    super.setSize(
      Math.max(1, Math.round(width * this.scale)),
      Math.max(1, Math.round(height * this.scale)),
    );
  }
}

/**
 * One path for the live view and every capture: MSAA scene render, GTAO at
 * the quality's resolution multiplied over it, then tone
 * mapping/colour output.
 * Lightweight quality bypasses it and renders directly.
 */
export class RenderPipeline {
  private composer: EffectComposer;
  private ao: ScaledGTAOPass;
  private size = new Vector2();
  private ratio = 0;
  constructor(
    private gl: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    aoScale = AO_SCALE,
  ) {
    gl.getSize(this.size);
    this.ratio = gl.getPixelRatio();
    const target = new WebGLRenderTarget(
      Math.max(1, this.size.x * this.ratio),
      Math.max(1, this.size.y * this.ratio),
      { type: HalfFloatType, samples: 4 },
    );
    this.composer = new EffectComposer(gl, target);
    pipelineSceneTargets.add(this.composer.renderTarget1);
    pipelineSceneTargets.add(this.composer.renderTarget2);
    this.composer.setPixelRatio(this.ratio);
    this.composer.addPass(new RenderPass(scene, camera));
    this.ao = new ScaledGTAOPass(scene, camera, 1, 1);
    this.ao.scale = aoScale;
    this.ao.updateGtaoMaterial(AO_SETTINGS);
    this.ao.updatePdMaterial(AO_DENOISE);
    this.ao.blendIntensity = 1;
    this.composer.addPass(this.ao);
    this.composer.addPass(new OutputPass());
    this.composer.setSize(this.size.x, this.size.y);
  }
  /** AO resolution fraction; captures use full resolution for a clean still. */
  get aoScale() {
    return this.ao.scale;
  }
  setAOScale(scale: number) {
    if (this.ao.scale === scale) return;
    this.ao.scale = scale;
    this.composer.setSize(this.size.x, this.size.y);
  }
  /** Skips the AO pass (automatic fallback); the scene still renders fully. */
  setAO(enabled: boolean) {
    this.ao.enabled = enabled;
  }
  /** Follows capture-time resizes and DPR changes before drawing. */
  render() {
    const size = this.gl.getSize(new Vector2()),
      ratio = this.gl.getPixelRatio();
    if (!size.equals(this.size) || ratio !== this.ratio) {
      this.size.copy(size);
      this.ratio = ratio;
      this.composer.setPixelRatio(ratio);
      this.composer.setSize(size.x, size.y);
    }
    this.composer.render();
  }
  dispose() {
    for (const pass of this.composer.passes) pass.dispose();
    this.composer.dispose();
  }
}
