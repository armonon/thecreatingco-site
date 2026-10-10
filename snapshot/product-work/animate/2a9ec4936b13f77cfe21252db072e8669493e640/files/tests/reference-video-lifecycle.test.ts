import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearReferenceVideos, syncReferenceVideos, videoElements } from "../src/engine/render";
import { newLayer } from "../src/engine/layers";

describe("reference video renderer lifecycle", () => {
  const created: HTMLVideoElement[] = [];
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    clearReferenceVideos();
    created.length = 0;
    vi.spyOn(URL, "revokeObjectURL");
    vi.spyOn(document, "createElement").mockImplementation(((tag: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tag, options);
      if (tag === "video") {
        const video = element as HTMLVideoElement;
        vi.spyOn(video, "play").mockResolvedValue(undefined);
        vi.spyOn(video, "pause").mockImplementation(() => {});
        vi.spyOn(video, "load").mockImplementation(() => {});
        created.push(video);
      }
      return element;
    }) as typeof document.createElement);
  });

  afterEach(() => {
    clearReferenceVideos();
    vi.restoreAllMocks();
  });

  function videoLayer(id: string, src: string) {
    return { ...newLayer("Reference", "reference"), id, referenceSrc: src, referenceKind: "video" as const };
  }

  it("rehydrates saved data-URL videos and is idempotent", () => {
    const layer = videoLayer("saved", "data:video/mp4;base64,AA==");
    syncReferenceVideos([layer]);

    const registered = videoElements.get(layer.id)!;
    expect(registered.src).toBe(layer.referenceSrc);
    expect(registered.loop).toBe(true);
    expect(registered.muted).toBe(true);
    expect(registered.playsInline).toBe(true);
    syncReferenceVideos([layer]);
    expect(videoElements.get(layer.id)).toBe(registered);
    expect(created).toHaveLength(1);
  });

  it("releases replaced and removed videos, revoking only owned blob URLs", () => {
    const first = videoLayer("ref", "blob:old-media");
    syncReferenceVideos([first]);
    const previous = videoElements.get("ref")!;

    syncReferenceVideos([videoLayer("ref", "data:video/mp4;base64,BB==")]);
    expect(previous.pause).toHaveBeenCalledOnce();
    expect(previous.load).toHaveBeenCalledOnce();
    expect(previous.hasAttribute("src")).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:old-media");

    const replacement = videoElements.get("ref")!;
    syncReferenceVideos([]);
    expect(replacement.pause).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(videoElements.size).toBe(0);
  });

  it("does not register images or drawn layers", () => {
    const image = { ...newLayer("Image", "reference"), referenceSrc: "data:image/png;base64,AA==", referenceKind: "image" as const };
    syncReferenceVideos([image, newLayer("Drawing")]);
    expect(videoElements.size).toBe(0);
    expect(created).toHaveLength(0);
  });
});
