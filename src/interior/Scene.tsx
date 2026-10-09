import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Plus,
  Minus,
} from "lucide-react";
import type { Catalog } from "../catalog/types";
import type { InteriorDesign } from "./types";
import { useBrand } from "../brand";
import { useT } from "../i18n";
import { useQuality } from "../scene/quality";
import type { RegisterCapture } from "../scene/Rendering";
import { InteriorRenderer, type SceneAssets } from "./renderer";
import {
  interiorPhotos,
  supportedPhotoDoor,
  boundedPhotoView,
  defaultPhotoView,
} from "./scenes";
const images = new Map<string, Promise<HTMLImageElement>>();
function image(url: string) {
  let promise = images.get(url);
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        images.delete(url);
        reject(Error("photoLoadError"));
      };
      img.src = url;
    });
    if (images.size > 24) images.delete(images.keys().next().value!);
    images.set(url, promise);
  }
  return promise;
}
export default function InteriorScene({
  design,
  catalog,
  capture,
  onReady,
}: {
  design: InteriorDesign;
  catalog: Catalog;
  capture?: RegisterCapture;
  onReady?: (ready: boolean) => void;
}) {
  const t = useT(),
    { assetUrl } = useBrand(),
    quality = useQuality();
  const canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<InteriorRenderer | null>(null),
    current = useRef(design),
    readySignature = useRef(""),
    assetRef = useRef<SceneAssets | null>(null);
  current.current = design;
  const [assets, setAssets] = useState<SceneAssets | null>(null),
    [error, setError] = useState<string | null>(null),
    [retry, setRetry] = useState(0),
    [view, setView] = useState(defaultPhotoView);
  const viewRef = useRef(view);
  viewRef.current = view;
  const photo = interiorPhotos[design.preset],
    floor = catalog.laminates.find((p) => p.id === design.laminateId)!,
    finish = catalog.productFinishes.find(
      (p) => p.id === design.doorStyle.finishId,
    )!,
    model = catalog.interiorDoors.find(
      (p) => p.id === design.doorStyle.modelId,
    )!;
  const supported = supportedPhotoDoor(model.style) && !design.legacyMixed;
  const signature = JSON.stringify([
    design.preset,
    design.laminateId,
    design.pattern,
    design.direction,
    design.doorStyle,
    design.legacyMixed,
    design.skirtingId,
    design.skirtingHeight,
  ]);
  const latestSignature = useRef(signature);
  latestSignature.current = signature;
  useEffect(() => {
    setView(boundedPhotoView(photo.framing));
  }, [photo]);
  useEffect(() => {
    let cancelled = false;
    readySignature.current = "";
    assetRef.current = null;
    setAssets(null);
    setError(null);
    onReady?.(false);
    if (!supported) return;
    const base = photo.image.replace(".webp", "");
    Promise.all([
      image(assetUrl(photo.image)),
      image(assetUrl(base + "-mask.webp")),
      image(assetUrl(base + "-light.webp")),
      image("/shared/interior/handle.png"),
      image(assetUrl((floor.previewTexture || floor.texture)!)),
      image(
        assetUrl(
          (finish.previewTexture ||
            finish.texture ||
            floor.previewTexture ||
            floor.texture)!,
        ),
      ),
    ])
      .then(([photo, mask, light, hardware, floor, door]) => {
        if (!cancelled) {
          const a = { photo, mask, light, hardware, floor, door };
          assetRef.current = a;
          setAssets(a);
        }
      })
      .catch(() => {
        if (!cancelled) setError("photoLoadError");
      });
    return () => {
      cancelled = true;
    };
  }, [
    photo,
    floor.texture,
    floor.previewTexture,
    finish.texture,
    finish.previewTexture,
    assetUrl,
    supported,
    retry,
    onReady,
  ]);
  useEffect(() => {
    if (!canvas.current) return;
    try {
      renderer.current = new InteriorRenderer(canvas.current);
    } catch {
      setError("webglError");
    }
    const el = canvas.current;
    const lost = (e: Event) => {
      e.preventDefault();
      readySignature.current = "";
      onReady?.(false);
      setError("webglError");
    };
    const restored = () => setRetry((n) => n + 1);
    el.addEventListener("webglcontextlost", lost);
    el.addEventListener("webglcontextrestored", restored);
    return () => {
      renderer.current?.dispose();
      renderer.current = null;
      el.removeEventListener("webglcontextlost", lost);
      el.removeEventListener("webglcontextrestored", restored);
    };
  }, [retry, onReady]);
  const render = useCallback(() => {
    if (
      !supported ||
      !assets ||
      assets !== assetRef.current ||
      !renderer.current
    )
      return;
    try {
      renderer.current.render(
        photo,
        assets,
        design,
        catalog,
        view,
        quality === "lightweight" ? 1200 : 1920,
      );
      readySignature.current = signature;
      setError(null);
      onReady?.(true);
    } catch {
      readySignature.current = "";
      setError("webglError");
      onReady?.(false);
    }
  }, [
    supported,
    assets,
    photo,
    design,
    catalog,
    view,
    signature,
    quality,
    onReady,
  ]);
  useEffect(render, [render]);
  useEffect(() => {
    capture?.(async () => {
      if (
        !renderer.current ||
        !assetRef.current ||
        readySignature.current !== latestSignature.current
      )
        throw Error("sceneLoading");
      const d = current.current;
      renderer.current.render(
        interiorPhotos[d.preset],
        assetRef.current,
        d,
        catalog,
        viewRef.current,
        1920,
      );
      return canvas.current!.toDataURL("image/png");
    });
  }, [capture, catalog]);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const update = (patch: Partial<typeof view>) =>
    setView((v) => boundedPhotoView({ ...v, ...patch }));
  const pan = (x: number, y: number) =>
    setView((v) =>
      boundedPhotoView({
        ...v,
        zoom: Math.max(1.16, v.zoom),
        x: v.x + x,
        y: v.y + y,
      }),
    );
  return (
    <div
      className="interior-photo-stage"
      data-scene={design.preset}
      data-zoom={view.zoom}
      data-pan-x={view.x}
      data-pan-y={view.y}
      aria-busy={!assets && supported && !error}
    >
      <canvas
        ref={canvas}
        aria-label={t(design.preset)}
        onPointerDown={(e) => {
          if (pointer.current) {
            pointer.current = null;
            return;
          }
          if (e.button !== 0) return;
          pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = pointer.current;
          if (!p || p.id !== e.pointerId) return;
          const box = e.currentTarget.getBoundingClientRect(),
            dx = (e.clientX - p.x) / box.width,
            dy = (e.clientY - p.y) / box.height;
          setView((v) =>
            boundedPhotoView({
              ...v,
              zoom: Math.max(1.16, v.zoom),
              x: v.x - dx / v.zoom,
              y: v.y - dy / v.zoom,
            }),
          );
          pointer.current = { id: p.id, x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          pointer.current = null;
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
        onLostPointerCapture={() => {
          pointer.current = null;
        }}
      />
      {(!supported || error || !assets) && (
        <div
          className="interior-scene-status"
          role={error || !supported ? "alert" : "status"}
        >
          <p>
            {t(
              !supported
                ? "unsupportedInteriorPreview"
                : error === "webglError"
                  ? "webglError"
                  : error
                    ? "photoLoadError"
                    : "sceneLoading",
            )}
          </p>
          {error && (
            <button
              className="button secondary"
              onClick={() => setRetry((n) => n + 1)}
            >
              {t("retry")}
            </button>
          )}
        </div>
      )}
      {supported && assets && !error && (
        <div className="interior-navigation" aria-label={t("photoNavigation")}>
          <div className="interior-zoom">
            <button
              aria-label={t("zoomOut")}
              disabled={view.zoom <= 1}
              onClick={() => update({ zoom: view.zoom - 0.15 })}
            >
              <Minus size={18} />
            </button>
            <button
              aria-label={t("resetView")}
              onClick={() => setView(boundedPhotoView(photo.framing))}
            >
              <RotateCcw size={17} />
            </button>
            <button
              aria-label={t("zoomIn")}
              disabled={view.zoom >= 1.8}
              onClick={() => update({ zoom: view.zoom + 0.15 })}
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="interior-dpad">
            <button
              className="up"
              aria-label={t("panUp")}
              onClick={() => pan(0, -0.04)}
            >
              <ArrowUp size={19} />
            </button>
            <button
              className="left"
              aria-label={t("panLeft")}
              onClick={() => pan(-0.04, 0)}
            >
              <ArrowLeft size={19} />
            </button>
            <button
              className="right"
              aria-label={t("panRight")}
              onClick={() => pan(0.04, 0)}
            >
              <ArrowRight size={19} />
            </button>
            <button
              className="down"
              aria-label={t("panDown")}
              onClick={() => pan(0, 0.04)}
            >
              <ArrowDown size={19} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
