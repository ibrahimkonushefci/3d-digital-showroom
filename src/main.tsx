import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./app/style.css";
import App from "./app/App";
// Save A/B and Compare were removed: drop their local database once.
try {
  if (!localStorage.getItem("showroom-comparisons-removed")) {
    indexedDB.deleteDatabase("showroom-furniture-comparisons");
    localStorage.setItem("showroom-comparisons-removed", "1");
  }
} catch {
  /* storage unavailable: nothing to clean */
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
