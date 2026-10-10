// Runs the Pro half of the engine-parity harness in an offscreen Chromium page.
import { app, BrowserWindow } from "electron";
import { readFile, writeFile } from "node:fs/promises";

// Mirror the real app: GPU compositing and hardware video paths stay enabled unless
// PARITY_PRO_SOFTWARE=1 asks for the software-only path.
if (process.env.PARITY_PRO_SOFTWARE === "1") app.disableHardwareAcceleration();
const timeout = setTimeout(() => { process.stderr.write("Engine-parity Pro render timed out.\n"); app.exit(1); }, 600_000);
app.whenReady().then(async () => {
  const payload = JSON.parse(await readFile(process.argv.at(-1), "utf8"));
  const window = new BrowserWindow({ show: false, webPreferences: { offscreen: true, sandbox: true, contextIsolation: true } });
  window.webContents.on("console-message", (event) => process.stderr.write(`${event.message}\n`));
  await window.loadFile(payload.html);
  const bundle = await readFile(payload.bundle, "utf8");
  const input = await readFile(payload.input, "utf8");
  const results = await window.webContents.executeJavaScript(`${bundle}\n(() => { const i = ${input}; return ScenePilotParity.render(i.cases, i.media); })()`);
  await writeFile(payload.result, JSON.stringify(results));
  window.destroy(); clearTimeout(timeout); app.quit();
}).catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); clearTimeout(timeout); app.exit(1); });
