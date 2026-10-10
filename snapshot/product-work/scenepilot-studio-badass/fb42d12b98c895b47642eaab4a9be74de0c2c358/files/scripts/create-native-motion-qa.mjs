import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Generated fixtures only; never opens or rewrites a user's project.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "outputs/native-macos");
const source = path.join(output, "pattern.mp4");
await access(source); // npm run native:test creates the synthetic pattern + tone.
await mkdir(output, { recursive: true });
const clip = { id: "motion-clip", assetId: "pattern", trackId: "v1", start: 0, sourceStart: 0, duration: 2, rate: 1, opacity: 1, gain: 1, fadeIn: 0, fadeOut: 0, exposure: 0, saturation: 1, blur: 0 };
const project = {
  format: "scenepilot-native", version: 3, id: "native-motion-ui-qa", name: "Native Motion QA", mainSequenceId: "main",
  media: [{ id: "pattern", path: source, name: "Generated motion pattern", duration: 3, hasVideo: true, hasAudio: true }],
  sequences: [{ id: "main", name: "Main Sequence", width: 640, height: 360, frameRate: 30,
    tracks: [{ id: "v2", name: "Track 2", enabled: true, locked: false, gain: 1 }, { id: "v1", name: "Track 1", enabled: true, locked: false, gain: 1 }], videoClips: [clip] }],
};
const file = path.join(output, "motion-ui.scenepilot-native.json");
await writeFile(file, JSON.stringify(project, null, 2));
console.log(file);
