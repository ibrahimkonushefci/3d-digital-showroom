import { useCaptureBusy } from "./busy";
import { useDesigner } from "../designer3d/store";
import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Wifi, Check, RefreshCw } from "lucide-react";
import { requiredSceneAssets } from "../scene/assets/manifest";
import { useT } from "../i18n";
export default function OfflineStatus({
  hideBadge = false,
}: {
  hideBadge?: boolean;
}) {
  const t = useT();
  const capturing = useCaptureBusy((s) => s.count > 0);
  const dragging = useDesigner((s) => s.dragging);
  const [deferred, setDeferred] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [installed, setInstalled] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activationNeeded, setActivationNeeded] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.ready
        .then(() => setInstalled(true))
        .catch(() => {});
  }, []);
  const {
    offlineReady: [ready],
    needRefresh: [refresh],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    if (!(ready || installed) || !("caches" in window)) return;
    let live = true,
      attempts = 0;
    const check = async () => {
      try {
        const matches = await Promise.all(
          requiredSceneAssets.map((path) =>
            caches.match(new URL("/" + path, location.origin).href, {
              ignoreSearch: true,
            }),
          ),
        );
        if (live) {
          const complete =
            !!navigator.serviceWorker.controller && matches.every(Boolean);
          setActivationNeeded(
            !navigator.serviceWorker.controller && matches.every(Boolean),
          );
          setSceneReady(complete);
          setFailed(!complete && ++attempts >= 10);
          if (complete || attempts >= 10) clearInterval(timer);
        }
      } catch {
        if (live) setFailed(true);
      }
    };
    setFailed(false);
    void check();
    const timer = setInterval(check, 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [ready, installed, retry, online]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <>
      {!hideBadge && (
        <span
          className={"offline-status " + (sceneReady ? "ready" : "")}
          title={t(
            sceneReady
              ? "offlineReady"
              : activationNeeded
                ? "offlineActivate"
                : failed
                  ? "offlineSceneFailed"
                  : "preparingOffline",
          )}
        >
          {sceneReady ? <Check size={13} /> : <Wifi size={13} />}
          <span>
            {t(
              sceneReady
                ? "offlineReady"
                : activationNeeded
                  ? "offlineActivate"
                  : failed
                    ? "offlineSceneFailed"
                    : "preparingOffline",
            )}
          </span>
          {!online && " ·"}
          {(failed || activationNeeded) && (
            <button
              onClick={() =>
                activationNeeded ? location.reload() : setRetry((n) => n + 1)
              }
            >
              {t(activationNeeded ? "finishOffline" : "retryOffline")}
            </button>
          )}
        </span>
      )}
      {refresh && !deferred && (
        <div className="update-toast">
          <RefreshCw size={16} />
          {t("updateAvailable")}
          <button
            disabled={capturing || dragging}
            title={capturing || dragging ? t("updateWhenReady") : undefined}
            onClick={() => updateServiceWorker(true)}
          >
            {t("update")}
          </button>
          <button className="update-later" onClick={() => setDeferred(true)}>
            {t("updateLater")}
          </button>
        </div>
      )}
    </>
  );
}
