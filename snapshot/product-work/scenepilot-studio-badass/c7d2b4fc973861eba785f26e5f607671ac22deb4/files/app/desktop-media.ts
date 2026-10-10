export type NativeMediaCapabilities = {
  available: boolean;
  encoder: string | null;
  hardware: boolean;
  message: string;
  encoders?: { h264?: string | null; hevc?: string | null; prores?: string | null; vp9?: string | null };
  nativeSequenceRender?: boolean;
  transparentVideo?: boolean;
  imageSequences?: boolean;
  neuralInpaint?: { available: boolean; message: string; provenance: { id: string; version: string; license: string; model: string; executableSha256: string; modelSha256: string } | null };
  mlAcceleration?: { runtime: "mediapipe-tflite" | "apple-vision-coreml"; provider: "apple-vision" | "metal" | "direct3d" | "vulkan" | "opengl" | "cpu"; gpuReady: boolean; native?: boolean; model?: string; promptableObjects?: boolean; temporalMemory?: boolean; persistentService?: boolean; neuralMemory?: boolean; alphaMatting?: boolean };
};

export type NativeMediaProgress = {
  jobId: string;
  progress: number;
  message: string;
  stage?: "awaiting-destination" | "preparing" | "rendering" | "finalizing";
};

export type NativeMediaProbe = {
  duration: number;
  format: string;
  size: number;
  video: { codec: string; width: number; height: number; pixelFormat: string; colorSpace: string; colorPrimaries: string; colorTransfer: string; averageFrameRate: number; realFrameRate: number; variableFrameRate: boolean; bitDepth: number; rotation: number; hdr: boolean } | null;
  audio: { codec: string; channels: number; sampleRate: number; channelLayout: string; bitRate: number } | null;
};

export type ScenePilotDesktopBridge = {
  writeGeneratedAudio?(request: { bytes: Uint8Array }): Promise<{ outputPath: string; url: string; bytes: number }>;
  closeWindow(): Promise<void>;
  confirmProjectReplacement(): Promise<"save" | "discard" | "cancel">;
  commitProjectDocument(path: string | null): Promise<void>;
  onAction(callback: (action: string) => void): () => void;
  getMediaCapabilities(): Promise<NativeMediaCapabilities>;
  segmentRotoFrame(request: { width: number; height: number; rgba: Uint8Array; target?: "person" | "object" | "auto"; prompts?: Array<{ x: number; y: number; kind: "foreground" | "background"; detail?: "hair" | "solid"; radius?: number; strength?: number }>; memoryAlpha?: Uint8Array; sessionId?: string; resetMemory?: boolean; memoryAnchor?: boolean; frameIndex?: number; refineAlpha?: boolean }): Promise<{ width: number; height: number; alpha: Uint8Array; provider: string; model: string; temporalMemory: boolean; memoryAttention: boolean; memoryConfidence: number; memoryFrames: number; memoryAnchors: number; memoryAnchorsUsed: number; alphaRefined: boolean; mattingModel: string; serviceReused: boolean }>;
  writeRotoCache(request: { cacheKey: string; frames: Array<{ id: string; time: number; points: Array<{ x: number; y: number }>; matte?: { width: number; height: number; rle: string }; confidence: number; source: "manual" | "tracked"; occluded?: boolean; recovered?: boolean; reviewed?: boolean }> }): Promise<{ cacheKey: string; frames: number; bytes: number; cacheBytes: number; pruned: string[] }>;
  readRotoCache(request: { cacheKey: string; start?: number; end?: number; limit?: number }): Promise<{ cacheKey: string; frames: Array<{ id: string; time: number; points: Array<{ x: number; y: number }>; matte: { width: number; height: number; rle: string }; confidence: number; source: "manual" | "tracked"; occluded?: boolean; recovered?: boolean; reviewed?: boolean }>; bytes: number }>;
  clearRotoCache(cacheKey: string): Promise<{ cacheKey: string; cleared: boolean }>;
  writeInpaintCache(request: { cacheKey: string; width: number; height: number; png: Uint8Array; model: string }): Promise<{ cacheKey: string; outputPath: string; url: string; bytes: number }>;
  readInpaintCache(cacheKey: string): Promise<{ cacheKey: string; png: Uint8Array; metadata: { schema: string; cacheKey: string; width: number; height: number; model: string } }>;
  clearInpaintCache(cacheKey: string): Promise<{ cacheKey: string; cleared: boolean }>;
  neuralInpaint(request: { jobId: string; width: number; height: number; frames: Uint8Array[]; masks: Uint8Array[] }): Promise<{ width: number; height: number; rgba: Uint8Array; backend: "neural-video"; provenance: { id: string; version: string; license: string; model: string; executableSha256: string; modelSha256: string } }>;
  getPathForFile(file: File): string;
  probeMedia(sourcePath: string): Promise<NativeMediaProbe>;
  createProxy(request: { jobId: string; sourcePath: string; maxWidth?: number }): Promise<{ url: string; cached: boolean; metadata: NativeMediaProbe | null }>;
  beginPcmMix(): Promise<{ token: string }>;
  writePcmMix(request: { token: string; position: number; data: Uint8Array }): Promise<void>;
  finishPcmMix(token: string): Promise<void>;
  releasePcmMix(token: string): Promise<boolean>;
  nativeRender(request: {
    jobId: string;
    preparedAudioToken?: string;
    suggestedName: string;
    outputPath?: string;
    useLastRenderDirectory?: boolean;
    plan: {
      clips: Array<{ sourcePath: string; sourceStart: number; duration: number; playbackRate?: number; fadeIn?: number; fadeOut?: number; flipH?: boolean; flipV?: boolean; reversed?: boolean; color?: { exposure: number; contrast: number; saturation: number; hue: number }; effects?: Array<{ type: "blur" | "glow" | "contrast" | "saturate" | "hue" | "monochrome" | "sepia" | "invert"; amount: number; enabled: boolean }> }>;
      audioClips?: Array<{ sourcePath: string; start: number; sourceStart: number; duration: number; playbackRate?: number; gain: number; pan: number; fadeIn: number; fadeOut: number; muted?: boolean; automation?: Array<{ time: number; gain: number }>; processing?: { highPassHz: number; lowDb: number; midDb: number; highDb: number; compressorThreshold: number; compressorRatio: number; limiter: boolean; makeupGain: number } }>;
      soundtrackPath?: string;
      width: number;
      height: number;
      frameRate: number;
      duration: number;
      rangeStart: number;
      masterGain: number;
      format: "mp4-h264" | "mp4-hevc";
    };
  }): Promise<{ canceled?: boolean; outputPath?: string; encoder?: string; hardware?: boolean }>;
  revealOutput(sourcePath: string): Promise<boolean>;
  cancelMediaJob(jobId: string): Promise<boolean>;
  logRenderEvent(entry: { event: string; jobId?: string; message?: string; progress?: number }): Promise<boolean>;
  loadRenderQueue(): Promise<unknown[]>;
  saveRenderQueue(request: { jobs: unknown[] }): Promise<boolean>;
  collectProject(request: { projectName: string; projectJson: string; sources: Array<{ id: string; path: string }> }): Promise<{ packageDirectory: string; mediaCount: number; skipped?: string[] } | null>;
  saveProjectDocument(request: { projectJson: string; suggestedName: string; saveAs?: boolean }): Promise<{ path: string } | null>;
  openProjectDocument(options?: { recovery?: boolean }): Promise<{ path: string; text: string; recovered?: boolean } | null>;
  registerLocalMedia(request: { sources: Array<{ id: string; path: string }> }): Promise<Array<{ id: string; url: string; path: string; size: number; lastModified: number; metadata: NativeMediaProbe | null }>>;
  journalProject(request: { projectId: string; projectJson: string }): Promise<{ path: string; savedAt: number }>;
  onMediaProgress(callback: (progress: NativeMediaProgress) => void): () => void;
};

declare global {
  interface Window {
    scenePilotDesktop?: ScenePilotDesktopBridge;
  }
}

export function desktopMediaBridge() {
  return typeof window === "undefined" ? undefined : window.scenePilotDesktop;
}
