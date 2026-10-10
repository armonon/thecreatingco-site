// Run against a locally served exact-source editor:
// node scripts/certify-lite-timeline-menu.mjs URL synthetic-video.mp4 evidence-dir
// Ordinary pointer clicks, no forced clicks or style injection. No physical media.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [url, video, evidence] = process.argv.slice(2);
assert.ok(url && video && evidence, "Pass URL, synthetic video, evidence directory");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname), "Use an owned local server");
const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(evidence, { recursive: true });
const result = {
  startedAt: new Date().toISOString(),
  source: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  cssSha256: createHash("sha256").update(await readFile(path.join(root, "app/studio-workspace.css"))).digest("hex"),
  fixtureSha256: createHash("sha256").update(await readFile(video)).digest("hex"),
  url, checks: [], errors: [], scope: "Browser Lite timeline menu pointer reachability only; not golden/release qualification",
};
const browser = await chromium.launch();
try {
  result.browser = browser.version();
  for (const viewport of [{ width: 1440, height: 1100 }, { width: 1140, height: 900 }]) {
    const context = await browser.newContext({ viewport });
    try {
      const page = await context.newPage();
      page.on("pageerror", error => result.errors.push(String(error)));
      await page.goto(url);
      await page.getByPlaceholder("My project").fill("Owned Lite menu regression");
      await page.getByRole("button", { name: "Start editing", exact: true }).click();
      assert.ok((await page.locator(".edition-badge").innerText()).includes("BROWSER LITE"));
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await page.locator(".panel-head input[type=file][multiple]").setInputFiles(video);
      await page.waitForFunction(() => document.querySelectorAll(".asset-row").length === 1);
      await page.locator(".asset-row").dblclick();
      await page.getByRole("button", { name: ", Insert", exact: true }).click();
      const count = async () => Number((await page.locator(".timeline-toolbar > div:first-child > span").textContent()).match(/(\d+) video/)[1]);
      const before = await count();
      await page.locator("summary").filter({ hasText: /Add track/ }).click();
      const button = page.getByRole("button", { name: "Video track", exact: true });
      const hit = await button.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        return { reachable: target === element || element.contains(target), overflow: getComputedStyle(element.closest(".timeline-wrap")).overflow };
      });
      await page.screenshot({ path: path.join(evidence, `menu-${viewport.width}.png`) });
      assert.equal(hit.reachable, true, "Timeline menu must be hit-testable above the inspector");
      await button.click();
      assert.equal(await count(), before + 1);
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      assert.equal(await count(), before);
      await page.getByRole("button", { name: "Redo", exact: true }).click();
      assert.equal(await count(), before + 1);
      result.checks.push({ viewport, status: "PASS", before, after: before + 1, hit });
    } finally { await context.close(); }
  }
  assert.deepEqual(result.errors, []);
  result.status = "PASS";
} catch (error) {
  result.status = "FAIL"; result.error = String(error.stack || error); process.exitCode = 1;
} finally {
  await browser.close(); result.finishedAt = new Date().toISOString();
  await writeFile(path.join(evidence, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
