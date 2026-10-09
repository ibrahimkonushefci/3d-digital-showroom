import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Wifi, Check, RefreshCw } from "lucide-react";
import { useT } from "../i18n";
export default function OfflineStatus({
  hideBadge = false,
}: {
  hideBadge?: boolean;
}) {
  const t = useT();
  const [online, setOnline] = useState(navigator.onLine);
  const [installed, setInstalled] = useState(false);
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
          className={"offline-status " + (ready || installed ? "ready" : "")}
          title={t(ready || installed ? "offlineReady" : "preparingOffline")}
        >
          {ready || installed ? <Check size={13} /> : <Wifi size={13} />}
          <span>
            {t(ready || installed ? "offlineReady" : "preparingOffline")}
          </span>
          {!online && " ·"}
        </span>
      )}
      {refresh && (
        <div className="update-toast">
          <RefreshCw size={16} />
          {t("updateAvailable")}
          <button onClick={() => updateServiceWorker(true)}>
            {t("update")}
          </button>
        </div>
      )}
    </>
  );
}
