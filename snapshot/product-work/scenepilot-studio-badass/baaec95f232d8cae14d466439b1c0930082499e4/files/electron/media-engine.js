import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { access, copyFile, mkdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;
const NATIVE_STATIC_EFFECT_TYPES = new Set(["blur", "contrast", "saturate", "hue", "monochrome", "sepia", "invert"]);

function runCapture(command, args, { timeoutMs = 8_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.stdout.on("data", (chunk) => { if (stdout.length < MAX_CAPTURE_BYTES) stdout += chunk; });
    child.stderr.on("data", (chunk) => { if (stderr.length < MAX_CAPTURE_BYTES) stderr += chunk; });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (timedOut) reject(new Error(`${path.basename(command)} timed out after ${Math.round(timeoutMs / 1000)}s`));
      else if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(command)} failed (${signal ?? code}): ${(stderr || stdout).trim().slice(-1200)}`));
    });
  });
}

async function firstWorking(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    try {
      if (path.isAbsolute(candidate)) await access(candidate);
      await runCapture(candidate, ["-version"], { timeoutMs: 3_000 });
      return candidate;
    } catch { /* try the next bundled or system tool */ }
  }
  return null;
}

export function mediaToolCandidates({ resourcesPath = "", env = process.env } = {}) {
  const bundled = resourcesPath ? path.join(resourcesPath, "media-tools") : "";
  return {
    ffmpeg: [env.SCENEPILOT_FFMPEG_PATH, bundled && path.join(bundled, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"), "ffmpeg"],
    ffprobe: [env.SCENEPILOT_FFPROBE_PATH, bundled && path.join(bundled, process.platform === "win32" ? "ffprobe.exe" : "ffprobe"), "ffprobe"],
  };
}

export async function detectNativeMediaEngine(options = {}) {
  const candidates = mediaToolCandidates(options);
  const [ffmpeg, ffprobe] = await Promise.all([firstWorking(candidates.ffmpeg), firstWorking(candidates.ffprobe)]);
  if (!ffmpeg || !ffprobe) {
    return { available: false, ffmpeg, ffprobe, encoder: null, hardware: false, message: "Native media tools unavailable — WebCodecs fallback active" };
  }
  let encoders = "";
  try { encoders = (await runCapture(ffmpeg, ["-hide_banner", "-encoders"])).stdout; } catch { /* software proxy remains available */ }
  const encoder = process.platform === "darwin" && /h264_videotoolbox/.test(encoders)
    ? "h264_videotoolbox"
    : /h264_nvenc/.test(encoders)
      ? "h264_nvenc"
      : /h264_vaapi/.test(encoders)
        ? "h264_vaapi"
        : "libx264";
  const hardware = encoder !== "libx264";
  return {
    available: true,
    ffmpeg,
    ffprobe,
    encoder,
    hardware,
    encoders: {
      h264: encoder,
      hevc: process.platform === "darwin" && /hevc_videotoolbox/.test(encoders) ? "hevc_videotoolbox" : /libx265/.test(encoders) ? "libx265" : null,
      prores: /prores_ks/.test(encoders) ? "prores_ks" : null,
      vp9: /libvpx-vp9/.test(encoders) ? "libvpx-vp9" : null,
    },
    transparentVideo: /prores_ks|libvpx-vp9/.test(encoders),
    imageSequences: true,
    message: `${hardware ? "Hardware" : "Software"} FFmpeg engine ready · ${encoder}`,
  };
}

export async function probeMedia(engine, sourcePath) {
  if (!engine?.ffprobe) throw new Error("The native media probe is unavailable.");
  if (typeof sourcePath !== "string" || !sourcePath.trim()) throw new Error("The media probe needs a source file path.");
  const { stdout } = await runCapture(engine.ffprobe, ["-v", "error", "-show_format", "-show_streams", "-of", "json", sourcePath], { timeoutMs: 20_000 });
  let raw;
  try {
    raw = JSON.parse(stdout);
  } catch {
    // ffprobe emits nothing usable on an unreadable/corrupt/unsupported file.
    throw new Error("Couldn't read that media file — it may be corrupt or an unsupported format.");
  }
  if (!raw || typeof raw !== "object") throw new Error("The media probe returned no information for that file.");
  const video = Array.isArray(raw.streams) ? raw.streams.find((stream) => stream.codec_type === "video") : null;
  const audio = Array.isArray(raw.streams) ? raw.streams.find((stream) => stream.codec_type === "audio") : null;
  const duration = Number(raw.format?.duration ?? video?.duration ?? audio?.duration ?? 0);
  const parseRate = (value) => {
    const [numerator, denominator = "1"] = String(value ?? "0/1").split("/");
    const n = Number(numerator);
    const d = Number(denominator);
    return d && Number.isFinite(n) && Number.isFinite(d) ? n / d : 0;
  };
  const averageFrameRate = video ? parseRate(video.avg_frame_rate) : 0;
  const realFrameRate = video ? parseRate(video.r_frame_rate) : 0;
  const variableFrameRate = !!video && averageFrameRate > 0 && realFrameRate > 0 && Math.abs(averageFrameRate - realFrameRate) > 0.01;
  const transfer = String(video?.color_transfer ?? "unknown");
  const colorPrimaries = String(video?.color_primaries ?? "unknown");
  const hdr = /smpte2084|arib-std-b67/i.test(transfer) || /bt2020/i.test(colorPrimaries);
  const rotation = Number(video?.tags?.rotate ?? video?.side_data_list?.find((item) => Number.isFinite(Number(item.rotation)))?.rotation ?? 0) || 0;
  return {
    duration: Number.isFinite(duration) ? duration : 0,
    format: String(raw.format?.format_long_name ?? raw.format?.format_name ?? "Unknown"),
    size: Number(raw.format?.size ?? 0) || 0,
    video: video ? {
      codec: String(video.codec_name ?? "unknown"),
      width: Number(video.width ?? 0) || 0,
      height: Number(video.height ?? 0) || 0,
      pixelFormat: String(video.pix_fmt ?? "unknown"),
      colorSpace: String(video.color_space ?? "unknown"),
      colorPrimaries,
      colorTransfer: transfer,
      averageFrameRate,
      realFrameRate,
      variableFrameRate,
      bitDepth: Number(video.bits_per_raw_sample ?? /p(\d{2})/.exec(String(video.pix_fmt ?? ""))?.[1] ?? 8) || 8,
      rotation,
      hdr,
    } : null,
    audio: audio ? {
      codec: String(audio.codec_name ?? "unknown"),
      channels: Number(audio.channels ?? 0) || 0,
      sampleRate: Number(audio.sample_rate ?? 0) || 0,
      channelLayout: String(audio.channel_layout ?? "unknown"),
      bitRate: Number(audio.bit_rate ?? 0) || 0,
    } : null,
  };
}

export function buildProxyArgs({ sourcePath, outputPath, maxWidth = 1280, encoder = "libx264" }) {
  if (typeof sourcePath !== "string" || !sourcePath.trim()) throw new Error("A proxy build needs a source file path.");
  if (typeof outputPath !== "string" || !outputPath.trim()) throw new Error("A proxy build needs an output path.");
  const safeWidth = Math.max(320, Math.min(7680, Math.round(finite(maxWidth, 1280))));
  const videoCodecArgs = encoder === "h264_videotoolbox"
    ? ["-c:v", encoder, "-allow_sw", "1", "-b:v", "6M"]
    : encoder === "h264_nvenc"
      ? ["-c:v", encoder, "-preset", "p4", "-b:v", "6M"]
      : ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20"];
  return [
    "-hide_banner", "-y", "-i", sourcePath,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", `scale=min(${safeWidth}\\,iw):-2:flags=lanczos`,
    ...videoCodecArgs,
    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart", "-progress", "pipe:1", "-nostats", outputPath,
  ];
}

export function progressSeconds(fields) {
  // FFmpeg's legacy out_time_ms field is also measured in microseconds.
  for (const value of [fields.out_time_us, fields.out_time_ms]) {
    const microseconds = Number(value);
    if (Number.isFinite(microseconds) && microseconds > 0) return microseconds / 1_000_000;
  }
  const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(fields.out_time ?? "");
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : 0;
}

/** One tracker per job: timestamps may reset or become N/A during muxing.
 * Completion belongs to the caller after the output has been finalized. */
export function createEncodingProgress(duration) {
  let highest = 0;
  return (fields) => {
    const candidate = Number.isFinite(duration) && duration > 0
      ? progressSeconds(fields) / duration : 0.5;
    highest = Math.max(highest, Math.min(0.995, candidate));
    return highest;
  };
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/** Normalize the untrusted renderer request before it reaches FFmpeg. Keeping
 * this pure and exported lets the desktop IPC boundary share the exact same
 * contract as the native engine tests. Unsupported effects are omitted here,
 * but the renderer eligibility gate rejects them before this point so they can
 * never disappear silently from a delivered master. */
export function sanitizeNativeRenderPlan(plan = {}, format = "mp4-h264") {
  const clips = (Array.isArray(plan.clips) ? plan.clips : []).slice(0, 10_000).map((clip, index) => {
    const sourcePath = typeof clip?.sourcePath === "string" ? clip.sourcePath : "";
    if (!sourcePath.trim() || !path.isAbsolute(sourcePath) || sourcePath.includes("\0")) {
      throw new Error(`Native render clip ${index + 1} of ${Math.max(1, plan.clips?.length ?? 0)} has no valid source file path.`);
    }
    return {
      sourcePath,
      sourceStart: Math.max(0, finite(clip.sourceStart)),
      duration: Math.max(0.02, Math.min(86_400, finite(clip.duration, 0.02))),
      playbackRate: Math.max(0.05, Math.min(16, finite(clip.playbackRate, 1))),
      fadeIn: Math.max(0, Math.min(10, finite(clip.fadeIn))),
      fadeOut: Math.max(0, Math.min(10, finite(clip.fadeOut))),
      flipH: clip.flipH === true,
      flipV: clip.flipV === true,
      reversed: clip.reversed === true,
      color: {
        exposure: Math.max(0.1, Math.min(3, finite(clip.color?.exposure, 1))),
        contrast: Math.max(0.1, Math.min(3, finite(clip.color?.contrast, 1))),
        saturation: Math.max(0, Math.min(3, finite(clip.color?.saturation, 1))),
        hue: Math.max(-180, Math.min(180, finite(clip.color?.hue))),
      },
      effects: (Array.isArray(clip.effects) ? clip.effects : []).slice(0, 64)
        .filter((effect) => NATIVE_STATIC_EFFECT_TYPES.has(String(effect?.type)))
        .map((effect) => ({
          type: String(effect.type),
          amount: Math.max(0, Math.min(1, finite(effect.amount))),
          enabled: effect.enabled === true,
        })),
    };
  });
  if (!clips.length) throw new Error("The native render plan has no picture clips.");
  const soundtrackPath = typeof plan.soundtrackPath === "string" && plan.soundtrackPath.trim()
    ? plan.soundtrackPath
    : "";
  if (soundtrackPath && (!path.isAbsolute(soundtrackPath) || soundtrackPath.includes("\0"))) {
    throw new Error("The native render soundtrack needs a valid local file path.");
  }
  const audioClips = (Array.isArray(plan.audioClips) ? plan.audioClips : []).slice(0, 2_000).map((clip, index) => {
    const sourcePath = typeof clip?.sourcePath === "string" ? clip.sourcePath : "";
    if (!sourcePath.trim() || !path.isAbsolute(sourcePath) || sourcePath.includes("\0")) {
      throw new Error(`Native audio clip ${index + 1} has no valid source file path.`);
    }
    const duration = Math.max(0.02, Math.min(86_400, finite(clip.duration, 0.02)));
    return {
      sourcePath,
      start: Math.max(0, Math.min(86_400, finite(clip.start))),
      sourceStart: Math.max(0, Math.min(86_400, finite(clip.sourceStart))),
      duration,
      gain: Math.max(0, Math.min(8, finite(clip.gain, 1))),
      pan: Math.max(-1, Math.min(1, finite(clip.pan))),
      fadeIn: Math.max(0, Math.min(duration, finite(clip.fadeIn))),
      fadeOut: Math.max(0, Math.min(duration, finite(clip.fadeOut))),
      muted: clip.muted === true,
      automation: (Array.isArray(clip.automation) ? clip.automation : []).slice(0, 256)
        .map((point) => ({ time: Math.max(0, Math.min(duration, finite(point?.time))), gain: Math.max(0, Math.min(8, finite(point?.gain, 1))) }))
        .sort((a, b) => a.time - b.time),
      processing: {
        highPassHz: Math.max(20, Math.min(400, finite(clip.processing?.highPassHz, 20))),
        lowDb: Math.max(-18, Math.min(18, finite(clip.processing?.lowDb))),
        midDb: Math.max(-18, Math.min(18, finite(clip.processing?.midDb))),
        highDb: Math.max(-18, Math.min(18, finite(clip.processing?.highDb))),
        compressorThreshold: Math.max(-60, Math.min(0, finite(clip.processing?.compressorThreshold, -18))),
        compressorRatio: Math.max(1, Math.min(20, finite(clip.processing?.compressorRatio, 2))),
        limiter: clip.processing?.limiter !== false,
        makeupGain: Math.max(0.25, Math.min(4, finite(clip.processing?.makeupGain, 1))),
      },
    };
  });
  return {
    clips,
    audioClips,
    soundtrackPath,
    width: Math.max(16, Math.min(7680, Math.round(finite(plan.width, 1920) / 2) * 2)),
    height: Math.max(16, Math.min(7680, Math.round(finite(plan.height, 1080) / 2) * 2)),
    frameRate: Math.max(1, Math.min(120, finite(plan.frameRate, 30))),
    duration: Math.max(0.05, Math.min(86_400, finite(plan.duration, 0.05))),
    rangeStart: Math.max(0, finite(plan.rangeStart)),
    masterGain: Math.max(0, Math.min(4, finite(plan.masterGain, 1))),
    format: format === "mp4-hevc" ? "mp4-hevc" : "mp4-h264",
  };
}

function automationVolumeExpression(points = [], duration = 0) {
  const sorted = [...points].filter((point) => point.time <= duration).sort((a, b) => a.time - b.time);
  if (!sorted.length) return "1";
  if (sorted[0].time > 0) sorted.unshift({ time: 0, gain: sorted[0].gain });
  let expression = finite(sorted.at(-1)?.gain, 1).toFixed(6);
  for (let index = sorted.length - 2; index >= 0; index--) {
    const left = sorted[index];
    const right = sorted[index + 1];
    const span = Math.max(0.000001, right.time - left.time);
    const slope = (right.gain - left.gain) / span;
    const line = `${left.gain.toFixed(6)}+(${slope.toFixed(8)})*(t-${left.time.toFixed(6)})`;
    expression = `if(lt(t\\,${right.time.toFixed(6)})\\,${line}\\,${expression})`;
  }
  return expression;
}

/** Build one deterministic FFmpeg audio strip. The same serialized parameters
 * used by ScenePilot's preview mixer are baked into Desktop Pro masters. */
export function buildNativeAudioClipFilters(clip, inputIndex, label) {
  const duration = Math.max(0.02, finite(clip.duration, 0.02));
  const gain = Math.max(0, Math.min(8, finite(clip.gain, 1)));
  const pan = Math.max(-1, Math.min(1, finite(clip.pan)));
  const left = Math.cos((pan + 1) * Math.PI / 4);
  const right = Math.sin((pan + 1) * Math.PI / 4);
  const processing = clip.processing ?? {};
  const threshold = Math.max(0.001, 10 ** (Math.max(-60, Math.min(0, finite(processing.compressorThreshold, -18))) / 20));
  const filters = [
    `atrim=duration=${duration.toFixed(6)}`,
    "asetpts=PTS-STARTPTS",
    `volume='${gain.toFixed(6)}*(${automationVolumeExpression(clip.automation, duration)})':eval=frame`,
  ];
  if (clip.fadeIn > 0) filters.push(`afade=t=in:st=0:d=${Math.min(duration, finite(clip.fadeIn)).toFixed(6)}`);
  if (clip.fadeOut > 0) filters.push(`afade=t=out:st=${Math.max(0, duration - finite(clip.fadeOut)).toFixed(6)}:d=${Math.min(duration, finite(clip.fadeOut)).toFixed(6)}`);
  filters.push("aformat=channel_layouts=stereo", `pan=stereo|c0=${left.toFixed(6)}*c0|c1=${right.toFixed(6)}*c1`);
  if (finite(processing.highPassHz, 20) > 20) filters.push(`highpass=f=${finite(processing.highPassHz, 20).toFixed(3)}`);
  if (finite(processing.lowDb)) filters.push(`equalizer=f=100:t=q:w=1:g=${finite(processing.lowDb).toFixed(3)}`);
  if (finite(processing.midDb)) filters.push(`equalizer=f=1000:t=q:w=1:g=${finite(processing.midDb).toFixed(3)}`);
  if (finite(processing.highDb)) filters.push(`equalizer=f=8000:t=q:w=1:g=${finite(processing.highDb).toFixed(3)}`);
  filters.push(`acompressor=threshold=${threshold.toFixed(6)}:ratio=${Math.max(1, Math.min(20, finite(processing.compressorRatio, 2))).toFixed(3)}:makeup=${Math.max(0.25, Math.min(4, finite(processing.makeupGain, 1))).toFixed(3)}`);
  if (processing.limiter !== false) filters.push("alimiter=limit=0.95:level=false");
  if (clip.start > 0) filters.push(`adelay=${Math.round(finite(clip.start) * 1000)}:all=1`);
  return `[${inputIndex}:a:0]${filters.join(",")}[${label}]`;
}

/** Static per-clip effects that FFmpeg can reproduce exactly enough for the
 * native path. Animated/audio-driven effects stay on the parity renderer. */
function rgbLut(expression) {
  return `lutrgb=r='${expression}':g='${expression}':b='${expression}'`;
}

function colorMatrixFilter(rows) {
  const value = (number) => (Math.abs(number) < 5e-7 ? 0 : number).toFixed(6);
  return `colorchannelmixer=rr=${value(rows[0][0])}:rg=${value(rows[0][1])}:rb=${value(rows[0][2])}:gr=${value(rows[1][0])}:gg=${value(rows[1][1])}:gb=${value(rows[1][2])}:br=${value(rows[2][0])}:bg=${value(rows[2][1])}:bb=${value(rows[2][2])}`;
}

/** CSS Filter Effects hue-rotate matrix, used by CanvasPreview. */
function cssHueMatrix(degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    [.213 + cosine * .787 - sine * .213, .715 - cosine * .715 - sine * .715, .072 - cosine * .072 + sine * .928],
    [.213 - cosine * .213 + sine * .143, .715 + cosine * .285 + sine * .140, .072 - cosine * .072 - sine * .283],
    [.213 - cosine * .213 - sine * .787, .715 - cosine * .715 + sine * .715, .072 + cosine * .928 + sine * .072],
  ];
}

/** CSS Filter Effects saturate matrix. Unlike FFmpeg's `eq=saturation`, this
 * uses the same Rec.709 coefficients and clipping contract as Canvas 2D. */
function cssSaturationMatrix(amount) {
  return [
    [.213 + .787 * amount, .715 - .715 * amount, .072 - .072 * amount],
    [.213 - .213 * amount, .715 + .285 * amount, .072 - .072 * amount],
    [.213 - .213 * amount, .715 - .715 * amount, .072 + .928 * amount],
  ];
}

/** CSS brightness and contrast are channel-local affine transforms. Expressing
 * them as RGB LUTs mirrors the Canvas filter contract; FFmpeg's `eq` brightness
 * is additive and previously changed the image differently from Program view. */
export function buildNativeColorFilters(color = {}) {
  const exposure = Math.max(0.1, Math.min(3, finite(color.exposure, 1)));
  const contrast = Math.max(0.1, Math.min(3, finite(color.contrast, 1)));
  const saturation = Math.max(0, Math.min(3, finite(color.saturation, 1)));
  const hue = Math.max(-180, Math.min(180, finite(color.hue)));
  const filters = [];
  if (Math.abs(exposure - 1) > 1e-6) filters.push(rgbLut(`clipval*${exposure.toFixed(6)}`));
  if (Math.abs(contrast - 1) > 1e-6) filters.push(rgbLut(`(clipval-127.5)*${contrast.toFixed(6)}+127.5`));
  if (Math.abs(saturation - 1) > 1e-6) filters.push(saturation <= 2
    ? colorMatrixFilter(cssSaturationMatrix(saturation))
    : `eq=saturation=${saturation.toFixed(6)}`);
  if (Math.abs(hue) > 1e-6) filters.push(colorMatrixFilter(cssHueMatrix(hue)));
  return filters;
}

export function buildNativeEffectFilters(effects = []) {
  const filters = [];
  const matrixMix = (identity, target, amount) => (identity * (1 - amount) + target * amount).toFixed(6);
  for (const effect of effects) {
    if (!effect?.enabled) continue;
    const amount = Math.max(0, Math.min(1, finite(effect.amount)));
    if (amount <= 0) continue;
    if (effect.type === "blur") filters.push(`gblur=sigma=${(amount * 12).toFixed(3)}`);
    else if (effect.type === "contrast") {
      const contrast = 1 + amount * 1.5;
      filters.push(rgbLut(`(clipval-127.5)*${contrast.toFixed(6)}+127.5`));
    }
    else if (effect.type === "saturate") {
      const saturation = 1 + amount * 2.5;
      filters.push(saturation <= 2 ? colorMatrixFilter(cssSaturationMatrix(saturation)) : `eq=saturation=${saturation.toFixed(4)}`);
    }
    else if (effect.type === "hue") filters.push(colorMatrixFilter(cssHueMatrix(amount * 180)));
    else if (effect.type === "monochrome") filters.push(colorMatrixFilter([
      [Number(matrixMix(1, .2126, amount)), Number(matrixMix(0, .7152, amount)), Number(matrixMix(0, .0722, amount))],
      [Number(matrixMix(0, .2126, amount)), Number(matrixMix(1, .7152, amount)), Number(matrixMix(0, .0722, amount))],
      [Number(matrixMix(0, .2126, amount)), Number(matrixMix(0, .7152, amount)), Number(matrixMix(1, .0722, amount))],
    ]));
    else if (effect.type === "sepia") {
      filters.push(`colorchannelmixer=rr=${matrixMix(1, .393, amount)}:rg=${matrixMix(0, .769, amount)}:rb=${matrixMix(0, .189, amount)}:gr=${matrixMix(0, .349, amount)}:gg=${matrixMix(1, .686, amount)}:gb=${matrixMix(0, .168, amount)}:br=${matrixMix(0, .272, amount)}:bg=${matrixMix(0, .534, amount)}:bb=${matrixMix(1, .131, amount)}`);
    } else if (effect.type === "invert") {
      filters.push(rgbLut(`clipval*${(1 - 2 * amount).toFixed(4)}+255*${amount.toFixed(4)}`));
    }
  }
  return filters;
}

function outputVideoArgs({ encoder, format, width }) {
  const bitRate = Math.max(8_000_000, Math.round(width >= 3000 ? 45_000_000 : width >= 1900 ? 22_000_000 : 12_000_000));
  if (format === "mp4-hevc") {
    const codec = encoder === "hevc_videotoolbox" || encoder === "libx265" ? encoder : "libx265";
    return codec === "hevc_videotoolbox"
      ? ["-c:v", codec, "-allow_sw", "1", "-b:v", String(bitRate), "-tag:v", "hvc1"]
      : ["-c:v", codec, "-preset", "medium", "-crf", "20", "-tag:v", "hvc1"];
  }
  if (encoder === "h264_videotoolbox") return ["-c:v", encoder, "-allow_sw", "1", "-b:v", String(bitRate), "-profile:v", "high"];
  if (encoder === "h264_nvenc") return ["-c:v", encoder, "-preset", "p5", "-b:v", String(bitRate), "-profile:v", "high"];
  return ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high"];
}

/**
 * Build an FFmpeg filter graph for ScenePilot's native Desktop cut engine.
 * This path deliberately handles the deterministic editorial core first:
 * source trims, retimes, clip colour, concat, master soundtrack and final
 * scaling. Layered comps/effects remain on the parity renderer until they have
 * equivalent native filters, so the application never silently drops a look.
 */
export function buildNativeSequenceRenderArgs({
  clips = [], audioClips = [], soundtrackPath = "", outputPath, width = 1920, height = 1080,
  frameRate = 30, duration = 0, rangeStart = 0, encoder = "libx264",
  hevcEncoder = null, format = "mp4-h264", masterGain = 1,
}) {
  if (!Array.isArray(clips) || !clips.length) throw new Error("A native render needs at least one picture clip.");
  if (typeof outputPath !== "string" || !outputPath.trim()) throw new Error("A native render needs an output path.");
  // Fail loud on a clip with no usable source file rather than handing FFmpeg a
  // blank `-i` and getting a cryptic decode error mid-render.
  clips.forEach((clip, index) => {
    if (!clip || typeof clip.sourcePath !== "string" || !clip.sourcePath.trim()) {
      throw new Error(`Native render clip ${index + 1} of ${clips.length} has no source file path.`);
    }
  });
  const safeWidth = Math.max(16, Math.min(7680, Math.round(finite(width, 1920) / 2) * 2));
  const safeHeight = Math.max(16, Math.min(7680, Math.round(finite(height, 1080) / 2) * 2));
  const safeFrameRate = Math.max(1, Math.min(120, finite(frameRate, 30)));
  const safeDuration = Math.max(0.05, finite(duration, clips.reduce((sum, clip) => sum + finite(clip.duration), 0)));
  const args = ["-hide_banner", "-y"];
  const filters = [];
  const videoLabels = [];

  clips.forEach((clip, index) => {
    const clipDuration = Math.max(0.02, finite(clip.duration, 0.02));
    const playbackRate = Math.max(0.05, Math.min(16, finite(clip.playbackRate, 1)));
    const sourceDuration = clipDuration * playbackRate;
    args.push("-ss", String(Math.max(0, finite(clip.sourceStart))), "-t", String(sourceDuration), "-i", clip.sourcePath);
    const color = clip.color ?? {};
    const exposure = Math.max(0.1, Math.min(3, finite(color.exposure, 1)));
    const contrast = Math.max(0.1, Math.min(3, finite(color.contrast, 1)));
    const saturation = Math.max(0, Math.min(3, finite(color.saturation, 1)));
    const hue = Math.max(-180, Math.min(180, finite(color.hue, 0)));
    const nativeColor = buildNativeColorFilters({ exposure, contrast, saturation, hue });
    const nativeEffects = buildNativeEffectFilters(clip.effects);
    const fadeIn = Math.max(0, Math.min(clipDuration, finite(clip.fadeIn)));
    const fadeOut = Math.max(0, Math.min(clipDuration, finite(clip.fadeOut)));
    const fades = [
      fadeIn > 0 ? `fade=t=in:st=0:d=${fadeIn.toFixed(6)}` : "",
      fadeOut > 0 ? `fade=t=out:st=${Math.max(0, clipDuration - fadeOut).toFixed(6)}:d=${fadeOut.toFixed(6)}` : "",
    ].filter(Boolean);
    // Clip mirror (matches the web compositor's flipH/flipV) — also how rotated
    // or upside-down footage is corrected on the native fast-path.
    const flips = [
      clip.flipH ? "hflip" : "",
      clip.flipV ? "vflip" : "",
    ].filter(Boolean);
    const label = `v${index}`;
    filters.push(
      `[${index}:v:0]${clip.reversed ? "reverse," : ""}setpts=(PTS-STARTPTS)/${playbackRate.toFixed(6)},` +
      `scale=${safeWidth}:${safeHeight}:force_original_aspect_ratio=increase:flags=lanczos,` +
      `crop=${safeWidth}:${safeHeight},fps=${safeFrameRate},setsar=1,` +
      `${flips.length ? `${flips.join(",")},` : ""}` +
      `${nativeColor.length ? `${nativeColor.join(",")},` : ""}` +
      `${nativeEffects.length ? `${nativeEffects.join(",")},` : ""}${fades.length ? `${fades.join(",")},` : ""}format=yuv420p[${label}]`,
    );
    videoLabels.push(`[${label}]`);
  });
  filters.push(`${videoLabels.join("")}concat=n=${videoLabels.length}:v=1:a=0,trim=duration=${safeDuration.toFixed(6)},setpts=PTS-STARTPTS[vout]`);

  let audioMap = [];
  const audioLabels = [];
  if (soundtrackPath) {
    const audioIndex = clips.length;
    args.push("-ss", String(Math.max(0, finite(rangeStart))), "-t", String(safeDuration), "-i", soundtrackPath);
    filters.push(`[${audioIndex}:a:0]atrim=duration=${safeDuration.toFixed(6)},asetpts=PTS-STARTPTS,volume=${Math.max(0, Math.min(4, finite(masterGain, 1))).toFixed(4)},aformat=channel_layouts=stereo[amusic]`);
    audioLabels.push("[amusic]");
  }
  audioClips.filter((clip) => !clip.muted && finite(clip.gain, 1) > 0).forEach((clip, index) => {
    const inputIndex = clips.length + (soundtrackPath ? 1 : 0) + index;
    args.push("-ss", String(Math.max(0, finite(clip.sourceStart))), "-t", String(Math.max(0.02, finite(clip.duration, 0.02))), "-i", clip.sourcePath);
    const label = `a${index}`;
    filters.push(buildNativeAudioClipFilters(clip, inputIndex, label));
    audioLabels.push(`[${label}]`);
  });
  if (audioLabels.length) {
    filters.push(audioLabels.length === 1
      ? `${audioLabels[0]}atrim=duration=${safeDuration.toFixed(6)},aresample=48000[aout]`
      : `${audioLabels.join("")}amix=inputs=${audioLabels.length}:duration=longest:normalize=0,atrim=duration=${safeDuration.toFixed(6)},aresample=48000[aout]`);
    audioMap = ["-map", "[aout]", "-c:a", "aac", "-b:a", "320k", "-ar", "48000"];
  }

  const selectedEncoder = format === "mp4-hevc" ? (hevcEncoder ?? "libx265") : encoder;
  return [
    ...args,
    "-filter_complex", filters.join(";"),
    "-map", "[vout]", ...audioMap,
    ...outputVideoArgs({ encoder: selectedEncoder, format, width: safeWidth }),
    "-r", String(safeFrameRate), "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    "-progress", "pipe:1", "-nostats", outputPath,
  ];
}

export async function createNativeSequenceRenderJob({
  engine, plan, outputPath, onProgress = () => {}, onSpawn = () => {},
}) {
  if (!engine?.ffmpeg) throw new Error("The native render engine is unavailable.");
  if (!plan || !Array.isArray(plan.clips)) throw new Error("The native render plan is missing its clips.");
  if (typeof outputPath !== "string" || !outputPath.trim()) throw new Error("The native render is missing an output path.");
  const extension = path.extname(outputPath) || ".mp4";
  const partialPath = `${outputPath}.${randomUUID()}.partial${extension}`;
  await mkdir(path.dirname(outputPath), { recursive: true });
  const args = buildNativeSequenceRenderArgs({
    ...plan,
    outputPath: partialPath,
    encoder: engine.encoder,
    hevcEncoder: engine.encoders?.hevc,
  });
  const child = spawn(engine.ffmpeg, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  onSpawn(child);
  const encodingProgress = createEncodingProgress(Math.max(0.05, finite(plan.duration, 0.05)));
  let stdoutBuffer = "";
  let stderr = "";
  const fields = {};
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      fields[line.slice(0, separator)] = line.slice(separator + 1);
      if (line.startsWith("progress=")) {
        const progress = encodingProgress(fields);
        onProgress(progress, fields.progress === "end" ? "Finalizing native master" : `Native ${engine.hardware ? "hardware" : "CPU"} render`);
      }
    }
  });
  child.stderr.on("data", (chunk) => { if (stderr.length < MAX_CAPTURE_BYTES) stderr += chunk; });
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(signal === "SIGTERM" || signal === "SIGKILL" ? "Native render canceled." : `Native FFmpeg render failed (${code}): ${stderr.trim().slice(-1800)}`));
    });
  }).catch(async (error) => {
    await unlink(partialPath).catch(() => undefined);
    throw error;
  });
  // Replace atomically on the same filesystem. Never delete the customer's
  // previous master before the new file is successfully committed.
  try { await rename(partialPath, outputPath); }
  catch (error) { await unlink(partialPath).catch(() => undefined); throw error; }
  onProgress(1, "Native master ready");
  return { outputPath, encoder: plan.format === "mp4-hevc" ? engine.encoders?.hevc : engine.encoder, hardware: engine.hardware };
}

export async function createProxyJob({ engine, sourcePath, cacheDirectory, maxWidth = 1280, onProgress = () => {}, onSpawn = () => {} }) {
  if (!engine?.ffmpeg || !engine?.ffprobe) throw new Error("The native proxy engine is unavailable.");
  if (typeof sourcePath !== "string" || !sourcePath.trim()) throw new Error("A proxy build needs a source file path.");
  if (typeof cacheDirectory !== "string" || !cacheDirectory.trim()) throw new Error("A proxy build needs a cache directory.");
  const sourceStat = await stat(sourcePath).catch(() => { throw new Error(`Source media not found: ${sourcePath}`); });
  const cacheKey = createHash("sha256")
    .update(`${sourcePath}:${sourceStat.size}:${sourceStat.mtimeMs}:${maxWidth}`)
    .digest("hex").slice(0, 24);
  await mkdir(cacheDirectory, { recursive: true });
  const outputPath = path.join(cacheDirectory, `${cacheKey}.mp4`);
  try {
    await access(outputPath);
    onProgress(1, "Proxy ready from cache");
    return { outputPath, cached: true };
  } catch { /* encode below */ }
  const partialPath = path.join(cacheDirectory, `${cacheKey}.${randomUUID()}.partial.mp4`);
  const metadata = await probeMedia(engine, sourcePath);
  const child = spawn(engine.ffmpeg, buildProxyArgs({ sourcePath, outputPath: partialPath, maxWidth, encoder: engine.encoder }), {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  onSpawn(child);
  const encodingProgress = createEncodingProgress(metadata.duration);
  let stdoutBuffer = "";
  let stderr = "";
  const fields = {};
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const separator = line.indexOf("=");
      if (separator < 1) continue;
      fields[line.slice(0, separator)] = line.slice(separator + 1);
      if (line.startsWith("progress=")) {
        const progress = encodingProgress(fields);
        onProgress(progress, fields.progress === "end" ? "Finalizing proxy" : "Encoding editing proxy");
      }
    }
  });
  child.stderr.on("data", (chunk) => { if (stderr.length < MAX_CAPTURE_BYTES) stderr += chunk; });
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(signal === "SIGTERM" || signal === "SIGKILL" ? "Proxy job canceled." : `FFmpeg proxy failed (${code}): ${stderr.trim().slice(-1600)}`));
    });
  }).catch(async (error) => {
    await unlink(partialPath).catch(() => undefined);
    throw error;
  });
  try { await rename(partialPath, outputPath); }
  catch (error) { await unlink(partialPath).catch(() => undefined); throw error; }
  onProgress(1, "Proxy ready");
  return { outputPath, cached: false, metadata };
}

export function safeProjectName(value) {
  return String(value || "ScenePilot Project").replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "ScenePilot Project";
}

export async function collectProjectPackage({ destinationDirectory, projectName, projectJson, sources = [] }) {
  if (typeof destinationDirectory !== "string" || !destinationDirectory.trim()) throw new Error("Collecting a project needs a destination folder.");
  if (typeof projectJson !== "string" || !projectJson.trim()) throw new Error("Collecting a project needs its project data.");
  const baseName = safeProjectName(projectName);
  let packageDirectory = path.join(destinationDirectory, `${baseName} - Collected`);
  try {
    await access(packageDirectory);
    packageDirectory = path.join(destinationDirectory, `${baseName} - Collected ${new Date().toISOString().replace(/[:.]/g, "-")}`);
  } catch { /* preferred package name is available */ }
  const mediaDirectory = path.join(packageDirectory, "Media");
  await mkdir(mediaDirectory, { recursive: true });
  const usedNames = new Set();
  const media = [];
  const skipped = [];
  for (const source of sources) {
    if (!source?.path || !path.isAbsolute(source.path)) {
      if (source?.path) skipped.push(String(source.path));
      continue;
    }
    const parsed = path.parse(source.path);
    let fileName = safeProjectName(parsed.name) + parsed.ext.toLowerCase();
    let suffix = 2;
    while (usedNames.has(fileName.toLowerCase())) fileName = `${safeProjectName(parsed.name)}-${suffix++}${parsed.ext.toLowerCase()}`;
    usedNames.add(fileName.toLowerCase());
    // A moved/deleted source shouldn't sink the whole collect — skip it, note it,
    // and still hand back a package for everything that copied.
    try {
      await copyFile(source.path, path.join(mediaDirectory, fileName));
      media.push({ id: String(source.id ?? ""), originalPath: source.path, collectedPath: `Media/${fileName}` });
    } catch {
      skipped.push(source.path);
    }
  }
  const manifest = { format: "scenepilot-collected-project", version: 1, project: baseName, createdAt: Date.now(), media, skipped };
  await Promise.all([
    writeFile(path.join(packageDirectory, `${baseName}.scenepilot.json`), projectJson, "utf8"),
    writeFile(path.join(packageDirectory, "media-manifest.json"), JSON.stringify(manifest, null, 2), "utf8"),
  ]);
  return { packageDirectory, mediaCount: media.length, skipped, manifest };
}
