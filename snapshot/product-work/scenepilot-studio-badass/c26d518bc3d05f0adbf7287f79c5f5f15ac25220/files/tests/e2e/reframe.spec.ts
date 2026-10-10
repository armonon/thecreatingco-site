import path from "node:path";
import { expect, test } from "@playwright/test";

// Smoke test for Reframe: load the tool, drop an ffmpeg-generated synthetic
// clip (a moving bright square with a hard scene cut at 3s, no faces — the
// motion-saliency fallback path), run analysis, change the aspect, export a
// video, and export the crop path JSON. Checks 0 console errors throughout,
// at both a desktop and a phone viewport (set by the Playwright project).
const FIXTURE = path.join(import.meta.dirname, "..", "fixtures", "reframe-smoke.mp4");
const FACE_FIXTURE = path.join(import.meta.dirname, "..", "fixtures", "reframe-face-smoke.mp4");

test("Reframe: import, analyze, preview, export video + crop path JSON, 0 console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto("/tools/reframe/");
  await expect(page).toHaveTitle(/Reframe/);
  await expect(page.getByRole("button", { name: /Drop a horizontal video here/i })).toBeVisible();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(FIXTURE);

  // Analysis runs client-side (face model load + per-frame sampling); give it room.
  await expect(page.locator(".status-line")).toContainText(/Analysed:/i, { timeout: 60_000 });
  await expect(page.locator(".status-line.error")).toHaveCount(0);

  // The side-by-side preview and timeline should be present once a clip is loaded.
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.locator(".reframe-timeline-scroll svg")).toBeVisible();

  // Switch aspect to exercise the crop-bounds path for a second ratio.
  await page.locator("select").selectOption("1:1");

  // Add a letterboxed segment to exercise that path too.
  await page.getByRole("button", { name: /Add segment at playhead/i }).click();
  await expect(page.locator(".segment-row")).toHaveCount(1);

  // Export the crop path JSON (fast, no encoding) and the video (exercises WebCodecs or the MediaRecorder fallback).
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export crop path JSON/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/crop-path\.json$/);

  await page.getByRole("button", { name: /^Export video$/i }).click();
  await expect(page.getByRole("link", { name: /Download .*reframe-1x1/i })).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(".status-line")).toContainText(/Exported/i);
  await expect(page.locator(".status-line.error")).toHaveCount(0);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("Reframe: a real face (generated test photo panning across frame) drives the crop, not the motion fallback", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto("/tools/reframe/");
  await page.locator('input[type="file"]').setInputFiles(FACE_FIXTURE);
  await expect(page.locator(".status-line")).toContainText(/Analysed:/i, { timeout: 60_000 });
  await expect(page.locator(".status-line")).toContainText(/faces found/i);

  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});

test("Film tools hub lists Reframe", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/tools/");
  await expect(page.getByRole("link", { name: /Reframe/i })).toBeVisible();
  expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
});
