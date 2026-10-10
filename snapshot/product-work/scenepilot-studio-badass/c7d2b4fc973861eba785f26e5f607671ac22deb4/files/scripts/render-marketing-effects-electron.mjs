import { app, BrowserWindow } from "electron";
import { readFile, writeFile } from "node:fs/promises";
// Use Chromium's actual WebGL implementation, including the product grade shader.
const timeout = setTimeout(() => app.exit(1), 600_000);
app.whenReady().then(async () => {
  const payload = JSON.parse(await readFile(process.argv.at(-1), "utf8"));
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, offscreen: true, backgroundThrottling: false } });
  window.webContents.on("console-message", (_event, _level, message) => { if (message.startsWith("Gallery:")) console.log(message); });
  await window.loadURL("data:text/html,<title>ScenePilot asset renderer</title>");
  const bundle = await readFile(payload.bundle, "utf8");
  const source = `data:image/jpeg;base64,${(await readFile(payload.source)).toString("base64")}`;
  const result = await window.webContents.executeJavaScript(`${bundle}\nScenePilotGalleryRender.renderGallery(${JSON.stringify(source)})`);
  await writeFile(payload.result, JSON.stringify(result));
  window.destroy(); clearTimeout(timeout); app.quit();
}).catch(error => { console.error(error); clearTimeout(timeout); app.exit(1); });
