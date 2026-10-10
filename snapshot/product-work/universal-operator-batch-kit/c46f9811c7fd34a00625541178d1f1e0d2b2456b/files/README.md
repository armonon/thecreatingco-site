# Reclaim

Reclaim is a Mac storage-review and reversible-quarantine alpha built with Tauri2 and React. The native interface is `DiskCleanerPanel`; the original supervised operator kit remains in the source but its overlays are disabled. The separate browser edition (`site/browser/`) is **read-only** file review. It cannot quarantine, restore or delete files.

## Run and verify

```sh
npm ci
npm run typecheck
npm test
npm run build
cd src-tauri
cargo test --locked
# From the repository root, on macOS:
# npm run tauri dev
```

Prerequisites: Node, Rust and Xcode command-line tools. Frontend styles are built locally; no Tailwind CDN is required. Native file operations are Mac-only qualified in the current source. A Windows build workflow does not establish Windows support.

Read [native safety and qualification](docs/RECLAIM_SAFETY.md) before testing removal or preparing a release. Use disposable files. Quarantine is reversible **until explicitly emptied or an enabled retention policy empties it**; moving into quarantine does not immediately free disk space.

Local native-engine and browser checks do not establish signed-package, clean-machine, physical Intel, macOS13, complete native UI or adversarial concurrent-filesystem safety. Published downloads have separate source/artifact provenance and qualification requirements.

## Original operator kit reference

The following describes retained integration features, not the current Reclaim UI or a claim that each workflow is release-qualified.

## What This Adds

- A typed batch task/action system.
- Approval tiers for safe suggestions, reversible actions, and sensitive actions.
- Repeatable task templates:
  - remove photo backgrounds in Photoshop
  - resize / convert image batches
  - organize folders by file type
  - long-run coding sessions with Codex
- A React `BatchOperatorPanel`.
- Work Session v1:
  - persistent SQLite session history
  - saved workflow recipes
  - live stdout/stderr process output events
  - emergency stop for registered native jobs
- Tauri/Rust commands for:
  - listing files
  - creating export folders
  - copying/moving/renaming files
  - generating a Photoshop JSX background-removal script
  - running the Photoshop script after approval
  - resizing images with `sips`
  - running typed terminal commands without raw shell strings
  - running Codex CLI
  - verifying outputs
  - writing logs
  - saving/listing/loading/deleting work sessions
  - saving/listing/deleting workflow recipes
  - detecting installed tools

## Integration

Copy these into the real app:

```text
src/lib/batch-operator/*
src/components/BatchOperatorPanel.tsx
src/components/CodingWorkSessionPanel.tsx
src-tauri/src/batch_operator.rs
```

Then in `src-tauri/src/main.rs` or your command registration module:

```rust
mod batch_operator;

.invoke_handler(tauri::generate_handler![
  batch_operator::batch_list_files,
  batch_operator::batch_create_folder,
  batch_operator::batch_copy_files,
  batch_operator::batch_preview_file_moves,
  batch_operator::batch_move_files,
  batch_operator::batch_rename_files,
  batch_operator::batch_generate_photoshop_background_script,
  batch_operator::batch_run_photoshop_script,
  batch_operator::batch_resize_images,
  batch_operator::batch_run_safe_command,
  batch_operator::batch_run_codex,
  batch_operator::batch_stop_process,
  batch_operator::batch_save_session_history,
  batch_operator::batch_list_session_history,
  batch_operator::batch_get_session_history,
  batch_operator::batch_delete_session_history,
  batch_operator::batch_save_recipe,
  batch_operator::batch_list_recipes,
  batch_operator::batch_delete_recipe,
  batch_operator::batch_verify_outputs,
  batch_operator::batch_write_log,
  batch_operator::batch_reveal_in_finder,
  batch_operator::batch_detect_tools,
  batch_operator::batch_trust_repo,
  batch_operator::batch_untrust_repo,
  batch_operator::batch_list_trusted_repos,
  batch_operator::batch_is_repo_trusted,
  batch_operator::batch_resolve_command,
  batch_operator::batch_detect_project,
  batch_operator::batch_write_receipt,
  batch_operator::batch_undo_moves,
  batch_operator::batch_estimate_scope,
  batch_operator::batch_trash,
  batch_operator::batch_restore_trash,
  batch_operator::batch_list_trash,
  batch_operator::batch_save_project_memory,
  batch_operator::batch_get_project_memory,
  batch_operator::batch_list_project_memory,
])
```

Add this panel somewhere in your Operator UI:

```tsx
import { BatchOperatorPanel } from "./components/BatchOperatorPanel";

<BatchOperatorPanel />
```

The panel now includes a built-in **command bar** (type a request in natural language → it becomes a plan) and an optional **chat box**. Pass a `chatClient` to enable chat; actionable messages get a "Create work session" button that adopts the plan into the panel. A **verifier review** (second-opinion risk findings) shows in the session sidebar before you run.

```tsx
<BatchOperatorPanel chatClient={{ send: async (messages) => myModel.reply(messages) }} />
```

For the iterate-until-pass coding loop, add the dedicated panel:

```tsx
import { CodingWorkSessionPanel } from "./components/CodingWorkSessionPanel";

<CodingWorkSessionPanel initialProjectPath="/Users/you/code/my-project" />
```

It detects the stack (`batch_detect_project`), runs the check set, asks before each Codex fix (or auto-approves up to a budget), shows a live iteration timeline, and stops on success, the iteration cap, no-progress, or your stop. Both panels listen for `batch-process-output` events to render live command/Codex/Photoshop output.

The native module stores session history and recipes in:

```text
<app data dir>/work-sessions.sqlite3
```

## Photoshop Background Removal Flow

Example command:

> Remove the background from these 50 photos in Photoshop, export transparent PNGs, and preserve originals.

The flow:

1. Scan the selected files/folder.
2. Create an output folder.
3. Generate a session-scoped Photoshop JSX script.
4. Ask for approval.
5. Open Photoshop and run the script.
6. Export transparent PNGs.
7. Verify outputs.
8. Write a log.

The script never overwrites originals. It closes documents without saving changes.

## Safety

The executor will not run Tier 2 or Tier 3 actions until approved.

Tier 3 actions require a typed confirmation phrase.

The terminal runner no longer accepts arbitrary shell strings. It accepts typed commands such as:

- `listTopLevelFiles`
- `npmScript`
- `npmTest`
- `cargoCheck`
- `cargoTest`
- `pythonPytest`
- `gitStatus`
- `gitDiff`
- `gitLog`

This avoids `sh -lc` command injection and prevents suffix tricks like `npm run build && rm -rf dist`.

The typed allowlist stops injection in the operator's command, but it does **not** sandbox the target project's own code: `npm run build`, `cargo check`, `pytest`, and `codex exec` all execute whatever the project defines. Two controls address this:

- **Repository trust.** A coding Work Session begins with a Tier 3 "Trust this repository" step (`batch_trust_repo`, persisted in `trusted_repos`). Nothing in the project runs until the user types the confirmation. Trust is canonical-path scoped and can be revoked (`batch_untrust_repo`).
- **Resolved command bodies.** `batch_resolve_command` returns the concrete program/args plus the actual `package.json` script body, so the approval UI shows exactly what `npm run build` will execute instead of an opaque label.

Codex runs are sandboxed: `batch_run_codex` passes `--sandbox` (default `workspace-write`; override via `sandboxMode`, validated against `read-only` / `workspace-write` / `danger-full-access`) and an optional pinned `--model`. Note: confirm these flags against your installed Codex version.

Long-running native jobs are registered by session/process id and each runs in its own process group. `batch_stop_process` signals the whole group (SIGTERM, then SIGKILL escalation after a short grace period), so child process trees — `npm`/`cargo`/Codex subprocesses — are stopped too, not just the launcher. Multi-step native loops (e.g. image resize) also check a per-session stop flag and halt between items.

Each native command additionally enforces a timeout (configurable via `timeoutSecs`; defaults: commands 300s, Codex 600s, resize 120s/image, Photoshop none unless set). On expiry the job is group-killed and reported as timed out. Move/rename are idempotent: if a prior run already moved a file, a re-run treats it as done instead of failing.

File organization has a dry-run preview step before moving files.

The injection gate is the typed command enum in the native layer, not a string blocklist — typed commands cannot carry suffixes or pipes. The dangerous-pattern list (`isDangerousCommand`) is therefore applied where it can actually do work: against the *resolved* command and `package.json` script body shown at approval time, surfacing a warning in the UI for patterns such as:

- `rm -rf /`
- `sudo`
- `curl | sh`
- `wget | bash`
- `chmod 777`
- commands that appear to expose secrets

Plans are still validated for approval-tier correctness and sensitive file paths (`.env`, `id_rsa`, `.ssh`, keychains) before anything runs.

## Local Verification

From this kit folder:

```bash
npm install
npm run typecheck
npm test          # 49 pure-logic unit tests (tsx)
cd src-tauri
cargo check
cargo clippy --all-targets
cargo test        # 19 Tier-0 safety tests (containment, overwrite, undo, allowlist, process-group kill + stop escalation, organization)
```

## Website + browser companion (reclaim.thecreatingco.com) — installable & offline

`site/` is the published Netlify site (`universal-computer-operator`, custom domain reclaim.thecreatingco.com), synced to the live deploy on 2026-10-06. `/browser/` is the **read-only** file review companion: it reads only files you select, compares equal-size files by SHA-256, and never changes, moves, uploads or deletes anything.

**PWA (thecreateco Wave 4 pattern):** `site/manifest.webmanifest` (name "Reclaim", start `/browser/`), icons in `site/icons/` (from `pwa/reclaim-mark.svg` via `pwa/gen-icons.mjs`), `site/pwa.js` (registration + "Update available — Reload" prompt; no silent swaps), `site/sw.js` **generated** by `node pwa/build-sw.mjs` from `pwa/sw.template.js` + `pwa/pwa.config.json` — rerun it after changing any app-shell file. Precaches the `/browser/` app; network-first navigations, offline fallback to the app; never caches user files, downloads, sample archives or anything cross-origin (except the public suite kit script). `/sw.js` is served `Cache-Control: no-cache` (`site/netlify.toml`). Works offline after the first visit.

- Verify: `node pwa/pwa-check.mjs` (local, incl. update cycle) or `PWA_CHECK_URL=https://reclaim.thecreatingco.com/ node pwa/pwa-check.mjs` (set `PLAYWRIGHT_PATH` to a playwright `index.mjs` if it isn't installed here).
- **Kill switch:** `cp pwa/kill-switch-sw.js site/sw.js` and deploy — every installed worker unregisters and clears its caches on next visit. Restoring an old deploy alone does not remove an installed worker.

**Suite menu:** both pages load `https://thecreatingco.com/suite/v1/suite.js` (`data-app="reclaim"`) and carry `<tcc-suite-menu>` in their nav (hidden until the kit defines it). Optional — works without it. No Locker integration: Reclaim reads local folders, and stays read-only.
