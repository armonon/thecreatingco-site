import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// ScenePilot film tools (alpha): Captions, Board and Grade. Small single-purpose
// browser pages that hand their output to the editor (SRT/VTT, .scenepilot.json
// starter cuts, .cube LUTs). Built separately from the editor bundle so shipping
// a tool never rewrites the checked-in site/app/ Browser Lite build.
//
//   npm run dev:tools     ->  http://localhost:5174/tools/
//   npm run build:tools   ->  site/tools/  (served at /tools/ on the site)
const root = path.resolve(import.meta.dirname, "tools");

export default defineConfig({
  base: "/tools/",
  root,
  publicDir: false,
  plugins: [react()],
  server: {
    port: 5174,
    fs: { allow: [path.resolve(import.meta.dirname)] },
  },
  worker: { format: "es" },
  build: {
    outDir: path.resolve(import.meta.dirname, "site/tools"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        hub: path.join(root, "index.html"),
        captions: path.join(root, "captions/index.html"),
        board: path.join(root, "board/index.html"),
        grade: path.join(root, "grade/index.html"),
      },
    },
  },
});
