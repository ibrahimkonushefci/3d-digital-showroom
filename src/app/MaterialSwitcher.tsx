import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useBrand } from "../brand";
import { useT } from "../i18n";
import { presentationPresets } from "../designer3d/presets";
import { useDesigner } from "../designer3d/store";
import { Materials } from "../designer3d/Designer";
const Scene = lazy(() => import("../designer3d/Scene"));
export default function MaterialSwitcher() {
  const { catalog } = useBrand(),
    t = useT(),
    navigate = useNavigate(),
    location = useLocation();
  const example = useMemo(
    () =>
      presentationPresets(catalog).find((p) => p.design.kind === "kitchen")!
        .design,
    [catalog],
  );
  const [design, setDesign] = useState(example);
  const embedded = location.pathname.startsWith("/embed");
  return (
    <main className={"material-page " + (embedded ? "embedded" : "page")}>
      <div className="material-heading">
        <div className="eyebrow">{t("materials")}</div>
        <h1>{t("materialTitle")}</h1>
        <p>{t("materialBody")}</p>
      </div>
      <div className="material-grid">
        <div className="material-scene">
          <Suspense fallback={<p>{t("sceneLoading")}</p>}>
            <Scene design={design} catalog={catalog} />
          </Suspense>
        </div>
        <div className="material-controls">
          <Materials design={design} onChange={setDesign} compact />
          <button
            className="button primary full"
            onClick={() => {
              useDesigner.getState().setDesign(design);
              navigate("/designer/kitchen" + location.search);
            }}
          >
            {t("designYourOwn")}
            <ArrowUpRight size={18} />
          </button>
        </div>
      </div>
    </main>
  );
}
