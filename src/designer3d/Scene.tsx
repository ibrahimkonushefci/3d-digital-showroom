import { SceneLifecycle } from "../scene/SceneLifecycle";
import SceneControls from "./SceneControls";
import { RoomLighting } from "../scene/lighting/RoomLighting";
import {
  RoomEnvironment,
  EnvironmentPolicy,
} from "../scene/lighting/RoomEnvironment";
import { ShadowShell } from "../scene/lighting/ShadowShell";
import { RoomShell, insideWall } from "../scene/rooms/RoomShell";
import { RoomProps } from "../scene/rooms/RoomProps";
import { pendingModelLoads } from "../scene/assets/ModelAsset";
import { assembleRenderInput } from "../scene/renderInput";
import { RunLights } from "../scene/RunLights";
import { Worktops } from "../scene/Worktops";
import {
  Rendering,
  RefreshShadows,
  showroomGL,
  type RegisterCapture,
} from "../scene/Rendering";
import { useQuality } from "../scene/quality";
import {
  useEffect,
  useMemo,
  useRef,
  useContext,
  useState,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import type { Catalog, DesignDocument } from "../catalog/types";
import { Box } from "../scene/Primitives";
import { useDesigner } from "./store";
import { CabinetMesh } from "./furniture/CabinetMesh";
import { useT } from "../i18n";
import { cabinetBounds, CABINET_FOV } from "./framing";
import type { CameraView, CameraPreset } from "./framing";
export type { CameraView, CameraPreset } from "./framing";

/** Controlled finite-distance highlight for the development material study only. */
function CalibrationHighlight({
  design,
  catalog,
}: {
  design: DesignDocument;
  catalog: Catalog;
}) {
  const centre = cabinetBounds(design, catalog).getCenter(new Vector3());
  return (
    <pointLight
      position={[centre.x - 0.35, centre.y + 0.35, centre.z + 1.6]}
      intensity={6}
      color="#ffffff"
      decay={2}
    />
  );
}
/** A strip of wall behind an upper cabinet, shown only once its real wall is
 * cut away for the overview, so cabinets never appear to float. */
function WallSupport({
  cabinet: c,
  room,
  color,
}: {
  cabinet: DesignDocument["cabinets"][number];
  room: DesignDocument["room"];
  color: string;
}) {
  const group = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (group.current)
      group.current.visible =
        c.wall === "island" ||
        !insideWall(
          camera,
          room,
          c.wall as "back" | "left" | "right" | "front",
        );
  });
  return (
    <group
      ref={group}
      position={[c.x / 100, 1.75, c.z / 100]}
      rotation={[0, c.rotation, 0]}
    >
      <Box
        size={[c.width / 100 + 0.01, 1.15, 0.035]}
        position={[0, 0, -c.depth / 200 - 0.015]}
        color={color}
      />
    </group>
  );
}
/** Rendered beside the furniture, so it only commits once nothing suspends. */
function FirstFrame({ onFirstFrame }: { onFirstFrame: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current || pendingModelLoads()) return;
    done.current = true;
    requestAnimationFrame(onFirstFrame);
  });
  return null;
}
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function Scene({
  design: committedDesign,
  catalog,
  preset = "hero",
  interactive = false,
  capture,
  cameraView,
  onFirstFrame,
  reframe,
  diagnostics,
  inspection,
  lockQuality = false,
  suspended = false,
  calibrationLight = false,
  calibrationHighlight = false,
}: {
  /** Only the development material-study controls opt into this light. */
  calibrationLight?: boolean;
  calibrationHighlight?: boolean;
  diagnostics?: ReactNode;
  inspection?: { opened: readonly string[]; interior: boolean };
  lockQuality?: boolean;
  suspended?: boolean;
  /** Changing this re-frames the camera, e.g. for "overall view". */
  reframe?: unknown;
  cameraView?: CameraView;
  design: DesignDocument;
  catalog: Catalog;
  preset?: CameraPreset;
  interactive?: boolean;
  capture?: RegisterCapture;
  /** Called once the furniture has committed and drawn its first frame. */
  onFirstFrame?: () => void;
}) {
  const [contextLost, setContextLost] = useState(false);
  const [generation, setGeneration] = useState(0);
  // Until the first complete frame, say so instead of showing an empty canvas.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => setDrawn(false), [generation]);
  const preview = useDesigner((s) => s.dragPreview);
  const opened = useDesigner((s) => s.opened);
  const openedInterior = useDesigner((s) => s.openedInterior);
  const focus = useDesigner((s) =>
    interactive && s.interactionMode === "showroom" ? s.focused : null,
  );
  const design = interactive && preview ? preview : committedDesign;
  const quality = useQuality();
  const environmentPolicy = useContext(EnvironmentPolicy);
  const performance = quality === "lightweight";
  const input = useMemo(
    () => assembleRenderInput(design, catalog, undefined, quality),
    [design, catalog, quality],
  );
  const t = useT();
  const w = design.room.width / 100,
    d = design.room.depth / 100;
  return (
    <SceneBoundary
      fallback={<div className="scene-fallback">{t("webglError")}</div>}
    >
      {interactive && !drawn && !contextLost && (
        <div className="scene-loading" role="status">
          <span className="scene-loading-dot" aria-hidden />
          {t("sceneLoading")}
        </div>
      )}
      {contextLost && (
        <div className="scene-recovery" role="alert">
          <p>{t("contextLostMessage")}</p>
          <button
            className="button primary"
            onClick={() => {
              setContextLost(false);
              setGeneration((n) => n + 1);
            }}
          >
            {t("retryScene")}
          </button>
        </div>
      )}
      <Canvas
        key={generation}
        role="img"
        aria-label={t("sceneLabel")}
        frameloop="demand"
        dpr={
          performance
            ? 1
            : Math.min(window.devicePixelRatio, quality === "high" ? 1.75 : 1.5)
        }
        // PCF honours each light's shadow.radius (PCFSoft ignores it).
        shadows={performance ? false : "percentage"}
        gl={showroomGL}
        camera={{ position: [2.4, 1.55, 4.2], fov: CABINET_FOV }}
        fallback={<div className="scene-fallback">{t("webglError")}</div>}
        onPointerMissed={() =>
          interactive && useDesigner.getState().select(null)
        }
      >
        <SceneLifecycle
          suspended={suspended}
          onLost={() => setContextLost(true)}
          onRestored={() => {
            setContextLost(false);
            setGeneration((n) => n + 1);
          }}
        />
        {diagnostics}
        <color attach="background" args={["#eee9df"]} />
        {calibrationLight ? (
          <>
            <hemisphereLight args={["#ffffff", "#808080", 0.65]} />
            <directionalLight
              position={[-3, 5, 4]}
              intensity={2}
              color="#ffffff"
            />
          </>
        ) : (
          <RoomLighting design={design} catalog={catalog} />
        )}
        {calibrationLight && calibrationHighlight && (
          <CalibrationHighlight design={design} catalog={catalog} />
        )}
        <RoomEnvironment design={design} policy={environmentPolicy} />
        <group position={[-w / 2, 0, -d / 2]}>
          <RoomShell design={design} />
          <ShadowShell design={design} />
          {design.cabinets
            .filter((c) => c.level === "wall")
            .map((c) => (
              <WallSupport
                key={`support-${c.id}`}
                cabinet={c}
                room={design.room}
                color={design.environment?.wallColor || "#e5e0d7"}
              />
            ))}
          {input.furniture.cabinets.map((furniture) => (
            <CabinetMesh
              key={furniture.cabinet.id}
              furniture={furniture}
              finishes={furniture.style}
              inspection={inspection}
              design={design}
              catalog={catalog}
              interactive={interactive}
            />
          ))}
          <Worktops design={design} catalog={catalog} />
          <RoomProps design={design} catalog={catalog} />
          <RunLights design={design} />
        </group>
        <RefreshShadows
          revision={[
            design,
            inspection?.opened || opened,
            inspection?.interior,
          ]}
        />
        <SceneControls
          catalog={catalog}
          preset={preset}
          focus={focus}
          design={committedDesign}
          cameraView={cameraView}
          reframe={reframe}
          opened={
            inspection?.opened ??
            (interactive
              ? [
                  ...new Set([
                    ...opened,
                    ...openedInterior.map((i) => i.cabinetId),
                  ]),
                ]
              : [])
          }
        />
        <Rendering
          capture={capture}
          lockQuality={lockQuality}
          fullAO={!interactive}
        />
        <FirstFrame
          key={generation}
          onFirstFrame={() => {
            setDrawn(true);
            onFirstFrame?.();
          }}
        />
      </Canvas>
    </SceneBoundary>
  );
}
