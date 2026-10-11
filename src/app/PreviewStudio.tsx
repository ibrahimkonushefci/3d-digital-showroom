/** Local-only asset/verification studio; eliminated from production routing. */
import { useState, useMemo, useRef, useCallback } from "react";
import { useBrand } from "../brand";
import { presentationPresets } from "../designer3d/presets";
import Scene from "../designer3d/Scene";
import { createOffer, downloadBlob } from "../documents/offer";
import { translate } from "../i18n";
import { useRenderQuality, type Quality } from "../scene/quality";
import type { CaptureImage } from "../scene/Rendering";
export default function PreviewStudio() {
  const { brand, catalog, logoUrl } = useBrand(),
    presets = useMemo(() => presentationPresets(catalog), [catalog]);
  const [id, setId] = useState(presets[0]?.id || ""),
    [status, setStatus] = useState("Ready");
  const p = presets.find((p) => p.id === id);
  const quality = useRenderQuality((s) => s.level);
  const capture = useRef<CaptureImage | null>(null),
    register = useCallback((fn: CaptureImage) => {
      capture.current = fn;
    }, []);
  const download = async () => {
    try {
      setStatus("Rendering");
      const png = await capture.current!();
      const img = new Image();
      img.src = png;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 960;
      canvas.height = Math.round((960 * img.height) / img.width);
      canvas
        .getContext("2d")!
        .drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/webp", 0.84),
      );
      if (blob) downloadBlob(blob, `thumbnail-${id}.webp`);
      setStatus("Saved");
    } catch (e) {
      setStatus(String(e));
    }
  };
  const pdf = async (language: "sq" | "en" | "de") => {
    try {
      setStatus("Rendering PDF");
      if (!p) return;
      const design = p.design;
      const doc = await createOffer({
        design,
        brand,
        catalog,
        logoUrl,
        language,
        screenshot: await capture.current!(),
        t: (k, v) => translate(language, k, v),
      });
      doc.save(`proposal-${id}-${language}.pdf`);
      setStatus("Saved");
    } catch (e) {
      setStatus(String(e));
    }
  };
  return (
    <main style={{ padding: 20 }}>
      <label>
        Scene{" "}
        <select
          aria-label="Scene"
          value={id}
          onChange={(e) => {
            setId(e.target.value);
          }}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id}
            </option>
          ))}
        </select>
      </label>
      <label>
        Quality
        <select
          aria-label="Quality"
          value={quality}
          onChange={(e) =>
            useRenderQuality.getState().setLevel(e.target.value as Quality)
          }
        >
          {["lightweight", "balanced", "high"].map((q) => (
            <option key={q}>{q}</option>
          ))}
        </select>
      </label>
      <button onClick={download}>Download thumbnail</button>
      {(["sq", "en", "de"] as const).map((l) => (
        <button key={l} onClick={() => pdf(l)}>
          PDF {l}
        </button>
      ))}
      <p role="status">{status}</p>
      <div style={{ width: "100%", height: 650 }}>
        {p ? (
          <Scene
            key={id}
            design={p.design}
            catalog={catalog}
            cameraView={p.camera}
            capture={register}
          />
        ) : null}
      </div>
    </main>
  );
}
