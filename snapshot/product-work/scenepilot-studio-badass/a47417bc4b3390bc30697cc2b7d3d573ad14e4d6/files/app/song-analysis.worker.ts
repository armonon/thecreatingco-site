/// <reference lib="webworker" />
import { analyzeAudio } from "../lib/analysis-engine";
import { deriveBarGrid } from "../lib/sequencer";
self.onmessage = async (event: MessageEvent<{ file: File; duration: number }>) => {
  try {
    const result = await analyzeAudio(event.data.file, event.data.duration, progress => self.postMessage({ type: "progress", message: progress.message }));
    const grid = deriveBarGrid(result.beats, result.signals);
    self.postMessage({ type: "done", map: { version: 1, bpm: result.bpm, confidence: result.confidence, beats: result.beats, downbeats: grid.downbeats, beatsPerBar: grid.beatsPerBar } });
  } catch (error) { self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) }); }
};
