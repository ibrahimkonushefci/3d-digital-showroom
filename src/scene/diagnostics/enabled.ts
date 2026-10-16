/** `?fps=1` turns the frame diagnostics on for this tab (kept across
 * navigation in sessionStorage); `?fps=0` turns them off again. Off by
 * default, and nothing of the probe or overlay is loaded while off. */
const KEY = "showroom-fps";
export const fpsDiagnostics: boolean = (() => {
  try {
    const flag = new URLSearchParams(location.search).get("fps");
    if (flag === "1") sessionStorage.setItem(KEY, "1");
    if (flag === "0") sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();
