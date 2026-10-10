import { defineConfig } from "@playwright/test";

// Smoke coverage for the Reframe tool page only (the rest of the site has no
// Playwright coverage yet). Runs against the tools dev server so face
// detection, mediabunny decode/encode and the real BlazeFace model all behave
// as they would in production — this is Chromium only (WebCodecs/BlazeFace
// need it) and launched with fake media permissions disabled since Reframe
// never requests the camera/mic.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174",
    trace: "retain-on-failure",
  },
  // Serves the real built `site/` tree (not the isolated tools-only dev
  // server) so Reframe's self-hosted-model HEAD check against
  // /app/mediapipe/wasm resolves the same way it does in production, instead
  // of 404ing and falling back to the CDN copy.
  webServer: {
    command: "npm run build:tools && npm run build:app && python3 -m http.server 5174 --directory site",
    url: "http://localhost:5174/tools/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop-1280", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 } } },
  ],
});
