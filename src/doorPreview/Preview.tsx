import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, Download, Share2, Trash2 } from "lucide-react";
import { SendAnyone } from "../app/SendAnyone";
import { useBrand } from "../brand";
import { useT, useLanguage, label, money } from "../i18n";
import { Field, ErrorNotice } from "../app/components";
import { validCorners, type Corners } from "./homography";
import { productImage } from "../scene/products";
import { ProductControls } from "./Controls";
import { productPrice } from "./pricing";
import { PhotoRenderer } from "./renderer";
import { downloadBlob } from "../documents/offer";
import { getPhoto, savePhoto } from "../persistence";

import { messageUrl } from "../sharing";
import { uid } from "../designer3d/layout";
import { PhotoSceneSchema, SavedPhotoSchema, type Placement } from "./types";
const doorCorners: Corners = [
  { x: 0.402, y: 0.392 },
  { x: 0.555, y: 0.392 },
  { x: 0.555, y: 0.836 },
  { x: 0.402, y: 0.836 },
];
const windowCorners: Corners = [
  { x: 0.67, y: 0.415 },
  { x: 0.865, y: 0.415 },
  { x: 0.865, y: 0.67 },
  { x: 0.67, y: 0.67 },
];
const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
export default function Preview({
  onItemsChange,
  sharedItems,
  capture,
}: {
  onItemsChange?: (p: Placement[]) => void;
  sharedItems?: Placement[];
  capture?: (fn: () => Promise<string>) => void;
} = {}) {
  const { brand, catalog, assetUrl } = useBrand(),
    t = useT(),
    { language } = useLanguage();
  const [scenes, setScenes] = useState<
      { id: string; name: { sq: string; en: string; de: string } }[]
    >([]),
    [sampleId, setSampleId] = useState("house-1"),
    [loupe, setLoupe] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    fetch("/shared/scenes/index.json")
      .then((r) => r.json())
      .then(setScenes)
      .catch(() => {});
  }, []);
  const [photo, setPhoto] = useState<string | null>(null),
    [placements, setPlacements] = useState<Placement[]>(sharedItems || []),
    [selected, setSelected] = useState<string | null>(null),
    [kind, setKind] = useState<"door" | "window">("door"),
    [compare, setCompare] = useState(0),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [size, setSize] = useState({ w: 1200, h: 800 }),
    [busy, setBusy] = useState(false),
    [rendering, setRendering] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    stage = useRef<HTMLDivElement>(null),
    renderer = useRef<PhotoRenderer | null>(null),
    photoImage = useRef<HTMLImageElement | null>(null),
    dragging = useRef<{ id: string; index: number } | null>(null),
    ready = useRef(false);
  const pendingRender = useRef<Promise<void>>(Promise.resolve());
  const renderFailed = useRef(false);
  const active = placements.find((p) => p.id === selected);
  const storageKey = brand.slug;
  const create = (type: "door" | "window", corners?: Corners): Placement => ({
    id: uid(),
    kind: type,
    modelId:
      type === "door"
        ? catalog.doors[0].id
        : (catalog.windows[1] || catalog.windows[0]).id,
    corners: structuredClone(
      corners || (type === "door" ? doorCorners : windowCorners),
    ),
    color:
      type === "door"
        ? catalog.doors[0].colors[0]
        : (catalog.windows[1] || catalog.windows[0]).colors[0],
    handle: "bar",
    brightness: 1,
    width: type === "door" ? 100 : 120,
    height: type === "door" ? 210 : 140,
    options: [],
    materialType: "pvc",
    profile: "standard",
    panes: 2,
    shutterOpen: true,
    finishId: "anthracite",
  });
  useEffect(() => {
    let live = true;
    getPhoto(storageKey)
      .then((saved) => {
        if (live && saved) {
          const parsed = SavedPhotoSchema.safeParse(saved);
          if (parsed.success) {
            const valid = parsed.data.placements.filter(
              (p) =>
                validCorners(p.corners) &&
                (p.kind === "door" ? catalog.doors : catalog.windows).some(
                  (m) => m.id === p.modelId,
                ),
            );
            setPhoto(parsed.data.photo);
            setPlacements(sharedItems || valid);
            setSelected(valid[0]?.id || null);
            if (valid[0]) setKind(valid[0].kind);
          } else setError("photoError");
        }
        ready.current = true;
      })
      .catch(() => {
        ready.current = true;
      });
    return () => {
      live = false;
    };
  }, [storageKey, catalog]);
  useEffect(() => {
    if (!ready.current || !photo) return;
    const timeout = setTimeout(
      () =>
        savePhoto(storageKey, { photo, placements }).catch(() =>
          setError("storageError"),
        ),
      500,
    );
    return () => clearTimeout(timeout);
  }, [photo, placements, storageKey]);
  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    loadImage(photo)
      .then((image) => {
        if (cancelled) return;
        photoImage.current = image;
        setSize({ w: image.naturalWidth, h: image.naturalHeight });
      })
      .catch(() => setError("photoError"));
    return () => {
      cancelled = true;
    };
  }, [photo]);
  useEffect(() => {
    if (!canvas.current || !photo) return;
    try {
      renderer.current = new PhotoRenderer(canvas.current);
    } catch {
      setError("webglError");
    }
    return () => {
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, [!!photo]);
  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    setRendering(true);
    renderFailed.current = false;
    pendingRender.current = (async () => {
      const items = [];
      for (const p of placements) {
        const rendered = await productImage(p, catalog, assetUrl);
        const image = rendered.image;
        items.push({
          image,
          corners: p.corners,
          brightness: p.brightness,
          frame: rendered?.frame,
          glass: rendered?.glass,
          photo: photoImage.current || undefined,
        });
      }
      return items;
    })()
      .then((items) => {
        if (!cancelled) {
          renderer.current?.render(size.w, size.h, items);
          setRendering(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          renderFailed.current = true;
          setError("photoError");
          setRendering(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [photo, placements, size, catalog, assetUrl]);
  const sample = async () => {
    try {
      const scene = PhotoSceneSchema.parse(
        await (await fetch(`/shared/scenes/${sampleId}.json`)).json(),
      );
      const image = await loadImage("/" + scene.photo),
        c = document.createElement("canvas");
      const ratio = Math.min(
        1,
        2048 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      c.width = Math.round(image.naturalWidth * ratio);
      c.height = Math.round(image.naturalHeight * ratio);
      c.getContext("2d")!.drawImage(image, 0, 0, c.width, c.height);
      const items = scene.placements
        .filter((p) => validCorners(p.corners))
        .map((p) => ({
          ...create(p.kind, p.corners),
          width: p.width,
          height: p.height,
        }));
      setPhoto(c.toDataURL("image/jpeg", 0.9));
      setPlacements(items);
      setSelected(items[0]?.id || null);
      setKind(items[0]?.kind || "door");
      setCompare(0);
      setError(null);
    } catch {
      setError("photoError");
    }
  };
  const upload = async (file: File) => {
    setBusy(true);
    try {
      if (
        file.size > 20 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      )
        throw Error();
      const url = URL.createObjectURL(file);
      try {
        const image = await loadImage(url),
          ratio = Math.min(
            1,
            1600 / Math.max(image.naturalWidth, image.naturalHeight),
          );
        const c = document.createElement("canvas");
        c.width = Math.round(image.naturalWidth * ratio);
        c.height = Math.round(image.naturalHeight * ratio);
        c.getContext("2d")!.drawImage(image, 0, 0, c.width, c.height);
        const p = create(kind, [
          { x: 0.35, y: 0.25 },
          { x: 0.65, y: 0.25 },
          { x: 0.65, y: 0.8 },
          { x: 0.35, y: 0.8 },
        ]);
        setPhoto(c.toDataURL("image/jpeg", 0.9));
        setPlacements([p]);
        setSelected(p.id);
        setCompare(0);
        setError(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setError("photoError");
    } finally {
      setBusy(false);
    }
  };
  const update = (partial: Partial<Placement>) => {
    if (!active) return;
    setPlacements((ps) =>
      ps.map((p) => (p.id === selected ? { ...p, ...partial } : p)),
    );
  };
  const changeKind = (next: "door" | "window") => {
    setKind(next);
    const existing = placements.find((p) => p.kind === next);
    if (existing) setSelected(existing.id);
    else if (photo) {
      const p = create(next);
      setPlacements((ps) =>
        next === "door"
          ? [...ps.filter((p) => p.kind !== "door"), p]
          : [...ps, p],
      );
      setSelected(p.id);
    }
  };
  const move = (event: React.PointerEvent) => {
    if (!dragging.current || !stage.current) return;
    const rect = stage.current.getBoundingClientRect();
    const point = {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
    if (event.pointerType === "touch") setLoupe(point);
    const { id, index } = dragging.current;
    setPlacements((ps) =>
      ps.map((p) => {
        if (p.id !== id) return p;
        const corners = structuredClone(p.corners);
        corners[index] = point;
        if (!validCorners(corners)) {
          setError("cornerError");
          return p;
        }
        setError(null);
        return { ...p, corners };
      }),
    );
  };
  useEffect(() => {
    onItemsChange?.(placements);
  }, [placements, onItemsChange]);
  useEffect(() => {
    capture?.(async () => {
      let pending: Promise<void>;
      do {
        pending = pendingRender.current;
        await pending;
      } while (pending !== pendingRender.current);
      if (renderFailed.current || !photoImage.current || !canvas.current)
        return "";
      const c = document.createElement("canvas");
      const ratio = Math.min(
        1,
        1600 / Math.max(canvas.current.width, canvas.current.height),
      );
      c.width = Math.round(canvas.current.width * ratio);
      c.height = Math.round(canvas.current.height * ratio);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(photoImage.current, 0, 0, c.width, c.height);
      ctx.drawImage(canvas.current, 0, 0, c.width, c.height);
      return c.toDataURL("image/png");
    });
  }, [capture]);
  const price = placements.reduce(
    (sum, p) => sum + productPrice(p, catalog),
    0,
  );
  const modelInfo = placements
    .map((p) =>
      label(
        (p.kind === "door" ? catalog.doors : catalog.windows).find(
          (m) => m.id === p.modelId,
        )!.name,
        language,
      ),
    )
    .join(", ");
  const message = t("photoMessage", {
    model: modelInfo,
    price: money(price, language),
  });
  const exportBlob = async () => {
    if (!photoImage.current || !canvas.current) throw Error();
    const c = document.createElement("canvas");
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(photoImage.current, 0, 0, c.width, c.height);
    ctx.drawImage(canvas.current, 0, 0);
    return new Promise<Blob>((resolve, reject) =>
      c.toBlob((b) => (b ? resolve(b) : reject(Error())), "image/png"),
    );
  };
  const exportImage = async (share = false) => {
    setBusy(true);
    try {
      const blob = await exportBlob(),
        file = new File([blob], brand.slug + "-preview.png", {
          type: "image/png",
        });
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: brand.companyName,
          text: message,
        });
      } else {
        downloadBlob(blob, file.name);
        if (share) setNotice("imageFallback");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError("exportError");
    } finally {
      setBusy(false);
    }
  };
  const send = (service: "whatsapp" | "viber") => {
    const url = messageUrl(service, brand, message);
    window.open(url, "_blank", "noopener,noreferrer");
  };
  return (
    <section className="page photo-page">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{t("doorsWindows")}</div>
          <h1>{t("previewTitle")}</h1>
          <p>{t("previewBody")}</p>
        </div>
      </div>
      <ErrorNotice message={error} onDismiss={() => setError(null)} />
      <div className="photo-grid">
        <section className="photo-workspace">
          <Field label={t("scenePresets")}>
            <select
              value={sampleId}
              onChange={(e) => setSampleId(e.target.value)}
            >
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {label(s.name, language)}
                </option>
              ))}
            </select>
          </Field>
          <div className="photo-toolbar">
            <div className="segmented">
              {(["door", "window"] as const).map((k) => (
                <button
                  key={k}
                  className={kind === k ? "active" : ""}
                  onClick={() => changeKind(k)}
                >
                  {t(k)}
                </button>
              ))}
            </div>
            <label className="button secondary">
              <ImagePlus size={18} />
              {t("uploadPhoto")}
              <input
                aria-label={t("uploadPhoto")}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) =>
                  e.target.files?.[0] && upload(e.target.files[0])
                }
              />
            </label>
          </div>
          {photo ? (
            <div
              className="photo-stage"
              ref={stage}
              style={{ aspectRatio: `${size.w}/${size.h}` }}
              onPointerMove={move}
              onPointerUp={() => {
                dragging.current = null;
                setLoupe(null);
              }}
              onPointerCancel={() => {
                dragging.current = null;
                setLoupe(null);
              }}
            >
              <img src={photo} alt={t("doorsWindows")} />
              <canvas
                ref={canvas}
                style={{ clipPath: `inset(0 0 0 ${compare}%)` }}
              />
              {loupe && (
                <div
                  className="touch-loupe"
                  style={{
                    left: `${Math.min(82, loupe.x * 100)}%`,
                    top: `${Math.max(0, loupe.y * 100 - 24)}%`,
                    backgroundImage: `url(${photo})`,
                    backgroundSize: `${size.w / 2}px ${size.h / 2}px`,
                    backgroundPosition: `${55 - (loupe.x * size.w) / 2}px ${55 - (loupe.y * size.h) / 2}px`,
                  }}
                />
              )}
              {placements.map((p) => (
                <div key={p.id} className="placement-region">
                  {p.id === selected ? (
                    p.corners.map((point, index) => (
                      <button
                        key={index}
                        className="corner-handle"
                        aria-label={`${t("selection")} ${index + 1}`}
                        style={{
                          left: `${point.x * 100}%`,
                          top: `${point.y * 100}%`,
                        }}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          dragging.current = { id: p.id, index };
                        }}
                        onKeyDown={(e) => {
                          const movement: { [key: string]: [number, number] } =
                            {
                              ArrowLeft: [-0.005, 0],
                              ArrowRight: [0.005, 0],
                              ArrowUp: [0, -0.005],
                              ArrowDown: [0, 0.005],
                            };
                          if (movement[e.key]) {
                            e.preventDefault();
                            const corners = structuredClone(p.corners);
                            corners[index] = {
                              x: point.x + movement[e.key][0],
                              y: point.y + movement[e.key][1],
                            };
                            if (validCorners(corners)) update({ corners });
                          }
                        }}
                      />
                    ))
                  ) : (
                    <button
                      className="placement-hit"
                      aria-label={`${t(p.kind)} ${placements.indexOf(p) + 1}`}
                      style={{
                        clipPath: `polygon(${p.corners.map((c) => `${c.x * 100}% ${c.y * 100}%`).join(",")})`,
                      }}
                      onClick={() => {
                        setSelected(p.id);
                        setKind(p.kind);
                      }}
                    ></button>
                  )}
                </div>
              ))}
              {true && (
                <button
                  className="comparison-line"
                  aria-label={t("beforeAfter")}
                  style={{ left: `${compare}%` }}
                  onPointerDown={(e) =>
                    e.currentTarget.setPointerCapture(e.pointerId)
                  }
                  onPointerMove={(e) => {
                    if (e.buttons && stage.current) {
                      const r = stage.current.getBoundingClientRect();
                      setCompare(
                        Math.min(
                          100,
                          Math.max(0, ((e.clientX - r.left) / r.width) * 100),
                        ),
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight")
                      setCompare(Math.min(100, compare + 2));
                    if (e.key === "ArrowLeft")
                      setCompare(Math.max(0, compare - 2));
                  }}
                >
                  ↔
                </button>
              )}
            </div>
          ) : (
            <div className="upload-empty">
              <img src="/shared/facade.svg" alt="" />
              <div>
                <ImagePlus size={28} />
                <h2>{t("uploadPhoto")}</h2>
                <p>{t("photoSize")}</p>
                <button className="button primary" onClick={sample}>
                  {t("samplePhoto")}
                </button>
              </div>
            </div>
          )}
          <p className="helper">{t("photoDrag")}</p>
          <Field label={t("beforeAfter")}>
            <input
              type="range"
              min={0}
              max={100}
              value={compare}
              onChange={(e) => setCompare(Number(e.target.value))}
            />
          </Field>
          <div className="photo-bottom">
            <span>{t("photoLocal")}</span>
            <button className="text-button" onClick={sample}>
              {t("samplePhoto")}
            </button>
          </div>
        </section>
        <aside className="preview-controls">
          <h2>{t("model")}</h2>
          {active && (
            <>
              <ProductControls
                item={active}
                catalog={catalog}
                onChange={(p) => update(p)}
              />
              <Field label={t("brightness")}>
                <input
                  type="range"
                  min={0.45}
                  max={1.5}
                  step={0.01}
                  value={active.brightness}
                  onChange={(e) =>
                    update({ brightness: Number(e.target.value) })
                  }
                />
              </Field>
              <button
                className="button secondary full"
                onClick={() => {
                  const p = create("window");
                  const count = placements.filter(
                    (x) => x.kind === "window",
                  ).length;
                  const shift = Math.min(0.08 * count, 0.2);
                  p.corners = p.corners.map((c) => ({
                    x: c.x - shift,
                    y: c.y - Math.min(0.04 * count, 0.18),
                  })) as Corners;
                  setPlacements([...placements, p]);
                  setSelected(p.id);
                  setKind("window");
                }}
              >
                <Plus size={16} />
                {t("addWindow")}
              </button>
              <button
                className="button danger full"
                onClick={() => {
                  const next = placements.filter((p) => p.id !== selected);
                  setPlacements(next);
                  setSelected(next[0]?.id || null);
                  if (next[0]) setKind(next[0].kind);
                }}
              >
                <Trash2 size={16} />
                {t("removePlacement")}
              </button>
            </>
          )}
          <div className="preview-total">
            <span>{t("previewPrice")}</span>
            <strong>{money(price, language)}</strong>
            <small>{t("indicative")}</small>
          </div>
          <button
            className="button primary full"
            disabled={!photo || busy || rendering}
            onClick={() => exportImage()}
          >
            <Download size={17} />
            {t("downloadImage")}
          </button>
          <button
            className="button secondary full"
            disabled={!photo || busy || rendering}
            onClick={() => exportImage(true)}
          >
            <Share2 size={17} />
            {t("shareImage")}
          </button>
          <SendAnyone
            title={brand.companyName}
            text={message}
            url={location.href}
          />
          <div className="two-buttons">
            <button
              className="button secondary"
              disabled={!photo}
              onClick={() => send("whatsapp")}
            >
              {t("whatsapp")}
            </button>
            <button
              className="button secondary"
              disabled={!photo}
              onClick={() => send("viber")}
            >
              {t("viber")}
            </button>
          </div>
          {notice && (
            <div className="notice" role="status">
              {t(notice as Parameters<typeof t>[0])}
            </div>
          )}
          {notice === "imageFallback" && (
            <textarea
              aria-label={t("message", { link: "" })}
              value={message}
              readOnly
            />
          )}
        </aside>
      </div>
    </section>
  );
}
