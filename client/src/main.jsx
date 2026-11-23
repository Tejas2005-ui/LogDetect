import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const isSaved = new URLSearchParams(window.location.search).get("view") === "saved" &&
  import.meta.env.VITE_CSV_ONLY !== "true";
const App = lazy(isSaved ? () => import("./App.jsx") : () => import("./Workspace.jsx"));

createRoot(document.getElementById("root")).render(
  <StrictMode><Suspense fallback={<p role="status">Loading LogDetect…</p>}><App /></Suspense></StrictMode>,
);
