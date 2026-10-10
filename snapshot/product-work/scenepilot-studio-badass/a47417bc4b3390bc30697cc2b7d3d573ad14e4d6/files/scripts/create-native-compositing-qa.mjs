import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Synthetic QA only. Deliberately separate from users' documents and motion QA.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "outputs/native-macos");
const source = path.join(output, "pattern.mp4");
await access(source);
await mkdir(output, { recursive: true });
const track = (id, name) => ({ id, name, enabled: true, locked: false, gain: 1 });
const clip = (id, trackId) => ({ id, assetId: "pattern", trackId, start: 0, sourceStart: 0, duration: 2, rate: 1, opacity: 1, gain: 0, fadeIn: 0, fadeOut: 0, exposure: 0, saturation: 1, blur: 0 });
const group = { ...clip("group", "picture"), assetId: undefined, compositionId: "child", opacity: 0.7, saturation: 0.5 };
const provider = { ...clip("provider", "matte"), mask: { shape: "ellipse", x: 0.5, y: 0.5, width: 0.75, height: 0.75, feather: 8, inverted: false } };
const project = {
  format: "scenepilot-native", version: 4, id: "native-compositing-ui-qa", name: "Native Compositing QA", mainSequenceId: "main",
  media: [{ id: "pattern", path: source, name: "Generated pattern", duration: 3, hasVideo: true, hasAudio: true }],
  sequences: [
    { id: "main", name: "Main Sequence", width: 640, height: 360, frameRate: 30, tracks: [track("matte", "Matte source"), track("picture", "Composition")], videoClips: [provider, group] },
    { id: "child", name: "Overlapping layers", width: 640, height: 360, frameRate: 30, tracks: [track("top", "Top"), track("bottom", "Bottom")], videoClips: [clip("top", "top"), clip("bottom", "bottom")] },
  ],
};
const file = path.join(output, "compositing-ui.scenepilot-native.json");
await writeFile(file, JSON.stringify(project, null, 2));
console.log(file);
