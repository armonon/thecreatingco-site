export type QualificationStatus = "passed" | "failed" | "pending" | "skipped";
export type QualificationKind = "automated" | "perceptual";

export type QualificationGate = {
  id: string;
  label: string;
  kind: QualificationKind;
  required: boolean;
  status: QualificationStatus;
  details?: string;
  evidencePath?: string;
};

export type QualificationVerdict = {
  status: "passed" | "failed" | "pending";
  releaseReady: boolean;
  requiredTotal: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
  blockingGateIds: string[];
};

export type PerceptualReviewTask = {
  id: string;
  area: "edit" | "motion" | "roto" | "color" | "audio" | "delivery" | "usability";
  label: string;
  instructions: string;
  acceptance: string[];
  minimumScore: number;
  required: boolean;
};

export type PerceptualReviewResponse = {
  taskId: string;
  score: number;
  passed: boolean;
  notes: string;
  evidence: string[];
};

export type PerceptualReviewSubmission = {
  reviewer: string;
  reviewedAt: string;
  appCommit: string;
  appSourceSha256?: string;
  sourceMediaSha256: string;
  responses: PerceptualReviewResponse[];
};

export const REQUIRED_PERCEPTUAL_TASKS: PerceptualReviewTask[] = [
  {
    id: "music-montage-preview-export",
    area: "edit",
    label: "Music montage preview/export parity",
    instructions: "Build a montage from a real song and at least six mixed-orientation clips. Scrub every cut, then render the full master.",
    acceptance: ["Cuts land intentionally on beats", "No black or stale frames", "Preview and export match at every sampled cut", "Audio stays synchronized"],
    minimumScore: 4,
    required: true,
  },
  {
    id: "timeline-edit-feel",
    area: "usability",
    label: "Professional trimming and timeline feel",
    instructions: "Complete razor, ripple, roll, slip, slide, insert, overwrite, track reorder, undo, and redo tasks without reloading.",
    acceptance: ["Every edit is predictable", "Linked audio remains correct", "Undo/redo restores exact state", "No interaction stalls"],
    minimumScore: 4,
    required: true,
  },
  {
    id: "composition-nesting",
    area: "motion",
    label: "Nested composition parity",
    instructions: "Animate a layered composition with transforms, easing, a matte, motion blur, and audio; nest it in MASTER and another composition.",
    acceptance: ["Track order is correct", "Nested timing and audio remain correct", "No stale dependency renders", "Export matches the viewer"],
    minimumScore: 4,
    required: true,
  },
  {
    id: "footage-camera-solve",
    area: "motion",
    label: "Footage 3D camera solve",
    instructions: "Solve a handheld shot with foreground and background detail, add three 3D layers at different depths, scrub the solve, then render the nested composition.",
    acceptance: ["Tracked layers remain registered to the shot", "Foreground/background parallax reads correctly", "Reprojection diagnostics flag weak solves", "Viewer and export camera motion match"],
    minimumScore: 4,
    required: true,
  },
  {
    id: "long-range-object-removal",
    area: "motion",
    label: "Long-range object removal",
    instructions: "Track a moving foreground object across a shot with changing background exposure, build a temporal clean plate, inspect difficult occlusions, and render the result.",
    acceptance: ["Background stays temporally stable", "No stationary object ghost remains", "Clean plate survives save/reopen", "Viewer and export replacement edges match"],
    minimumScore: 4,
    required: true,
  },
  {
    id: "roto-difficult-shot",
    area: "roto",
    label: "Difficult long-shot roto",
    instructions: "Track a subject through hair detail, fast motion, partial and full occlusion, exit/re-entry, and a crossing distractor for at least 60 seconds.",
    acceptance: ["Identity never silently switches", "Hair and motion-blur edges remain usable", "Corrections persist and propagate safely", "Nested alpha export matches the viewer"],
    minimumScore: 4,
    required: true,
  },
  {
    id: "color-grade-parity",
    area: "color",
    label: "Color and LUT parity",
    instructions: "Apply exposure, temperature/tint, curves, a 3D LUT, shot match, and auto white balance to real log and standard footage.",
    acceptance: ["No clipping or channel artifacts", "LUT interpolation is visually correct", "Preview/export differences are not visible", "Adjustments remain stable while scrubbing"],
    minimumScore: 4,
    required: true,
  },
  {
    id: "audio-mix-sync",
    area: "audio",
    label: "Multitrack mix and sync",
    instructions: "Mix dialogue, music, and effects with fades, automation, pan, EQ, compression, and limiting; render the master and isolated review stems.",
    acceptance: ["No clicks at edits or fades", "Automation timing is correct", "Dialogue stays synchronized", "Master does not audibly clip"],
    minimumScore: 4,
    required: true,
  },
  {
    id: "desktop-delivery-recovery",
    area: "delivery",
    label: "Desktop delivery and recovery",
    instructions: "Queue H.264, HEVC, and alpha outputs; cancel one render, restart the app, retry it, and validate every resulting file.",
    acceptance: ["Qualifying jobs use the native engine", "Fallback reason is explicit", "Interrupted jobs recover", "Files have correct dimensions, duration, audio, and alpha"],
    minimumScore: 4,
    required: true,
  },
  {
    id: "first-project-usability",
    area: "usability",
    label: "First-project usability",
    instructions: "Give the unsigned build to an editor who has not used ScenePilot and ask them to import media, create a cut, add a comp, and export without coaching.",
    acceptance: ["User finds the primary workflow", "Terminology is understandable", "Disabled states explain recovery", "A valid export is completed"],
    minimumScore: 4,
    required: true,
  },
];

export function qualificationVerdict(gates: QualificationGate[]): QualificationVerdict {
  const required = gates.filter((gate) => gate.required);
  const failed = required.filter((gate) => gate.status === "failed");
  const pending = required.filter((gate) => gate.status === "pending");
  const skipped = required.filter((gate) => gate.status === "skipped");
  const passed = required.filter((gate) => gate.status === "passed");
  const blocking = [...failed, ...pending, ...skipped];
  return {
    status: failed.length ? "failed" : blocking.length ? "pending" : "passed",
    releaseReady: blocking.length === 0,
    requiredTotal: required.length,
    passed: passed.length,
    failed: failed.length,
    pending: pending.length,
    skipped: skipped.length,
    blockingGateIds: blocking.map((gate) => gate.id),
  };
}

function isSha256(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function perceptualReviewGates(
  submission: PerceptualReviewSubmission | null | undefined,
  tasks: PerceptualReviewTask[] = REQUIRED_PERCEPTUAL_TASKS,
): QualificationGate[] {
  const provenanceValid = Boolean(
    typeof submission?.reviewer === "string" && submission.reviewer.trim()
    && typeof submission?.appCommit === "string" && submission.appCommit.trim()
    && !Number.isNaN(Date.parse(submission?.reviewedAt ?? ""))
    && isSha256(submission?.sourceMediaSha256 ?? ""),
  );
  const responses = new Map((Array.isArray(submission?.responses) ? submission.responses : [])
    .filter((response) => response && typeof response.taskId === "string")
    .map((response) => [response.taskId, response]));
  return tasks.map((task) => {
    const response = responses.get(task.id);
    const evidenceValid = Boolean(typeof response?.notes === "string" && response.notes.trim() && Array.isArray(response.evidence) && response.evidence.length && response.evidence.every((entry) => typeof entry === "string" && entry.trim()));
    const passed = Boolean(response && provenanceValid && evidenceValid && response.passed === true && typeof response.score === "number" && Number.isFinite(response.score) && response.score >= task.minimumScore && response.score <= 5);
    const failed = Boolean(response && provenanceValid && evidenceValid && (!response.passed || response.score < task.minimumScore || response.score > 5));
    return {
      id: `perceptual:${task.id}`,
      label: task.label,
      kind: "perceptual",
      required: task.required,
      status: passed ? "passed" : failed ? "failed" : "pending",
      details: !submission
        ? "Awaiting signed human review"
        : !provenanceValid
          ? "Reviewer, commit, timestamp, and source-media SHA-256 are required"
          : !response
            ? "No response recorded"
            : !evidenceValid
              ? "Notes and at least one evidence path are required"
              : `Score ${response.score}/5; ${response.passed ? "marked pass" : "marked fail"}`,
      evidencePath: response?.evidence[0],
    };
  });
}

export function blankPerceptualReviewSubmission(appCommit = ""): PerceptualReviewSubmission {
  return {
    reviewer: "",
    reviewedAt: "",
    appCommit,
    sourceMediaSha256: "",
    responses: REQUIRED_PERCEPTUAL_TASKS.map((task) => ({
      taskId: task.id,
      score: 0,
      passed: false,
      notes: "",
      evidence: [],
    })),
  };
}

export function deterministicBlindSide(id: string, seed: string): "left" | "right" {
  let hash = 2166136261;
  for (const character of `${seed}:${id}`) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? "left" : "right";
}
