import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Reproducible, generated-media-only UI fixture. Run native:test first.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "outputs/native-macos");
const media = ["red", "blue"].map(id => ({ id, path: path.join(output, `${id}.mp4`), name: `${id}.mp4`, duration: 3, hasVideo: true, hasAudio: true }));
for (const asset of media) await access(asset.path);
const project = {
  format: "scenepilot-native", version: 2, id: "adjacent-ui-qa", name: "Roll and Slide QA", mainSequenceId: "main", media,
  sequences: [{ id: "main", name: "Main Sequence", width: 640, height: 360, frameRate: 30,
    tracks: [{ id: "v2", name: "Track 2", enabled: true, locked: false, gain: 1 }, { id: "v1", name: "Track 1", enabled: true, locked: false, gain: 1 }],
    videoClips: [0, 1, 2].map(index => ({ id: `shot-${index}`, assetId: index === 1 ? "blue" : "red", trackId: "v1", start: index * .6, duration: .6, sourceStart: .5, rate: 1, opacity: 1, gain: 1, fadeIn: 0, fadeOut: 0, exposure: 0, saturation: 1, blur: 0 })),
  }],
};
await mkdir(output, { recursive: true });
const destination = path.join(output, "adjacent-ui.scenepilot-native.json");
await writeFile(destination, JSON.stringify(project, null, 2));
console.log(destination);
