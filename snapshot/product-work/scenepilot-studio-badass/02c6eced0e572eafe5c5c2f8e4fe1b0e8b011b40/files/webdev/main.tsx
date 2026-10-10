// Web dev entry — mounts the editor as a plain client SPA, the same way the
// Electron renderer does. This is a working HMR dev path that sidesteps the
// vinext/RSC dev-server bug (a virtual client-in-server shim fails to load in
// dev). The production/worker build still uses `npm run build` + `npm run start`.
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import "../app/studio-workspace.css";
import "../app/workspace-sizing.css";
import { PwaStatus } from "../app/suite-ui";

// Keep the public Lite shell tiny. The professional editor loads as a separate
// route chunk, while media decoding is split again and fetched only on Analyze.
const Home = lazy(() => import("../app/page"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={<div className="editor-boot"><strong>SCENEPILOT</strong><span>Loading the editing workspace…</span><i /></div>}><Home /></Suspense>
    <PwaStatus />
  </StrictMode>,
);
