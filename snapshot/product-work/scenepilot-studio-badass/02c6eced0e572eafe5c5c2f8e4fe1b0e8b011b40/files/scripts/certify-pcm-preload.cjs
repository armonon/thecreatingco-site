/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("pcmCertificateBridge", {
  beginPcmMix: () => ipcRenderer.invoke("qa:pcm-begin"),
  writePcmMix: request => ipcRenderer.invoke("qa:pcm-write", request),
  finishPcmMix: token => ipcRenderer.invoke("qa:pcm-finish", token),
  releasePcmMix: token => ipcRenderer.invoke("qa:pcm-release", token),
});
