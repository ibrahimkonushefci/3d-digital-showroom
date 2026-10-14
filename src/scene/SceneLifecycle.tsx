import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";

/** A DOM counter avoids React/report timers perturbing a normal-editor idle check.
 * Eliminated from production along with this component's call site. */
function DevelopmentFrameCounter() {
  const { gl } = useThree();
  const frames = useRef(0);
  useFrame(() => {
    gl.domElement.dataset.renderedFrames = String(++frames.current);
  });
  return null;
}

/** Pause the entire demand loop, including fronts/controls, in background tabs. */
export function SceneLifecycle({
  suspended = false,
  onLost,
  onRestored,
}: {
  suspended?: boolean;
  onLost: () => void;
  onRestored: () => void;
}) {
  const { gl, setFrameloop, invalidate } = useThree();
  const callbacks = useRef({ onLost, onRestored });
  callbacks.current = { onLost, onRestored };
  useEffect(() => {
    let lost = false;
    const visibility = () => {
      setFrameloop(document.hidden || lost || suspended ? "never" : "demand");
      if (!document.hidden && !lost && !suspended) invalidate();
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      visibility();
      callbacks.current.onLost();
    };
    const restored = () => callbacks.current.onRestored();
    document.addEventListener("visibilitychange", visibility);
    gl.domElement.addEventListener("webglcontextlost", contextLost);
    gl.domElement.addEventListener("webglcontextrestored", restored);
    visibility();
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      gl.domElement.removeEventListener("webglcontextlost", contextLost);
      gl.domElement.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl, setFrameloop, invalidate, suspended]);
  return import.meta.env.DEV ? <DevelopmentFrameCounter /> : null;
}
