import { useThree } from "@react-three/fiber";
import { EnvironmentPolicy } from "../scene/lighting/RoomEnvironment";
import { presetRoom } from "../scene/rooms/resolveRoom";
import { ModelPolicy } from "../scene/assets/ModelAsset";
/** Local-only asset/verification studio; eliminated from production routing. */
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useBrand } from "../brand";
import { DesignSchema } from "../catalog/types";
import defaultFixture from "../../tests/fixtures/realism/default.json";
import druriFixture from "../../tests/fixtures/realism/druri-design.json";
import RenderMetrics, { resetCapturePeak } from "../scene/RenderMetrics";
import type { MetricsReport } from "../scene/metrics";
import { QualityOverride } from "../scene/quality";
import type { CameraView } from "../designer3d/Scene";
import Scene from "../designer3d/Scene";
import { createOffer, downloadBlob } from "../documents/offer";
import { translate } from "../i18n";
import { type Quality } from "../scene/quality";
import type { CaptureImage } from "../scene/Rendering";
import { studyDesign, type StudyView } from "./studyDesign";
function ContextLossStudy({
  register,
}: {
  register: (lose: (() => void) | null) => void;
}) {
  const { gl } = useThree();
  useEffect(() => {
    register(() =>
      gl.getContext().getExtension("WEBGL_lose_context")?.loseContext(),
    );
    return () => register(null);
  }, [gl, register]);
  return null;
}
export default function PreviewStudio() {
  const { brand, catalog, logoUrl } = useBrand(),
    presets = useMemo(
      () =>
        (brand.slug === "druri-design"
          ? druriFixture
          : defaultFixture
        ).presets.map((p) => ({
          ...p,
          design: DesignSchema.parse(p.design),
          camera: p.camera as CameraView,
        })),
      [brand.slug],
    );
  const [id, setId] = useState(presets[0]?.id || ""),
    [status, setStatus] = useState("Ready");
  const p = presets.find((p) => p.id === id);
  const contextLoss = useRef<(() => void) | null>(null);
  const registerContextLoss = useCallback((lose: (() => void) | null) => {
    contextLoss.current = lose;
  }, []);
  const [study, setStudy] = useState<StudyView>("overall");
  const [finish, setFinish] = useState<Record<string, string>>({});
  const [neutral, setNeutral] = useState(false);
  const [environmentPolicy, setEnvironmentPolicy] = useState<
    "auto" | "authored"
  >("auto");
  const [leds, setLeds] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<
    "perspective" | "hero" | "overall" | "front" | "top"
  >("perspective");
  const [windowWall, setWindowWall] = useState<
    "recipe" | "solid" | "back" | "left" | "right" | "front"
  >("recipe");
  const [highlight, setHighlight] = useState(false);
  const [modelPolicy, setModelPolicy] = useState<
    "detailed" | "fallback" | "missing"
  >("detailed");
  const renderDesign = useMemo(
    () =>
      p
        ? {
            ...studyDesign(p.design, catalog, study),
            style: {
              ...p.design.style,
              ...finish,
              led: leds && p.design.style.led,
            },
            environment: {
              floor: p.design.environment?.floor || ("laminate" as const),
              wallColor: p.design.environment?.wallColor || "#e5e0d7",
              internalLed: leds && !!p.design.environment?.internalLed,
            },
            room: (() => {
              const room =
                study === "overall" || study === "storage"
                  ? presetRoom(p.design.room, p.design.kind, p.design.cabinets)
                  : p.design.room;
              if (windowWall === "recipe") return room;
              if (windowWall === "solid") return { ...room, openings: [] };
              const length =
                windowWall === "back" || windowWall === "front"
                  ? room.width
                  : room.depth;
              return {
                ...room,
                openings: [
                  {
                    id: "lighting-study-window",
                    type: "window" as const,
                    wall: windowWall,
                    width: 100,
                    height: 100,
                    sill: 120,
                    offset: (length - 100) / 2,
                  },
                ],
              };
            })(),
          }
        : null,
    [p, catalog, study, finish, leds, windowWall],
  );
  const baseCamera: CameraView | undefined = useMemo(
    () =>
      p
        ? study === "overall" || study === "storage"
          ? p.camera
          : {
              position: [1, p.design.kind === "wardrobe" ? 1.6 : 1.2, 2],
              target: [0, 1, 0],
            }
        : undefined,
    [p, study],
  );
  const [quality, setQuality] = useState<Quality>("balanced");
  const [scope, setScope] = useState<MetricsReport["scope"]>("desktop-browser");
  const [deviceLabel, setDeviceLabel] = useState("@Browser desktop");
  const measurement = useMemo(
    () => ({ scope, label: deviceLabel }),
    [scope, deviceLabel],
  );
  const [interior, setInterior] = useState(false),
    [opened, setOpened] = useState(false);
  const [report, setReport] = useState<MetricsReport | null>(null);
  const [sampleSeconds, setSampleSeconds] = useState(10);
  const [running, setRunning] = useState(false),
    [view, setView] = useState<CameraView>();
  const [captureScene, setCaptureScene] = useState(false);
  const [captureReady, setCaptureReady] = useState(false);
  const exporting = status === "Rendering" || status === "Rendering PDF";
  const [epoch, setEpoch] = useState(0);
  const [sampleEpoch, setSampleEpoch] = useState(0);
  const receive = useCallback((value: MetricsReport) => setReport(value), []);
  const peakReport = useRef<MetricsReport | null>(null);
  const receivePeak = useCallback((value: MetricsReport) => {
    peakReport.current = value;
  }, []);
  useEffect(() => {
    if (!running || !p) return;
    let step = 0;
    const timer = setInterval(() => {
      if (document.hidden) return;
      step++;
      if (step > sampleSeconds * 2) {
        setRunning(false);
        setView(undefined);
        setStatus("Motion sample complete");
        return;
      }
      const angle = Math.sin((step / 20) * Math.PI * 4) * 0.18;
      const [x, y, z] = baseCamera!.position,
        [tx, , tz] = baseCamera!.target;
      setView({
        position: [
          tx + (x - tx) * Math.cos(angle) - (z - tz) * Math.sin(angle),
          y,
          tz + (x - tx) * Math.sin(angle) + (z - tz) * Math.cos(angle),
        ],
        target: baseCamera!.target,
      });
    }, 500);
    return () => clearInterval(timer);
  }, [running, p, baseCamera, sampleSeconds]);
  const captureTemporary = useCallback(async (fn: CaptureImage) => {
    try {
      await fn();
      setStatus(
        `A/B capture complete; estimated combined peak ${((peakReport.current?.estimates.capturePeakBytes || 0) / 1048576).toFixed(1)} MiB (estimate)`,
      );
    } catch (e) {
      setStatus(String(e));
    } finally {
      setCaptureScene(false);
    }
  }, []);
  const capture = useRef<CaptureImage | null>(null),
    register = useCallback((fn: CaptureImage) => {
      capture.current = fn;
      setCaptureReady(true);
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
      const design = renderDesign!;
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
    <QualityOverride.Provider value={quality}>
      <ModelPolicy.Provider value={modelPolicy}>
        <EnvironmentPolicy.Provider value={environmentPolicy}>
          <main style={{ padding: 20 }}>
            <p>
              Phase 0–6 verification · development only · fixed IDs · does not
              load or save drafts. Memory is estimated; physical tablets are
              unverified.
            </p>
            <label>
              Reflections{" "}
              <select
                aria-label="Reflections"
                value={environmentPolicy}
                disabled={running || captureScene || exporting}
                onChange={(e) =>
                  setEnvironmentPolicy(
                    e.target.value as typeof environmentPolicy,
                  )
                }
              >
                <option value="auto">Room probe with authored fallback</option>
                <option value="authored">Authored fallback only</option>
              </select>
            </label>
            <label>
              Window study{" "}
              <select
                aria-label="Window study"
                value={windowWall}
                disabled={running || captureScene || exporting}
                onChange={(e) =>
                  setWindowWall(e.target.value as typeof windowWall)
                }
              >
                <option value="recipe">Actual fixture opening</option>
                <option value="solid">Solid walls</option>
                {["back", "left", "right", "front"].map((side) => (
                  <option key={side} value={side}>
                    {side}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Camera{" "}
              <select
                aria-label="Lighting camera"
                value={cameraPreset}
                disabled={running || captureScene || exporting}
                onChange={(e) =>
                  setCameraPreset(e.target.value as typeof cameraPreset)
                }
              >
                <option value="perspective">Perspective / fixture</option>
                <option value="hero">Hero</option>
                <option value="overall">Overall</option>
                <option value="front">Front</option>
                <option value="top">Top</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                aria-label="LED fills"
                checked={leds}
                disabled={running || captureScene || exporting}
                onChange={(e) => setLeds(e.target.checked)}
              />
              LED fills (temporary)
            </label>
            <label>
              Models{" "}
              <select
                aria-label="Models"
                value={modelPolicy}
                disabled={running || captureScene || exporting}
                onChange={(e) =>
                  setModelPolicy(e.target.value as typeof modelPolicy)
                }
              >
                <option value="detailed">Original room kit</option>
                <option value="fallback">Procedural fallbacks</option>
                <option value="missing">Missing model test</option>
              </select>
            </label>
            <label>
              Scene{" "}
              <select
                aria-label="Scene"
                value={id}
                disabled={running || captureScene || exporting}
                onChange={(e) => {
                  if (e.target.value === id) return;
                  setId(e.target.value);
                  setStudy("overall");
                  setFinish({});
                  capture.current = null;
                  setCaptureReady(false);
                  setRunning(false);
                  setView(undefined);
                  setReport(null);
                  setInterior(false);
                  setOpened(false);
                  peakReport.current = null;
                  resetCapturePeak();
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
              Inspection shot
              <select
                aria-label="Inspection shot"
                value={study}
                disabled={running || captureScene || exporting}
                onChange={(e) => setStudy(e.target.value as StudyView)}
              >
                <option value="overall">Overall fixture</option>
                {p?.design.kind === "kitchen" ? (
                  <>
                    <option value="door40">40 cm base door</option>
                    <option value="door90">90 cm base cabinet</option>
                    <option value="worktop">Connected worktops / edges</option>
                  </>
                ) : (
                  <>
                    <option value="tall">Tall wardrobe doors</option>
                    <option value="shelves">Shelves and back panel</option>
                    <option value="storage">Custom wardrobe storage</option>
                  </>
                )}
                <option value="drawers">Drawer construction</option>
              </select>
            </label>
            {renderDesign &&
              (
                [
                  ["front", "Front decor", catalog.fronts],
                  ["carcass", "Carcass decor", catalog.carcasses],
                  ["countertop", "Worktop decor", catalog.countertops],
                  ["plinth", "Plinth finish", catalog.plinths],
                ] as const
              ).map(([key, label, items]) => (
                <label key={key}>
                  {label}
                  <select
                    aria-label={label}
                    value={renderDesign.style[key]}
                    disabled={running || captureScene || exporting}
                    onChange={(e) =>
                      setFinish((s) => ({ ...s, [key]: e.target.value }))
                    }
                  >
                    {items.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            <label>
              <input
                type="checkbox"
                aria-label="Neutral calibration light"
                checked={neutral}
                disabled={running || captureScene || exporting}
                onChange={(e) => setNeutral(e.target.checked)}
              />
              Neutral calibration light (development only)
            </label>
            <label>
              <input
                aria-label="Calibration highlight"
                type="checkbox"
                checked={highlight}
                disabled={!neutral || running || captureScene || exporting}
                onChange={(e) => setHighlight(e.target.checked)}
              />
              Calibration highlight (development only)
            </label>
            <label>
              Quality
              <select
                aria-label="Quality"
                value={quality}
                disabled={running || captureScene || exporting}
                onChange={(e) => {
                  if (e.target.value === quality) return;
                  setQuality(e.target.value as Quality);
                  capture.current = null;
                  setCaptureReady(false);
                  setReport(null);
                  peakReport.current = null;
                  resetCapturePeak();
                }}
              >
                {["lightweight", "balanced", "high"].map((q) => (
                  <option key={q}>{q}</option>
                ))}
              </select>
            </label>
            <label>
              Measurement context
              <select
                aria-label="Measurement context"
                value={scope}
                onChange={(e) =>
                  setScope(e.target.value as MetricsReport["scope"])
                }
              >
                <option value="desktop-browser">Desktop browser</option>
                <option value="physical-tablet">Actual physical tablet</option>
              </select>
            </label>
            <label>
              Device / OS notes
              <input
                aria-label="Device / OS notes"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
              />
            </label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                margin: "12px 0",
              }}
            >
              <label>
                Motion duration{" "}
                <select
                  aria-label="Motion duration"
                  value={sampleSeconds}
                  disabled={running}
                  onChange={(e) => setSampleSeconds(Number(e.target.value))}
                >
                  <option value={10}>10 seconds</option>
                  <option value={600}>10 minutes</option>
                </select>
              </label>
              {running && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setRunning(false);
                    setView(undefined);
                    setStatus("Motion sample cancelled");
                  }}
                >
                  Stop motion sample
                </button>
              )}
              <button
                className="button"
                disabled={running || captureScene}
                onClick={() => {
                  setSampleEpoch((n) => n + 1);
                  setRunning(true);
                  setStatus("Sampling camera motion for 10 seconds");
                }}
              >
                Run {sampleSeconds === 600 ? "10min" : "10s"} motion sample
              </button>
              <button
                className="button"
                aria-pressed={opened}
                onClick={() => {
                  setOpened(!opened);
                }}
              >
                Toggle all fronts
              </button>
              <button
                className="button"
                disabled={p?.design.kind !== "wardrobe"}
                aria-pressed={interior}
                onClick={() => setInterior(!interior)}
              >
                Toggle interior
              </button>
              <button
                className="button"
                disabled={!report || running || captureScene}
                onClick={() => {
                  resetCapturePeak();
                  peakReport.current = null;
                  setCaptureScene(true);
                  setStatus("Measuring temporary closed A/B Canvas");
                }}
              >
                Measure A/B peak
              </button>
              <button
                className="button"
                disabled={!report}
                onClick={() =>
                  downloadBlob(
                    new Blob(
                      [
                        JSON.stringify(
                          {
                            ...report,
                            studyContext: {
                              study,
                              neutral,
                              highlight,
                              style: renderDesign?.style,
                              environmentPolicy,
                              cameraPreset,
                              windowWall,
                              leds,
                              cabinetIds: renderDesign?.cabinets.map(
                                (c) => c.id,
                              ),
                            },
                            temporaryCapture: peakReport.current,
                          },
                          null,
                          2,
                        ),
                      ],
                      { type: "application/json" },
                    ),
                    `metrics-${brand.slug}-${id}-${quality}.json`,
                  )
                }
              >
                Download metrics JSON
              </button>
              <button
                className="button"
                onClick={() => {
                  setEpoch((n) => n + 1);
                  capture.current = null;
                  setCaptureReady(false);
                  setRunning(false);
                  setView(undefined);
                  setReport(null);
                  peakReport.current = null;
                  resetCapturePeak();
                }}
              >
                Reset measurements
              </button>
            </div>
            <button
              disabled={!captureReady || exporting || running || captureScene}
              onClick={download}
            >
              Download thumbnail
            </button>
            {(["sq", "en", "de"] as const).map((l) => (
              <button
                key={l}
                disabled={!captureReady || exporting || running || captureScene}
                onClick={() => pdf(l)}
              >
                PDF {l}
              </button>
            ))}
            <button
              className="button secondary"
              disabled={!captureReady || running || exporting || captureScene}
              onClick={() => {
                contextLoss.current?.();
                setStatus(
                  "Context loss requested. Use Restore 3D view; fixture state is retained.",
                );
              }}
            >
              Simulate WebGL context loss
            </button>
            <p role="status">{status}</p>
            <div style={{ width: "100%", height: 650 }}>
              {p ? (
                <Scene
                  key={`${brand.slug}:${id}:${quality}:${epoch}`}
                  design={renderDesign!}
                  catalog={catalog}
                  preset={cameraPreset}
                  cameraView={
                    view ||
                    (cameraPreset === "perspective" ? baseCamera : undefined)
                  }
                  calibrationLight={neutral}
                  calibrationHighlight={highlight}
                  capture={register}
                  inspection={{
                    opened: opened
                      ? renderDesign!.cabinets.map((c) => c.id)
                      : [],
                    interior,
                  }}
                  suspended={captureScene}
                  diagnostics={
                    <>
                      <ContextLossStudy register={registerContextLoss} />
                      <RenderMetrics
                        sceneId={`${brand.slug}:${id}`}
                        sampleEpoch={sampleEpoch}
                        quality={quality}
                        onReport={receive}
                        measurement={measurement}
                      />
                    </>
                  }
                />
              ) : null}
            </div>
            <details open>
              <summary>
                Browser rendering measurements (estimates, not tablet results)
              </summary>
              <pre
                data-testid="render-metrics"
                style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {report
                  ? JSON.stringify(report, null, 2)
                  : "Waiting for a complete scene frame…"}
              </pre>
              {peakReport.current && (
                <pre
                  data-testid="capture-metrics"
                  style={{ whiteSpace: "pre-wrap" }}
                >
                  {JSON.stringify(peakReport.current, null, 2)}
                </pre>
              )}
            </details>
            {captureScene && p && (
              <div aria-hidden="true" className="offscreen-capture">
                <Scene
                  design={renderDesign!}
                  catalog={catalog}
                  capture={captureTemporary}
                  diagnostics={
                    <RenderMetrics
                      sceneId={`${brand.slug}:${id}:temporary-capture`}
                      quality={quality}
                      onReport={receivePeak}
                      measurement={measurement}
                    />
                  }
                />
              </div>
            )}
          </main>
        </EnvironmentPolicy.Provider>
      </ModelPolicy.Provider>
    </QualityOverride.Provider>
  );
}
