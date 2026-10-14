import type { WebGLRenderer } from "three";
const passes = new WeakMap<WebGLRenderer, "probe">();
export const currentRenderPass = (renderer: WebGLRenderer) =>
  passes.get(renderer);
/** Explicit pass annotation covers PMREM's scene capture AND mesh blur stages. */
export function withProbePass<T>(renderer: WebGLRenderer, work: () => T): T {
  const previous = passes.get(renderer);
  passes.set(renderer, "probe");
  try {
    return work();
  } finally {
    if (previous) passes.set(renderer, previous);
    else passes.delete(renderer);
  }
}
