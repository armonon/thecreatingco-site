import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "outputs/native-macos");
const mediaPath = path.join(output, "pattern.mp4");
await access(mediaPath); // npm run native:test generates this synthetic footage.
const clip = (index) => ({ id: `shot-${index}`, assetId: "pattern", trackId: "video", start: index * 0.5,
  sourceStart: 0.5, duration: 0.5, rate: 1, opacity: 1, gain: 0.25, fadeIn: 0, fadeOut: 0,
  exposure: 0, saturation: 1, blur: 0 });
const project = { format: "scenepilot-native", version: 5, id: "native-performance-qa", name: "Native Performance QA · 64 cuts",
  mainSequenceId: "main", media: [{ id: "pattern", path: mediaPath, name: "Synthetic pattern", duration: 3, hasVideo: true, hasAudio: true }],
  sequences: [{ id: "main", name: "64 sequential cuts", width: 640, height: 360, frameRate: 30,
    tracks: [{ id: "video", name: "Sequence", enabled: true, locked: false, gain: 1 }],
    videoClips: Array.from({ length: 64 }, (_, index) => clip(index)) }] };
const target = path.join(output, "performance-ui.scenepilot-native.json");
await writeFile(target, JSON.stringify(project, null, 2));
console.log(target);
