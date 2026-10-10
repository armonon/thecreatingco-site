export type EditorCommandItem = {
  id: EditorCommandId;
  label: string;
  group: string;
  shortcut: string;
  enabled: boolean;
  run: () => void;
};

const EDITOR_COMMAND_SPECS = [
  { id: "new-project", label: "New project", group: "Project", shortcut: "⌘N" },
  { id: "import-media", label: "Import media", group: "Project", shortcut: "⌘I" },
  { id: "undo", label: "Undo", group: "Edit", shortcut: "⌘Z" },
  { id: "redo", label: "Redo", group: "Edit", shortcut: "⇧⌘Z" },
  { id: "copy", label: "Copy selection", group: "Edit", shortcut: "⌘C" },
  { id: "cut", label: "Cut selection", group: "Edit", shortcut: "⌘X" },
  { id: "paste", label: "Paste at playhead", group: "Edit", shortcut: "⌘V" },
  { id: "duplicate", label: "Duplicate selection", group: "Edit", shortcut: "⌘D" },
  { id: "delete", label: "Delete selection", group: "Edit", shortcut: "Delete" },
  { id: "ripple-delete", label: "Ripple delete selection", group: "Edit", shortcut: "⇧Delete" },
  { id: "split", label: "Split selected video at playhead", group: "Edit", shortcut: "⌘K" },
  { id: "play-pause", label: "Play / pause active monitor", group: "Transport", shortcut: "Space" },
  { id: "stop", label: "Stop active monitor", group: "Transport", shortcut: "K" },
  { id: "shuttle-reverse", label: "Shuttle reverse", group: "Transport", shortcut: "J" },
  { id: "shuttle-forward", label: "Shuttle forward", group: "Transport", shortcut: "L" },
  { id: "step-back", label: "Previous frame", group: "Transport", shortcut: "←" },
  { id: "step-forward", label: "Next frame", group: "Transport", shortcut: "→" },
  { id: "step-back-second", label: "Back one second", group: "Transport", shortcut: "⇧←" },
  { id: "step-forward-second", label: "Forward one second", group: "Transport", shortcut: "⇧→" },
  { id: "mark-in", label: "Mark In", group: "Transport", shortcut: "I" },
  { id: "mark-out", label: "Mark Out", group: "Transport", shortcut: "O" },
  { id: "source-insert", label: "Insert source into sequence", group: "Edit", shortcut: "," },
  { id: "source-overwrite", label: "Overwrite from source", group: "Edit", shortcut: "." },
  { id: "open-auto", label: "Open Auto Cut / Auto Director", group: "Workspace", shortcut: "⌥1" },
  { id: "open-edit", label: "Open Edit", group: "Workspace", shortcut: "⌥2" },
  { id: "open-composition", label: "Open Composition", group: "Workspace", shortcut: "⌥3", proOnly: true },
  { id: "open-color", label: "Open Color", group: "Workspace", shortcut: "⌥4", proOnly: true },
  { id: "open-audio", label: "Open Audio", group: "Workspace", shortcut: "⌥5", proOnly: true },
  { id: "open-deliver", label: "Open Deliver", group: "Workspace", shortcut: "⌥6", proOnly: true },
  { id: "save-project", label: "Save project", group: "Project", shortcut: "⌘S" },
  { id: "open-disk-project", label: "Open disk project document", group: "Project", shortcut: "⌘O", proOnly: true },
  { id: "save-disk-project-as", label: "Save disk project document as", group: "Project", shortcut: "⇧⌘S", proOnly: true },
  { id: "import-extension-pack", label: "Import ScenePilot extension pack", group: "Extensions", shortcut: "", proOnly: true },
  { id: "export-extension-pack", label: "Export creator extension pack", group: "Extensions", shortcut: "", proOnly: true },
  { id: "queue-master", label: "Add master to render queue", group: "Project", shortcut: "" },
  { id: "generate-alternatives", label: "Generate three editorial alternatives", group: "Auto Director", shortcut: "" },
  { id: "tool-select", label: "Select tool", group: "Timeline", shortcut: "V", proOnly: true },
  { id: "tool-razor", label: "Razor tool", group: "Timeline", shortcut: "C", proOnly: true },
  { id: "tool-slip", label: "Slip tool", group: "Timeline", shortcut: "Y", proOnly: true },
  { id: "tool-slide", label: "Slide tool", group: "Timeline", shortcut: "U", proOnly: true },
  { id: "tool-roll", label: "Roll tool", group: "Timeline", shortcut: "N", proOnly: true },
  { id: "tool-fade", label: "Fade tool", group: "Timeline", shortcut: "F", proOnly: true },
  { id: "add-marker", label: "Add marker", group: "Timeline", shortcut: "M" },
  { id: "extract-range", label: "Extract marked range", group: "Timeline", shortcut: "'" },
  { id: "fit-to-fill", label: "Fit selected clip to range (fit-to-fill)", group: "Timeline", shortcut: "" },
  { id: "close-gaps", label: "Close all V1 gaps", group: "Timeline", shortcut: "" },
  { id: "match-frame", label: "Match frame in Source", group: "Timeline", shortcut: "⇧F" },
  { id: "group-selection", label: "Group selected clips", group: "Timeline", shortcut: "⌘G" },
  { id: "ungroup-selection", label: "Ungroup selected clips", group: "Timeline", shortcut: "⇧⌘G" },
  { id: "nest-selection", label: "Nest selected clips into a composition", group: "Timeline", shortcut: "" },
  { id: "select-all", label: "Select all V1 clips", group: "Timeline", shortcut: "⌘A" },
  { id: "deselect", label: "Deselect timeline", group: "Timeline", shortcut: "Esc" },
  { id: "replace-edit", label: "Replace edit from Source", group: "Timeline", shortcut: "" },
  { id: "build-multicam", label: "Build multicam pass", group: "Auto Director", shortcut: "" },
  { id: "import-captions", label: "Import SRT / VTT captions", group: "Text", shortcut: "" },
  { id: "export-captions", label: "Export SRT caption sidecar", group: "Text", shortcut: "" },
  { id: "remove-dialogue-silence", label: "Remove dialogue silence", group: "Text", shortcut: "" },
  { id: "export-edl", label: "Export CMX 3600 EDL", group: "Interchange", shortcut: "" },
  { id: "export-fcpxml", label: "Export FCPXML", group: "Interchange", shortcut: "" },
  { id: "export-otio", label: "Export OpenTimelineIO", group: "Interchange", shortcut: "" },
  { id: "collect-media", label: "Collect project with media", group: "Project", shortcut: "" },
  { id: "queue-social", label: "Queue social version set", group: "Delivery", shortcut: "" },
  { id: "new-composition", label: "New composition with custom settings", group: "Project", shortcut: "", proOnly: true },
  { id: "tool-rate", label: "Rate Stretch tool", group: "Timeline", shortcut: "R", proOnly: true },
  { id: "tool-hand", label: "Hand tool", group: "Timeline", shortcut: "H", proOnly: true },
  { id: "tool-zoom", label: "Zoom tool", group: "Timeline", shortcut: "Z", proOnly: true },
] as const;

export type EditorCommandId = (typeof EDITOR_COMMAND_SPECS)[number]["id"];
export type EditorCommandActions = Record<EditorCommandId, () => void>;

/** Bind stable command metadata to the editor's action layer. UI search and
 * shortcuts never need direct access to timeline/project state. */
export function buildEditorCommandItems(actions: EditorCommandActions, isPro: boolean, availability: Partial<Record<EditorCommandId, boolean>> = {}): EditorCommandItem[] {
  return EDITOR_COMMAND_SPECS
    .filter((spec) => !("proOnly" in spec && spec.proOnly) || isPro)
    .map((spec) => ({ id: spec.id, label: spec.label, group: spec.group, shortcut: spec.shortcut, enabled: availability[spec.id] !== false, run: () => { if (availability[spec.id] !== false) actions[spec.id](); } }));
}
