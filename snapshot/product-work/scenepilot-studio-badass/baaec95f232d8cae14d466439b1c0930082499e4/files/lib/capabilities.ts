// What the current browser can actually do. The renderer needs WebCodecs +
// OffscreenCanvas, which today means Chromium (Chrome/Edge/Arc/Brave). Safari
// and Firefox can browse and analyse but can't encode, so we detect that up
// front and tell the user, instead of letting them build an edit and only fail
// when they hit Render.

export type RenderSupport = {
  /** True when a render can actually run. */
  supported: boolean;
  /** Human names of the missing pieces, e.g. ["VideoEncoder"]. */
  missing: string[];
  /** A ready-to-show sentence: empty when supported. */
  message: string;
};

export type ExportProfile = {
  format: "mp4-h264" | "mp4-hevc" | "webm-vp9" | "webm-vp9-alpha";
  width: number;
  height: number;
  frameRate: number;
  requiresWebGL?: boolean;
};

export type ExportProfileSupport = {
  supported: boolean;
  checking: boolean;
  codec: string;
  message: string;
};

type CapabilityScope = Record<string, unknown>;

/**
 * Check the APIs the export pipeline needs. Pass a fake scope in tests; defaults
 * to the real global. Pure — reads capability presence, never invokes anything.
 */
export function checkRenderSupport(scope: CapabilityScope = globalThis): RenderSupport {
  const needed = ["VideoEncoder", "VideoDecoder", "OffscreenCanvas"];
  const missing = needed.filter((name) => typeof scope[name] === "undefined");
  const supported = missing.length === 0;
  return {
    supported,
    missing,
    message: supported
      ? ""
      : "This browser can’t export video yet — it’s missing WebCodecs. Open ScenePilot in Chrome, Edge, or another Chromium browser to render. You can still explore the editor here.",
  };
}

const codecForFormat = (format: ExportProfile["format"]) => {
  if (format === "mp4-hevc") return "hev1.1.6.L150.B0";
  if (format.startsWith("webm")) return "vp09.00.10.08";
  return "avc1.640028";
};

/**
 * Prove that the exact selected output profile is encodable before it enters
 * the queue. WebCodecs support is profile- and resolution-specific; detecting
 * only the existence of VideoEncoder creates false promises on real machines.
 */
export async function checkExportProfile(
  profile: ExportProfile,
  scope: CapabilityScope = globalThis,
): Promise<ExportProfileSupport> {
  const base = checkRenderSupport(scope);
  const codec = codecForFormat(profile.format);
  if (!base.supported) return { supported: false, checking: false, codec, message: base.message };

  const Encoder = scope.VideoEncoder as { isConfigSupported?: (config: Record<string, unknown>) => Promise<{ supported?: boolean }> } | undefined;
  if (!Encoder?.isConfigSupported) {
    return { supported: false, checking: false, codec, message: "This render engine cannot validate the selected codec profile." };
  }

  if (profile.format === "webm-vp9-alpha" && profile.requiresWebGL) {
    return { supported: false, checking: false, codec, message: "Transparent export cannot preserve the active sequence grade or feedback effects. Disable them or use an opaque master." };
  }

  if (profile.requiresWebGL) {
    try {
      const Canvas = scope.OffscreenCanvas as (new (width: number, height: number) => { getContext?: (kind: string, options?: unknown) => unknown }) | undefined;
      const canvas = Canvas ? new Canvas(16, 16) : null;
      if (!canvas?.getContext?.("webgl", { preserveDrawingBuffer: true })) {
        return { supported: false, checking: false, codec, message: "The selected look needs WebGL, but this device cannot reproduce it during export." };
      }
    } catch {
      return { supported: false, checking: false, codec, message: "The selected look cannot be reproduced by this device during export." };
    }
  }

  try {
    const result = await Encoder.isConfigSupported({
      codec,
      width: Math.max(2, Math.round(profile.width / 2) * 2),
      height: Math.max(2, Math.round(profile.height / 2) * 2),
      bitrate: profile.width >= 3840 || profile.height >= 2160 ? 40_000_000 : 14_000_000,
      framerate: profile.frameRate,
      hardwareAcceleration: "no-preference",
      // Mediabunny preserves VP9 alpha using a second grayscale VP9 encoder
      // and WebM BlockAdditional data. Each WebCodecs encoder is opaque; asking
      // Chromium for native alpha rejects this supported dual-encoder route.
      alpha: "discard",
    });
    return result.supported
      ? { supported: true, checking: false, codec, message: "Selected codec, resolution and frame rate are supported." }
      : { supported: false, checking: false, codec, message: "This device cannot encode the selected codec, resolution and frame rate." };
  } catch {
    return { supported: false, checking: false, codec, message: "The selected export profile failed its codec capability check." };
  }
}
