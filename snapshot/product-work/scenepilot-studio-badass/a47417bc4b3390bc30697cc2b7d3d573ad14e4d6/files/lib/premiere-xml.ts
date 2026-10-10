// Premiere Pro hand-off. Builds a Final Cut Pro 7 XML (`xmeml` version 4) that
// Premiere Pro opens via File → Import, plus a CMX3600 EDL of the same cut.
//
// Both reference the user's ORIGINAL media by file name: nothing is rendered or
// embedded. `pathurl` is the real folder when the user typed one in, otherwise a
// placeholder folder, and Premiere's Link Media dialog relinks the lot once one
// file has been located (file names are kept exactly). Pure; no DOM.

export const PREMIERE_RATES = ["23.976", "24", "25", "29.97", "30", "50", "59.94", "60"] as const;
export type PremiereRateId = (typeof PREMIERE_RATES)[number];

export type SequenceRate = {
  id: PremiereRateId;
  /** Integer frame count per timecode second (24, 25, 30, 50, 60). */
  timebase: number;
  /** NTSC (x1000/1001) pull-down. */
  ntsc: boolean;
  /** Actual frames per real second. */
  fps: number;
  /** Drop-frame timecode display. Only legal for 29.97 and 59.94. */
  dropFrame: boolean;
};

export function sequenceRate(id: PremiereRateId, dropFrame = true): SequenceRate {
  const ntsc = id === "23.976" || id === "29.97" || id === "59.94";
  const timebase = ntsc ? Math.round(Number(id)) : Number(id);
  return { id, timebase, ntsc, fps: ntsc ? (timebase * 1000) / 1001 : timebase, dropFrame: dropFrame && (id === "29.97" || id === "59.94") };
}

/** Snap a measured frame rate (e.g. 29.97002997 or 30.02) to the closest standard one. */
export function nearestRate(fps: number | undefined, fallback: PremiereRateId = "30"): PremiereRateId {
  if (!fps || !Number.isFinite(fps) || fps <= 0) return fallback;
  let best = fallback;
  let bestError = Infinity;
  for (const id of PREMIERE_RATES) {
    const rate = sequenceRate(id);
    const error = Math.abs(rate.fps - fps);
    if (error < bestError) { best = id; bestError = error; }
  }
  return bestError <= 0.6 ? best : fallback;
}

/** Real seconds → whole frames at the sequence rate. */
export function secondsToFrames(seconds: number, rate: SequenceRate) {
  return Math.max(0, Math.round(seconds * rate.fps + 1e-9));
}

export function framesToSeconds(frames: number, rate: SequenceRate) {
  return frames / rate.fps;
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Frame count → SMPTE timecode. Drop-frame (29.97/59.94) skips frame numbers
 * 0–1 (0–3 at 59.94) at the start of every minute except each tenth minute, so
 * the display tracks wall-clock time; it uses `;` before the frames field.
 */
export function framesToTimecode(frames: number, rate: SequenceRate) {
  let value = Math.max(0, Math.round(frames));
  const tb = rate.timebase;
  if (rate.dropFrame) {
    const drop = tb === 60 ? 4 : 2;
    const perMinute = tb * 60 - drop;
    const perTenMinutes = perMinute * 10 + drop;
    const tens = Math.floor(value / perTenMinutes);
    const rest = value % perTenMinutes;
    value += drop * 9 * tens + (rest > drop ? drop * Math.floor((rest - drop) / perMinute) : 0);
  }
  const ff = value % tb;
  const totalSeconds = Math.floor(value / tb);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600) % 24;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}${rate.dropFrame ? ";" : ":"}${pad(ff)}`;
}

/** Inverse of framesToTimecode (accepts `:` or `;` separators). */
export function timecodeToFrames(timecode: string, rate: SequenceRate) {
  const parts = timecode.split(/[:;.]/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0)) throw new Error(`Invalid timecode ${timecode}`);
  const [hh, mm, ss, ff] = parts;
  const tb = rate.timebase;
  const nominal = ((hh * 60 + mm) * 60 + ss) * tb + ff;
  if (!rate.dropFrame) return nominal;
  const drop = tb === 60 ? 4 : 2;
  const minutes = hh * 60 + mm;
  return nominal - drop * (minutes - Math.floor(minutes / 10));
}

export type PremiereMedia = {
  id: string;
  /** Original file name, exactly as on disk (used for relinking). */
  name: string;
  kind: "video" | "audio" | "image";
  /** Seconds. */
  duration: number;
  width?: number;
  height?: number;
  /** The file's own frame rate, when known. */
  frameRate?: number;
  hasAudio?: boolean;
  audioChannels?: number;
  sampleRate?: number;
  /** Absolute path on the user's machine, when the host knows it (desktop). */
  path?: string;
};

export type PremiereClip = {
  mediaId: string;
  /** Timeline seconds. */
  start: number;
  duration: number;
  /** Source seconds the clip starts from. */
  sourceStart: number;
};

export type PremiereMarker = { time: number; name: string; comment?: string; duration?: number };

export type PremiereTimeline = {
  name: string;
  rate: PremiereRateId;
  /** Drop-frame display for 29.97/59.94 (default true). Ignored for other rates. */
  dropFrame?: boolean;
  width: number;
  height: number;
  media: PremiereMedia[];
  /** Picture edits. Overlapping clips are spread over V1, V2… so nothing moves. */
  video: PremiereClip[];
  /** Sound edits (the song). Spread over A1, A2… the same way. */
  audio: PremiereClip[];
  markers?: PremiereMarker[];
  /** Folder that holds the media on the editor's machine. Empty = placeholder + relink. */
  mediaFolder?: string;
};

export const RELINK_FOLDER = "ScenePilot-relink";

export const PREMIERE_RELINK_NOTE = [
  "Premiere Pro: File → Import… and choose the .xml (not File → Open). A new bin with the sequence appears.",
  "Media is referenced by its original file name, not embedded. If you typed the media folder before exporting, Premiere links it straight away.",
  "Otherwise Premiere shows “Link Media”: click Locate, find the first file, and keep “Relink others automatically” on — the rest are found in the same folder by name.",
  "Keep the original file names. Renamed or transcoded copies won’t relink by name.",
  "Hard cuts, the song and markers come across. Effects, looks, titles, speed changes and transitions do not — export a reference video for those.",
].join("\n");

const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&apos;");

/** file://localhost/… URL for a folder + file name (macOS or Windows paths). */
export function mediaPathUrl(name: string, folder?: string, path?: string) {
  const raw = (path || `${(folder?.trim() || `/${RELINK_FOLDER}`).replace(/[\\/]+$/, "")}/${name}`).replaceAll("\\", "/");
  const absolute = raw.startsWith("/") ? raw : `/${raw}`;
  const encoded = absolute.split("/").map((segment) => encodeURIComponent(segment).replace(/%3A/gi, ":")).join("/");
  return `file://localhost${encoded}`;
}

type Lane = PremiereClip[];

/** Serial lanes: a clip goes on the first track where it doesn't overlap. */
export function partitionLanes(clips: PremiereClip[], rate: SequenceRate): Lane[] {
  const lanes: Lane[] = [];
  const ends: number[] = [];
  for (const clip of [...clips].sort((a, b) => a.start - b.start || a.duration - b.duration)) {
    const startFrame = secondsToFrames(clip.start, rate);
    let lane = ends.findIndex((end) => end <= startFrame);
    if (lane < 0) { lane = lanes.length; lanes.push([]); ends.push(0); }
    lanes[lane].push(clip);
    ends[lane] = Math.max(ends[lane], secondsToFrames(clip.start + clip.duration, rate));
  }
  return lanes;
}

type FrameClip = { clip: PremiereClip; media: PremiereMedia; start: number; end: number; in: number; out: number };

/**
 * Quantise a clip to frames. Start and end are rounded independently so that
 * butt-joined clips stay butt-joined; the source out follows the same length.
 */
export function frameClip(clip: PremiereClip, media: PremiereMedia, rate: SequenceRate): FrameClip | null {
  const start = secondsToFrames(clip.start, rate);
  const end = secondsToFrames(clip.start + clip.duration, rate);
  if (end <= start) return null;
  const length = end - start;
  const mediaFrames = media.kind === "image" ? Infinity : Math.max(1, secondsToFrames(media.duration, rate));
  let sourceIn = secondsToFrames(clip.sourceStart, rate);
  if (sourceIn + length > mediaFrames) sourceIn = Math.max(0, mediaFrames - length);
  return { clip, media, start, end, in: sourceIn, out: sourceIn + length };
}

const rateXml = (rate: SequenceRate, indent: string) => `${indent}<rate>\n${indent}  <timebase>${rate.timebase}</timebase>\n${indent}  <ntsc>${rate.ntsc ? "TRUE" : "FALSE"}</ntsc>\n${indent}</rate>`;

const timecodeXml = (rate: SequenceRate, indent: string) => [
  `${indent}<timecode>`,
  rateXml(rate, `${indent}  `),
  `${indent}  <string>${framesToTimecode(0, rate)}</string>`,
  `${indent}  <frame>0</frame>`,
  `${indent}  <displayformat>${rate.dropFrame ? "DF" : "NDF"}</displayformat>`,
  `${indent}</timecode>`,
].join("\n");

function fileRate(media: PremiereMedia, sequence: SequenceRate) {
  return media.frameRate ? sequenceRate(nearestRate(media.frameRate, sequence.id), sequence.dropFrame) : sequence;
}

/** Final Cut Pro 7 XML (xmeml v4) — Premiere Pro: File → Import. */
export function buildPremiereXml(timeline: PremiereTimeline): string {
  const rate = sequenceRate(timeline.rate, timeline.dropFrame ?? true);
  const mediaById = new Map(timeline.media.map((media) => [media.id, media]));
  const fileIds = new Map<string, string>();
  const written = new Set<string>();
  let clipCounter = 0;
  timeline.media.forEach((media, index) => fileIds.set(media.id, `file-${index + 1}`));

  const fileXml = (media: PremiereMedia, indent: string, wantAudio: boolean) => {
    const id = fileIds.get(media.id)!;
    if (written.has(id)) return `${indent}<file id="${id}"/>`;
    written.add(id);
    const own = fileRate(media, rate);
    const isVisual = media.kind !== "audio";
    const hasAudio = media.kind === "audio" || Boolean(media.hasAudio) || wantAudio;
    const lines = [
      `${indent}<file id="${id}">`,
      `${indent}  <name>${xml(media.name)}</name>`,
      `${indent}  <pathurl>${xml(mediaPathUrl(media.name, timeline.mediaFolder, media.path))}</pathurl>`,
      rateXml(own, `${indent}  `),
      `${indent}  <duration>${media.kind === "image" ? 1 : Math.max(1, secondsToFrames(media.duration, own))}</duration>`,
      timecodeXml(own, `${indent}  `),
      `${indent}  <media>`,
    ];
    if (isVisual) lines.push(
      `${indent}    <video>`,
      `${indent}      <samplecharacteristics>`,
      rateXml(own, `${indent}        `),
      `${indent}        <width>${Math.round(media.width ?? timeline.width)}</width>`,
      `${indent}        <height>${Math.round(media.height ?? timeline.height)}</height>`,
      `${indent}        <anamorphic>FALSE</anamorphic>`,
      `${indent}        <pixelaspectratio>square</pixelaspectratio>`,
      `${indent}        <fielddominance>none</fielddominance>`,
      `${indent}      </samplecharacteristics>`,
      `${indent}    </video>`,
    );
    if (hasAudio) lines.push(
      `${indent}    <audio>`,
      `${indent}      <samplecharacteristics>`,
      `${indent}        <depth>16</depth>`,
      `${indent}        <samplerate>${Math.round(media.sampleRate ?? 48000)}</samplerate>`,
      `${indent}      </samplecharacteristics>`,
      `${indent}      <channelcount>${media.audioChannels ?? 2}</channelcount>`,
      `${indent}    </audio>`,
    );
    lines.push(`${indent}  </media>`, `${indent}</file>`);
    return lines.join("\n");
  };

  const clipXml = (item: FrameClip, kind: "video" | "audio", indent: string) => {
    clipCounter += 1;
    const { media } = item;
    const mediaFrames = media.kind === "image" ? item.out : Math.max(item.out, secondsToFrames(media.duration, rate));
    const lines = [
      `${indent}<clipitem id="clipitem-${clipCounter}">`,
      `${indent}  <masterclipid>masterclip-${fileIds.get(media.id)!.slice(5)}</masterclipid>`,
      `${indent}  <name>${xml(media.name)}</name>`,
      `${indent}  <enabled>TRUE</enabled>`,
      `${indent}  <duration>${mediaFrames}</duration>`,
      rateXml(rate, `${indent}  `),
      `${indent}  <start>${item.start}</start>`,
      `${indent}  <end>${item.end}</end>`,
      `${indent}  <in>${item.in}</in>`,
      `${indent}  <out>${item.out}</out>`,
    ];
    if (kind === "video") lines.push(`${indent}  <alphatype>none</alphatype>`, `${indent}  <pixelaspectratio>square</pixelaspectratio>`, `${indent}  <anamorphic>FALSE</anamorphic>`);
    lines.push(fileXml(media, `${indent}  `, kind === "audio"));
    if (kind === "audio") lines.push(`${indent}  <sourcetrack>`, `${indent}    <mediatype>audio</mediatype>`, `${indent}    <trackindex>1</trackindex>`, `${indent}  </sourcetrack>`);
    lines.push(`${indent}</clipitem>`);
    return lines.join("\n");
  };

  const lanesXml = (clips: PremiereClip[], kind: "video" | "audio", indent: string) => {
    const lanes = partitionLanes(clips, rate)
      .map((lane) => lane.map((clip) => { const media = mediaById.get(clip.mediaId); return media ? frameClip(clip, media, rate) : null; }).filter((item): item is FrameClip => item !== null))
      .filter((lane) => lane.length);
    if (!lanes.length) lanes.push([]);
    return lanes.map((lane) => [
      `${indent}<track>`,
      ...lane.map((item) => clipXml(item, kind, `${indent}  `)),
      `${indent}  <enabled>TRUE</enabled>`,
      `${indent}  <locked>FALSE</locked>`,
      `${indent}</track>`,
    ].join("\n")).join("\n");
  };

  const allEnds = [...timeline.video, ...timeline.audio].map((clip) => secondsToFrames(clip.start + clip.duration, rate));
  const duration = Math.max(1, ...allEnds);
  const markers = (timeline.markers ?? [])
    .filter((marker) => Number.isFinite(marker.time) && marker.time >= 0 && secondsToFrames(marker.time, rate) <= duration)
    .sort((a, b) => a.time - b.time)
    .map((marker) => {
      const inFrame = secondsToFrames(marker.time, rate);
      const outFrame = marker.duration && marker.duration > 0 ? Math.min(duration, secondsToFrames(marker.time + marker.duration, rate)) : -1;
      return [
        "    <marker>",
        `      <comment>${xml(marker.comment ?? "")}</comment>`,
        `      <name>${xml(marker.name)}</name>`,
        `      <in>${inFrame}</in>`,
        `      <out>${outFrame > inFrame ? outFrame : -1}</out>`,
        "    </marker>",
      ].join("\n");
    });

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<!DOCTYPE xmeml>",
    "<xmeml version=\"4\">",
    "  <sequence id=\"sequence-1\">",
    `    <name>${xml(timeline.name)}</name>`,
    `    <duration>${duration}</duration>`,
    rateXml(rate, "    "),
    timecodeXml(rate, "    "),
    "    <in>-1</in>",
    "    <out>-1</out>",
    "    <media>",
    "      <video>",
    "        <format>",
    "          <samplecharacteristics>",
    rateXml(rate, "            "),
    `            <width>${Math.round(timeline.width)}</width>`,
    `            <height>${Math.round(timeline.height)}</height>`,
    "            <anamorphic>FALSE</anamorphic>",
    "            <pixelaspectratio>square</pixelaspectratio>",
    "            <fielddominance>none</fielddominance>",
    "          </samplecharacteristics>",
    "        </format>",
    lanesXml(timeline.video, "video", "        "),
    "      </video>",
    "      <audio>",
    "        <format>",
    "          <samplecharacteristics>",
    "            <depth>16</depth>",
    "            <samplerate>48000</samplerate>",
    "          </samplecharacteristics>",
    "        </format>",
    lanesXml(timeline.audio, "audio", "        "),
    "      </audio>",
    "    </media>",
    ...markers,
    "  </sequence>",
    "</xmeml>",
    "",
  ].join("\n");
}

/** CMX3600 reel: ≤8 chars, A–Z/0–9 (the clip name travels in a comment). */
export function reelName(name: string, index: number) {
  return name.replace(/\.[^.]+$/, "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8) || `REEL${index + 1}`;
}

/**
 * CMX3600 EDL of the same timeline: picture events (V) on the first video
 * lane, then sound events (A) for the first audio lane. Record timecode starts
 * at 00:00:00:00 to match the XML sequence. Markers ride along as comments.
 */
export function buildCmx3600(timeline: PremiereTimeline): string {
  const rate = sequenceRate(timeline.rate, timeline.dropFrame ?? true);
  const mediaIndex = new Map(timeline.media.map((media, index) => [media.id, index]));
  const mediaById = new Map(timeline.media.map((media) => [media.id, media]));
  const lines = [`TITLE: ${timeline.name.replace(/[\r\n]+/g, " ").toUpperCase().slice(0, 70)}`, `FCM: ${rate.dropFrame ? "DROP FRAME" : "NON-DROP FRAME"}`, ""];
  let event = 0;
  const add = (clips: PremiereClip[], track: "V" | "A") => {
    const lane = partitionLanes(clips, rate)[0] ?? [];
    for (const clip of lane) {
      const media = mediaById.get(clip.mediaId);
      if (!media) continue;
      const item = frameClip(clip, media, rate);
      if (!item) continue;
      event += 1;
      const reel = reelName(media.name, mediaIndex.get(media.id) ?? 0);
      lines.push(`${String(event).padStart(3, "0")}  ${reel.padEnd(8, " ")} ${track.padEnd(5, " ")} C        ${framesToTimecode(item.in, rate)} ${framesToTimecode(item.out, rate)} ${framesToTimecode(item.start, rate)} ${framesToTimecode(item.end, rate)}`);
      lines.push(`* FROM CLIP NAME: ${media.name}`);
      lines.push("");
    }
  };
  add(timeline.video, "V");
  add(timeline.audio, "A");
  const markers = (timeline.markers ?? []).filter((marker) => marker.time >= 0).sort((a, b) => a.time - b.time);
  if (markers.length) {
    lines.push("* MARKERS (for reference; Premiere's EDL import ignores comments - use the XML for markers)");
    for (const marker of markers) lines.push(`* ${framesToTimecode(secondsToFrames(marker.time, rate), rate)} ${marker.name.replace(/[\r\n]+/g, " ")}`);
    lines.push("");
  }
  return lines.join("\r\n");
}
