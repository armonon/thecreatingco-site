import { describe, expect, it } from "vitest";
import { deserializeProject, newProject, serializeProject } from "../src/engine/project";
import { newLayer, setCelAtFrame } from "../src/engine/layers";
import { setKeyframe } from "../src/engine/tween";

describe("Animate project files", () => {
  it("round-trips a valid v1 project", async () => {
    const project = newProject("Round trip");
    const layer = project.layers[0];
    const populatedLayer = {
      ...setCelAtFrame(layer, 0, {
        strokes: [{ id: "s1", color: "#111111", baseWidth: 4, points: [{ x: 10, y: 20, pressure: 0.5 }] }],
        fillDataUrl: "data:image/png;base64,AA==",
      }),
      tweens: { x: setKeyframe([], { frame: 0, value: 12, easing: "easeOutQuad" }) },
    };
    const populatedProject = { ...project, layers: [populatedLayer] };
    const loaded = deserializeProject(await serializeProject(populatedProject));
    expect(loaded).toMatchObject({
      version: 1,
      name: "Round trip",
      layers: populatedProject.layers,
      timeline: project.timeline,
    });
  });

  it.each([
    ["truthy non-array layers", (p: ReturnType<typeof newProject>) => ({ ...p, layers: {} })],
    ["empty layers", (p: ReturnType<typeof newProject>) => ({ ...p, layers: [] })],
    ["malformed timeline", (p: ReturnType<typeof newProject>) => ({ ...p, timeline: { ...p.timeline, onionSkin: null } })],
    ["malformed nested layer", (p: ReturnType<typeof newProject>) => ({ ...p, layers: [{ ...p.layers[0], transform: null }] })],
    ["malformed cel stroke", (p: ReturnType<typeof newProject>) => ({ ...p, layers: [{ ...p.layers[0], cels: { 0: { strokes: [null] } } }] })],
    ["malformed keyframe easing", (p: ReturnType<typeof newProject>) => ({ ...p, layers: [{ ...p.layers[0], tweens: { x: [{ frame: 0, value: 1, easing: ["linear"] }] } }] })],
    ["unsupported version", (p: ReturnType<typeof newProject>) => ({ ...p, version: 2 })],
  ])("rejects %s before returning a project", async (_label, mutate) => {
    const malformed = mutate(newProject());
    await expect(Promise.resolve().then(() => deserializeProject(JSON.stringify(malformed))))
      .rejects.toThrow("That file doesn't look like an Animate project.");
  });

  it("accepts a valid reference layer", () => {
    const project = newProject();
    const reference = { ...newLayer("ref", "reference"), referenceSrc: "data:image/png;base64,AA==", referenceKind: "image" as const };
    expect(deserializeProject(JSON.stringify({ ...project, layers: [...project.layers, reference] })).layers).toHaveLength(2);
  });
});
