/* eslint-disable @typescript-eslint/no-require-imports -- Electron preload runs as CommonJS inside the sandbox. */
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("scenePilotDesktop", {
  closeWindow: () => ipcRenderer.invoke("scenepilot:close-window"),
  confirmProjectReplacement: () => ipcRenderer.invoke("scenepilot:confirm-project-replacement"),
  commitProjectDocument: (path) => ipcRenderer.invoke("scenepilot:commit-project-document", { path }),
  onAction(callback) {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on("scenepilot:action", listener);
    return () => ipcRenderer.removeListener("scenepilot:action", listener);
  },
  getMediaCapabilities: () => ipcRenderer.invoke("scenepilot:media-capabilities"),
  segmentRotoFrame: (request) => ipcRenderer.invoke("scenepilot:native-roto-segment", request),
  writeRotoCache: (request) => ipcRenderer.invoke("scenepilot:roto-cache-write", request),
  readRotoCache: (request) => ipcRenderer.invoke("scenepilot:roto-cache-read", request),
  clearRotoCache: (cacheKey) => ipcRenderer.invoke("scenepilot:roto-cache-clear", { cacheKey }),
  writeInpaintCache: (request) => ipcRenderer.invoke("scenepilot:inpaint-cache-write", request),
  writeGeneratedAudio: (request) => ipcRenderer.invoke("scenepilot:generated-audio-write", request),
  readInpaintCache: (cacheKey) => ipcRenderer.invoke("scenepilot:inpaint-cache-read", { cacheKey }),
  clearInpaintCache: (cacheKey) => ipcRenderer.invoke("scenepilot:inpaint-cache-clear", { cacheKey }),
  neuralInpaint: (request) => ipcRenderer.invoke("scenepilot:neural-inpaint", request),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  probeMedia: (sourcePath) => ipcRenderer.invoke("scenepilot:probe-media", { sourcePath }),
  createProxy: (request) => ipcRenderer.invoke("scenepilot:create-proxy", request),
  nativeRender: (request) => ipcRenderer.invoke("scenepilot:native-render", request),
  beginPcmMix: () => ipcRenderer.invoke("scenepilot:pcm-begin"),
  writePcmMix: (request) => ipcRenderer.invoke("scenepilot:pcm-write", request),
  finishPcmMix: (token) => ipcRenderer.invoke("scenepilot:pcm-finish", { token }),
  releasePcmMix: (token) => ipcRenderer.invoke("scenepilot:pcm-release", { token }),
  revealOutput: (sourcePath) => ipcRenderer.invoke("scenepilot:reveal-output", { sourcePath }),
  cancelMediaJob: (jobId) => ipcRenderer.invoke("scenepilot:cancel-media-job", { jobId }),
  logRenderEvent: (entry) => ipcRenderer.invoke("scenepilot:render-log", entry),
  loadRenderQueue: () => ipcRenderer.invoke("scenepilot:load-render-queue"),
  saveRenderQueue: (request) => ipcRenderer.invoke("scenepilot:save-render-queue", request),
  collectProject: (request) => ipcRenderer.invoke("scenepilot:collect-project", request),
  saveProjectDocument: (request) => ipcRenderer.invoke("scenepilot:save-project-document", request),
  openProjectDocument: (options) => ipcRenderer.invoke("scenepilot:open-project-document", options),
  registerLocalMedia: (request) => ipcRenderer.invoke("scenepilot:register-local-media", request),
  journalProject: (request) => ipcRenderer.invoke("scenepilot:journal-project", request),
  onMediaProgress(callback) {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("scenepilot:media-progress", listener);
    return () => ipcRenderer.removeListener("scenepilot:media-progress", listener);
  },
});
