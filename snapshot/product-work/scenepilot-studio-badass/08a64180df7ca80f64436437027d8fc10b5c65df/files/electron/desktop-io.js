import { fileURLToPath, pathToFileURL } from "node:url";

export const EDITOR_SESSION_PARTITION = "persist:scenepilot";

export function installLinkedMediaProtocol(editorSession, mediaPaths, developmentUrl = "") {
  editorSession.protocol.handle("scenepilot-media", (request) => {
    const token = new URL(request.url).pathname.replace(/^\//, "");
    return linkedMediaResponse(request, mediaPaths.get(token), (url, options) => editorSession.fetch(url, options), developmentUrl);
  });
}

/** File-backed media stays streamed; only the local editor origin receives CORS access. */
export async function linkedMediaResponse(request, filePath, fetchFile, developmentUrl = "") {
  if (!filePath) return new Response("Media cache entry not found", { status: 404 });
  const origin = request.headers.get("Origin") ?? "null";
  if (origin !== "null" && (!developmentUrl || origin !== new URL(developmentUrl).origin)) return new Response("Media origin denied", { status: 403 });
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405 });
  const headers = new Headers();
  const range = request.headers.get("Range");
  if (range) headers.set("Range", range);
  const response = await fetchFile(pathToFileURL(filePath).href, { method: request.method, headers });
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", origin);
  responseHeaders.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
}

export function isTrustedEditorUrl(value, entry, developmentUrl = "") {
  try {
    const target = new URL(value);
    if (target.protocol === "file:") return fileURLToPath(target) === entry;
    return Boolean(developmentUrl) && target.origin === new URL(developmentUrl).origin;
  } catch { return false; }
}

/** Probe bounded batches rather than spawning one ffprobe process per asset. */
export async function mapConcurrent(items, mapper, limit = 4) {
  const result = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, limit)) }, async () => {
    while (next < items.length) { const index = next++; result[index] = await mapper(items[index], index); }
  }));
  return result;
}
