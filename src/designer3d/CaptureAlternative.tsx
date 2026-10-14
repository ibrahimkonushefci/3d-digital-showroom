import { beginCapture } from "../pwa/busy";
import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import type { Catalog, DesignDocument } from "../catalog/types";
const Scene = lazy(() => import("./Scene"));
/** One temporary closed scene. Never borrows inspection or camera state. */
export default function CaptureAlternative({
  design,
  catalog,
  onCapture,
  onError,
}: {
  design: DesignDocument;
  catalog: Catalog;
  onCapture: (image: string) => void;
  onError: () => void;
}) {
  const started = useRef(false),
    finished = useRef(false);
  const callbacks = useRef({ onCapture, onError });
  callbacks.current = { onCapture, onError };
  useEffect(() => {
    const endCapture = beginCapture();
    const timer = setTimeout(() => {
      if (!finished.current) {
        finished.current = true;
        callbacks.current.onError();
      }
    }, 20000);
    return () => {
      clearTimeout(timer);
      endCapture();
    };
  }, []);
  const register = useCallback(async (capture: () => Promise<string>) => {
    if (started.current) return;
    started.current = true;
    try {
      const image = await capture();
      if (!finished.current) {
        finished.current = true;
        callbacks.current.onCapture(image);
      }
    } catch {
      if (!finished.current) {
        finished.current = true;
        callbacks.current.onError();
      }
    }
  }, []);
  return (
    <div aria-hidden="true" className="comparison-capture">
      <Suspense fallback={null}>
        <Scene
          preset="overall"
          design={design}
          catalog={catalog}
          capture={register}
        />
      </Suspense>
    </div>
  );
}
