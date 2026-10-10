import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Separate, synthetic fixture. Never edits another project or user media.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "outputs/native-macos");
const source = path.join(output, "pattern.mp4");
await access(source); await mkdir(output, { recursive: true });
const track = (id, name) => ({ id, name, enabled: true, locked: false, gain: 1 });
const clip = (id, trackId) => ({ id, assetId: "pattern", trackId, start: 0, sourceStart: 0, duration: 2, rate: 1, opacity: 1, gain: 0.5, fadeIn: 0, fadeOut: 0, exposure: 0, saturation: 1, blur: 0 });
const point = (x, y) => ({ x, y });
const k = 0.2761423749153967;
const points = [
  { anchor: point(0.5, 0), incoming: point(0.5-k, 0), outgoing: point(0.5+k, 0) },
  { anchor: point(1, 0.5), incoming: point(1, 0.5-k), outgoing: point(1, 0.5+k) },
  { anchor: point(0.5, 1), incoming: point(0.5+k, 1), outgoing: point(0.5-k, 1) },
  { anchor: point(0, 0.5), incoming: point(0, 0.5+k), outgoing: point(0, 0.5-k) },
];
const group = { ...clip("animated-group", "picture"), assetId: undefined, compositionId: "child", gain: 1,
  mask: { shape: "bezier", x: 0.5, y: 0.5, width: 0.75, height: 0.75, feather: 3, inverted: false, points } };
const project = {
  format: "scenepilot-native", version: 5, id: "native-mask-animation-qa", name: "Native Bezier & Fades QA", mainSequenceId: "main",
  media: [{ id: "pattern", path: source, name: "Generated pattern", duration: 3, hasVideo: true, hasAudio: true }],
  sequences: [
    { id: "main", name: "Main Sequence", width: 640, height: 360, frameRate: 30, tracks: [track("picture", "Animated composition")], videoClips: [group] },
    { id: "child", name: "Pattern + audio", width: 640, height: 360, frameRate: 30, tracks: [track("child-track", "Picture + sound")], videoClips: [{ ...clip("source", "child-track"), fadeIn: 0.8, fadeOut: 0.5 }] },
  ],
};
const file = path.join(output, "mask-animation-ui.scenepilot-native.json");
await writeFile(file, JSON.stringify(project, null, 2)); console.log(file);
