# Composition and Auto Cut workflow

This workflow applies to the browser-rendered Pro workspace used by Electron, not the separate native migration preview. Compositions remain a Pro capability.

## Auto Cut

Use **Auto Cut** beside the document tabs, or **AUTO EDIT** in the workspace bar. Import the song/video to analyze and the footage to arrange, then use the Auto Director's generation action (for Music mode, **MAKE MY MUSIC VIDEO**).

## Project Media and documents

- **MAIN SEQUENCE** is always the first horizontal document tab.
- Click another document tab, or a composition in **Project Media**, to edit it. Tab navigation also supports Left/Right, Home, and End.
- Switching documents preserves the visited composition's playhead and valid layer/track selection during the current editing session.
- Project Media contains imported assets and a searchable composition section. **COMPS** filters the panel to compositions.
- Drag a composition onto a sequence/composition track or into a composition viewer to nest it. Existing cycle checks still apply.

## Create a composition

Click the **New Composition** box or the **+** beside the document tabs. Set a name, width, height, duration, and viewer background. New blank compositions start from project dimensions and duration. The frame rate follows the project; independent per-comp frame rates are not implemented.

Drag an imported image/movie onto **New Composition**, or use its **New composition from…** media-row action, to start with that source as the first layer. The settings dialog uses project dimensions and the movie duration. Cancel does not create a comp or an undo entry.

Drag imported assets into an existing composition viewer to insert them at its playhead, or onto a timeline track for precise placement. Import external files before dropping them into an existing viewer. The new-composition box also has an external-file import path, but OS-to-browser file dragging remains a manual QA item.

Viewer background is a viewing guide, not an opaque render layer. Add a solid layer when an opaque background is required.

## Validation notes

Verified with the repository's real four-second `native-people.mp4` fixture: custom portrait comp creation; media-row source creation; Project Media source drag onto New Composition; viewer media drop; comp nesting; undo/redo; horizontal tab switching and playhead restoration; project save/restore; and opening Auto Cut. Layouts inspected at 1280×800, 1440×900, and 1920×1080. No browser console errors were observed.

Pure creation tests cover serialization, default tracks, source references/duration, and invalid settings. The editor remains under its existing shell-size budget after extracting shared composition document and library components.
