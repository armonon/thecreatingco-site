use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashSet, VecDeque},
    ffi::{OsStr, OsString},
    fs,
    io::{BufRead, BufReader},
    os::unix::process::CommandExt,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, LazyLock, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};
use thiserror::Error;
use uuid::Uuid;

type NativeAppHandle = tauri::AppHandle<tauri::Wry>;

static RUNNING_PROCESSES: LazyLock<Mutex<std::collections::HashMap<String, u32>>> =
    LazyLock::new(|| Mutex::new(std::collections::HashMap::new()));

// Sessions whose long-running native work has been asked to stop. Checked by
// multi-step native loops (e.g. image resize) so they halt between items.
static STOP_REQUESTED: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

#[derive(Debug, Error)]
pub enum BatchError {
    #[error("{0}")]
    Message(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
}

impl serde::Serialize for BatchError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchExecutionResult {
    ok: bool,
    message: String,
    output_paths: Vec<String>,
    stdout: Option<String>,
    stderr: Option<String>,
    metadata: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchFileInfo {
    path: String,
    name: String,
    extension: Option<String>,
    size_bytes: u64,
    is_directory: bool,
    /// Last-modified time as epoch milliseconds (None if unavailable). Lets the
    /// AI file manager filter by age ("files older than 30 days").
    modified_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkSessionSummary {
    id: String,
    title: String,
    status: String,
    user_goal: String,
    kind: String,
    updated_at: String,
    created_at: String,
    finished_at: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessOutputEvent {
    process_id: String,
    stream: String,
    line: String,
    timestamp: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListFilesInput {
    input_paths: Vec<String>,
    extensions: Option<Vec<String>>,
    recursive: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderInput {
    output_path: String,
    folders: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyMoveInput {
    files: Option<Vec<FilePair>>,
    input_paths: Option<Vec<String>>,
    output_path: Option<String>,
    overwrite: Option<bool>,
    strategy: Option<String>,
    dry_run: Option<bool>,
    confine_to_root: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePair {
    source: String,
    destination: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoshopScriptInput {
    input_paths: Vec<String>,
    output_path: String,
    preserve_originals: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunPhotoshopScriptInput {
    script_path: Option<String>,
    output_path: Option<String>,
    process_id: Option<String>,
    timeout_secs: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResizeImagesInput {
    input_paths: Vec<String>,
    output_path: String,
    width: Option<u32>,
    format: Option<String>,
    process_id: Option<String>,
    timeout_secs: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandInput {
    cwd: Option<String>,
    command: Option<TypedCommand>,
    auto_detect: Option<bool>,
    process_id: Option<String>,
    timeout_secs: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexInput {
    cwd: String,
    prompt: String,
    user_goal: Option<String>,
    process_id: Option<String>,
    timeout_secs: Option<u64>,
    sandbox_mode: Option<String>,
    model: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TypedCommand {
    ListTopLevelFiles {
        max_depth: Option<u8>,
        limit: Option<usize>,
    },
    NpmScript {
        script: String,
    },
    NpmTest,
    PnpmScript {
        script: String,
    },
    YarnScript {
        script: String,
    },
    CargoCheck,
    CargoTest,
    PythonPytest,
    GitStatus,
    GitDiff {
        stat: Option<bool>,
    },
    GitLog {
        limit: Option<u16>,
    },
    NodeScript {
        path: String,
        args: Option<Vec<String>>,
    },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyInput {
    output_path: String,
    expected_extension: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogInput {
    output_path: String,
    log_name: Option<String>,
    payload: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectProjectInput {
    cwd: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptInput {
    output_path: String,
    markdown: String,
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoMovesInput {
    pairs: Vec<FilePair>,
    confine_to_root: Option<String>,
    overwrite: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeInput {
    input_paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashInput {
    paths: Vec<String>,
    /// Optional user-approved root. When set, every path to be trashed must live
    /// inside it — so an AI-produced plan can't reach outside the folders the
    /// user actually reviewed (e.g. can't trash ~/.ssh while "cleaning Downloads").
    confine_to_root: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashItemInput {
    trash_id: String,
    original: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmptyQuarantineInput {
    /// Specific batches to empty; `None` means "every batch" (subject to age).
    trash_ids: Option<Vec<String>>,
    /// Only empty batches older than this many days.
    older_than_days: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashIdInput {
    trash_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMemoryInput {
    path: String,
    profile: Value,
}

#[tauri::command(async)]
pub fn batch_list_files(input: ListFilesInput) -> Result<BatchExecutionResult, BatchError> {
    let mut files = Vec::new();
    let extensions = input
        .extensions
        .unwrap_or_default()
        .into_iter()
        .map(|ext| ext.trim_start_matches('.').to_lowercase())
        .collect::<HashSet<_>>();
    let recursive = input.recursive.unwrap_or(true);

    let mut truncated = false;
    for raw_path in input.input_paths {
        let path = expand_home(&raw_path);
        if collect_files(&path, recursive, &extensions, &mut files)? {
            truncated = true;
            break;
        }
    }

    let message = if truncated {
        format!(
            "Found {}+ items (stopped at the {} scan limit — narrow the folder or add a filter).",
            files.len(),
            MAX_SCAN_FILES
        )
    } else {
        format!("Found {} matching item(s).", files.len())
    };
    Ok(ok(
        message,
        vec![],
        json!({ "files": files, "truncated": truncated }),
    ))
}

#[tauri::command]
pub fn batch_create_folder(input: FolderInput) -> Result<BatchExecutionResult, BatchError> {
    let output = expand_home(&input.output_path);
    fs::create_dir_all(&output)?;
    let mut created = vec![output.to_string_lossy().to_string()];

    for folder in input.folders.unwrap_or_default() {
        let child = output.join(sanitize_folder_name(&folder));
        fs::create_dir_all(&child)?;
        created.push(child.to_string_lossy().to_string());
    }

    Ok(ok(
        format!("Created {} folder(s).", created.len()),
        created.clone(),
        json!({ "created": created }),
    ))
}

#[tauri::command]
pub fn batch_copy_files(input: CopyMoveInput) -> Result<BatchExecutionResult, BatchError> {
    copy_or_move_files(input, false)
}

#[tauri::command]
pub fn batch_preview_file_moves(input: CopyMoveInput) -> Result<BatchExecutionResult, BatchError> {
    preview_file_moves(input)
}

#[tauri::command]
pub fn batch_move_files(input: CopyMoveInput) -> Result<BatchExecutionResult, BatchError> {
    copy_or_move_files(input, true)
}

#[tauri::command]
pub fn batch_rename_files(input: CopyMoveInput) -> Result<BatchExecutionResult, BatchError> {
    let pairs = input
        .files
        .ok_or_else(|| BatchError::Message("Missing file rename pairs.".into()))?;
    let overwrite = input.overwrite.unwrap_or(false);
    let confine = input.confine_to_root.as_deref().map(expand_home);
    let mut outputs = Vec::new();

    for pair in pairs {
        let source = expand_home(&pair.source);
        let destination = expand_home(&pair.destination);

        if let Some(root) = &confine {
            ensure_within_root(root, &source)?;
            ensure_within_root(root, &destination)?;
        }

        // Idempotency guard: a prior run already renamed this file.
        if !source.exists() && destination.exists() {
            outputs.push(destination.to_string_lossy().to_string());
            continue;
        }

        ensure_safe_destination(&destination, overwrite)?;
        fs::rename(&source, &destination)?;
        outputs.push(destination.to_string_lossy().to_string());
    }

    Ok(ok(
        format!("Renamed {} file(s).", outputs.len()),
        outputs.clone(),
        json!({ "renamed": outputs }),
    ))
}

#[tauri::command]
pub fn batch_generate_photoshop_background_script(
    input: PhotoshopScriptInput,
) -> Result<BatchExecutionResult, BatchError> {
    if !input.preserve_originals.unwrap_or(true) {
        return Err(BatchError::Message(
            "Background removal batch refuses to run unless preserveOriginals is true.".into(),
        ));
    }

    let output = expand_home(&input.output_path);
    fs::create_dir_all(&output)?;
    let files = resolve_supported_images(&input.input_paths)?;
    if files.is_empty() {
        return Err(BatchError::Message(
            "No supported images found for Photoshop batch.".into(),
        ));
    }

    let script_path = std::env::temp_dir().join(format!("uco-photoshop-bg-{}.jsx", Uuid::new_v4()));
    let script = photoshop_background_script(&files, &output)?;
    fs::write(&script_path, script)?;

    Ok(ok(
        format!("Prepared Photoshop script for {} image(s).", files.len()),
        vec![script_path.to_string_lossy().to_string()],
        json!({
            "scriptPath": script_path,
            "imageCount": files.len(),
            "outputPath": output,
        }),
    ))
}

#[tauri::command]
pub fn batch_run_photoshop_script(
    app: NativeAppHandle,
    input: RunPhotoshopScriptInput,
) -> Result<BatchExecutionResult, BatchError> {
    let script_path = match input.script_path {
        Some(path) => expand_home(&path),
        None => {
            return Err(BatchError::Message(
                "No generated Photoshop script path was provided for this session.".into(),
            ));
        }
    };
    if !script_path.exists() {
        return Err(BatchError::Message(format!(
            "Photoshop script does not exist: {}",
            script_path.display()
        )));
    }

    // Target Photoshop by bundle id so this works across versions instead of
    // being pinned to one year's app name.
    let apple_script = format!(
        r#"tell application id "com.adobe.Photoshop"
            activate
            do javascript file "{}"
        end tell"#,
        script_path.to_string_lossy().replace('"', "\\\"")
    );

    let process_id = input
        .process_id
        .unwrap_or_else(|| format!("photoshop-{}", Uuid::new_v4()));
    clear_stop(&process_id);
    // Photoshop batches can legitimately run a long time; only enforce a timeout
    // if the caller asked for one.
    let timeout = input.timeout_secs.map(Duration::from_secs);
    let output = run_registered_process(
        &app,
        process_id.clone(),
        "osascript",
        vec!["-e".to_string(), apple_script],
        None,
        timeout,
    )?;
    let timed_out = output.timed_out;
    let stdout = output.stdout;
    let stderr = output.stderr;

    if !output.success {
        let message = if timed_out {
            "Photoshop script timed out and was stopped."
        } else {
            "Photoshop script failed. Make sure Photoshop is installed and scripting is allowed."
        };
        return Ok(fail(message, Some(stdout), Some(stderr)));
    }

    Ok(ok_with_output(
        "Photoshop batch completed.",
        vec![],
        Some(stdout),
        Some(stderr),
        json!({ "scriptPath": script_path, "outputPath": input.output_path, "processId": process_id }),
    ))
}

#[tauri::command]
pub fn batch_resize_images(
    app: NativeAppHandle,
    input: ResizeImagesInput,
) -> Result<BatchExecutionResult, BatchError> {
    let files = resolve_supported_images(&input.input_paths)?;
    if files.is_empty() {
        return Err(BatchError::Message("No supported images found.".into()));
    }

    let output = expand_home(&input.output_path);
    fs::create_dir_all(&output)?;
    let width = input.width.unwrap_or(2048).to_string();
    let format = input.format.unwrap_or_else(|| "jpeg".into()).to_lowercase();
    let extension = if format == "jpg" { "jpeg" } else { &format };

    let process_id = input
        .process_id
        .unwrap_or_else(|| format!("resize-{}", Uuid::new_v4()));
    clear_stop(&process_id);
    let timeout = Some(Duration::from_secs(input.timeout_secs.unwrap_or(120)));

    let mut outputs = Vec::new();
    let mut failures = Vec::new();
    let mut stopped = false;

    for file in files {
        // Halt the batch between files if the user requested a stop.
        if is_stop_requested(&process_id) {
            stopped = true;
            break;
        }

        let stem = file.file_stem().and_then(OsStr::to_str).unwrap_or("image");
        let destination = unique_path(&output.join(format!("{}-resized.{}", stem, extension)));
        let result = run_registered_process(
            &app,
            process_id.clone(),
            "sips",
            vec![
                "-Z".into(),
                width.clone(),
                "-s".into(),
                "format".into(),
                extension.to_string(),
                file.to_string_lossy().to_string(),
                "--out".into(),
                destination.to_string_lossy().to_string(),
            ],
            None,
            timeout,
        );

        match result {
            Ok(process) if process.success => {
                outputs.push(destination.to_string_lossy().to_string())
            }
            Ok(process) => failures.push(json!({ "file": file, "stderr": process.stderr })),
            Err(error) => failures.push(json!({ "file": file, "error": error.to_string() })),
        }
    }

    let message = if stopped {
        format!(
            "Stopped after {} resized image(s); {} failed.",
            outputs.len(),
            failures.len()
        )
    } else {
        format!(
            "Exported {} resized image(s); {} failed.",
            outputs.len(),
            failures.len()
        )
    };

    Ok(ok(
        message,
        outputs.clone(),
        json!({ "outputs": outputs, "failures": failures, "stopped": stopped, "processId": process_id }),
    ))
}

#[tauri::command]
pub fn batch_run_safe_command(
    app: NativeAppHandle,
    input: CommandInput,
) -> Result<BatchExecutionResult, BatchError> {
    let cwd = input
        .cwd
        .as_deref()
        .map(expand_home)
        .unwrap_or(std::env::current_dir()?);

    // Native trust gate: running npm/cargo/etc. executes the project's own code,
    // so the working directory must be an explicitly trusted repository. Enforced
    // here (not just in the frontend) so a direct invoke can't bypass it.
    if !repo_is_trusted(&app, cwd.to_string_lossy().to_string())? {
        return Ok(fail(
            format!(
                "This folder isn't a trusted repository, so commands won't run here. Trust it first: {}",
                cwd.display()
            ),
            None,
            None,
        ));
    }

    let command = if input.auto_detect.unwrap_or(false) {
        detect_project_check_command(&cwd)?
    } else {
        input
            .command
            .ok_or_else(|| BatchError::Message("Missing command.".into()))?
    };

    let command_label = command_label(&command);
    let process = command_to_process(&command)?;
    let process_id = input
        .process_id
        .unwrap_or_else(|| format!("command-{}", Uuid::new_v4()));
    clear_stop(&process_id);
    let timeout = Some(Duration::from_secs(input.timeout_secs.unwrap_or(300)));
    let output = run_registered_process(
        &app,
        process_id.clone(),
        &process.program,
        process.args,
        Some(cwd.clone()),
        timeout,
    )?;
    let timed_out = output.timed_out;
    let stdout = trim_output_for_command(&command, output.stdout);
    let stderr = output.stderr;

    if !output.success {
        let message = if timed_out {
            format!("Command timed out: {}", command_label)
        } else {
            format!("Command failed: {}", command_label)
        };
        return Ok(fail(message, Some(stdout), Some(stderr)));
    }

    Ok(ok_with_output(
        format!("Command completed: {}", command_label),
        vec![],
        Some(stdout),
        Some(stderr),
        json!({ "cwd": cwd, "command": command_label, "processId": process_id }),
    ))
}

#[tauri::command]
pub fn batch_run_codex(
    app: NativeAppHandle,
    input: CodexInput,
) -> Result<BatchExecutionResult, BatchError> {
    if which::which("codex").is_err() {
        return Ok(fail(
            "Codex CLI is not installed or not on PATH.",
            None,
            None,
        ));
    }
    let cwd = expand_home(&input.cwd);

    // Native trust gate — Codex edits and runs code in this directory, so it must
    // be an explicitly trusted repository regardless of what the frontend claims.
    if !repo_is_trusted(&app, cwd.to_string_lossy().to_string())? {
        return Ok(fail(
            "This folder isn't a trusted repository — Codex won't run here until you trust it.",
            None,
            None,
        ));
    }

    let prompt = match input.user_goal {
        Some(goal) => format!("{}\n\nUser goal:\n{}", input.prompt, goal),
        None => input.prompt,
    };

    // Run Codex inside a sandbox so a single Tier-2 approval cannot grant it
    // unrestricted machine access. Defaults to workspace-write (edit the repo,
    // no broad filesystem/network access).
    let sandbox = input
        .sandbox_mode
        .clone()
        .unwrap_or_else(|| "workspace-write".into());
    validate_sandbox_mode(&sandbox)?;
    if !sandbox_run_permitted(&sandbox) {
        return Ok(fail(
            "Refusing to run Codex with danger-full-access — use read-only or workspace-write.",
            None,
            None,
        ));
    }

    let process_id = input
        .process_id
        .unwrap_or_else(|| format!("codex-{}", Uuid::new_v4()));
    clear_stop(&process_id);
    let timeout = Some(Duration::from_secs(input.timeout_secs.unwrap_or(600)));

    // `codex exec` is non-interactive and is governed entirely by --sandbox;
    // current Codex (0.140) rejects --approval-policy here as an unknown
    // argument, so the sandbox above (default workspace-write) is the real
    // containment boundary. Do not re-add --approval-policy to exec.
    let mut codex_args: Vec<String> = vec![
        "exec".into(),
        "--sandbox".into(),
        sandbox.clone(),
    ];
    if let Some(model) = input.model.as_ref().filter(|value| !value.is_empty()) {
        codex_args.push("--model".into());
        codex_args.push(model.clone());
    }
    codex_args.push(prompt);

    let output = run_registered_process(
        &app,
        process_id.clone(),
        "codex",
        codex_args,
        Some(cwd.clone()),
        timeout,
    )?;

    let timed_out = output.timed_out;
    let stdout = output.stdout;
    let stderr = output.stderr;
    if !output.success {
        let message = if timed_out {
            "Codex run timed out and was stopped."
        } else {
            "Codex run failed or was stopped."
        };
        return Ok(fail(message, Some(stdout), Some(stderr)));
    }

    Ok(ok_with_output(
        "Codex run completed.",
        vec![],
        Some(stdout),
        Some(stderr),
        json!({ "cwd": cwd, "processId": process_id, "sandbox": sandbox }),
    ))
}

fn validate_sandbox_mode(mode: &str) -> Result<(), BatchError> {
    matches!(mode, "read-only" | "workspace-write" | "danger-full-access")
        .then_some(())
        .ok_or_else(|| {
            BatchError::Message(format!(
                "Unsupported Codex sandbox mode: {}. Use read-only, workspace-write, or danger-full-access.",
                mode
            ))
        })
}

#[tauri::command]
pub fn batch_stop_process(process_id: String) -> Result<BatchExecutionResult, BatchError> {
    // Flag the session as stopping so any multi-step native loop halts between items,
    // even if no single process is registered at this instant.
    request_stop(&process_id);

    let pid = {
        let processes = RUNNING_PROCESSES
            .lock()
            .map_err(|_| BatchError::Message("Process registry is unavailable.".into()))?;
        processes.get(&process_id).copied()
    };

    let Some(pid) = pid else {
        return Ok(ok(
            "Stop requested. No native process is currently running for this session.",
            vec![],
            json!({ "processId": process_id, "stopRequested": true }),
        ));
    };

    // Graceful stop of the whole process group, then escalate to SIGKILL if it
    // is still the registered process after a short grace period.
    kill_process_group(pid, libc::SIGTERM);
    {
        let process_id = process_id.clone();
        thread::spawn(move || {
            thread::sleep(Duration::from_secs(3));
            let still = RUNNING_PROCESSES
                .lock()
                .ok()
                .and_then(|processes| processes.get(&process_id).copied());
            // Only escalate if the exact same pid is still running (guards PID reuse).
            if still == Some(pid) {
                kill_process_group(pid, libc::SIGKILL);
            }
        });
    }

    Ok(ok(
        "Stop signal sent to the process group (SIGTERM now, SIGKILL escalation armed).",
        vec![],
        json!({ "processId": process_id, "pid": pid }),
    ))
}

#[tauri::command]
pub fn batch_verify_outputs(input: VerifyInput) -> Result<BatchExecutionResult, BatchError> {
    let output = expand_home(&input.output_path);
    let extension = input
        .expected_extension
        .map(|item| item.trim_start_matches('.').to_lowercase());
    let mut count = 0usize;
    let mut outputs = Vec::new();
    if output.exists() {
        for entry in fs::read_dir(&output)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() {
                let matches = extension.as_ref().is_none_or(|expected| {
                    path.extension()
                        .and_then(OsStr::to_str)
                        .map(|actual| actual.eq_ignore_ascii_case(expected))
                        .unwrap_or(false)
                });
                if matches {
                    count += 1;
                    outputs.push(path.to_string_lossy().to_string());
                }
            }
        }
    }

    Ok(ok(
        format!("Verified {} output file(s).", count),
        outputs.clone(),
        json!({ "count": count, "outputs": outputs }),
    ))
}

#[tauri::command]
pub fn batch_write_log(input: LogInput) -> Result<BatchExecutionResult, BatchError> {
    let output = expand_home(&input.output_path);
    fs::create_dir_all(&output)?;
    let name = input.log_name.unwrap_or_else(|| "batch-log".into());
    let log_path = unique_path(&output.join(format!(
        "{}-{}.json",
        name,
        Utc::now().format("%Y%m%d-%H%M%S")
    )));
    let payload = input.payload.unwrap_or_else(
        || json!({ "createdAt": Utc::now(), "source": "Universal Computer Operator" }),
    );
    fs::write(&log_path, serde_json::to_vec_pretty(&payload)?)?;
    Ok(ok(
        "Wrote batch log.",
        vec![log_path.to_string_lossy().to_string()],
        json!({ "logPath": log_path }),
    ))
}

#[tauri::command]
pub fn batch_write_receipt(input: ReceiptInput) -> Result<BatchExecutionResult, BatchError> {
    let output = expand_home(&input.output_path);
    fs::create_dir_all(&output)?;
    let name = input.name.unwrap_or_else(|| "session-receipt".into());
    let receipt_path = unique_path(&output.join(format!(
        "{}-{}.md",
        sanitize_folder_name(&name),
        Utc::now().format("%Y%m%d-%H%M%S")
    )));
    fs::write(&receipt_path, input.markdown)?;
    Ok(ok(
        "Wrote session receipt.",
        vec![receipt_path.to_string_lossy().to_string()],
        json!({ "receiptPath": receipt_path }),
    ))
}

#[tauri::command]
pub fn batch_undo_moves(input: UndoMovesInput) -> Result<BatchExecutionResult, BatchError> {
    let confine = input.confine_to_root.as_deref().map(expand_home);
    let overwrite = input.overwrite.unwrap_or(false);
    let mut restored = Vec::new();
    let mut skipped: Vec<Value> = Vec::new();

    // Reverse order so nested moves unwind cleanly: move each destination back
    // to its original source location.
    for pair in input.pairs.iter().rev() {
        let source = expand_home(&pair.source);
        let destination = expand_home(&pair.destination);

        if let Some(root) = &confine {
            ensure_within_root(root, &source)?;
            ensure_within_root(root, &destination)?;
        }

        if !destination.exists() {
            skipped.push(json!({ "path": destination.to_string_lossy(), "reason": "already gone" }));
            continue;
        }
        if source.exists() && !overwrite {
            skipped.push(json!({ "path": source.to_string_lossy(), "reason": "original still present" }));
            continue;
        }
        if let Some(parent) = source.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::rename(&destination, &source)?;
        restored.push(source.to_string_lossy().to_string());
    }

    Ok(ok(
        format!(
            "Restored {} file(s); skipped {}.",
            restored.len(),
            skipped.len()
        ),
        restored.clone(),
        json!({ "restored": restored, "skipped": skipped }),
    ))
}

#[tauri::command]
pub fn batch_estimate_scope(input: ScopeInput) -> Result<BatchExecutionResult, BatchError> {
    const CAP: u64 = 200_000;
    let mut files = 0u64;
    let mut dirs = 0u64;
    let mut bytes = 0u64;
    for raw in &input.input_paths {
        walk_scope(&expand_home(raw), &mut files, &mut dirs, &mut bytes, CAP);
    }
    let capped = files + dirs >= CAP;
    Ok(ok(
        format!(
            "Scope: {} file(s), {} folder(s), {}{}.",
            files,
            dirs,
            human_bytes(bytes),
            if capped { " (truncated)" } else { "" }
        ),
        vec![],
        json!({
            "fileCount": files,
            "dirCount": dirs,
            "totalBytes": bytes,
            "humanSize": human_bytes(bytes),
            "capped": capped,
        }),
    ))
}

#[tauri::command(async)]
pub fn batch_trash(
    app: NativeAppHandle,
    input: TrashInput,
) -> Result<BatchExecutionResult, BatchError> {
    let base = trash_root(&app)?;
    trash_in(&base, input)
}

fn trash_in(base: &Path, input: TrashInput) -> Result<BatchExecutionResult, BatchError> {
    let confine = input.confine_to_root.as_deref().map(expand_home);

    // Containment is validated up front: if an approved root is set and ANY path
    // falls outside it, the whole request is refused before anything is trashed.
    if let Some(root) = &confine {
        ensure_all_within_root(root, &input.paths)?;
    }

    let base_resolved = canonicalize_existing_prefix(base);
    for raw in &input.paths {
        let source = canonicalize_existing_prefix(&expand_home(raw));
        if source.starts_with(&base_resolved) || base_resolved.starts_with(&source) {
            return Err(BatchError::Message("Cannot quarantine the recovery store or one of its parents.".into()));
        }
    }

    let trash_id = Uuid::new_v4().to_string();
    let trash_dir = base.join(&trash_id);
    fs::create_dir_all(base)?;
    {
        use std::os::unix::fs::DirBuilderExt;
        fs::DirBuilder::new().mode(0o700).create(&trash_dir)?;
    }

    // Record every planned move before touching its source. Fixed storage names
    // cannot collide with recovery metadata or with another user's filename.
    let cwd = std::env::current_dir()?;
    let items: Vec<Value> = input.paths.iter().enumerate().map(|(index, raw)| {
        let original = expand_home(raw);
        let original = if original.is_absolute() { original } else {
            cwd.join(original)
        };
        json!({ "original": original, "trashed": trash_dir.join(format!("item-{index:08}")) })
    }).collect();
    let manifest = json!({ "trashId": trash_id, "trashedAt": Utc::now().to_rfc3339(), "items": items });
    let planned = validated_manifest_items(&trash_dir, &manifest)?;
    crate::private_file::write_private(&trash_dir.join("manifest.json"), &serde_json::to_vec_pretty(&manifest)?)?;
    fs::File::open(&trash_dir)?.sync_all()?;

    let mut moved = 0usize;
    let mut skipped: Vec<Value> = Vec::new();
    for (original, trashed) in planned {
        let outcome = move_recoverably(&original, &trashed);
        match outcome {
            Ok(()) => moved += 1,
            Err(error) => skipped.push(json!({ "path": original, "reason": error.to_string() })),
        }
    }

    Ok(ok(
        format!(
            "Moved {} item(s) to trash; skipped {}.",
            moved,
            skipped.len()
        ),
        vec![],
        json!({ "trashId": trash_id, "moved": moved, "skipped": skipped }),
    ))
}

#[tauri::command(async)]
pub fn batch_restore_trash(
    app: NativeAppHandle,
    input: TrashIdInput,
) -> Result<BatchExecutionResult, BatchError> {
    restore_batch_in(&trash_root(&app)?, &input.trash_id)
}

fn restore_batch_in(base: &Path, trash_id: &str) -> Result<BatchExecutionResult, BatchError> {
    let dir = trash_batch_dir(base, trash_id)?;
    let manifest = read_manifest(&dir)
        .ok_or_else(|| BatchError::Message("That quarantine batch has no valid manifest.".into()))?;
    let items = validated_manifest_items(&dir, &manifest)?;

    let mut restored = Vec::new();
    let mut skipped: Vec<Value> = Vec::new();
    for (original, trashed) in items {
        if fs::symlink_metadata(&trashed).is_err() {
            skipped.push(json!({ "path": trashed.to_string_lossy(), "reason": "missing from trash" }));
            continue;
        }
        if fs::symlink_metadata(&original).is_ok() {
            skipped.push(json!({ "path": original.to_string_lossy(), "reason": "original path occupied" }));
            continue;
        }
        if let Some(parent) = original.parent() {
            fs::create_dir_all(parent)?;
        }
        move_recoverably(&trashed, &original)?;
        restored.push(original.to_string_lossy().to_string());
    }

    Ok(ok(
        format!("Restored {} item(s); skipped {}.", restored.len(), skipped.len()),
        restored.clone(),
        json!({ "restored": restored, "skipped": skipped }),
    ))
}

#[tauri::command]
pub fn batch_list_trash(app: NativeAppHandle) -> Result<Vec<Value>, BatchError> {
    let base = trash_root(&app)?;
    let mut entries: Vec<Value> = Vec::new();
    if base.exists() {
        for entry in fs::read_dir(&base)?.flatten() {
            let manifest_path = entry.path().join("manifest.json");
            if let Ok(text) = fs::read_to_string(&manifest_path) {
                if let Ok(value) = serde_json::from_str::<Value>(&text) {
                    let count = value
                        .get("items")
                        .and_then(Value::as_array)
                        .map(|items| items.len())
                        .unwrap_or(0);
                    entries.push(json!({
                        "trashId": value.get("trashId").and_then(Value::as_str).unwrap_or_default(),
                        "trashedAt": value.get("trashedAt").and_then(Value::as_str).unwrap_or_default(),
                        "count": count,
                    }));
                }
            }
        }
    }
    Ok(entries)
}

fn trash_root(app: &NativeAppHandle) -> Result<PathBuf, BatchError> {
    let dir = app.path().app_data_dir().map_err(|err| {
        BatchError::Message(format!("Could not resolve app data directory: {}", err))
    })?;
    Ok(dir.join("trash"))
}

// ----- quarantine ------------------------------------------------------------
// "Trash" moves items into this app's quarantine folder on the same disk: it's
// reversible, but it frees no space until the quarantine is emptied. These
// commands make that honest — show what's held, restore single items, and empty
// batches (permanently, only on explicit user action or the retention policy).

/// Resolve a batch folder, refusing anything but a real batch id: the id is
/// joined onto the quarantine path, so "../" must never get through.
fn trash_batch_dir(base: &Path, trash_id: &str) -> Result<PathBuf, BatchError> {
    if Uuid::parse_str(trash_id).is_err() {
        return Err(BatchError::Message(format!("Not a quarantine batch: {trash_id}")));
    }
    let dir = base.join(trash_id);
    match fs::symlink_metadata(&dir) {
        Ok(metadata) if !metadata.is_dir() || metadata.file_type().is_symlink() => {
            return Err(BatchError::Message("Quarantine batch must be a real directory, not a link.".into()));
        }
        Err(error) if error.kind() != std::io::ErrorKind::NotFound => return Err(error.into()),
        _ => {}
    }
    Ok(dir)
}

fn read_manifest(dir: &Path) -> Option<Value> {
    let file = dir.join("manifest.json");
    if !fs::symlink_metadata(&file).ok()?.is_file() { return None; }
    serde_json::from_str(&fs::read_to_string(file).ok()?).ok()
}

fn rename_without_overwrite(source: &Path, destination: &Path) -> std::io::Result<()> {
    #[cfg(target_os = "macos")]
    {
        use std::{ffi::CString, os::unix::ffi::OsStrExt};
        let source = CString::new(source.as_os_str().as_bytes())?;
        let destination = CString::new(destination.as_os_str().as_bytes())?;
        // The filesystem enforces no-replace atomically, including dangling links.
        let result = unsafe { libc::renamex_np(source.as_ptr(), destination.as_ptr(), libc::RENAME_EXCL) };
        if result == 0 { Ok(()) } else { Err(std::io::Error::last_os_error()) }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (source, destination);
        Err(std::io::Error::new(std::io::ErrorKind::Unsupported, "Atomic quarantine moves require macOS"))
    }
}

fn copy_then_remove(source: &Path, destination: &Path) -> std::io::Result<()> {
    copy_then_remove_checked(source, destination, || {})
}

// The callback permits deterministic real-filesystem race regression tests;
// production supplies a no-op and never exposes this hook to IPC callers.
fn copy_then_remove_checked(source: &Path, destination: &Path, after_copy: impl FnOnce()) -> std::io::Result<()> {
    use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
    let parent = destination.parent().ok_or_else(|| std::io::Error::other("Missing destination directory"))?;
    let temporary = parent.join(format!(".reclaim-copy-{}", Uuid::new_v4()));
    let result = (|| {
        let input = fs::OpenOptions::new().read(true).custom_flags(libc::O_NOFOLLOW).open(source)?;
        let metadata = input.metadata()?;
        if !metadata.is_file() { return Err(std::io::Error::other("Cross-volume recovery supports regular files only")); }
        let snapshot = |md: &fs::Metadata| (md.dev(), md.ino(), md.len(), md.mtime(), md.mtime_nsec(), md.ctime(), md.ctime_nsec());
        let validate_source = || -> std::io::Result<()> {
            let opened = input.metadata()?;
            let current = fs::symlink_metadata(source)?;
            if !current.is_file() || snapshot(&metadata) != snapshot(&opened) || snapshot(&metadata) != snapshot(&current) {
                return Err(std::io::Error::other("Source changed during cross-volume copy; preserving source and any completed recovery copy."));
            }
            Ok(())
        };
        let output = fs::OpenOptions::new().write(true).create_new(true).mode(0o600).open(&temporary)?;
        #[cfg(target_os = "macos")]
        {
            use std::os::fd::AsRawFd;
            // Resource forks and extended attributes are user data too. The
            // descriptor API copies them without following a substituted path.
            let flags = libc::COPYFILE_DATA | libc::COPYFILE_METADATA;
            let copied = unsafe { libc::fcopyfile(input.as_raw_fd(), output.as_raw_fd(), std::ptr::null_mut(), flags) };
            if copied != 0 { return Err(std::io::Error::last_os_error()); }
        }
        #[cfg(not(target_os = "macos"))]
        {
            std::io::copy(&mut &input, &mut &output)?;
            output.set_permissions(metadata.permissions())?;
        }
        output.sync_all()?;
        after_copy();
        validate_source()?;
        drop(output);
        rename_without_overwrite(&temporary, destination)?;
        fs::File::open(parent)?.sync_all()?;
        validate_source()?;
        // No portable compare-and-unlink primitive exists: this last check is
        // fail-closed for observed changes, not a hostile-writer race guarantee.
        fs::remove_file(source)
    })();
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result
}

fn move_recoverably(source: &Path, destination: &Path) -> std::io::Result<()> {
    match rename_without_overwrite(source, destination) {
        Err(error) if error.raw_os_error() == Some(libc::EXDEV) => copy_then_remove(source, destination),
        result => result,
    }
}

fn manifest_items(manifest: &Value) -> Vec<(PathBuf, PathBuf)> {
    manifest
        .get("items")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|it| {
                    Some((
                        PathBuf::from(it.get("original")?.as_str()?),
                        PathBuf::from(it.get("trashed")?.as_str()?),
                    ))
                })
                .collect()
        })
        .unwrap_or_default()
}

fn validated_manifest_items(dir: &Path, manifest: &Value) -> Result<Vec<(PathBuf, PathBuf)>, BatchError> {
    let invalid = || BatchError::Message("Refusing invalid recovery metadata or an entry outside its batch.".into());
    let raw = manifest.get("items").and_then(Value::as_array).ok_or_else(invalid)?;
    let items = manifest_items(manifest);
    if items.len() != raw.len() { return Err(invalid()); }
    for (original, trashed) in &items {
        let normal_absolute = |path: &Path| path.is_absolute() && !path.components().any(|c| {
            matches!(c, std::path::Component::ParentDir | std::path::Component::CurDir)
        });
        if !normal_absolute(original) || !normal_absolute(trashed)
            || original.file_name().is_none()
            || trashed.parent() != Some(dir)
            || trashed.file_name() == Some(OsStr::new("manifest.json"))
            || original.starts_with(dir.parent().ok_or_else(invalid)?)
        {
            return Err(invalid());
        }
    }
    Ok(items)
}

/// Everything currently held, newest batch first, with on-disk sizes. Items
/// already restored are skipped (their quarantined copy no longer exists).
fn quarantine_info_in(base: &Path) -> Value {
    let mut batches: Vec<Value> = Vec::new();
    let mut total = 0u64;
    if let Ok(rd) = fs::read_dir(base) {
        for e in rd.flatten() {
            let dir = e.path();
            let Some(name) = dir.file_name().and_then(OsStr::to_str) else { continue };
            if Uuid::parse_str(name).is_err() {
                continue;
            }
            if trash_batch_dir(base, name).is_err() { continue; }
            let Some(manifest) = read_manifest(&dir) else { continue };
            let Ok(items) = validated_manifest_items(&dir, &manifest) else { continue };
            let held: Vec<(PathBuf, PathBuf)> = items
                .into_iter()
                .filter(|(_, trashed)| fs::symlink_metadata(trashed).is_ok())
                .collect();
            if held.is_empty() {
                continue;
            }
            let trashed_paths: Vec<PathBuf> = held.iter().map(|(_, t)| t.clone()).collect();
            let sizes = par_sizes(&trashed_paths, CLEAN_SIZE_CAP_FILES);
            let batch_bytes: u64 = sizes.iter().map(|(b, _)| *b).sum();
            total += batch_bytes;
            let items: Vec<Value> = held
                .iter()
                .zip(sizes.iter())
                .map(|((original, trashed), (bytes, _))| {
                    json!({
                        "original": original.to_string_lossy(),
                        "trashed": trashed.to_string_lossy(),
                        "sizeBytes": bytes,
                        "humanSize": human_bytes(*bytes),
                    })
                })
                .collect();
            batches.push(json!({
                "trashId": name,
                "trashedAt": manifest.get("trashedAt").and_then(Value::as_str).unwrap_or_default(),
                "itemCount": items.len(),
                "sizeBytes": batch_bytes,
                "humanSize": human_bytes(batch_bytes),
                "items": items,
            }));
        }
    }
    batches.sort_by(|a, b| {
        b["trashedAt"].as_str().unwrap_or("").cmp(a["trashedAt"].as_str().unwrap_or(""))
    });
    json!({ "totalBytes": total, "humanTotal": human_bytes(total), "batches": batches })
}

/// Put one quarantined item back where it came from.
fn restore_item_in(base: &Path, trash_id: &str, original: &str) -> Result<String, BatchError> {
    let dir = trash_batch_dir(base, trash_id)?;
    let manifest = read_manifest(&dir)
        .ok_or_else(|| BatchError::Message("That quarantine batch has no manifest.".into()))?;
    let (orig, trashed) = validated_manifest_items(&dir, &manifest)?
        .into_iter()
        .find(|(o, _)| o.to_string_lossy() == original)
        .ok_or_else(|| BatchError::Message(format!("{original} isn't in that batch.")))?;
    if fs::symlink_metadata(&trashed).is_err() {
        return Err(BatchError::Message(format!("{original} was already restored.")));
    }
    if fs::symlink_metadata(&orig).is_ok() {
        return Err(BatchError::Message(format!(
            "Something already exists at {} — move it first, then restore.",
            orig.display()
        )));
    }
    if let Some(parent) = orig.parent() {
        fs::create_dir_all(parent)?;
    }
    move_recoverably(&trashed, &orig)?;
    Ok(orig.to_string_lossy().to_string())
}

/// Permanently delete quarantine batches: the listed ids (or all), limited to
/// those older than `older_than_days` when given. Returns (bytes, batches) freed.
fn empty_quarantine_in(
    base: &Path,
    trash_ids: Option<&[String]>,
    older_than_days: Option<u64>,
    now: chrono::DateTime<Utc>,
) -> Result<EmptyOutcome, BatchError> {
    let targets: Vec<PathBuf> = match trash_ids {
        Some(ids) => ids
            .iter()
            .map(|id| trash_batch_dir(base, id))
            .collect::<Result<Vec<_>, _>>()?,
        None => fs::read_dir(base)
            .map(|rd| {
                rd.flatten()
                    .map(|e| e.path())
                    .filter(|p| {
                        p.file_name()
                            .and_then(OsStr::to_str)
                            .map(|n| Uuid::parse_str(n).is_ok())
                            .unwrap_or(false)
                    })
                    .collect()
            })
            .unwrap_or_default(),
    };
    let (mut freed, mut emptied) = (0u64, 0usize);
    let (mut failed, mut protected_apps) = (Vec::new(), Vec::<PathBuf>::new());
    for dir in targets {
        if !fs::symlink_metadata(&dir).map(|m| m.is_dir()).unwrap_or(false) {
            continue;
        }
        if let Some(days) = older_than_days {
            let trashed_at = read_manifest(&dir)
                .and_then(|m| m.get("trashedAt").and_then(Value::as_str).map(str::to_string))
                .and_then(|t| chrono::DateTime::parse_from_rfc3339(&t).ok());
            match trashed_at {
                Some(t) if u64::try_from(now.signed_duration_since(t).num_days()).is_ok_and(|age| age >= days) => {}
                _ => continue, // too recent, or undated: keep it
            }
        }
        let before = disk_usage(&dir, u64::MAX).0;
        let stuck = remove_tree(&dir);
        if stuck.is_empty() {
            freed += before;
            emptied += 1;
            continue;
        }
        // Keep going: one stubborn item shouldn't hold the rest hostage.
        freed += before.saturating_sub(disk_usage(&dir, u64::MAX).0);
        for path in stuck {
            match protected_app_bundle(&path) {
                Some(app) => {
                    if !protected_apps.contains(&app) {
                        protected_apps.push(app);
                    }
                }
                None => failed.push(path.to_string_lossy().into_owned()),
            }
        }
    }
    Ok(EmptyOutcome { freed, emptied, failed, protected_apps })
}

struct EmptyOutcome {
    freed: u64,
    emptied: usize,
    /// Paths that could not be removed for reasons other than app protection.
    failed: Vec<String>,
    /// App bundles macOS refuses to let Reclaim delete without App Management.
    protected_apps: Vec<PathBuf>,
}

/// macOS (13+) protects the contents of signed app bundles: without the App
/// Management permission even the owner can't chmod or delete inside one.
fn protected_app_bundle(path: &Path) -> Option<PathBuf> {
    path.ancestors()
        .find(|p| p.extension().is_some_and(|e| e.eq_ignore_ascii_case("app")))
        .map(Path::to_path_buf)
}

/// Delete a quarantined tree. Caches often hold read-only folders (Go's module
/// cache, copied app bundles) or files with the owner's "locked" flag set; both
/// make a plain `remove_dir_all` fail with EACCES/EPERM. On failure, lift those
/// owner-level locks — never following symlinks, and only inside `dir` — and retry.
/// Returns the paths still left behind (empty = fully removed). If something
/// can't go, everything else is still removed and the batch's manifest is kept,
/// so what remains stays listed and restorable.
fn remove_tree(dir: &Path) -> Vec<PathBuf> {
    match fs::remove_dir_all(dir) {
        Ok(()) => return Vec::new(),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Vec::new(),
        Err(_) => {}
    }
    make_removable(dir);
    if fs::remove_dir_all(dir).is_ok() {
        return Vec::new();
    }
    let mut stuck = Vec::new();
    let manifest = dir.join("manifest.json");
    if let Ok(rd) = fs::read_dir(dir) {
        for entry in rd.flatten() {
            let path = entry.path();
            if path != manifest {
                remove_best_effort(&path, &mut stuck);
            }
        }
    }
    if stuck.is_empty() {
        if let Err(err) = fs::remove_dir_all(dir) {
            if err.kind() != std::io::ErrorKind::NotFound {
                stuck.push(dir.to_path_buf());
            }
        }
    }
    stuck
}

/// Remove what can be removed under `path`, recording what can't. A directory
/// we still can't write to (after `make_removable`) is recorded once rather
/// than once per file inside it. Never follows symlinks.
fn remove_best_effort(path: &Path, stuck: &mut Vec<PathBuf>) {
    use std::os::unix::fs::PermissionsExt;
    let Ok(md) = fs::symlink_metadata(path) else { return };
    if !md.is_dir() {
        if fs::remove_file(path).is_err() {
            stuck.push(path.to_path_buf());
        }
        return;
    }
    if md.permissions().mode() & 0o200 == 0 {
        stuck.push(path.to_path_buf());
        return;
    }
    let before = stuck.len();
    match fs::read_dir(path) {
        Ok(rd) => rd.flatten().for_each(|e| remove_best_effort(&e.path(), stuck)),
        Err(_) => {
            stuck.push(path.to_path_buf());
            return;
        }
    }
    if stuck.len() == before && fs::remove_dir(path).is_err() {
        stuck.push(path.to_path_buf());
    }
}

/// Give the owner write access to every directory and clear the user-settable
/// immutable/append-only flags under `root`. System flags (schg) are left alone.
fn make_removable(root: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let mut stack = vec![root.to_path_buf()];
    while let Some(path) = stack.pop() {
        let Ok(md) = fs::symlink_metadata(&path) else { continue };
        clear_user_flags(&path, &md);
        if md.is_dir() {
            let mode = md.permissions().mode();
            if mode & 0o700 != 0o700 {
                let _ = fs::set_permissions(&path, fs::Permissions::from_mode(mode | 0o700));
            }
            if let Ok(rd) = fs::read_dir(&path) {
                stack.extend(rd.flatten().map(|e| e.path()));
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn clear_user_flags(path: &Path, md: &fs::Metadata) {
    use std::os::macos::fs::MetadataExt;
    use std::os::unix::ffi::OsStrExt;
    let flags = md.st_flags();
    let user = libc::UF_IMMUTABLE | libc::UF_APPEND;
    if flags & user == 0 {
        return;
    }
    // lchflags acts on a symlink itself, never its target (macOS libc; not in the `libc` crate).
    extern "C" {
        fn lchflags(path: *const libc::c_char, flags: libc::c_uint) -> libc::c_int;
    }
    if let Ok(c) = std::ffi::CString::new(path.as_os_str().as_bytes()) {
        unsafe { lchflags(c.as_ptr(), flags & !user) };
    }
}

#[cfg(not(target_os = "macos"))]
fn clear_user_flags(_path: &Path, _md: &fs::Metadata) {}

#[tauri::command(async)]
pub fn batch_quarantine_info(app: NativeAppHandle) -> Result<Value, BatchError> {
    Ok(quarantine_info_in(&trash_root(&app)?))
}

#[tauri::command(async)]
pub fn batch_restore_trash_item(
    app: NativeAppHandle,
    input: TrashItemInput,
) -> Result<BatchExecutionResult, BatchError> {
    let restored = restore_item_in(&trash_root(&app)?, &input.trash_id, &input.original)?;
    Ok(ok(format!("Restored {restored}."), vec![restored.clone()], json!({ "restored": restored })))
}

/// Permanently empty quarantine batches. The only permanent deletion in the app;
/// the UI calls it on an explicit, typed confirmation or the retention policy.
#[tauri::command(async)]
pub fn batch_empty_quarantine(
    app: NativeAppHandle,
    input: EmptyQuarantineInput,
) -> Result<BatchExecutionResult, BatchError> {
    let EmptyOutcome { freed, emptied, failed, protected_apps } = empty_quarantine_in(
        &trash_root(&app)?,
        input.trash_ids.as_deref(),
        input.older_than_days,
        Utc::now(),
    )?;
    let protected: Vec<Value> = protected_apps
        .iter()
        .map(|p| {
            let bytes = disk_usage(p, u64::MAX).0;
            json!({
                "name": p.file_name().and_then(OsStr::to_str).unwrap_or("app"),
                "sizeBytes": bytes,
                "humanSize": human_bytes(bytes),
            })
        })
        .collect();
    Ok(ok(
        format!("Freed {} by emptying {emptied} quarantine batch(es).", human_bytes(freed)),
        vec![],
        json!({
            "freedBytes": freed,
            "humanFreed": human_bytes(freed),
            "emptied": emptied,
            "failed": failed,
            "protectedApps": protected,
        }),
    ))
}

/// Whether the app has Full Disk Access (needed for Trash, Mail, backups).
#[tauri::command]
pub fn disk_full_disk_access() -> bool {
    has_full_disk_access()
}

fn walk_scope(path: &Path, files: &mut u64, dirs: &mut u64, bytes: &mut u64, cap: u64) {
    if *files + *dirs >= cap {
        return;
    }
    if path.is_dir() {
        *dirs += 1;
        if let Ok(read) = fs::read_dir(path) {
            for entry in read.flatten() {
                let child = entry.path();
                if child.is_dir() {
                    walk_scope(&child, files, dirs, bytes, cap);
                } else if let Ok(meta) = entry.metadata() {
                    *files += 1;
                    *bytes += meta.len();
                }
                if *files + *dirs >= cap {
                    return;
                }
            }
        }
    } else if path.is_file() {
        if let Ok(meta) = fs::metadata(path) {
            *files += 1;
            *bytes += meta.len();
        }
    }
}

fn human_bytes(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 {
        format!("{} B", bytes)
    } else {
        format!("{:.1} {}", value, UNITS[unit])
    }
}

#[tauri::command]
pub fn batch_reveal_in_finder(input: FolderInput) -> Result<BatchExecutionResult, BatchError> {
    let path = expand_home(&input.output_path);
    Command::new("open").arg("-R").arg(&path).output()?;
    Ok(ok(
        "Revealed in Finder.",
        vec![path.to_string_lossy().to_string()],
        json!({}),
    ))
}

#[tauri::command]
pub fn batch_detect_tools() -> Result<BatchExecutionResult, BatchError> {
    let tools = [
        "codex",
        "git",
        "node",
        "npm",
        "cargo",
        "sips",
        "ffmpeg",
        "magick",
        "osascript",
    ];
    let detected = tools
        .iter()
        .map(|tool| json!({ "name": tool, "available": which::which(tool).is_ok() }))
        .collect::<Vec<_>>();
    Ok(ok(
        "Detected local tool availability.",
        vec![],
        json!({ "tools": detected }),
    ))
}

#[tauri::command]
pub fn batch_detect_project(
    input: DetectProjectInput,
) -> Result<BatchExecutionResult, BatchError> {
    let cwd = expand_home(&input.cwd);
    let has_git = cwd.join(".git").exists();
    let mut checks: Vec<Value> = Vec::new();
    let mut stack = "unknown";
    let mut package_manager: Option<&str> = None;

    let package_json = cwd.join("package.json");
    if package_json.exists() {
        stack = "node";
        package_manager = Some(if cwd.join("pnpm-lock.yaml").exists() {
            "pnpm"
        } else if cwd.join("yarn.lock").exists() {
            "yarn"
        } else {
            "npm"
        });
        if let Ok(text) = fs::read_to_string(&package_json) {
            if let Ok(value) = serde_json::from_str::<Value>(&text) {
                if let Some(scripts) = value.get("scripts").and_then(Value::as_object) {
                    // Ordered, not just the first match: the loop wants the full check set.
                    for name in ["typecheck", "lint", "build", "test"] {
                        if scripts.contains_key(name) {
                            let command = if name == "test" {
                                TypedCommand::NpmTest
                            } else {
                                TypedCommand::NpmScript {
                                    script: name.to_string(),
                                }
                            };
                            checks.push(json!({ "label": name, "command": command_value(&command) }));
                        }
                    }
                }
            }
        }
    } else if cwd.join("Cargo.toml").exists() {
        stack = "rust";
        checks.push(json!({ "label": "cargo check", "command": command_value(&TypedCommand::CargoCheck) }));
        checks.push(json!({ "label": "cargo test", "command": command_value(&TypedCommand::CargoTest) }));
    } else if cwd.join("pyproject.toml").exists() || cwd.join("pytest.ini").exists() {
        stack = "python";
        checks
            .push(json!({ "label": "pytest", "command": command_value(&TypedCommand::PythonPytest) }));
    }

    Ok(ok(
        format!("Detected {} project with {} check(s).", stack, checks.len()),
        vec![],
        json!({
            "stack": stack,
            "packageManager": package_manager,
            "hasGit": has_git,
            "checks": checks,
            "cwd": cwd.to_string_lossy(),
        }),
    ))
}

fn command_value(command: &TypedCommand) -> Value {
    serde_json::to_value(command).unwrap_or(Value::Null)
}

#[tauri::command]
pub fn batch_save_session_history(app: NativeAppHandle, session: Value) -> Result<(), BatchError> {
    let conn = open_history_db(&app)?;
    let id = json_string(&session, "/id", "unknown-session");
    let title = json_string(&session, "/plan/title", "Untitled Work Session");
    let status = json_string(&session, "/status", "draft");
    let user_goal = json_string(&session, "/plan/userGoal", "");
    let kind = json_string(&session, "/plan/kind", "custom");
    let created_at = json_string(&session, "/plan/createdAt", &Utc::now().to_rfc3339());
    let finished_at = json_optional_string(&session, "/finishedAt");
    let updated_at = Utc::now().to_rfc3339();
    let payload = serde_json::to_string_pretty(&session)?;

    conn.execute(
        "insert into work_sessions
          (id, title, status, user_goal, kind, created_at, updated_at, finished_at, payload)
         values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         on conflict(id) do update set
          title=excluded.title,
          status=excluded.status,
          user_goal=excluded.user_goal,
          kind=excluded.kind,
          updated_at=excluded.updated_at,
          finished_at=excluded.finished_at,
          payload=excluded.payload",
        params![
            id,
            title,
            status,
            user_goal,
            kind,
            created_at,
            updated_at,
            finished_at,
            payload
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn batch_list_session_history(
    app: NativeAppHandle,
    limit: Option<u32>,
) -> Result<Vec<WorkSessionSummary>, BatchError> {
    let conn = open_history_db(&app)?;
    let mut stmt = conn.prepare(
        "select id, title, status, user_goal, kind, updated_at, created_at, finished_at
         from work_sessions
         order by updated_at desc
         limit ?1",
    )?;
    let rows = stmt.query_map(params![limit.unwrap_or(30).min(200)], |row| {
        Ok(WorkSessionSummary {
            id: row.get(0)?,
            title: row.get(1)?,
            status: row.get(2)?,
            user_goal: row.get(3)?,
            kind: row.get(4)?,
            updated_at: row.get(5)?,
            created_at: row.get(6)?,
            finished_at: row.get(7)?,
        })
    })?;
    // Skip-and-keep: a single bad row must not break history listing.
    Ok(rows.filter_map(|row| row.ok()).collect::<Vec<_>>())
}

#[tauri::command]
pub fn batch_get_session_history(
    app: NativeAppHandle,
    session_id: String,
) -> Result<Value, BatchError> {
    let conn = open_history_db(&app)?;
    let payload: String = conn.query_row(
        "select payload from work_sessions where id = ?1",
        params![session_id],
        |row| row.get(0),
    )?;
    serde_json::from_str(&payload).map_err(BatchError::from)
}

#[tauri::command]
pub fn batch_delete_session_history(
    app: NativeAppHandle,
    session_id: String,
) -> Result<(), BatchError> {
    let conn = open_history_db(&app)?;
    conn.execute(
        "delete from work_sessions where id = ?1",
        params![session_id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn batch_save_recipe(app: NativeAppHandle, recipe: Value) -> Result<(), BatchError> {
    let conn = open_history_db(&app)?;
    let id = json_string(&recipe, "/id", &format!("recipe-{}", Uuid::new_v4()));
    let name = json_string(&recipe, "/name", "Untitled Recipe");
    let description = json_string(&recipe, "/description", "");
    let kind = json_string(&recipe, "/kind", "custom");
    let goal = json_string(&recipe, "/goal", "");
    let default_output_path = json_optional_string(&recipe, "/defaultOutputPath");
    let created_at = json_string(&recipe, "/createdAt", &Utc::now().to_rfc3339());
    let updated_at = Utc::now().to_rfc3339();
    let payload = serde_json::to_string_pretty(&recipe)?;

    conn.execute(
        "insert into work_recipes
          (id, name, description, kind, goal, default_output_path, created_at, updated_at, payload)
         values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         on conflict(id) do update set
          name=excluded.name,
          description=excluded.description,
          kind=excluded.kind,
          goal=excluded.goal,
          default_output_path=excluded.default_output_path,
          updated_at=excluded.updated_at,
          payload=excluded.payload",
        params![
            id,
            name,
            description,
            kind,
            goal,
            default_output_path,
            created_at,
            updated_at,
            payload
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn batch_list_recipes(app: NativeAppHandle) -> Result<Vec<Value>, BatchError> {
    let conn = open_history_db(&app)?;
    let mut stmt = conn.prepare("select payload from work_recipes order by updated_at desc")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    // Skip-and-keep: one corrupt/legacy payload row must not break the whole list.
    let recipes = rows
        .filter_map(|row| row.ok())
        .filter_map(|payload| serde_json::from_str::<Value>(&payload).ok())
        .collect::<Vec<_>>();
    Ok(recipes)
}

#[tauri::command]
pub fn batch_delete_recipe(app: NativeAppHandle, recipe_id: String) -> Result<(), BatchError> {
    let conn = open_history_db(&app)?;
    conn.execute("delete from work_recipes where id = ?1", params![recipe_id])?;
    Ok(())
}

#[tauri::command]
pub fn batch_trust_repo(
    app: NativeAppHandle,
    path: String,
    label: Option<String>,
) -> Result<BatchExecutionResult, BatchError> {
    let canonical = canonical_repo_path(&path);
    let conn = open_history_db(&app)?;
    conn.execute(
        "insert into trusted_repos (path, trusted_at, label) values (?1, ?2, ?3)
         on conflict(path) do update set trusted_at=excluded.trusted_at, label=excluded.label",
        params![canonical, Utc::now().to_rfc3339(), label],
    )?;
    Ok(ok(
        format!("Trusted repository: {}", canonical),
        vec![],
        json!({ "path": canonical }),
    ))
}

#[tauri::command]
pub fn batch_untrust_repo(app: NativeAppHandle, path: String) -> Result<(), BatchError> {
    let canonical = canonical_repo_path(&path);
    let conn = open_history_db(&app)?;
    conn.execute(
        "delete from trusted_repos where path = ?1",
        params![canonical],
    )?;
    Ok(())
}

#[tauri::command]
pub fn batch_list_trusted_repos(app: NativeAppHandle) -> Result<Vec<Value>, BatchError> {
    let conn = open_history_db(&app)?;
    let mut stmt =
        conn.prepare("select path, trusted_at, label from trusted_repos order by trusted_at desc")?;
    let rows = stmt.query_map([], |row| {
        let path: String = row.get(0)?;
        let trusted_at: String = row.get(1)?;
        let label: Option<String> = row.get(2)?;
        Ok(json!({ "path": path, "trustedAt": trusted_at, "label": label }))
    })?;
    Ok(rows.filter_map(|row| row.ok()).collect::<Vec<_>>())
}

#[tauri::command]
pub fn batch_is_repo_trusted(app: NativeAppHandle, path: String) -> Result<bool, BatchError> {
    repo_is_trusted(&app, path)
}

/// Native trust check — the source of truth the command runners consult before
/// spawning anything, so the Tier-3 repository-trust gate can't be bypassed by a
/// direct `invoke` that skips the frontend.
fn repo_is_trusted(app: &NativeAppHandle, path: String) -> Result<bool, BatchError> {
    let canonical = canonical_repo_path(&path);
    let conn = open_history_db(app)?;
    let count: i64 = conn.query_row(
        "select count(*) from trusted_repos where path = ?1",
        params![canonical],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Sandbox modes the coding loop may actually *run* with. `danger-full-access`
/// validates as a mode but is refused at execution — it strips Codex's
/// containment entirely, which no supervised flow should grant.
fn sandbox_run_permitted(mode: &str) -> bool {
    matches!(mode, "read-only" | "workspace-write")
}

#[tauri::command]
pub fn batch_save_project_memory(
    app: NativeAppHandle,
    input: ProjectMemoryInput,
) -> Result<(), BatchError> {
    let canonical = canonical_repo_path(&input.path);
    let conn = open_history_db(&app)?;
    conn.execute(
        "insert into project_memory (path, profile, updated_at) values (?1, ?2, ?3)
         on conflict(path) do update set profile=excluded.profile, updated_at=excluded.updated_at",
        params![
            canonical,
            serde_json::to_string(&input.profile)?,
            Utc::now().to_rfc3339()
        ],
    )?;
    Ok(())
}

#[tauri::command]
pub fn batch_get_project_memory(app: NativeAppHandle, path: String) -> Result<Value, BatchError> {
    let canonical = canonical_repo_path(&path);
    let conn = open_history_db(&app)?;
    let profile: Option<String> = conn
        .query_row(
            "select profile from project_memory where path = ?1",
            params![canonical],
            |row| row.get(0),
        )
        .optional()?;
    match profile {
        Some(text) => serde_json::from_str(&text).map_err(BatchError::from),
        None => Ok(Value::Null),
    }
}

#[tauri::command]
pub fn batch_list_project_memory(app: NativeAppHandle) -> Result<Vec<Value>, BatchError> {
    let conn = open_history_db(&app)?;
    let mut stmt =
        conn.prepare("select path, profile, updated_at from project_memory order by updated_at desc")?;
    let rows = stmt.query_map([], |row| {
        let path: String = row.get(0)?;
        let profile: String = row.get(1)?;
        let updated_at: String = row.get(2)?;
        Ok(json!({
            "path": path,
            "profile": serde_json::from_str::<Value>(&profile).unwrap_or(Value::Null),
            "updatedAt": updated_at,
        }))
    })?;
    Ok(rows.filter_map(|row| row.ok()).collect::<Vec<_>>())
}

#[tauri::command]
pub fn batch_resolve_command(input: CommandInput) -> Result<BatchExecutionResult, BatchError> {
    let cwd = input
        .cwd
        .as_deref()
        .map(expand_home)
        .unwrap_or(std::env::current_dir()?);
    let command = if input.auto_detect.unwrap_or(false) {
        detect_project_check_command(&cwd)?
    } else {
        input
            .command
            .ok_or_else(|| BatchError::Message("Missing command.".into()))?
    };

    let label = command_label(&command);
    let process = command_to_process(&command)?;
    let script_body = resolve_script_body(&cwd, &command);

    Ok(ok(
        format!("Resolved: {}", label),
        vec![],
        json!({
            "label": label,
            "program": process.program,
            "args": process.args,
            "scriptBody": script_body,
            "cwd": cwd.to_string_lossy(),
        }),
    ))
}

/// For npm/pnpm/yarn script commands, read the actual script body from
/// package.json so the approval UI can show exactly what will run.
fn resolve_script_body(cwd: &Path, command: &TypedCommand) -> Option<String> {
    let script = match command {
        TypedCommand::NpmScript { script }
        | TypedCommand::PnpmScript { script }
        | TypedCommand::YarnScript { script } => script.clone(),
        TypedCommand::NpmTest => "test".to_string(),
        _ => return None,
    };
    let text = fs::read_to_string(cwd.join("package.json")).ok()?;
    let value: Value = serde_json::from_str(&text).ok()?;
    value
        .get("scripts")
        .and_then(|scripts| scripts.get(&script))
        .and_then(Value::as_str)
        .map(str::to_string)
}

/// Canonicalize a repo path for stable trust lookups. Falls back to the
/// home-expanded path if the path cannot be canonicalized (e.g. it is gone).
fn canonical_repo_path(path: &str) -> String {
    let expanded = expand_home(path);
    fs::canonicalize(&expanded)
        .unwrap_or(expanded)
        .to_string_lossy()
        .to_string()
}

fn open_history_db(app: &NativeAppHandle) -> Result<Connection, BatchError> {
    let dir = app.path().app_data_dir().map_err(|err| {
        BatchError::Message(format!("Could not resolve app data directory: {}", err))
    })?;
    fs::create_dir_all(&dir)?;
    let conn = Connection::open(dir.join("work-sessions.sqlite3"))?;
    // Concurrency: WAL + a busy timeout so overlapping commands don't hit
    // "database is locked" (each command opens its own connection).
    conn.busy_timeout(Duration::from_secs(5))?;
    let _: String = conn.query_row("PRAGMA journal_mode=WAL", [], |row| row.get(0))?;
    conn.execute_batch(
        "
        create table if not exists work_sessions (
            id text primary key,
            title text not null,
            status text not null,
            user_goal text not null,
            kind text not null,
            created_at text not null,
            updated_at text not null,
            finished_at text,
            payload text not null
        );
        create index if not exists idx_work_sessions_updated_at on work_sessions(updated_at desc);

        create table if not exists work_recipes (
            id text primary key,
            name text not null,
            description text not null,
            kind text not null,
            goal text not null,
            default_output_path text,
            created_at text not null,
            updated_at text not null,
            payload text not null
        );
        create index if not exists idx_work_recipes_updated_at on work_recipes(updated_at desc);

        create table if not exists trusted_repos (
            path text primary key,
            trusted_at text not null,
            label text
        );
        create index if not exists idx_trusted_repos_trusted_at on trusted_repos(trusted_at desc);

        create table if not exists project_memory (
            path text primary key,
            profile text not null,
            updated_at text not null
        );
        create index if not exists idx_project_memory_updated_at on project_memory(updated_at desc);
        ",
    )?;
    // Schema version stamp for future migrations.
    conn.execute_batch("PRAGMA user_version = 1;")?;
    Ok(conn)
}

fn json_string(value: &Value, pointer: &str, fallback: &str) -> String {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .unwrap_or(fallback)
        .to_string()
}

fn json_optional_string(value: &Value, pointer: &str) -> Option<String> {
    value
        .pointer(pointer)
        .and_then(Value::as_str)
        .map(str::to_string)
}

/// Upper bounds on a single scan so pointing the file manager at `~` (or a
/// symlink loop) can't hang a worker or exhaust memory. Chosen well above any
/// real cleanup target; when hit, the scan stops and reports truncation.
const MAX_SCAN_FILES: usize = 50_000;
const MAX_SCAN_DEPTH: usize = 24;

/// Returns `true` if the file-count cap was reached (results are truncated).
fn collect_files(
    path: &Path,
    recursive: bool,
    extensions: &HashSet<String>,
    files: &mut Vec<BatchFileInfo>,
) -> Result<bool, BatchError> {
    collect_files_bounded(path, recursive, extensions, files, 0)
}

fn collect_files_bounded(
    path: &Path,
    recursive: bool,
    extensions: &HashSet<String>,
    files: &mut Vec<BatchFileInfo>,
    depth: usize,
) -> Result<bool, BatchError> {
    if files.len() >= MAX_SCAN_FILES {
        return Ok(true);
    }
    if !path.exists() {
        return Ok(false);
    }

    if path.is_file() {
        if extension_matches(path, extensions) {
            let metadata = fs::metadata(path)?;
            files.push(file_info(path, metadata.len(), false));
        }
        return Ok(files.len() >= MAX_SCAN_FILES);
    }

    if path.is_dir() {
        // Depth guard: stop descending (but don't fail) past the limit.
        if depth >= MAX_SCAN_DEPTH {
            return Ok(false);
        }
        for entry in fs::read_dir(path)? {
            if files.len() >= MAX_SCAN_FILES {
                return Ok(true);
            }
            let entry = entry?;
            let child = entry.path();
            let metadata = entry.metadata()?;
            if metadata.is_dir() {
                if recursive {
                    if collect_files_bounded(&child, recursive, extensions, files, depth + 1)? {
                        return Ok(true);
                    }
                } else if extensions.is_empty() {
                    files.push(file_info(&child, 0, true));
                }
            } else if extension_matches(&child, extensions) {
                files.push(file_info(&child, metadata.len(), false));
            }
        }
    }
    Ok(files.len() >= MAX_SCAN_FILES)
}

fn file_info(path: &Path, size_bytes: u64, is_directory: bool) -> BatchFileInfo {
    let modified_ms = fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64);
    BatchFileInfo {
        path: path.to_string_lossy().to_string(),
        name: path
            .file_name()
            .and_then(OsStr::to_str)
            .unwrap_or_default()
            .to_string(),
        extension: path.extension().and_then(OsStr::to_str).map(str::to_string),
        size_bytes,
        is_directory,
        modified_ms,
    }
}

fn copy_or_move_files(
    input: CopyMoveInput,
    move_files: bool,
) -> Result<BatchExecutionResult, BatchError> {
    let overwrite = input.overwrite.unwrap_or(false);
    let dry_run = input.dry_run.unwrap_or(false);
    let pairs = resolve_file_pairs(&input)?;

    if dry_run {
        return Ok(ok(
            format!("Previewed {} file operation(s).", pairs.len()),
            vec![],
            json!({ "pairs": pairs, "dryRun": true }),
        ));
    }

    let confine = input.confine_to_root.as_deref().map(expand_home);

    // Containment is validated UP FRONT, before a single file is touched: a
    // destination (or source, for moves) outside the approved root aborts the
    // whole batch with nothing moved. This keeps the containment guarantee a
    // hard stop while ensuring the move-log below can never be lost to a
    // mid-batch containment abort.
    if let Some(root) = &confine {
        for pair in &pairs {
            ensure_within_root(root, &expand_home(&pair.destination))?;
            if move_files {
                ensure_within_root(root, &expand_home(&pair.source))?;
            }
        }
    }

    let mut outputs = Vec::new();
    // The pairs that were ACTUALLY moved — returned even on partial failure so
    // undo can always reverse exactly what happened (never more, never less).
    let mut moved_pairs: Vec<FilePair> = Vec::new();
    let mut failed: Vec<Value> = Vec::new();

    for pair in pairs {
        let source = expand_home(&pair.source);
        let destination = expand_home(&pair.destination);

        let outcome: Result<(), String> = (|| {
            // Idempotency guard: a prior run already moved this file.
            if move_files && !source.exists() && destination.exists() {
                return Ok(());
            }
            ensure_safe_destination(&destination, overwrite).map_err(|e| e.to_string())?;
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            if move_files {
                fs::rename(&source, &destination).map_err(|e| e.to_string())?;
            } else {
                fs::copy(&source, &destination).map_err(|e| e.to_string())?;
            }
            Ok(())
        })();

        match outcome {
            Ok(()) => {
                outputs.push(destination.to_string_lossy().to_string());
                if move_files {
                    moved_pairs.push(FilePair {
                        source: source.to_string_lossy().to_string(),
                        destination: destination.to_string_lossy().to_string(),
                    });
                }
            }
            Err(reason) => failed.push(json!({
                "source": source.to_string_lossy(),
                "destination": destination.to_string_lossy(),
                "reason": reason,
            })),
        }
    }

    let verb = if move_files { "Moved" } else { "Copied" };
    let message = if failed.is_empty() {
        format!("{} {} file(s).", verb, outputs.len())
    } else {
        format!(
            "{} {} file(s); {} could not be {} (undo still covers the {} that moved).",
            verb,
            outputs.len(),
            failed.len(),
            if move_files { "moved" } else { "copied" },
            outputs.len()
        )
    };

    Ok(ok(
        message,
        outputs.clone(),
        json!({ "outputs": outputs, "pairs": moved_pairs, "failed": failed }),
    ))
}

fn preview_file_moves(input: CopyMoveInput) -> Result<BatchExecutionResult, BatchError> {
    let pairs = resolve_file_pairs(&input)?;
    Ok(ok(
        format!("Previewed {} file move(s).", pairs.len()),
        vec![],
        json!({ "pairs": pairs, "dryRun": true }),
    ))
}

fn resolve_file_pairs(input: &CopyMoveInput) -> Result<Vec<FilePair>, BatchError> {
    if let Some(pairs) = &input.files {
        return Ok(pairs.clone());
    }

    let output = input
        .output_path
        .as_deref()
        .map(expand_home)
        .ok_or_else(|| BatchError::Message("Missing outputPath for file operation.".into()))?;

    let input_paths = input.input_paths.clone().unwrap_or_default();
    if let Some(strategy @ ("by_extension" | "by_date")) = input.strategy.as_deref() {
        return organization_pairs(&input_paths, &output, strategy);
    }

    Ok(input_paths
        .into_iter()
        .map(|source| {
            let source_path = expand_home(&source);
            let destination = output.join(
                source_path
                    .file_name()
                    .unwrap_or_else(|| OsStr::new("file")),
            );
            FilePair {
                source: source_path.to_string_lossy().to_string(),
                destination: destination.to_string_lossy().to_string(),
            }
        })
        .collect())
}

fn organization_pairs(
    input_paths: &[String],
    root: &Path,
    strategy: &str,
) -> Result<Vec<FilePair>, BatchError> {
    let mut pairs = Vec::new();
    for raw_path in input_paths {
        let path = expand_home(raw_path);
        if path.is_file() {
            push_organization_pair(&mut pairs, &path, root, strategy);
        } else if path.is_dir() {
            for entry in fs::read_dir(&path)? {
                let entry = entry?;
                let child = entry.path();
                if child.is_file() {
                    push_organization_pair(&mut pairs, &child, root, strategy);
                }
            }
        }
    }
    Ok(pairs)
}

fn push_organization_pair(pairs: &mut Vec<FilePair>, source: &Path, root: &Path, strategy: &str) {
    let subfolder = organization_subfolder(source, strategy);
    let destination = root
        .join(subfolder)
        .join(source.file_name().unwrap_or_else(|| OsStr::new("file")));
    pairs.push(FilePair {
        source: source.to_string_lossy().to_string(),
        destination: destination.to_string_lossy().to_string(),
    });
}

/// Choose the destination subfolder for a file under the chosen organization
/// strategy: by file-type category (default) or by `YYYY-MM` of its modified date.
fn organization_subfolder(source: &Path, strategy: &str) -> String {
    match strategy {
        "by_date" => date_folder_for(source),
        _ => category_for_extension(source.extension().and_then(OsStr::to_str)).to_string(),
    }
}

fn date_folder_for(path: &Path) -> String {
    fs::metadata(path)
        .and_then(|meta| meta.modified())
        .map(date_folder)
        .unwrap_or_else(|_| "Undated".to_string())
}

fn date_folder(modified: std::time::SystemTime) -> String {
    let datetime: chrono::DateTime<chrono::Utc> = modified.into();
    datetime.format("%Y-%m").to_string()
}

fn category_for_extension(extension: Option<&str>) -> &'static str {
    match extension.unwrap_or_default().to_lowercase().as_str() {
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "tif" | "tiff" | "psd" | "heic" => "Images",
        "wav" | "mp3" | "aif" | "aiff" | "flac" | "m4a" | "caf" | "mid" | "midi" => "Audio",
        "mov" | "mp4" | "m4v" | "avi" | "mkv" | "webm" => "Video",
        "pdf" | "doc" | "docx" | "rtf" | "txt" | "pages" | "md" => "Documents",
        "zip" | "rar" | "7z" | "tar" | "gz" => "Archives",
        "js" | "jsx" | "ts" | "tsx" | "rs" | "py" | "json" | "toml" | "html" | "css" => "Code",
        _ => "Other",
    }
}

fn resolve_supported_images(input_paths: &[String]) -> Result<Vec<PathBuf>, BatchError> {
    let extensions = ["jpg", "jpeg", "png", "tif", "tiff", "psd", "webp"]
        .iter()
        .map(|item| item.to_string())
        .collect::<HashSet<_>>();
    let mut info = Vec::new();
    for raw_path in input_paths {
        collect_files(&expand_home(raw_path), true, &extensions, &mut info)?;
    }
    Ok(info
        .into_iter()
        .filter(|item| !item.is_directory)
        .map(|item| PathBuf::from(item.path))
        .collect())
}

fn photoshop_background_script(files: &[PathBuf], output: &Path) -> Result<String, BatchError> {
    let file_list = files
        .iter()
        .map(|file| format!("File({:?})", file.to_string_lossy().to_string()))
        .collect::<Vec<_>>()
        .join(",\n");
    let output_path = output
        .to_string_lossy()
        .replace('\\', "\\\\")
        .replace('"', "\\\"");

    Ok(format!(
        r#"
#target photoshop
app.displayDialogs = DialogModes.NO;

var files = [
{file_list}
];
var outputFolder = Folder("{output_path}");
if (!outputFolder.exists) outputFolder.create();
var failures = [];
var completed = [];

function safeName(name) {{
  return name.replace(/\.[^\.]+$/, "").replace(/[\\\/:\*\?"<>\|]/g, "_");
}}

function tryRemoveBackground() {{
  try {{
    executeAction(stringIDToTypeID("removeBackground"), new ActionDescriptor(), DialogModes.NO);
    return true;
  }} catch (removeError) {{
    try {{
      executeAction(stringIDToTypeID("autoCutout"), undefined, DialogModes.NO);
      var idMk = charIDToTypeID("Mk  ");
      var desc = new ActionDescriptor();
      var idNw = charIDToTypeID("Nw  ");
      var idChnl = charIDToTypeID("Chnl");
      desc.putClass(idNw, idChnl);
      var idAt = charIDToTypeID("At  ");
      var ref = new ActionReference();
      ref.putEnumerated(charIDToTypeID("Chnl"), charIDToTypeID("Chnl"), charIDToTypeID("Msk "));
      desc.putReference(idAt, ref);
      var idUsng = charIDToTypeID("Usng");
      desc.putEnumerated(idUsng, charIDToTypeID("UsrM"), charIDToTypeID("RvlS"));
      executeAction(idMk, desc, DialogModes.NO);
      return true;
    }} catch (cutoutError) {{
      return false;
    }}
  }}
}}

function exportPng(doc, outFile) {{
  var options = new ExportOptionsSaveForWeb();
  options.format = SaveDocumentType.PNG;
  options.PNG8 = false;
  options.transparency = true;
  options.interlaced = false;
  options.quality = 100;
  doc.exportDocument(outFile, ExportType.SAVEFORWEB, options);
}}

for (var i = 0; i < files.length; i++) {{
  var file = files[i];
  try {{
    var doc = app.open(file);
    if (doc.layers.length > 0 && doc.activeLayer.isBackgroundLayer) {{
      doc.activeLayer.isBackgroundLayer = false;
    }}
    var removed = tryRemoveBackground();
    if (!removed) throw new Error("Photoshop background removal command failed.");
    var outFile = File(outputFolder.fsName + "/" + safeName(file.name) + ".png");
    exportPng(doc, outFile);
    completed.push({{ input: file.fsName, output: outFile.fsName }});
    doc.close(SaveOptions.DONOTSAVECHANGES);
  }} catch (error) {{
    failures.push({{ input: file.fsName, error: String(error) }});
    try {{
      if (app.documents.length > 0) app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
    }} catch (closeError) {{}}
  }}
}}

var logFile = File(outputFolder.fsName + "/background-removal-log-" + (new Date()).getTime() + ".json");
logFile.open("w");
logFile.write(JSON.stringify({{ completed: completed, failures: failures }}, null, 2));
logFile.close();
"#
    ))
}

struct TypedProcess {
    program: String,
    args: Vec<String>,
}

struct RegisteredOutput {
    success: bool,
    stdout: String,
    stderr: String,
    timed_out: bool,
}

fn detect_project_check_command(cwd: &Path) -> Result<TypedCommand, BatchError> {
    let package_json = cwd.join("package.json");
    if package_json.exists() {
        let text = fs::read_to_string(package_json)?;
        let value: Value = serde_json::from_str(&text)?;
        let scripts = value.get("scripts").and_then(Value::as_object);
        if let Some(scripts) = scripts {
            if scripts.contains_key("typecheck") {
                return Ok(TypedCommand::NpmScript {
                    script: "typecheck".into(),
                });
            }
            if scripts.contains_key("lint") {
                return Ok(TypedCommand::NpmScript {
                    script: "lint".into(),
                });
            }
            if scripts.contains_key("build") {
                return Ok(TypedCommand::NpmScript {
                    script: "build".into(),
                });
            }
            if scripts.contains_key("test") {
                return Ok(TypedCommand::NpmTest);
            }
        }
    }
    if cwd.join("Cargo.toml").exists() {
        return Ok(TypedCommand::CargoCheck);
    }
    if cwd.join("pyproject.toml").exists() || cwd.join("pytest.ini").exists() {
        return Ok(TypedCommand::PythonPytest);
    }
    Ok(TypedCommand::ListTopLevelFiles {
        max_depth: Some(2),
        limit: Some(200),
    })
}

fn command_to_process(command: &TypedCommand) -> Result<TypedProcess, BatchError> {
    match command {
        TypedCommand::ListTopLevelFiles { max_depth, .. } => Ok(TypedProcess {
            program: "find".into(),
            args: vec![
                ".".into(),
                "-maxdepth".into(),
                max_depth.unwrap_or(2).min(6).to_string(),
                "-type".into(),
                "f".into(),
            ],
        }),
        TypedCommand::NpmScript { script } => {
            validate_script_name(script)?;
            Ok(TypedProcess {
                program: "npm".into(),
                args: vec!["run".into(), script.clone()],
            })
        }
        TypedCommand::NpmTest => Ok(TypedProcess {
            program: "npm".into(),
            args: vec!["test".into()],
        }),
        TypedCommand::PnpmScript { script } => {
            validate_script_name(script)?;
            Ok(TypedProcess {
                program: "pnpm".into(),
                args: vec!["run".into(), script.clone()],
            })
        }
        TypedCommand::YarnScript { script } => {
            validate_script_name(script)?;
            Ok(TypedProcess {
                program: "yarn".into(),
                args: vec![script.clone()],
            })
        }
        TypedCommand::CargoCheck => Ok(TypedProcess {
            program: "cargo".into(),
            args: vec!["check".into()],
        }),
        TypedCommand::CargoTest => Ok(TypedProcess {
            program: "cargo".into(),
            args: vec!["test".into()],
        }),
        TypedCommand::PythonPytest => Ok(TypedProcess {
            program: "python".into(),
            args: vec!["-m".into(), "pytest".into()],
        }),
        TypedCommand::GitStatus => Ok(TypedProcess {
            program: "git".into(),
            args: vec!["status".into(), "--short".into()],
        }),
        TypedCommand::GitDiff { stat } => Ok(TypedProcess {
            program: "git".into(),
            args: if stat.unwrap_or(false) {
                vec!["diff".into(), "--stat".into()]
            } else {
                vec!["diff".into()]
            },
        }),
        TypedCommand::GitLog { limit } => Ok(TypedProcess {
            program: "git".into(),
            args: vec![
                "log".into(),
                "--oneline".into(),
                "-n".into(),
                limit.unwrap_or(20).min(100).to_string(),
            ],
        }),
        TypedCommand::NodeScript { path, args } => {
            validate_relative_script_path(path)?;
            let mut process_args = vec![path.clone()];
            process_args.extend(args.clone().unwrap_or_default());
            Ok(TypedProcess {
                program: "node".into(),
                args: process_args,
            })
        }
    }
}

fn command_label(command: &TypedCommand) -> String {
    match command {
        TypedCommand::ListTopLevelFiles { max_depth, limit } => {
            format!(
                "listTopLevelFiles depth={} limit={}",
                max_depth.unwrap_or(2),
                limit.unwrap_or(200)
            )
        }
        TypedCommand::NpmScript { script } => format!("npm run {}", script),
        TypedCommand::NpmTest => "npm test".into(),
        TypedCommand::PnpmScript { script } => format!("pnpm run {}", script),
        TypedCommand::YarnScript { script } => format!("yarn {}", script),
        TypedCommand::CargoCheck => "cargo check".into(),
        TypedCommand::CargoTest => "cargo test".into(),
        TypedCommand::PythonPytest => "python -m pytest".into(),
        TypedCommand::GitStatus => "git status --short".into(),
        TypedCommand::GitDiff { stat } => {
            if stat.unwrap_or(false) {
                "git diff --stat".into()
            } else {
                "git diff".into()
            }
        }
        TypedCommand::GitLog { limit } => format!("git log --oneline -n {}", limit.unwrap_or(20)),
        TypedCommand::NodeScript { path, args } => {
            format!(
                "node {} {}",
                path,
                args.clone().unwrap_or_default().join(" ")
            )
        }
    }
}

fn trim_output_for_command(command: &TypedCommand, stdout: String) -> String {
    let limit = match command {
        TypedCommand::ListTopLevelFiles { limit, .. } => limit.unwrap_or(200),
        _ => return stdout,
    };

    stdout.lines().take(limit).collect::<Vec<_>>().join("\n")
}

fn validate_script_name(script: &str) -> Result<(), BatchError> {
    let is_valid = !script.is_empty()
        && script
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | ':' | '.'));
    if !is_valid {
        return Err(BatchError::Message(format!(
            "Script name is not safe to run: {}",
            script
        )));
    }
    Ok(())
}

fn validate_relative_script_path(path: &str) -> Result<(), BatchError> {
    let path = Path::new(path);
    if path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, std::path::Component::ParentDir))
    {
        return Err(BatchError::Message(
            "Node script path must be a relative path inside the project.".into(),
        ));
    }
    Ok(())
}

fn run_registered_process(
    app: &NativeAppHandle,
    process_id: String,
    program: &str,
    args: Vec<String>,
    cwd: Option<PathBuf>,
    timeout: Option<Duration>,
) -> Result<RegisteredOutput, BatchError> {
    let mut command = Command::new(program);
    let start_label = format!("Starting: {} {}", program, args.join(" "));
    command.args(&args);
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    // Put the child in its own process group (pgid == child pid) so that a stop
    // or timeout can signal the whole tree, not just the launcher process.
    command.process_group(0);

    emit_process_line(app, &process_id, "system", &start_label);
    let mut child = command.spawn()?;
    let pid = child.id();
    {
        let mut processes = RUNNING_PROCESSES
            .lock()
            .map_err(|_| BatchError::Message("Process registry is unavailable.".into()))?;
        processes.insert(process_id.clone(), pid);
    }

    let stdout_buffer = Arc::new(Mutex::new(VecDeque::<String>::new()));
    let stderr_buffer = Arc::new(Mutex::new(VecDeque::<String>::new()));
    let mut handles = Vec::new();

    if let Some(stdout) = child.stdout.take() {
        handles.push(spawn_output_reader(
            app.clone(),
            process_id.clone(),
            "stdout",
            stdout,
            Arc::clone(&stdout_buffer),
        ));
    }

    if let Some(stderr) = child.stderr.take() {
        handles.push(spawn_output_reader(
            app.clone(),
            process_id.clone(),
            "stderr",
            stderr,
            Arc::clone(&stderr_buffer),
        ));
    }

    // Watchdog: if a timeout is set and the deadline passes before the process
    // finishes, group-kill it (TERM then KILL) and flag the run as timed out.
    let done = Arc::new(AtomicBool::new(false));
    let timed_out = Arc::new(AtomicBool::new(false));
    let watchdog = timeout.map(|dur| {
        let done = Arc::clone(&done);
        let timed_out = Arc::clone(&timed_out);
        let app = app.clone();
        let process_id = process_id.clone();
        thread::spawn(move || {
            let start = Instant::now();
            while start.elapsed() < dur {
                if done.load(Ordering::SeqCst) {
                    return;
                }
                thread::sleep(Duration::from_millis(200));
            }
            if !done.load(Ordering::SeqCst) {
                timed_out.store(true, Ordering::SeqCst);
                emit_process_line(
                    &app,
                    &process_id,
                    "system",
                    &format!("Timed out after {}s; sending stop signal.", dur.as_secs()),
                );
                kill_process_group(pid, libc::SIGTERM);
                thread::sleep(Duration::from_secs(3));
                if !done.load(Ordering::SeqCst) {
                    kill_process_group(pid, libc::SIGKILL);
                }
            }
        })
    });

    let status = child.wait()?;
    done.store(true, Ordering::SeqCst);
    if let Some(handle) = watchdog {
        let _ = handle.join();
    }
    for handle in handles {
        let _ = handle.join();
    }

    let timed_out = timed_out.load(Ordering::SeqCst);
    let success = status.success() && !timed_out;
    let stdout = join_buffer(&stdout_buffer)?;
    let stderr = join_buffer(&stderr_buffer)?;

    let mut processes = RUNNING_PROCESSES
        .lock()
        .map_err(|_| BatchError::Message("Process registry is unavailable.".into()))?;
    processes.remove(&process_id);
    emit_process_line(
        app,
        &process_id,
        "system",
        if timed_out {
            "Process stopped: timed out."
        } else if success {
            "Process completed."
        } else {
            "Process exited with an error or stop signal."
        },
    );

    Ok(RegisteredOutput {
        success,
        stdout,
        stderr,
        timed_out,
    })
}

/// Send `signal` to the process group led by `pid`. Children are spawned with
/// `process_group(0)`, so the child's PGID equals its PID and the negative PID
/// targets the whole group — killing child process trees, not just the parent.
fn kill_process_group(pid: u32, signal: i32) {
    unsafe {
        libc::kill(-(pid as i32), signal);
    }
}

fn request_stop(process_id: &str) {
    if let Ok(mut set) = STOP_REQUESTED.lock() {
        set.insert(process_id.to_string());
    }
}

fn clear_stop(process_id: &str) {
    if let Ok(mut set) = STOP_REQUESTED.lock() {
        set.remove(process_id);
    }
}

fn is_stop_requested(process_id: &str) -> bool {
    STOP_REQUESTED
        .lock()
        .map(|set| set.contains(process_id))
        .unwrap_or(false)
}

const MAX_OUTPUT_LINES: usize = 2000;

fn spawn_output_reader<R>(
    app: NativeAppHandle,
    process_id: String,
    stream: &'static str,
    reader: R,
    buffer: Arc<Mutex<VecDeque<String>>>,
) -> thread::JoinHandle<()>
where
    R: std::io::Read + Send + 'static,
{
    thread::spawn(move || {
        let reader = BufReader::new(reader);
        for line in reader.lines() {
            let line = line.unwrap_or_else(|err| format!("output read error: {}", err));
            if let Ok(mut buffer) = buffer.lock() {
                // Bounded ring buffer: keep only the most recent lines so a
                // verbose build/Codex run cannot balloon memory or the DB payload.
                buffer.push_back(line.clone());
                while buffer.len() > MAX_OUTPUT_LINES {
                    buffer.pop_front();
                }
            }
            emit_process_line(&app, &process_id, stream, &line);
        }
    })
}

fn join_buffer(buffer: &Arc<Mutex<VecDeque<String>>>) -> Result<String, BatchError> {
    let guard = buffer
        .lock()
        .map_err(|_| BatchError::Message("Output buffer is unavailable.".into()))?;
    Ok(guard.iter().cloned().collect::<Vec<_>>().join("\n"))
}

fn emit_process_line(app: &NativeAppHandle, process_id: &str, stream: &str, line: &str) {
    let _ = app.emit(
        "batch-process-output",
        ProcessOutputEvent {
            process_id: process_id.to_string(),
            stream: stream.to_string(),
            line: line.to_string(),
            timestamp: Utc::now().to_rfc3339(),
        },
    );
}

fn ensure_safe_destination(path: &Path, overwrite: bool) -> Result<(), BatchError> {
    if path.exists() && !overwrite {
        return Err(BatchError::Message(format!(
            "Destination exists and overwrite is not approved: {}",
            path.display()
        )));
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(())
}

/// Canonicalize `path` even when trailing components don't exist yet.
///
/// `fs::canonicalize` requires the whole path to exist, so for a not-yet-created
/// destination we walk up to the nearest EXISTING ancestor, canonicalize that
/// (resolving symlinks such as macOS `/var` -> `/private/var`), then re-append
/// the remaining non-existent components. This keeps the result canonical-rooted
/// no matter how many leading components are missing, so a containment check
/// against a canonical root doesn't spuriously fail. Falls back to the literal
/// path only when no ancestor can be canonicalized.
fn canonicalize_existing_prefix(path: &Path) -> PathBuf {
    if let Ok(canonical) = fs::canonicalize(path) {
        return canonical;
    }
    // Strip trailing (non-existent) components until an ancestor canonicalizes.
    let mut remainder: Vec<OsString> = Vec::new();
    let mut current = path;
    loop {
        match (current.parent(), current.file_name()) {
            (Some(parent), Some(name)) => {
                remainder.push(name.to_os_string());
                if let Ok(mut canonical) = fs::canonicalize(parent) {
                    for component in remainder.iter().rev() {
                        canonical.push(component);
                    }
                    return canonical;
                }
                current = parent;
            }
            // No existing ancestor (root, empty, or a bare relative component).
            _ => {
                let mut resolved = current.to_path_buf();
                for component in remainder.iter().rev() {
                    resolved.push(component);
                }
                return resolved;
            }
        }
    }
}

/// Refuse paths that resolve outside an approved root, defeating `../` escapes.
fn ensure_within_root(root: &Path, path: &Path) -> Result<(), BatchError> {
    let root_canonical = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let candidate = canonicalize_existing_prefix(path);
    if candidate.starts_with(&root_canonical) {
        Ok(())
    } else {
        Err(BatchError::Message(format!(
            "Refusing to operate outside the approved folder: {}",
            path.display()
        )))
    }
}

/// Refuse the whole request if any raw path (after home-expansion) is outside
/// the approved root. Used as an up-front gate before any destructive batch.
fn ensure_all_within_root(root: &Path, raw_paths: &[String]) -> Result<(), BatchError> {
    for raw in raw_paths {
        ensure_within_root(root, &expand_home(raw))?;
    }
    Ok(())
}

fn extension_matches(path: &Path, extensions: &HashSet<String>) -> bool {
    if extensions.is_empty() {
        return true;
    }
    path.extension()
        .and_then(OsStr::to_str)
        .map(|ext| extensions.contains(&ext.to_lowercase()))
        .unwrap_or(false)
}

fn expand_home(raw: &str) -> PathBuf {
    if raw == "~" {
        return std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(raw));
    }
    if let Some(rest) = raw.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(raw)
}

fn sanitize_folder_name(name: &str) -> String {
    name.chars()
        .map(|ch| match ch {
            '/' | ':' | '\0' => '_',
            _ => ch,
        })
        .collect()
}

fn unique_path(path: &Path) -> PathBuf {
    if !path.exists() {
        return path.to_path_buf();
    }
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let stem = path.file_stem().and_then(OsStr::to_str).unwrap_or("file");
    let ext = path.extension().and_then(OsStr::to_str);
    for index in 1..10000 {
        let candidate = match ext {
            Some(ext) => parent.join(format!("{}-{}.{}", stem, index, ext)),
            None => parent.join(format!("{}-{}", stem, index)),
        };
        if !candidate.exists() {
            return candidate;
        }
    }
    path.to_path_buf()
}

fn ok(
    message: impl Into<String>,
    output_paths: Vec<String>,
    metadata: Value,
) -> BatchExecutionResult {
    ok_with_output(message, output_paths, None, None, metadata)
}

fn ok_with_output(
    message: impl Into<String>,
    output_paths: Vec<String>,
    stdout: Option<String>,
    stderr: Option<String>,
    metadata: Value,
) -> BatchExecutionResult {
    BatchExecutionResult {
        ok: true,
        message: message.into(),
        output_paths,
        stdout,
        stderr,
        metadata,
    }
}

fn fail(
    message: impl Into<String>,
    stdout: Option<String>,
    stderr: Option<String>,
) -> BatchExecutionResult {
    BatchExecutionResult {
        ok: false,
        message: message.into(),
        output_paths: vec![],
        stdout,
        stderr,
        metadata: json!({}),
    }
}

// ================================================================ disk cleaner
// An AI-assisted, fully-reversible disk cleaner: a Smart Scan of reclaimable junk
// categories (like CleanMyMac), a whole-disk storage overview, a biggest-items
// space map (like OmniDiskSweeper), a duplicate finder, and space-saving tips.
// Nothing is deleted here — removal always routes through the reversible
// quarantine trash (`batch_trash`) with user approval. Tips that can only free
// space outside the trash are surfaced as commands, never run.
//
// Heavy commands are `#[tauri::command(async)]`: a plain sync command runs on the
// main thread, which would freeze the whole window for the length of a scan.

const CLEAN_ENTRY_CAP: usize = 1000;
const CLEAN_SIZE_CAP_FILES: u64 = 600_000;
const STORAGE_CAP_FILES: u64 = 2_000_000;
const SIZE_WORKERS: usize = 6;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CleanEntry {
    path: String,
    size_bytes: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CleanCategory {
    id: String,
    name: String,
    description: String,
    /// "safe" = regenerable junk, pre-selected; "review" = real files, opt-in.
    safety: String,
    /// Confinement root the frontend passes to `batch_trash` for this category.
    root: String,
    size_bytes: u64,
    human_size: String,
    item_count: usize,
    entries: Vec<CleanEntry>,
}

/// On-disk size of a path: allocated blocks (not logical length), so sparse
/// files and iCloud "optimized" placeholders report the space they really use.
/// Never follows symlinks and never crosses onto another filesystem. Returns
/// `(bytes, capped)` — `capped` when the walk hit `cap` entries.
fn disk_usage(path: &Path, cap: u64) -> (u64, bool) {
    use std::os::unix::fs::MetadataExt;
    let root = match fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(_) => return (0, false),
    };
    if root.file_type().is_symlink() {
        return (0, false);
    }
    let dev = root.dev();
    let mut bytes = 0u64;
    let mut seen = 0u64;
    let mut stack = vec![path.to_path_buf()];
    while let Some(p) = stack.pop() {
        let md = match fs::symlink_metadata(&p) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if md.file_type().is_symlink() || md.dev() != dev {
            continue;
        }
        seen += 1;
        if seen > cap {
            return (bytes, true);
        }
        bytes += md.blocks() * 512;
        if md.is_dir() {
            if let Ok(rd) = fs::read_dir(&p) {
                for e in rd.flatten() {
                    stack.push(e.path());
                }
            }
        }
    }
    (bytes, false)
}

fn alloc_bytes(md: &fs::Metadata) -> u64 {
    use std::os::unix::fs::MetadataExt;
    md.blocks() * 512
}

/// Size many paths on a small worker pool — sizing is IO-bound and folders like
/// ~/Library have dozens of large children. Results are in input order.
fn par_sizes(paths: &[PathBuf], cap: u64) -> Vec<(u64, bool)> {
    let next = std::sync::atomic::AtomicUsize::new(0);
    let results: Vec<Mutex<(u64, bool)>> = paths.iter().map(|_| Mutex::new((0, false))).collect();
    std::thread::scope(|s| {
        for _ in 0..SIZE_WORKERS.min(paths.len()) {
            s.spawn(|| loop {
                let i = next.fetch_add(1, Ordering::Relaxed);
                if i >= paths.len() {
                    break;
                }
                let r = disk_usage(&paths[i], cap);
                if let Ok(mut slot) = results[i].lock() {
                    *slot = r;
                }
            });
        }
    });
    results
        .into_iter()
        .map(|m| m.into_inner().unwrap_or_else(|e| e.into_inner()))
        .collect()
}

/// Run jobs on detached threads and keep whatever finishes before `deadline`.
/// A job blocked inside the kernel — opening a cloud-storage folder, or waiting
/// on a macOS privacy prompt nobody is answering — can't be cancelled, but it
/// can't hang the scan either: its slot comes back `None` and its thread ends
/// whenever the OS lets go.
fn run_with_deadline<T: Send + 'static>(
    jobs: Vec<Box<dyn FnOnce() -> T + Send>>,
    deadline: Duration,
) -> Vec<Option<T>> {
    let n = jobs.len();
    let (tx, rx) = std::sync::mpsc::channel::<(usize, T)>();
    for (i, job) in jobs.into_iter().enumerate() {
        let tx = tx.clone();
        thread::spawn(move || {
            let _ = tx.send((i, job()));
        });
    }
    drop(tx);
    let mut out: Vec<Option<T>> = (0..n).map(|_| None).collect();
    let end = Instant::now() + deadline;
    let mut got = 0;
    while got < n {
        let left = end.saturating_duration_since(Instant::now());
        match rx.recv_timeout(left) {
            Ok((i, value)) => {
                out[i] = Some(value);
                got += 1;
            }
            Err(_) => break, // deadline passed (or every job has reported)
        }
    }
    out
}

/// `par_sizes` with a deadline, on detached workers: a path whose walk blocks
/// comes back `None` instead of stalling everything behind it. `on_result` is
/// called on the waiting thread as each size lands (for live progress).
fn par_sizes_deadline(
    paths: Vec<PathBuf>,
    cap: u64,
    deadline: Duration,
    on_result: &mut dyn FnMut(usize, (u64, bool)),
) -> Vec<Option<(u64, bool)>> {
    let n = paths.len();
    let paths = Arc::new(paths);
    let next = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let (tx, rx) = std::sync::mpsc::channel::<(usize, (u64, bool))>();
    for _ in 0..SIZE_WORKERS.min(n) {
        let (paths, next, tx) = (Arc::clone(&paths), Arc::clone(&next), tx.clone());
        thread::spawn(move || loop {
            let i = next.fetch_add(1, Ordering::Relaxed);
            if i >= paths.len() || tx.send((i, disk_usage(&paths[i], cap))).is_err() {
                break;
            }
        });
    }
    drop(tx);
    let mut out: Vec<Option<(u64, bool)>> = vec![None; n];
    let end = Instant::now() + deadline;
    let mut got = 0;
    while got < n {
        let left = end.saturating_duration_since(Instant::now());
        match rx.recv_timeout(left) {
            Ok((i, size)) => {
                out[i] = Some(size);
                on_result(i, size);
                got += 1;
            }
            Err(_) => break,
        }
    }
    out
}

/// Whether this process has Full Disk Access. Without it, macOS denies ~/.Trash
/// and Safari's data outright — and opening other apps' sandbox containers can
/// block on a consent prompt — so scans skip those areas and say so.
fn has_full_disk_access() -> bool {
    let home = expand_home("~");
    [home.join("Library/Safari"), home.join(".Trash")]
        .iter()
        .any(|p| fs::read_dir(p).is_ok())
}

/// ~/Library areas that need Full Disk Access (other apps' sandbox data).
const PROTECTED_LIBRARY_DIRS: [&str; 3] = ["Containers", "Group Containers", "Daemon Containers"];

fn sized_entries(paths: &[PathBuf]) -> Vec<CleanEntry> {
    let sizes = par_sizes(paths, CLEAN_SIZE_CAP_FILES);
    let mut v: Vec<CleanEntry> = paths
        .iter()
        .zip(sizes)
        .filter(|(_, (size, _))| *size > 0)
        .map(|(p, (size, _))| CleanEntry {
            path: p.to_string_lossy().to_string(),
            size_bytes: size,
        })
        .collect();
    v.sort_by_key(|e| std::cmp::Reverse(e.size_bytes));
    v.truncate(CLEAN_ENTRY_CAP);
    v
}

/// Immediate children of `dir` as removable entries, largest first.
fn children_entries(dir: &Path) -> Vec<CleanEntry> {
    let paths: Vec<PathBuf> = match fs::read_dir(dir) {
        Ok(rd) => rd.flatten().map(|e| e.path()).collect(),
        Err(_) => return Vec::new(),
    };
    sized_entries(&paths)
}

/// Existing home-relative directories, each as one whole removable entry.
fn dirs_as_entries(rels: &[String]) -> Vec<CleanEntry> {
    let home = expand_home("~");
    let paths: Vec<PathBuf> = rels
        .iter()
        .map(|r| home.join(r))
        .filter(|p| p.is_dir())
        .collect();
    sized_entries(&paths)
}

fn make_category(
    id: &str,
    name: &str,
    description: &str,
    safety: &str,
    root: &Path,
    entries: Vec<CleanEntry>,
) -> Option<CleanCategory> {
    let size: u64 = entries.iter().map(|e| e.size_bytes).sum();
    if size == 0 || entries.is_empty() {
        return None;
    }
    Some(CleanCategory {
        id: id.into(),
        name: name.into(),
        description: description.into(),
        safety: safety.into(),
        root: root.to_string_lossy().to_string(),
        size_bytes: size,
        human_size: human_bytes(size),
        item_count: entries.len(),
        entries,
    })
}

/// Category built from the immediate children of a home-relative directory.
fn scan_children(
    id: &str,
    name: &str,
    desc: &str,
    safety: &str,
    rel: &str,
) -> Option<CleanCategory> {
    let dir = expand_home("~").join(rel);
    if !dir.exists() {
        return None;
    }
    make_category(id, name, desc, safety, &dir, children_entries(&dir))
}

/// Category whose entries are whole directories (each removed as one unit).
fn scan_dirs(id: &str, name: &str, desc: &str, safety: &str, rels: &[String]) -> Option<CleanCategory> {
    make_category(id, name, desc, safety, &expand_home("~"), dirs_as_entries(rels))
}

fn modified_ms(path: &Path) -> Option<u64> {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

/// Bounded recursive scan for files matching extension / size / age filters.
/// Sizes are allocated bytes, so cloud placeholders never count as "large".
fn collect_matching_files(
    root: &Path,
    exts: &[&str],
    min_bytes: u64,
    older_than_ms: Option<u64>,
    out: &mut Vec<CleanEntry>,
    budget: &mut u64,
) {
    if *budget == 0 {
        return;
    }
    let rd = match fs::read_dir(root) {
        Ok(x) => x,
        Err(_) => return,
    };
    for e in rd.flatten() {
        if *budget == 0 {
            return;
        }
        *budget -= 1;
        let p = e.path();
        // DirEntry::metadata does not follow symlinks.
        let md = match e.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if md.is_dir() {
            collect_matching_files(&p, exts, min_bytes, older_than_ms, out, budget);
            continue;
        }
        let alloc = alloc_bytes(&md);
        if alloc < min_bytes {
            continue;
        }
        if !exts.is_empty() {
            let ok = p
                .extension()
                .and_then(OsStr::to_str)
                .map(|x| exts.contains(&x.to_lowercase().as_str()))
                .unwrap_or(false);
            if !ok {
                continue;
            }
        }
        if let Some(cutoff) = older_than_ms {
            // Keep only "old" files — skip anything modified after the cutoff.
            if modified_ms(&p).map(|m| m > cutoff).unwrap_or(true) {
                continue;
            }
        }
        out.push(CleanEntry {
            path: p.to_string_lossy().to_string(),
            size_bytes: alloc,
        });
    }
}

fn finish_file_entries(mut entries: Vec<CleanEntry>) -> Vec<CleanEntry> {
    entries.sort_by_key(|e| std::cmp::Reverse(e.size_bytes));
    entries.truncate(CLEAN_ENTRY_CAP);
    entries
}

/// Trees a build-artifact search should never spend its budget walking.
fn is_walk_excluded(name: &str) -> bool {
    matches!(
        name,
        "Library"
            | ".Trash"
            | ".git"
            | "Pictures"
            | "Music"
            | "Movies"
            | "Applications"
            | ".cargo"
            | ".rustup"
            | ".npm"
            | ".ollama"
            | ".cache"
    ) || name.ends_with(".photoslibrary")
        || name.ends_with(".musiclibrary")
        || name.ends_with(".app")
}

/// Bounded search for regenerable build output. Dependency directories
/// (node_modules, .venv, framework build caches) go to `deps`; Cargo `target`
/// directories — identified by the CACHEDIR.TAG Cargo writes into them, so an
/// unrelated folder named "target" is never touched — go to `targets`.
/// A matched directory is recorded whole and not descended into. Matches are
/// collected first and sized afterwards in parallel (sizing is the slow part).
fn find_build_dirs(
    root: &Path,
    dep_names: &[&str],
    depth: u32,
    node_budget: &mut u64,
    deps: &mut Vec<CleanEntry>,
    targets: &mut Vec<CleanEntry>,
) {
    let (mut dep_paths, mut target_paths) = (Vec::new(), Vec::new());
    walk_build_dirs(root, dep_names, depth, node_budget, &mut dep_paths, &mut target_paths);
    deps.extend(sized_entries(&dep_paths));
    targets.extend(sized_entries(&target_paths));
}

fn walk_build_dirs(
    root: &Path,
    dep_names: &[&str],
    depth: u32,
    node_budget: &mut u64,
    deps: &mut Vec<PathBuf>,
    targets: &mut Vec<PathBuf>,
) {
    if depth == 0 || *node_budget == 0 {
        return;
    }
    let rd = match fs::read_dir(root) {
        Ok(x) => x,
        Err(_) => return,
    };
    for e in rd.flatten() {
        if *node_budget == 0 {
            return;
        }
        *node_budget -= 1;
        // file_type() does not follow symlinks — never walk into a symlinked dir.
        if !e.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let p = e.path();
        let name = p.file_name().and_then(OsStr::to_str).unwrap_or("");
        if is_walk_excluded(name) {
            continue;
        }
        if dep_names.contains(&name) {
            deps.push(p);
        } else if name == "target" && p.join("CACHEDIR.TAG").is_file() {
            targets.push(p);
        } else {
            walk_build_dirs(&p, dep_names, depth - 1, node_budget, deps, targets);
        }
    }
}

/// Dependency-directory search (test helper for callers that only want `deps`).
#[cfg(test)]
fn find_named_dirs(
    root: &Path,
    names: &[&str],
    depth: u32,
    node_budget: &mut u64,
    out: &mut Vec<CleanEntry>,
) {
    let mut ignored = Vec::new();
    find_build_dirs(root, names, depth, node_budget, out, &mut ignored);
}

fn is_screenshot_name(name: &str) -> bool {
    name.starts_with("Screenshot")
        || name.starts_with("Screen Shot")
        || name.starts_with("Screen Recording")
        || name.starts_with("CleanShot")
}

/// Where screenshots land: the Desktop, plus a custom `screencapture` location
/// if one is set and it lives inside the home folder (the category is confined
/// to home, so an outside location would make the whole clean request refuse).
fn screenshot_dirs() -> Vec<PathBuf> {
    let home = expand_home("~");
    let mut dirs = vec![home.join("Desktop")];
    if let Ok(out) = Command::new("defaults")
        .args(["read", "com.apple.screencapture", "location"])
        .output()
    {
        if out.status.success() {
            let loc = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !loc.is_empty() {
                let p = expand_home(&loc);
                if p.is_dir() && p.starts_with(&home) && !dirs.contains(&p) {
                    dirs.push(p);
                }
            }
        }
    }
    dirs
}

fn scan_old_screenshots(cutoff_ms: u64) -> Option<CleanCategory> {
    let mut out = Vec::new();
    for dir in screenshot_dirs() {
        let rd = match fs::read_dir(&dir) {
            Ok(x) => x,
            Err(_) => continue,
        };
        for e in rd.flatten() {
            let md = match e.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            if !md.is_file() {
                continue;
            }
            let p = e.path();
            let name = p.file_name().and_then(OsStr::to_str).unwrap_or("");
            if !is_screenshot_name(name) || modified_ms(&p).map(|m| m > cutoff_ms).unwrap_or(true) {
                continue;
            }
            let size = alloc_bytes(&md);
            if size > 0 {
                out.push(CleanEntry {
                    path: p.to_string_lossy().to_string(),
                    size_bytes: size,
                });
            }
        }
    }
    make_category(
        "screenshots",
        "Old screenshots",
        "Screenshots and screen recordings older than a month.",
        "review",
        &expand_home("~"),
        finish_file_entries(out),
    )
}

/// Apps in /Applications that Spotlight says haven't been opened since the
/// cutoff. An app with no recorded last-used date is treated as unknown, not
/// unused — so a Mac with Spotlight disabled never flags everything.
fn scan_unused_apps(cutoff_ms: u64) -> Option<CleanCategory> {
    let apps_dir = PathBuf::from("/Applications");
    let apps: Vec<PathBuf> = fs::read_dir(&apps_dir)
        .ok()?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(OsStr::to_str) == Some("app"))
        .filter(|p| {
            let n = p.file_name().and_then(OsStr::to_str).unwrap_or("");
            !matches!(n, "Safari.app" | "Reclaim.app" | "Universal Computer Operator.app")
        })
        .collect();
    if apps.is_empty() {
        return None;
    }
    // One mdls call for every app; with -raw and several files the values come
    // back NUL-separated, in argument order.
    let out = Command::new("mdls")
        .args(["-raw", "-name", "kMDItemLastUsedDate"])
        .args(&apps)
        .output()
        .ok()?;
    let raw = String::from_utf8_lossy(&out.stdout).to_string();
    let stale: Vec<PathBuf> = apps
        .iter()
        .zip(raw.split('\0'))
        .filter_map(|(app, value)| {
            let dt = chrono::DateTime::parse_from_str(value.trim(), "%Y-%m-%d %H:%M:%S %z").ok()?;
            (dt.timestamp_millis() < cutoff_ms as i64).then(|| app.clone())
        })
        .collect();
    make_category(
        "unused-apps",
        "Unused apps",
        "Apps you haven't opened in 6 months.",
        "review",
        &apps_dir,
        sized_entries(&stale),
    )
}

fn one(category: Option<CleanCategory>) -> Vec<CleanCategory> {
    category.into_iter().collect()
}

type ScanJob = Box<dyn FnOnce() -> Vec<CleanCategory> + Send>;

/// Longest a scan may run before unfinished checks are reported as skipped.
const SCAN_DEADLINE: Duration = Duration::from_secs(150);

/// Smart Scan core: every check runs as a deadline-protected job and reports
/// through `progress` the moment it finishes, so the UI fills in live.
fn smart_scan_impl(progress: Arc<dyn Fn(Value) + Send + Sync>) -> Value {
    let now = Utc::now().timestamp_millis() as u64;
    let day = 86_400_000u64;
    let home = expand_home("~");
    let fda = has_full_disk_access();

    let owned = |items: &[&str]| -> Vec<String> { items.iter().map(|s| s.to_string()).collect() };
    let pkg_caches = owned(&[
        ".npm/_cacache",
        ".pnpm-store",
        "Library/pnpm/store",
        ".bun/install/cache",
        ".yarn/berry/cache",
        ".cargo/registry/cache",
        ".cargo/registry/src",
        ".cargo/git/checkouts",
        ".cargo/git/db",
        ".gradle/caches",
        ".m2/repository",
        "go/pkg/mod/cache/download",
        ".composer/cache",
    ]);
    // Electron/Chromium apps keep regenerable caches under Application Support.
    let mut app_caches: Vec<String> = Vec::new();
    for app in ["Code", "Cursor", "discord", "Slack", "Claude", "Figma", "Notion", "Microsoft Teams", "Spotify"] {
        for sub in [
            "Cache",
            "Code Cache",
            "GPUCache",
            "CachedData",
            "CachedExtensionVSIXs",
            "Service Worker/CacheStorage",
            "DawnCache",
            "DawnGraphiteCache",
            "DawnWebGPUCache",
        ] {
            app_caches.push(format!("Library/Application Support/{app}/{sub}"));
        }
    }
    let adobe = owned(&[
        "Library/Application Support/Adobe/Common/Media Cache Files",
        "Library/Application Support/Adobe/Common/Media Cache",
        "Library/Application Support/Adobe/Common/Peak Files",
        "Library/Application Support/Adobe/Common/Team Projects Cache",
    ]);
    let ai_caches = owned(&[".cache/huggingface", ".cache/torch", ".cache/whisper", ".cache/lm-studio", ".lmstudio/models"]);

    let mut jobs: Vec<(&'static str, ScanJob)> = vec![
        ("user-caches", Box::new(|| one(scan_children("user-caches", "App & user caches", "Cached data apps rebuild automatically.", "safe", "Library/Caches")))),
        ("logs", Box::new(|| one(scan_children("logs", "Logs", "Diagnostic logs — safe to clear.", "safe", "Library/Logs")))),
        ("derived-data", Box::new(|| one(scan_children("derived-data", "Xcode DerivedData", "Xcode build intermediates — regenerated on next build.", "safe", "Library/Developer/Xcode/DerivedData")))),
        ("device-support", Box::new(|| one(scan_children("device-support", "iOS DeviceSupport", "Debug symbols re-downloaded when a device reconnects.", "safe", "Library/Developer/Xcode/iOS DeviceSupport")))),
        ("sim-caches", Box::new(|| one(scan_children("sim-caches", "Simulator caches", "iOS Simulator caches — safe to clear.", "safe", "Library/Developer/CoreSimulator/Caches")))),
        ("pkg-caches", Box::new(move || one(scan_dirs("pkg-caches", "Package manager caches", "npm / pnpm / Cargo / Gradle / Go download caches — re-downloaded on the next install.", "safe", &pkg_caches)))),
        ("app-caches", Box::new(move || one(scan_dirs("app-caches", "Editor & chat app caches", "VS Code, Cursor, Slack, Discord and similar app caches — rebuilt on launch.", "safe", &app_caches)))),
        ("adobe-cache", Box::new(move || one(scan_dirs("adobe-cache", "Adobe media cache", "Premiere / After Effects media cache and peak files — regenerated as needed.", "safe", &adobe)))),
        ("ai-caches", Box::new(move || one(scan_dirs("ai-caches", "AI model caches", "Downloaded model weights (Hugging Face, PyTorch, LM Studio) — re-downloaded when needed.", "review", &ai_caches)))),
        ("archives", Box::new(|| one(scan_children("archives", "Xcode Archives", "App archives — keep any you still need for crash symbolication.", "review", "Library/Developer/Xcode/Archives")))),
        ("screenshots", Box::new(move || one(scan_old_screenshots(now.saturating_sub(30 * day))))),
        ("unused-apps", Box::new(move || one(scan_unused_apps(now.saturating_sub(180 * day))))),
    ];

    let dev_home = home.clone();
    jobs.push(("build-output", Box::new(move || {
        let (mut deps, mut targets) = (Vec::new(), Vec::new());
        let mut budget = 150_000u64;
        find_build_dirs(
            &dev_home,
            &["node_modules", ".venv", "venv", "__pycache__", "Pods", ".next", ".turbo", ".parcel-cache", ".nuxt", ".angular", ".svelte-kit"],
            6,
            &mut budget,
            &mut deps,
            &mut targets,
        );
        let mut out = one(make_category("dev-junk", "Developer dependencies", "node_modules, .venv and framework build caches — rebuilt with a reinstall.", "review", &dev_home, finish_file_entries(deps)));
        out.extend(one(make_category("rust-targets", "Rust build output", "Cargo target/ folders — rebuilt by the next cargo build.", "review", &dev_home, finish_file_entries(targets))));
        out
    })));

    let dl_home = home.clone();
    jobs.push(("installers", Box::new(move || {
        let mut out = Vec::new();
        let mut budget = 40_000u64;
        let downloads = dl_home.join("Downloads");
        collect_matching_files(&downloads, &["dmg", "pkg", "zip", "iso", "xip"], 1_048_576, Some(now.saturating_sub(14 * day)), &mut out, &mut budget);
        one(make_category("installers", "Old installers", "Installer archives in Downloads older than 2 weeks.", "review", &downloads, finish_file_entries(out)))
    })));

    let big_home = home.clone();
    jobs.push(("large-old", Box::new(move || {
        let mut out = Vec::new();
        let mut budget = 80_000u64;
        let cutoff = Some(now.saturating_sub(30 * day));
        for rel in ["Downloads", "Desktop", "Documents", "Movies"] {
            collect_matching_files(&big_home.join(rel), &[], 524_288_000, cutoff, &mut out, &mut budget);
        }
        one(make_category("large-old", "Large & old files", "Files over 500 MB you haven't touched in a month.", "review", &big_home, finish_file_entries(out)))
    })));

    // These live in privacy-protected areas: macOS refuses them without Full Disk
    // Access, so only try when we have it (avoids prompts and silent gaps).
    if fda {
        jobs.push(("trash", Box::new(|| one(scan_children("trash", "Trash", "Items in your Trash, ready to be emptied.", "safe", ".Trash")))));
        jobs.push(("mail-downloads", Box::new(|| one(scan_children("mail-downloads", "Mail attachment copies", "Copies Mail saved when you opened attachments — the originals stay in your mailbox.", "safe", "Library/Containers/com.apple.mail/Data/Library/Mail Downloads")))));
        jobs.push(("ios-backups", Box::new(|| one(scan_children("ios-backups", "iPhone & iPad backups", "Local device backups — keep the latest if you don't use iCloud Backup.", "review", "Library/Application Support/MobileSync/Backup")))));
    }

    let total_checks = jobs.len();
    let wrapped: Vec<ScanJob> = jobs
        .into_iter()
        .map(|(check, job)| {
            let progress = Arc::clone(&progress);
            Box::new(move || {
                let categories = job();
                progress(json!({ "check": check, "categories": &categories, "totalChecks": total_checks }));
                categories
            }) as ScanJob
        })
        .collect();

    let results = run_with_deadline(wrapped, SCAN_DEADLINE);
    let skipped = results.iter().filter(|r| r.is_none()).count();
    let mut categories: Vec<CleanCategory> = results.into_iter().flatten().flatten().collect();
    categories.sort_by_key(|c| std::cmp::Reverse(c.size_bytes));
    let total: u64 = categories.iter().map(|c| c.size_bytes).sum();

    json!({
        "categories": categories,
        "totalReclaimable": total,
        "humanTotal": human_bytes(total),
        "needsFullDiskAccess": !fda,
        "skippedChecks": skipped,
    })
}

/// Smart Scan: reclaimable space across curated categories, streamed live via
/// `disk-scan-progress` events and returned in full at the end.
#[tauri::command(async)]
pub fn disk_smart_scan(app: NativeAppHandle) -> Result<Value, String> {
    Ok(smart_scan_impl(Arc::new(move |event| {
        let _ = app.emit("disk-scan-progress", event);
    })))
}

/// Disk capacity of the user data volume (the APFS container's free space).
#[tauri::command(async)]
pub fn disk_capacity() -> Result<Value, String> {
    let target = if Path::new("/System/Volumes/Data").exists() {
        "/System/Volumes/Data"
    } else {
        "/"
    };
    let out = Command::new("df")
        .args(["-kP", target])
        .output()
        .map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&out.stdout);
    let line = text.lines().nth(1).ok_or("df returned no data")?;
    let fields: Vec<&str> = line.split_whitespace().collect();
    if fields.len() < 4 {
        return Err("Unexpected df output.".into());
    }
    let total = fields[1].parse::<u64>().map_err(|e| e.to_string())? * 1024;
    let available = fields[3].parse::<u64>().map_err(|e| e.to_string())? * 1024;
    let used = total.saturating_sub(available);
    Ok(json!({
        "totalBytes": total,
        "availableBytes": available,
        "usedBytes": used,
        "humanTotal": human_bytes(total),
        "humanAvailable": human_bytes(available),
        "humanUsed": human_bytes(used),
    }))
}

/// Whole-disk overview core: what's using space, grouped the way people think
/// about it (Apps, Documents, Photos, Developer, iCloud, Caches…). Every path is
/// sized in parallel under a deadline; `progress` receives running totals so the
/// bars grow live. A group whose walk hit the file limit is marked `capped` (≥).
fn storage_impl(progress: &dyn Fn(Value)) -> Value {
    let home = expand_home("~");
    let lib = home.join("Library");
    let fda = has_full_disk_access();

    // Home children that don't belong to a named group.
    let named_home = ["Documents", "Desktop", "Downloads", "Pictures", "Music", "Movies", "Library", "Applications", "Public", ".Trash"];
    let (mut hidden, mut other_home) = (Vec::new(), Vec::new());
    if let Ok(rd) = fs::read_dir(&home) {
        for e in rd.flatten() {
            if e.file_type().map(|t| t.is_symlink()).unwrap_or(true) {
                continue;
            }
            let p = e.path();
            let name = p.file_name().and_then(OsStr::to_str).unwrap_or("").to_string();
            if named_home.contains(&name.as_str()) {
                continue;
            }
            if name.starts_with('.') {
                hidden.push(p);
            } else {
                other_home.push(p);
            }
        }
    }
    // ~/Library children that don't belong to a named group. Without Full Disk
    // Access, other apps' containers are skipped: opening them can block on a
    // consent prompt, and macOS would refuse most of them anyway.
    let named_lib = ["Developer", "Mobile Documents", "Caches", "Mail", "CloudStorage"];
    let mut lib_rest = Vec::new();
    if let Ok(rd) = fs::read_dir(&lib) {
        for e in rd.flatten() {
            let p = e.path();
            let name = p.file_name().and_then(OsStr::to_str).unwrap_or("");
            if named_lib.contains(&name) || (!fda && PROTECTED_LIBRARY_DIRS.contains(&name)) {
                continue;
            }
            lib_rest.push(p);
        }
    }

    // (id, label, drill-down path, paths measured)
    let mut kinds: Vec<(&str, &str, PathBuf, Vec<PathBuf>)> = vec![
        ("apps", "Applications", PathBuf::from("/Applications"), vec![PathBuf::from("/Applications"), home.join("Applications")]),
        ("documents", "Documents", home.join("Documents"), vec![home.join("Documents")]),
        ("desktop", "Desktop", home.join("Desktop"), vec![home.join("Desktop")]),
        ("downloads", "Downloads", home.join("Downloads"), vec![home.join("Downloads")]),
        ("pictures", "Photos & Pictures", home.join("Pictures"), vec![home.join("Pictures")]),
        ("music", "Music & audio", home.join("Music"), vec![home.join("Music")]),
        ("movies", "Movies", home.join("Movies"), vec![home.join("Movies")]),
        ("developer", "Developer (Xcode, simulators)", lib.join("Developer"), vec![lib.join("Developer")]),
        ("icloud", "iCloud Drive (local copies)", lib.join("Mobile Documents"), vec![lib.join("Mobile Documents")]),
        ("cloud", "Cloud storage (Dropbox, Drive…)", lib.join("CloudStorage"), vec![lib.join("CloudStorage")]),
        ("caches", "Caches", lib.join("Caches"), vec![lib.join("Caches")]),
        ("appdata", "App data & settings", lib.clone(), lib_rest),
        ("hidden", "Hidden files (.cargo, .ollama…)", home.clone(), hidden),
        ("home-other", "Other folders in your home", home.clone(), other_home),
        ("shared", "Shared files (/Users/Shared)", PathBuf::from("/Users/Shared"), vec![PathBuf::from("/Users/Shared")]),
        ("system-lib", "Plug-ins & shared libraries (/Library)", PathBuf::from("/Library"), vec![PathBuf::from("/Library")]),
        ("cli", "Homebrew & command-line tools", PathBuf::from("/opt/homebrew"), vec![PathBuf::from("/opt/homebrew"), PathBuf::from("/usr/local")]),
    ];
    if fda {
        kinds.push(("mail", "Mail", lib.join("Mail"), vec![lib.join("Mail")]));
        kinds.push(("trash", "Trash", home.join(".Trash"), vec![home.join(".Trash")]));
    }

    // Flatten every path of every group into one parallel, deadline-bound pass.
    let mut flat: Vec<PathBuf> = Vec::new();
    let mut owner: Vec<usize> = Vec::new();
    for (i, (_, _, _, paths)) in kinds.iter().enumerate() {
        for p in paths {
            if p.exists() {
                flat.push(p.clone());
                owner.push(i);
            }
        }
    }
    let mut totals = vec![(0u64, false); kinds.len()];
    let mut pending: Vec<usize> = vec![0; kinds.len()];
    for &k in &owner {
        pending[k] += 1;
    }

    let snapshot = |totals: &[(u64, bool)], pending: &[usize]| -> Vec<Value> {
        let mut out: Vec<Value> = kinds
            .iter()
            .zip(totals.iter().zip(pending.iter()))
            .filter(|(_, ((bytes, _), left))| *bytes > 0 || **left > 0)
            .map(|((id, name, drill, _), ((bytes, capped), left))| {
                json!({
                    "id": id,
                    "name": name,
                    "drillPath": drill.to_string_lossy(),
                    "sizeBytes": bytes,
                    "humanSize": human_bytes(*bytes),
                    "capped": capped,
                    "measuring": *left > 0,
                })
            })
            .collect();
        out.sort_by_key(|k| std::cmp::Reverse(k["sizeBytes"].as_u64().unwrap_or(0)));
        out
    };

    let mut last_emit = Instant::now();
    let owner_for_cb = owner.clone();
    let results = par_sizes_deadline(flat, STORAGE_CAP_FILES, SCAN_DEADLINE, &mut |i, (bytes, capped)| {
        let k = owner_for_cb[i];
        totals[k].0 += bytes;
        totals[k].1 |= capped;
        pending[k] = pending[k].saturating_sub(1);
        if last_emit.elapsed() >= Duration::from_millis(400) {
            last_emit = Instant::now();
            progress(json!({ "kinds": snapshot(&totals, &pending) }));
        }
    });

    // Anything still pending when the deadline hit couldn't be measured.
    let mut unmeasured: Vec<String> = results
        .iter()
        .zip(owner.iter())
        .filter(|(r, _)| r.is_none())
        .map(|(_, &k)| kinds[k].1.to_string())
        .collect();
    unmeasured.sort();
    unmeasured.dedup();
    let pending_done = vec![0usize; kinds.len()];
    let out = snapshot(&totals, &pending_done);
    let measured: u64 = out.iter().map(|k| k["sizeBytes"].as_u64().unwrap_or(0)).sum();

    json!({
        "kinds": out,
        "measuredBytes": measured,
        "humanMeasured": human_bytes(measured),
        "needsFullDiskAccess": !fda,
        "unmeasured": unmeasured,
    })
}

/// Whole-disk overview, streamed live via `disk-storage-progress` events.
#[tauri::command(async)]
pub fn disk_storage_breakdown(app: NativeAppHandle) -> Result<Value, String> {
    Ok(storage_impl(&move |event| {
        let _ = app.emit("disk-storage-progress", event);
    }))
}

/// Space map: immediate children of a directory with on-disk sizes, largest
/// first — the OmniDiskSweeper-style "where did my space go?" drill-down.
#[tauri::command(async)]
pub fn disk_usage_tree(path: Option<String>, limit: Option<usize>) -> Result<Value, String> {
    let dir = match path {
        Some(p) if !p.trim().is_empty() => expand_home(&p),
        _ => expand_home("~"),
    };
    if !dir.exists() {
        return Err(format!("No such folder: {}", dir.display()));
    }
    let children: Vec<(PathBuf, bool)> = match fs::read_dir(&dir) {
        Ok(rd) => rd
            .flatten()
            .map(|e| {
                let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
                (e.path(), is_dir)
            })
            .collect(),
        Err(e) => return Err(format!("Can't read {}: {e}", dir.display())),
    };
    let paths: Vec<PathBuf> = children.iter().map(|(p, _)| p.clone()).collect();
    let sizes = par_sizes(&paths, CLEAN_SIZE_CAP_FILES);

    let mut items: Vec<Value> = children
        .iter()
        .zip(sizes)
        .map(|((p, is_dir), (size, capped))| {
            json!({
                "path": p.to_string_lossy(),
                "name": p.file_name().and_then(OsStr::to_str).unwrap_or_default(),
                "sizeBytes": size,
                "humanSize": human_bytes(size),
                "isDirectory": is_dir,
                "capped": capped,
            })
        })
        .collect();
    items.sort_by_key(|v| std::cmp::Reverse(v["sizeBytes"].as_u64().unwrap_or(0)));
    let total: u64 = items.iter().map(|v| v["sizeBytes"].as_u64().unwrap_or(0)).sum();
    let count = items.len();
    items.truncate(limit.unwrap_or(200).clamp(1, 5000));
    Ok(json!({
        "path": dir.to_string_lossy(),
        "items": items,
        "totalBytes": total,
        "humanTotal": human_bytes(total),
        "itemCount": count,
    }))
}

/// Extended attributes can include a resource fork and user annotations. Do not
/// call equal data forks duplicates when these differ. Bound metadata allocation;
/// files with unusually large attribute sets are conservatively not compared.
#[cfg(target_os = "macos")]
fn hash_duplicate_attributes(file: &fs::File, hasher: &mut sha2::Sha256) -> Option<()> {
    use sha2::Digest;
    use std::os::fd::AsRawFd;
    const LIMIT: usize = 16 * 1024 * 1024;
    let fd = file.as_raw_fd();
    let length = unsafe { libc::flistxattr(fd, std::ptr::null_mut(), 0, 0) };
    if length < 0 || length as usize > LIMIT { return None; }
    let mut names = vec![0u8; length as usize];
    if unsafe { libc::flistxattr(fd, names.as_mut_ptr().cast(), names.len(), 0) } != length { return None; }
    let mut names: Vec<&[u8]> = names.split(|byte| *byte == 0).filter(|name| !name.is_empty()).collect();
    names.sort();
    let mut total = 0usize;
    for name in names {
        let attribute = std::ffi::CString::new(name).ok()?;
        let length = unsafe { libc::fgetxattr(fd, attribute.as_ptr(), std::ptr::null_mut(), 0, 0, 0) };
        if length < 0 { return None; }
        total = total.checked_add(length as usize)?;
        if total > LIMIT { return None; }
        let mut value = vec![0u8; length as usize];
        if unsafe { libc::fgetxattr(fd, attribute.as_ptr(), value.as_mut_ptr().cast(), value.len(), 0, 0) } != length { return None; }
        hasher.update((name.len() as u64).to_le_bytes());
        hasher.update(name);
        hasher.update((value.len() as u64).to_le_bytes());
        hasher.update(value);
    }
    Some(())
}

/// Compare every byte, with bounded memory. A sampled head/tail match is not
/// enough to call a file a duplicate: differing middles may hold unique work.
/// Reject links, hardlinked files and files replaced/modified during the read.
fn full_file_hash(path: &Path, size: u64) -> Option<String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;
    use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
    let mut file = fs::OpenOptions::new().read(true).custom_flags(libc::O_NOFOLLOW).open(path).ok()?;
    let before = file.metadata().ok()?;
    if !before.is_file() || before.len() != size || before.nlink() != 1 { return None; }
    let snapshot = |md: &fs::Metadata| (md.dev(), md.ino(), md.len(), md.mtime(), md.mtime_nsec(), md.ctime(), md.ctime_nsec());
    let mut hasher = Sha256::new();
    hasher.update(size.to_le_bytes());
    let mut buffer = [0u8; 65536];
    let mut remaining = size;
    while remaining > 0 {
        let limit = remaining.min(buffer.len() as u64) as usize;
        let count = file.read(&mut buffer[..limit]).ok()?;
        if count == 0 { return None; }
        hasher.update(&buffer[..count]);
        remaining -= count as u64;
    }
    let mut extra = [0u8; 1];
    if file.read(&mut extra).ok()? != 0 { return None; }
    #[cfg(target_os = "macos")]
    hash_duplicate_attributes(&file, &mut hasher)?;
    let after = file.metadata().ok()?;
    let current_path = fs::symlink_metadata(path).ok()?;
    if !current_path.is_file() || after.nlink() != 1 || current_path.nlink() != 1
        || snapshot(&before) != snapshot(&after) || snapshot(&before) != snapshot(&current_path) { return None; }
    Some(format!("{:x}", hasher.finalize()))
}

fn collect_all_files(
    root: &Path,
    min_bytes: u64,
    by_size: &mut std::collections::HashMap<u64, Vec<PathBuf>>,
    budget: &mut u64,
) {
    if *budget == 0 || !fs::symlink_metadata(root).map(|md| md.is_dir()).unwrap_or(false) {
        return;
    }
    let rd = match fs::read_dir(root) {
        Ok(x) => x,
        Err(_) => return,
    };
    for e in rd.flatten() {
        if *budget == 0 {
            return;
        }
        *budget -= 1;
        let p = e.path();
        let md = match e.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if md.is_dir() {
            let name = p.file_name().and_then(OsStr::to_str).unwrap_or("");
            if name == ".Trash" || name.ends_with(".photoslibrary") {
                continue;
            }
            collect_all_files(&p, min_bytes, by_size, budget);
        } else if md.is_file() && md.len() >= min_bytes {
            by_size.entry(md.len()).or_default().push(p);
        }
    }
}

/// Duplicate finder: group same-size files, confirm with a complete SHA-256, and
/// report each duplicate set with its reclaimable space (keep one, trash the rest).
#[tauri::command(async)]
pub fn disk_find_duplicates(input: ScopeInput) -> Result<Value, String> {
    let mut by_size: std::collections::HashMap<u64, Vec<PathBuf>> = std::collections::HashMap::new();
    let mut budget = 200_000u64;
    for raw in &input.input_paths {
        collect_all_files(&expand_home(raw), 1_048_576, &mut by_size, &mut budget);
    }

    let mut groups: Vec<Value> = Vec::new();
    let mut seen_files = HashSet::new();
    for (size, mut paths) in by_size {
        use std::os::unix::fs::MetadataExt;
        // Overlapping input roots must not turn one file into several copies.
        paths.sort();
        paths.retain(|path| fs::symlink_metadata(path).map(|md| {
            md.is_file() && md.nlink() == 1 && seen_files.insert((md.dev(), md.ino()))
        }).unwrap_or(false));
        if paths.len() < 2 {
            continue;
        }
        let mut by_hash: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
        for p in paths {
            if let Some(h) = full_file_hash(&p, size) {
                by_hash.entry(h).or_default().push(p.to_string_lossy().to_string());
            }
        }
        for ps in by_hash.into_values() {
            if ps.len() >= 2 {
                let reclaimable = size * (ps.len() as u64 - 1);
                groups.push(json!({
                    "sizeBytes": size,
                    "humanSize": human_bytes(size),
                    "count": ps.len(),
                    "reclaimable": reclaimable,
                    "paths": ps,
                }));
            }
        }
    }
    groups.sort_by_key(|g| std::cmp::Reverse(g["reclaimable"].as_u64().unwrap_or(0)));
    groups.truncate(200);
    let total: u64 = groups.iter().map(|g| g["reclaimable"].as_u64().unwrap_or(0)).sum();

    Ok(json!({
        "groups": groups,
        "reclaimable": total,
        "humanReclaimable": human_bytes(total),
    }))
}

// ----- space-saving tips: things that free space OUTSIDE the reversible trash.
// They're surfaced as commands for the user to run — never run automatically —
// so the "every delete is reversible" guarantee stays true.

fn tip_simulators() -> Option<Value> {
    let devices = expand_home("~").join("Library/Developer/CoreSimulator/Devices");
    // simctl needs Xcode; guard so a Mac without it never triggers the
    // "install developer tools" prompt.
    if !devices.is_dir() || !Path::new("/Applications/Xcode.app").exists() {
        return None;
    }
    let out = Command::new("xcrun")
        .args(["simctl", "list", "devices", "unavailable", "-j"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let v: Value = serde_json::from_slice(&out.stdout).ok()?;
    let mut paths = Vec::new();
    if let Some(map) = v["devices"].as_object() {
        for list in map.values() {
            for d in list.as_array().into_iter().flatten() {
                if let Some(udid) = d["udid"].as_str() {
                    paths.push(devices.join(udid));
                }
            }
        }
    }
    if paths.is_empty() {
        return None;
    }
    let total: u64 = par_sizes(&paths, CLEAN_SIZE_CAP_FILES).iter().map(|(b, _)| *b).sum();
    let n = paths.len();
    Some(json!({
        "id": "simulators",
        "title": format!("{n} unavailable iOS simulator{}", if n == 1 { "" } else { "s" }),
        "detail": "Simulator devices for runtimes you no longer have installed.",
        "command": "xcrun simctl delete unavailable",
        "sizeBytes": total,
        "humanSize": human_bytes(total),
    }))
}

fn tip_snapshots() -> Option<Value> {
    let out = Command::new("tmutil").args(["listlocalsnapshots", "/"]).output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let n = text.lines().filter(|l| l.contains("com.apple.TimeMachine")).count();
    if n == 0 {
        return None;
    }
    Some(json!({
        "id": "snapshots",
        "title": format!("{n} Time Machine local snapshot{}", if n == 1 { "" } else { "s" }),
        "detail": "macOS frees these when space runs low; thinning them reclaims that space now. Asks for your password.",
        "command": "sudo tmutil thinlocalsnapshots / 999999999999 4",
    }))
}

fn tip_homebrew() -> Option<Value> {
    ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]
        .iter()
        .find(|p| Path::new(p).exists())?;
    Some(json!({
        "id": "homebrew",
        "title": "Homebrew old versions & downloads",
        "detail": "Removes outdated formula versions and unneeded dependencies Homebrew keeps around.",
        "command": "brew cleanup --prune=all && brew autoremove",
    }))
}

fn tip_docker() -> Option<Value> {
    if which::which("docker").is_err() && !Path::new("/Applications/Docker.app").exists() {
        return None;
    }
    Some(json!({
        "id": "docker",
        "title": "Docker images, containers & build cache",
        "detail": "Unused images and build cache often grow to tens of gigabytes.",
        "command": "docker system prune -a",
    }))
}

/// Space-saving tips that live outside the reversible trash (shown, not run).
#[tauri::command(async)]
pub fn disk_tips() -> Result<Value, String> {
    let tips: Vec<Value> = std::thread::scope(|s| {
        let handles = vec![
            s.spawn(tip_simulators),
            s.spawn(tip_snapshots),
            s.spawn(tip_homebrew),
            s.spawn(tip_docker),
        ];
        handles.into_iter().filter_map(|h| h.join().ok().flatten()).collect()
    });
    Ok(json!({ "tips": tips }))
}

#[cfg(test)]
mod tests {
    //! Tier-0 safety invariants exercised at the Rust layer (the GUI can't be
    //! driven headlessly). Mirrors VALIDATION_CHECKLIST Tier 0: typed-command
    //! allowlist, sandbox validation, path containment, overwrite protection,
    //! idempotent moves, and undo. Run with `cargo test`.
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        use std::sync::atomic::{AtomicU32, Ordering};
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("uco-test-{}-{}-{}", std::process::id(), tag, n));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        // Canonicalize so the macOS /var -> /private/var symlink doesn't make a
        // confined-root prefix check spuriously fail in tests.
        fs::canonicalize(&dir).unwrap()
    }

    fn write_file(path: &Path, contents: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, contents).unwrap();
    }

    fn pair(source: &Path, destination: &Path) -> FilePair {
        FilePair {
            source: source.to_string_lossy().to_string(),
            destination: destination.to_string_lossy().to_string(),
        }
    }

    fn move_input(files: Vec<FilePair>, confine: Option<String>) -> CopyMoveInput {
        CopyMoveInput {
            files: Some(files),
            input_paths: None,
            output_path: None,
            overwrite: None,
            strategy: None,
            dry_run: None,
            confine_to_root: confine,
        }
    }

    // --- typed-command allowlist (no raw shell) -------------------------

    #[test]
    fn npm_script_maps_to_validated_run() {
        let proc = command_to_process(&TypedCommand::NpmScript { script: "build".into() }).unwrap();
        assert_eq!(proc.program, "npm");
        assert_eq!(proc.args, vec!["run".to_string(), "build".to_string()]);
    }

    #[test]
    fn cargo_and_git_commands_have_fixed_args() {
        let cargo = command_to_process(&TypedCommand::CargoCheck).unwrap();
        assert_eq!(cargo.program, "cargo");
        assert_eq!(cargo.args, vec!["check".to_string()]);

        let diff = command_to_process(&TypedCommand::GitDiff { stat: Some(true) }).unwrap();
        assert_eq!(diff.args, vec!["diff".to_string(), "--stat".to_string()]);
    }

    #[test]
    fn dangerous_script_names_are_rejected() {
        assert!(command_to_process(&TypedCommand::NpmScript { script: "build; rm -rf /".into() }).is_err());
        assert!(validate_script_name("build:prod").is_ok());
        assert!(validate_script_name("bad name").is_err());
        assert!(validate_script_name("a&&b").is_err());
        assert!(validate_script_name("").is_err());
    }

    #[test]
    fn node_script_path_must_stay_inside_project() {
        assert!(validate_relative_script_path("scripts/run.js").is_ok());
        assert!(validate_relative_script_path("../escape.js").is_err());
        assert!(validate_relative_script_path("/etc/passwd").is_err());
        assert!(command_to_process(&TypedCommand::NodeScript { path: "../evil.js".into(), args: None }).is_err());
    }

    // --- Codex sandbox validation ---------------------------------------

    #[test]
    fn sandbox_modes_match_codex_cli() {
        for mode in ["read-only", "workspace-write", "danger-full-access"] {
            assert!(validate_sandbox_mode(mode).is_ok(), "{mode} should be valid");
        }
        assert!(validate_sandbox_mode("yolo").is_err());
        assert!(validate_sandbox_mode("").is_err());
    }

    // --- path containment -----------------------------------------------

    #[test]
    fn ensure_within_root_blocks_escapes() {
        let root = temp_dir("contain");
        let inside = root.join("sub/file.txt");
        write_file(&inside, "x");
        assert!(ensure_within_root(&root, &inside).is_ok());

        let outside = root.parent().unwrap().join("uco-escape.txt");
        assert!(ensure_within_root(&root, &outside).is_err());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn ensure_within_root_allows_missing_nested_dest_under_symlinked_root() {
        // Intentionally do NOT canonicalize the root: on macOS std::env::temp_dir()
        // lives under the /var -> /private/var symlink, so the un-canonicalized root
        // reproduces the false rejection the old code hit when BOTH the destination
        // and its parent directory don't exist yet.
        use std::sync::atomic::{AtomicU32, Ordering};
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let root =
            std::env::temp_dir().join(format!("uco-symlink-root-{}-{}", std::process::id(), n));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();

        // Destination is two levels deep: the "missing" intermediate folder does
        // not exist, so canonicalizing only path.parent() used to fall back to the
        // literal /var path and fail the starts_with against the canonical root.
        let dest = root.join("missing").join("dest.txt");
        assert!(!dest.parent().unwrap().exists());
        assert!(
            ensure_within_root(&root, &dest).is_ok(),
            "a confined move to a not-yet-created nested folder under a symlinked root must be allowed"
        );

        // An escape relative to the same un-canonicalized root must still be refused.
        let outside = root.parent().unwrap().join("uco-symlink-escape.txt");
        assert!(ensure_within_root(&root, &outside).is_err());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn move_refuses_destination_outside_confined_root() {
        let root = temp_dir("confine");
        let src = root.join("a.txt");
        write_file(&src, "x");
        let outside = root.parent().unwrap().join("uco-out.txt");
        let result = copy_or_move_files(
            move_input(vec![pair(&src, &outside)], Some(root.to_string_lossy().to_string())),
            true,
        );
        assert!(result.is_err(), "move outside the confined root must be refused");
        assert!(src.exists(), "source must be untouched when refused");
        let _ = fs::remove_dir_all(&root);
    }

    // --- overwrite protection -------------------------------------------

    #[test]
    fn ensure_safe_destination_guards_existing_files() {
        let dir = temp_dir("overwrite");
        let existing = dir.join("there.txt");
        write_file(&existing, "x");
        assert!(ensure_safe_destination(&existing, false).is_err());
        assert!(ensure_safe_destination(&existing, true).is_ok());
        assert!(ensure_safe_destination(&dir.join("fresh.txt"), false).is_ok());
        let _ = fs::remove_dir_all(&dir);
    }

    // --- idempotent move + undo round-trip ------------------------------

    #[test]
    fn move_is_idempotent_on_resume() {
        let root = temp_dir("idempotent");
        let src = root.join("note.txt");
        write_file(&src, "hello");
        let dest = root.join("Documents/note.txt");
        let confine = Some(root.to_string_lossy().to_string());

        let first = copy_or_move_files(move_input(vec![pair(&src, &dest)], confine.clone()), true).unwrap();
        assert!(first.ok);
        assert!(!src.exists() && dest.exists());

        // Re-running the same move (resume) must not error or double-process.
        let second = copy_or_move_files(move_input(vec![pair(&src, &dest)], confine), true).unwrap();
        assert!(second.ok, "resume should treat an already-moved file as done");
        assert_eq!(second.output_paths, vec![dest.to_string_lossy().to_string()]);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn undo_restores_moved_files() {
        let root = temp_dir("undo");
        let src = root.join("photo.png");
        write_file(&src, "img");
        let dest = root.join("Images/photo.png");

        copy_or_move_files(move_input(vec![pair(&src, &dest)], None), true).unwrap();
        assert!(!src.exists() && dest.exists());

        let undo = batch_undo_moves(UndoMovesInput {
            pairs: vec![pair(&src, &dest)],
            confine_to_root: Some(root.to_string_lossy().to_string()),
            overwrite: None,
        })
        .unwrap();
        assert!(undo.ok);
        assert!(src.exists(), "original restored");
        assert!(!dest.exists(), "moved copy removed");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn scan_stops_descending_past_the_depth_cap() {
        let root = temp_dir("depth");
        // A file at the top must be found…
        write_file(&root.join("top.txt"), "x");
        // …but one buried below the depth cap must not (guards symlink loops / runaway trees).
        let mut deep = root.clone();
        for _ in 0..(MAX_SCAN_DEPTH + 3) {
            deep = deep.join("d");
        }
        write_file(&deep.join("buried.txt"), "x");

        let mut files = Vec::new();
        let truncated = collect_files(&root, true, &HashSet::new(), &mut files).unwrap();
        assert!(!truncated, "a small tree is not count-truncated");
        let names: Vec<&str> = files.iter().filter_map(|f| f.path.split('/').next_back()).collect();
        assert!(names.contains(&"top.txt"), "shallow file found");
        assert!(!names.contains(&"buried.txt"), "file below the depth cap is not scanned");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn disk_scan_children_and_categories() {
        let root = temp_dir("disk-children");
        // Sizes are allocated bytes, so use files big enough to own real blocks.
        write_file(&root.join("big.bin"), &"x".repeat(200_000));
        fs::create_dir_all(root.join("sub")).unwrap();
        write_file(&root.join("sub/nested.bin"), &"z".repeat(80_000));

        let entries = children_entries(&root);
        assert!(entries.len() >= 2);
        assert!(entries[0].size_bytes >= entries[1].size_bytes, "sorted desc");
        assert!(entries[0].path.ends_with("big.bin"), "largest first");

        let cat = make_category("t", "T", "d", "safe", &root, entries).unwrap();
        assert!(cat.size_bytes >= 200_000);
        assert_eq!(cat.safety, "safe");
        // Empty entries → no category.
        assert!(make_category("t", "T", "d", "safe", &root, vec![]).is_none());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn duplicates_do_not_confuse_matching_edges_with_identical_files() {
        let root = temp_dir("duplicate-middle");
        let a = root.join("a.bin");
        let b = root.join("b.bin");
        let c = root.join("c.bin");
        let body = vec![42u8; 2 * 1024 * 1024];
        fs::write(&a, &body).unwrap();
        fs::write(&b, &body).unwrap();
        let mut changed = body.clone();
        changed[1024 * 1024] = 99;
        fs::write(&c, changed).unwrap();
        let report = disk_find_duplicates(ScopeInput { input_paths: vec![root.to_string_lossy().into_owned()] }).unwrap();
        let groups = report["groups"].as_array().unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0]["count"], 2, "a differing middle must never be selected for duplicate removal");
        assert!(!groups[0]["paths"].as_array().unwrap().contains(&json!(c)));
        assert_eq!(report["reclaimable"], body.len());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn duplicates_preserve_distinct_resource_forks_and_annotations() {
        let root = temp_dir("duplicate-resource-data");
        let a = root.join("a.bin");
        let b = root.join("b.bin");
        let c = root.join("c.bin");
        for file in [&a, &b, &c] { fs::write(file, vec![91u8; 1024 * 1024]).unwrap(); }
        assert!(Command::new("/usr/bin/xattr").args(["-w", "com.apple.ResourceFork", "unique resource data"]).arg(&b).status().unwrap().success());
        assert!(Command::new("/usr/bin/xattr").args(["-w", "com.reclaim.fixture", "unique annotation"]).arg(&c).status().unwrap().success());
        let report = disk_find_duplicates(ScopeInput { input_paths: vec![root.to_string_lossy().into_owned()] }).unwrap();
        assert!(report["groups"].as_array().unwrap().is_empty(), "equal data forks do not make unique metadata safe to discard");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn duplicates_do_not_count_overlapping_roots_or_hardlinks_as_copies() {
        let root = temp_dir("duplicate-alias");
        let child = root.join("child");
        fs::create_dir(&child).unwrap();
        let a = child.join("a.bin");
        fs::write(&a, vec![17u8; 1024 * 1024]).unwrap();
        fs::hard_link(&a, child.join("alias.bin")).unwrap();
        let report = disk_find_duplicates(ScopeInput { input_paths: vec![root.to_string_lossy().into_owned(), child.to_string_lossy().into_owned()] }).unwrap();
        assert_eq!(report["groups"].as_array().unwrap().len(), 0, "multiple paths to one inode do not reclaim file bytes");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn disk_duplicate_hash_matches_identical_and_differs_on_content() {
        let root = temp_dir("disk-dup");
        let a = root.join("a.bin");
        let b = root.join("b.bin");
        let c = root.join("c.bin");
        let body = "duplicate-body-".repeat(20000); // Multiple streamed read blocks
        write_file(&a, &body);
        write_file(&b, &body);
        write_file(&c, &body.replace("duplicate", "different"));
        let sa = fs::metadata(&a).unwrap().len();
        let sc = fs::metadata(&c).unwrap().len();
        assert_eq!(full_file_hash(&a, sa), full_file_hash(&b, sa), "identical files hash equal");
        assert_ne!(full_file_hash(&a, sa), full_file_hash(&c, sc), "different content differs");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn disk_finds_named_dependency_dirs_without_descending_into_them() {
        let root = temp_dir("disk-devjunk");
        write_file(&root.join("proj/node_modules/pkg/index.js"), &"a".repeat(64_000));
        write_file(&root.join("proj/src/main.ts"), "b");
        let mut out = Vec::new();
        let mut budget = 10_000u64;
        find_named_dirs(&root, &["node_modules"], 6, &mut budget, &mut out);
        assert_eq!(out.len(), 1, "records the node_modules dir itself");
        assert!(out[0].path.ends_with("node_modules"));
        assert!(out[0].size_bytes >= 64_000);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn disk_finds_cargo_targets_only_when_tagged() {
        let root = temp_dir("disk-targets");
        // A real Cargo target dir carries CACHEDIR.TAG…
        write_file(&root.join("crate/target/CACHEDIR.TAG"), "Signature: 8a477f597d28d172789f06886806bc55");
        write_file(&root.join("crate/target/debug/app"), &"b".repeat(64_000));
        // …an unrelated folder merely named "target" must never be touched.
        write_file(&root.join("marketing/target/plan.txt"), &"c".repeat(64_000));
        let (mut deps, mut targets) = (Vec::new(), Vec::new());
        let mut budget = 10_000u64;
        find_build_dirs(&root, &["node_modules"], 6, &mut budget, &mut deps, &mut targets);
        assert_eq!(targets.len(), 1);
        assert!(targets[0].path.ends_with("crate/target"));
        assert!(deps.is_empty());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn disk_usage_does_not_follow_symlinks() {
        let root = temp_dir("disk-symlink");
        let elsewhere = temp_dir("disk-symlink-target");
        write_file(&elsewhere.join("huge.bin"), &"h".repeat(500_000));
        write_file(&root.join("own.bin"), &"o".repeat(64_000));
        std::os::unix::fs::symlink(&elsewhere, root.join("link")).unwrap();
        let (bytes, capped) = disk_usage(&root, 10_000);
        assert!(!capped);
        assert!(bytes >= 64_000, "counts its own file");
        assert!(bytes < 500_000, "does not count the symlink target");
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&elsewhere);
    }

    #[test]
    fn disk_par_sizes_keep_input_order() {
        let root = temp_dir("disk-par");
        write_file(&root.join("a.bin"), &"a".repeat(300_000));
        write_file(&root.join("b.bin"), &"b".repeat(60_000));
        let sizes = par_sizes(&[root.join("b.bin"), root.join("a.bin"), root.join("missing")], 1000);
        assert_eq!(sizes.len(), 3);
        assert!(sizes[1].0 > sizes[0].0, "results line up with inputs");
        assert_eq!(sizes[2].0, 0, "missing path sizes to zero");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn disk_screenshot_names_and_walk_exclusions() {
        assert!(is_screenshot_name("Screenshot 2026-01-02 at 10.00.00.png"));
        assert!(is_screenshot_name("Screen Recording 2026-01-02.mov"));
        assert!(!is_screenshot_name("vacation.png"));
        assert!(is_walk_excluded("Library"));
        assert!(is_walk_excluded("Photos Library.photoslibrary"));
        assert!(is_walk_excluded(".git"));
        assert!(!is_walk_excluded("projects"));
    }

    /// Read-only smoke test against the real disk (never deletes anything).
    /// Run manually: `cargo test live_disk_smoke -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn live_disk_smoke() {
        let t = Instant::now();
        let cap = disk_capacity().unwrap();
        println!("capacity: used {} of {} ({} free)", cap["humanUsed"], cap["humanTotal"], cap["humanAvailable"]);
        let scan = smart_scan_impl(Arc::new(|_| {}));
        println!("smart scan: {} reclaimable in {:?}", scan["humanTotal"], t.elapsed());
        for c in scan["categories"].as_array().unwrap() {
            println!("  {:<28} {:>10}  {:>4} items  [{}]", c["name"].as_str().unwrap(), c["humanSize"].as_str().unwrap(), c["itemCount"], c["safety"].as_str().unwrap());
        }
        let t = Instant::now();
        let tips = disk_tips().unwrap();
        println!("tips ({:?}):", t.elapsed());
        for tip in tips["tips"].as_array().unwrap() {
            println!("  {} — {} {}", tip["title"], tip["command"], tip["humanSize"]);
        }
        let t = Instant::now();
        let storage = storage_impl(&|_| {});
        println!("storage breakdown: {} measured in {:?}", storage["humanMeasured"], t.elapsed());
        for k in storage["kinds"].as_array().unwrap() {
            println!("  {:<40} {:>10}{}", k["name"].as_str().unwrap(), k["humanSize"].as_str().unwrap(), if k["capped"].as_bool().unwrap() { " (≥)" } else { "" });
        }
    }

    /// Build a quarantine batch the way `batch_trash` does: items inside a
    /// UUID-named folder plus a manifest mapping each back to its original.
    fn make_batch(base: &Path, trashed_at: &str, originals: &[PathBuf]) -> String {
        let id = Uuid::new_v4().to_string();
        let dir = base.join(&id);
        fs::create_dir_all(&dir).unwrap();
        let mut items = Vec::new();
        for (i, orig) in originals.iter().enumerate() {
            let trashed = dir.join(format!("item{i}.bin"));
            write_file(&trashed, &"q".repeat(64_000));
            items.push(json!({ "original": orig.to_string_lossy(), "trashed": trashed.to_string_lossy() }));
        }
        let manifest = json!({ "trashId": id, "trashedAt": trashed_at, "items": items });
        fs::write(dir.join("manifest.json"), serde_json::to_vec(&manifest).unwrap()).unwrap();
        id
    }

    // Run native engine operations in a separate OS process. No AppHandle mock,
    // user folders, GUI permissions or physical devices are involved.
    #[test]
    #[ignore = "subprocess helper invoked only by the owned-fixture recovery test"]
    fn quarantine_process_fixture_worker() {
        let root = PathBuf::from(std::env::var_os("RECLAIM_FIXTURE_ROOT").expect("fixture root"));
        assert_eq!(fs::read_to_string(root.join("owned-fixture")).unwrap(), "reclaim-process-test");
        let base = root.join("quarantine");
        if std::env::var("RECLAIM_FIXTURE_STAGE").unwrap() == "trash" {
            let paths: Vec<String> = serde_json::from_slice(&fs::read(root.join("paths.json")).unwrap()).unwrap();
            trash_in(&base, TrashInput { paths, confine_to_root: Some(root.join("source").to_string_lossy().into_owned()) }).unwrap();
        } else {
            for entry in fs::read_dir(&base).unwrap() {
                let name = entry.unwrap().file_name().into_string().unwrap();
                restore_batch_in(&base, &name).unwrap();
            }
        }
    }

    #[test]
    fn quarantine_process_kill_restarts_and_restores_exact_fixture_bytes() {
        use std::time::{Duration, Instant};
        let root = temp_dir("q-process-crash");
        fs::write(root.join("owned-fixture"), "reclaim-process-test").unwrap();
        let source = root.join("source");
        fs::create_dir_all(&source).unwrap();
        let paths: Vec<String> = (0..5000).map(|i| {
            let path = source.join(format!("folder-{}/same-name-{}.bin", i % 5, i / 5));
            write_file(&path, &format!("owned fixture {i:05}: ").repeat(160));
            path.to_string_lossy().into_owned()
        }).collect();
        fs::write(root.join("paths.json"), serde_json::to_vec(&paths).unwrap()).unwrap();
        let command = |stage: &str| {
            let mut cmd = Command::new(std::env::current_exe().unwrap());
            cmd.args(["--ignored", "--exact", "batch_operator::tests::quarantine_process_fixture_worker", "--nocapture"])
                .env("RECLAIM_FIXTURE_ROOT", &root).env("RECLAIM_FIXTURE_STAGE", stage);
            cmd
        };
        let mut child = command("trash").spawn().unwrap();
        let deadline = Instant::now() + Duration::from_secs(30);
        let base = root.join("quarantine");
        let mut committed_dir = None;
        while Instant::now() < deadline {
            if let Ok(entries) = fs::read_dir(&base) {
                committed_dir = entries.flatten().map(|e| e.path()).find(|dir| dir.join("item-00000000").exists());
            }
            if committed_dir.is_some() { break; }
            assert!(child.try_wait().unwrap().is_none(), "quarantine worker exited before observation");
            std::thread::sleep(Duration::from_millis(1));
        }
        child.kill().unwrap();
        assert!(!child.wait().unwrap().success(), "worker was actually terminated");
        let dir = committed_dir.expect("observed actual committed move before killing process");
        let manifest = read_manifest(&dir).expect("manifest survives interruption");
        let items = validated_manifest_items(&dir, &manifest).unwrap();
        let mut held = 0;
        for (i, (original, trashed)) in items.iter().enumerate() {
            assert_ne!(original.exists(), trashed.exists(), "exactly one copy before restart");
            let path = if trashed.exists() { held += 1; trashed } else { original };
            assert_eq!(fs::read(path).unwrap(), format!("owned fixture {i:05}: ").repeat(160).as_bytes());
        }
        assert!(held > 0 && held < paths.len(), "interrupted a partially moved batch, not an already completed operation");
        let restarted = command("restore").output().unwrap();
        assert!(restarted.status.success(), "{}", String::from_utf8_lossy(&restarted.stderr));
        for (i, original) in paths.iter().enumerate() {
            assert_eq!(fs::read(original).unwrap(), format!("owned fixture {i:05}: ").repeat(160).as_bytes());
        }
        assert_eq!(quarantine_info_in(&base)["totalBytes"], 0);
        println!("RECOVERY_EVIDENCE {}", json!({ "fixtureFiles": paths.len(), "movedBeforeSigkill": held, "restoredByteExact": paths.len(), "realSubprocessRestart": true }));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    #[ignore = "requires an explicitly mounted disposable 32 MiB test volume"]
    fn quarantine_owned_volume_roundtrip_and_disk_full_preserve_source() {
        use std::io::Write;
        use std::os::unix::fs::MetadataExt;
        let volume = PathBuf::from(std::env::var_os("RECLAIM_OWNED_TEST_VOLUME").expect("owned disposable volume required"));
        assert_eq!(fs::read_to_string(volume.join("owned-fixture")).unwrap(), "reclaim-disposable-32mb-volume");
        let root = temp_dir("q-real-enospc");
        assert_ne!(fs::metadata(&root).unwrap().dev(), fs::metadata(&volume).unwrap().dev(), "must be a separate test filesystem, never fill the workspace disk");
        let base = volume.join(format!("quarantine-{}", Uuid::new_v4()));
        let source = root.join("source.bin");
        let contents = vec![83u8; 8 * 1024 * 1024];
        fs::write(&source, &contents).unwrap();
        assert!(Command::new("/usr/bin/xattr").args(["-w", "com.apple.ResourceFork", "cross-volume resource data"]).arg(&source).status().unwrap().success());
        let input = || TrashInput { paths: vec![source.to_string_lossy().into_owned()], confine_to_root: Some(root.to_string_lossy().into_owned()) };
        let result = trash_in(&base, input()).unwrap();
        assert_eq!(result.metadata["moved"], 1);
        assert!(!source.exists());
        let id = result.metadata["trashId"].as_str().unwrap();
        assert_eq!(fs::read(base.join(id).join("item-00000000")).unwrap(), contents);
        restore_batch_in(&base, id).unwrap();
        assert_eq!(fs::read(&source).unwrap(), contents);
        let resource = Command::new("/usr/bin/xattr").args(["-p", "com.apple.ResourceFork"]).arg(&source).output().unwrap();
        assert!(resource.status.success());
        assert_eq!(String::from_utf8(resource.stdout).unwrap().trim_end(), "cross-volume resource data");
        let reserve = volume.join("owned-reserve.bin");
        fs::write(&reserve, vec![0u8; 2 * 1024 * 1024]).unwrap();
        let filler_path = volume.join("owned-filler.bin");
        let mut filler = fs::File::create(&filler_path).unwrap();
        let block = [0u8; 65536];
        let mut disk_full = false;
        for _ in 0..640 {
            if let Err(error) = filler.write_all(&block) {
                assert_eq!(error.raw_os_error(), Some(libc::ENOSPC));
                disk_full = true;
                break;
            }
        }
        drop(filler);
        assert!(disk_full, "volume must actually return ENOSPC within 40 MiB fixture bound");
        fs::remove_file(reserve).unwrap(); // room for manifest and only a partial copy
        let failed = trash_in(&base, input()).unwrap();
        assert_eq!(failed.metadata["moved"], 0);
        assert_eq!(failed.metadata["skipped"].as_array().unwrap().len(), 1);
        assert_eq!(fs::read(&source).unwrap(), contents, "a real full-disk copy must never unlink or modify source");
        assert_eq!(quarantine_info_in(&base)["totalBytes"], 0);
        println!("DISK_PRESSURE_EVIDENCE {}", json!({"actualSeparateFilesystem": true, "actualEnospc": true, "crossVolumeRoundtripBytes": contents.len(), "sourceAfterCopyFailureByteExact": true, "failure": failed.metadata["skipped"]}));
        fs::remove_file(filler_path).unwrap();
        fs::remove_dir_all(base).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_info_reports_held_items_and_skips_restored_ones() {
        let base = temp_dir("q-info");
        let home = temp_dir("q-info-home");
        let a = home.join("a.bin");
        let b = home.join("b.bin");
        let id = make_batch(&base, "2026-09-01T00:00:00Z", &[a.clone(), b.clone()]);

        let info = quarantine_info_in(&base);
        assert_eq!(info["batches"].as_array().unwrap().len(), 1);
        assert_eq!(info["batches"][0]["itemCount"], 2);
        assert!(info["totalBytes"].as_u64().unwrap() >= 128_000);

        restore_item_in(&base, &id, &a.to_string_lossy()).unwrap();
        assert!(a.exists(), "item restored to its original path");
        let info = quarantine_info_in(&base);
        assert_eq!(info["batches"][0]["itemCount"], 1, "restored item no longer counted");
        let _ = fs::remove_dir_all(&base);
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn quarantine_restore_refuses_occupied_paths_and_bad_ids() {
        let base = temp_dir("q-restore");
        let home = temp_dir("q-restore-home");
        let a = home.join("a.bin");
        let id = make_batch(&base, "2026-09-01T00:00:00Z", std::slice::from_ref(&a));
        write_file(&a, "someone put a new file here");
        assert!(restore_item_in(&base, &id, &a.to_string_lossy()).is_err(), "never overwrite");
        // Batch ids are joined onto the quarantine path — traversal must be refused.
        assert!(restore_item_in(&base, "../../etc", &a.to_string_lossy()).is_err());
        assert!(trash_batch_dir(&base, "../x").is_err());
        let _ = fs::remove_dir_all(&base);
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn quarantine_manifest_named_file_round_trips_without_data_loss() {
        let root = temp_dir("q-manifest-name");
        let base = root.join("quarantine");
        let original = root.join("source/manifest.json");
        write_file(&original, "user document, not recovery metadata");
        let result = trash_in(&base, TrashInput {
            paths: vec![original.to_string_lossy().into_owned()],
            confine_to_root: Some(root.to_string_lossy().into_owned()),
        }).unwrap();
        let id = result.metadata["trashId"].as_str().unwrap();
        restore_item_in(&base, id, &original.to_string_lossy()).unwrap();
        assert_eq!(fs::read_to_string(&original).unwrap(), "user document, not recovery metadata");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_restore_refuses_manifest_traversal() {
        let root = temp_dir("q-traversal");
        let base = root.join("quarantine");
        let original = root.join("restore.txt");
        let id = make_batch(&base, "2026-09-01T00:00:00Z", std::slice::from_ref(&original));
        let outside = root.join("outside.txt");
        write_file(&outside, "must stay outside quarantine");
        let manifest = json!({ "trashId": id, "items": [{ "original": original,
            "trashed": base.join(&id).join("../../outside.txt") }] });
        fs::write(base.join(&id).join("manifest.json"), serde_json::to_vec(&manifest).unwrap()).unwrap();
        assert!(restore_item_in(&base, &id, &original.to_string_lossy()).is_err());
        assert_eq!(fs::read_to_string(outside).unwrap(), "must stay outside quarantine");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_restore_preserves_occupied_dangling_symlink() {
        use std::os::unix::fs::symlink;
        let root = temp_dir("q-dangling");
        let base = root.join("quarantine");
        let original = root.join("original.txt");
        let id = make_batch(&base, "2026-09-01T00:00:00Z", std::slice::from_ref(&original));
        let missing = root.join("missing.txt");
        symlink(&missing, &original).unwrap();
        assert!(restore_item_in(&base, &id, &original.to_string_lossy()).is_err());
        assert_eq!(fs::read_link(original).unwrap(), missing);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_partial_permission_failure_keeps_recovery_records() {
        use std::os::unix::fs::PermissionsExt;
        let root = temp_dir("q-partial");
        let base = root.join("quarantine");
        let first = root.join("first.txt");
        let locked_dir = root.join("locked");
        let blocked = locked_dir.join("blocked.txt");
        write_file(&first, "recover me");
        write_file(&blocked, "leave me");
        fs::set_permissions(&locked_dir, fs::Permissions::from_mode(0o500)).unwrap();
        let outcome = trash_in(&base, TrashInput {
            paths: vec![first.to_string_lossy().into_owned(), blocked.to_string_lossy().into_owned()],
            confine_to_root: Some(root.to_string_lossy().into_owned()),
        });
        fs::set_permissions(&locked_dir, fs::Permissions::from_mode(0o700)).unwrap();
        let result = outcome.unwrap();
        assert_eq!(result.metadata["moved"], 1);
        assert_eq!(result.metadata["skipped"].as_array().unwrap().len(), 1);
        assert_eq!(fs::read_to_string(&blocked).unwrap(), "leave me");
        let id = result.metadata["trashId"].as_str().unwrap();
        let manifest_file = base.join(id).join("manifest.json");
        assert_eq!(fs::metadata(&manifest_file).unwrap().permissions().mode() & 0o777, 0o600);
        assert_eq!(read_manifest(&base.join(id)).unwrap()["items"].as_array().unwrap().len(), 2);
        restore_batch_in(&base, id).unwrap();
        assert_eq!(fs::read_to_string(first).unwrap(), "recover me");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_never_moves_its_own_store_or_parent() {
        let root = temp_dir("q-self");
        let base = root.join("quarantine");
        write_file(&base.join("kept"), "recovery data");
        for source in [&root, &base, &base.join("kept")] {
            assert!(trash_in(&base, TrashInput {
                paths: vec![source.to_string_lossy().into_owned()], confine_to_root: None,
            }).is_err());
        }
        assert_eq!(fs::read_to_string(base.join("kept")).unwrap(), "recovery data");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_batch_restore_prevalidates_every_manifest_entry() {
        let root = temp_dir("q-batch-validation");
        let base = root.join("quarantine");
        let first = root.join("first.txt");
        let id = make_batch(&base, "2026-09-01T00:00:00Z", std::slice::from_ref(&first));
        let outside = root.join("outside.txt");
        write_file(&outside, "not quarantined");
        let dir = base.join(&id);
        let mut manifest = read_manifest(&dir).unwrap();
        manifest["items"].as_array_mut().unwrap().push(json!({ "original": root.join("other.txt"), "trashed": outside }));
        fs::write(dir.join("manifest.json"), serde_json::to_vec(&manifest).unwrap()).unwrap();
        assert!(restore_batch_in(&base, &id).is_err());
        assert!(!first.exists(), "valid first item must not move before later entry is checked");
        assert_eq!(fs::read_to_string(outside).unwrap(), "not quarantined");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_dangling_source_link_round_trips() {
        use std::os::unix::fs::symlink;
        let root = temp_dir("q-link-source");
        let base = root.join("quarantine");
        let source = root.join("link");
        let target = root.join("missing");
        symlink(&target, &source).unwrap();
        let result = trash_in(&base, TrashInput {
            paths: vec![source.to_string_lossy().into_owned()], confine_to_root: None,
        }).unwrap();
        assert_eq!(result.metadata["moved"], 1);
        restore_batch_in(&base, result.metadata["trashId"].as_str().unwrap()).unwrap();
        assert_eq!(fs::read_link(source).unwrap(), target);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_symlinked_batch_cannot_restore_or_empty_external_data() {
        use std::os::unix::fs::symlink;
        let root = temp_dir("q-link-batch");
        let base = root.join("quarantine");
        let outside = root.join("outside");
        fs::create_dir_all(&base).unwrap();
        write_file(&outside.join("keep"), "unrelated");
        let id = Uuid::new_v4().to_string();
        symlink(&outside, base.join(&id)).unwrap();
        assert!(trash_batch_dir(&base, &id).is_err());
        assert!(restore_batch_in(&base, &id).is_err());
        let (_, emptied) = empty_quarantine_in(&base, None, None, Utc::now()).map(|o| (o.freed, o.emptied)).unwrap();
        assert_eq!(emptied, 0);
        assert_eq!(fs::read_to_string(outside.join("keep")).unwrap(), "unrelated");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_best_effort_removes_around_an_undeletable_bundle() {
        use std::os::unix::fs::PermissionsExt;
        let root = temp_dir("q-best-effort");
        let item = root.join("item-00000016");
        // Stands in for a signed app bundle macOS won't let us touch: a
        // read-only directory that `remove_best_effort` must skip, not recurse.
        let app = item.join("bd/hash/React Native DevTools.app");
        write_file(&app.join("Contents/Info.plist"), "plist");
        write_file(&item.join("bd/other/blob"), "cache");
        write_file(&root.join("item-00000017/big.bin"), "cache");
        fs::set_permissions(&app, fs::Permissions::from_mode(0o555)).unwrap();

        let mut stuck = Vec::new();
        for entry in fs::read_dir(&root).unwrap().flatten() {
            remove_best_effort(&entry.path(), &mut stuck);
        }
        assert_eq!(stuck, vec![app.clone()], "only the bundle is left, recorded once");
        assert!(!root.join("item-00000017").exists());
        assert!(!item.join("bd/other").exists());
        assert_eq!(protected_app_bundle(&app.join("Contents/Info.plist")), Some(app.clone()));
        assert_eq!(protected_app_bundle(&root.join("cache/blob")), None);
        fs::set_permissions(&app, fs::Permissions::from_mode(0o755)).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_empties_read_only_and_locked_items() {
        use std::os::unix::ffi::OsStrExt;
        use std::os::unix::fs::{symlink, PermissionsExt};
        let lock = |p: &Path, on: bool| {
            let c = std::ffi::CString::new(p.as_os_str().as_bytes()).unwrap();
            assert_eq!(unsafe { libc::chflags(c.as_ptr(), if on { libc::UF_IMMUTABLE } else { 0 }) }, 0);
        };
        let root = temp_dir("q-locked");
        let base = root.join("quarantine");
        let outside = root.join("outside");
        write_file(&outside.join("keep"), "unrelated");
        lock(&outside.join("keep"), true);

        // A batch shaped like the real failure: a read-only app bundle inside a
        // cache, a file with the owner's "locked" flag, and a symlink out.
        let batch = base.join(Uuid::new_v4().to_string());
        let bundle = batch.join("item-00000000/Tool.app/Contents");
        write_file(&bundle.join("MacOS/tool"), "bin");
        write_file(&batch.join("item-00000001/drcore.log"), "log");
        lock(&batch.join("item-00000001/drcore.log"), true);
        symlink(&outside, batch.join("item-00000002")).unwrap();
        for d in [bundle.join("MacOS"), bundle.clone(), bundle.parent().unwrap().to_path_buf()] {
            fs::set_permissions(&d, fs::Permissions::from_mode(0o555)).unwrap();
        }
        assert!(fs::remove_dir_all(&batch).is_err(), "plain removal hits EACCES/EPERM");

        let out = empty_quarantine_in(&base, None, None, Utc::now()).unwrap();
        assert_eq!((out.emptied, out.failed.len()), (1, 0), "failures: {:?}", out.failed);
        assert!(out.protected_apps.is_empty());
        assert!(!batch.exists());
        // The symlink's target is untouched — still there, still locked.
        assert_eq!(fs::read_to_string(outside.join("keep")).unwrap(), "unrelated");
        assert!(fs::remove_file(outside.join("keep")).is_err());
        lock(&outside.join("keep"), false);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_copy_refuses_concurrent_source_mutation_and_replacement() {
        for replace in [false, true] {
            let root = temp_dir(if replace { "q-copy-replaced" } else { "q-copy-mutated" });
            let source = root.join("source.bin");
            let destination = root.join("destination.bin");
            let old = b"initial file contents";
            let changed = b"changed file contents"; // same length: identity/timestamps matter
            fs::write(&source, old).unwrap();
            let mutator_source = source.clone();
            let displaced = root.join("displaced.bin");
            let mutator_displaced = displaced.clone();
            let result = copy_then_remove_checked(&source, &destination, move || {
                // A separate actual thread modifies/replaces the real file only
                // after copying, making the previously destructive race reliable.
                std::thread::spawn(move || {
                    if replace { fs::rename(&mutator_source, &mutator_displaced).unwrap(); }
                    fs::write(mutator_source, changed).unwrap();
                }).join().unwrap();
            });
            assert!(result.is_err(), "source changes must fail closed");
            assert_eq!(fs::read(&source).unwrap(), changed, "never unlink the new user data");
            assert!(!destination.exists(), "do not publish stale copied bytes");
            if replace { assert_eq!(fs::read(displaced).unwrap(), old); }
            assert!(!fs::read_dir(&root).unwrap().any(|entry| entry.unwrap().file_name().to_string_lossy().starts_with(".reclaim-copy-")));
            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    #[cfg(unix)]
    fn duplicates_refuse_symbolically_linked_scan_roots() {
        use std::os::unix::fs::symlink;
        let root = temp_dir("duplicate-linked-root");
        let outside = root.join("actual");
        fs::create_dir(&outside).unwrap();
        fs::write(outside.join("a.bin"), vec![12u8; 1024 * 1024]).unwrap();
        fs::write(outside.join("b.bin"), vec![12u8; 1024 * 1024]).unwrap();
        let link = root.join("link");
        symlink(&outside, &link).unwrap();
        let report = disk_find_duplicates(ScopeInput { input_paths: vec![link.to_string_lossy().into_owned()] }).unwrap();
        assert!(report["groups"].as_array().unwrap().is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn quarantine_copy_fallback_preserves_extended_attributes_and_resource_fork() {
        let root = temp_dir("q-copy-metadata");
        let source = root.join("original.bin");
        let destination = root.join("recovered.bin");
        fs::write(&source, b"owned data fork").unwrap();
        for (name, value) in [("com.reclaim.fixture", "owned metadata"), ("com.apple.ResourceFork", "owned resource fork")] {
            assert!(Command::new("/usr/bin/xattr").args(["-w", name, value]).arg(&source).status().unwrap().success());
        }
        copy_then_remove(&source, &destination).unwrap();
        assert!(!source.exists());
        assert_eq!(fs::read(&destination).unwrap(), b"owned data fork");
        for (name, value) in [("com.reclaim.fixture", "owned metadata"), ("com.apple.ResourceFork", "owned resource fork")] {
            let result = Command::new("/usr/bin/xattr").args(["-p", name]).arg(&destination).output().unwrap();
            assert!(result.status.success(), "cross-volume fallback lost {name}");
            assert_eq!(String::from_utf8(result.stdout).unwrap().trim_end(), value);
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_copy_fallback_keeps_source_when_destination_is_occupied() {
        let root = temp_dir("q-copy");
        let source = root.join("source.txt");
        let destination = root.join("destination.txt");
        write_file(&source, "source data");
        write_file(&destination, "existing destination");
        assert!(copy_then_remove(&source, &destination).is_err());
        assert_eq!(fs::read_to_string(&source).unwrap(), "source data");
        assert_eq!(fs::read_to_string(&destination).unwrap(), "existing destination");
        let fresh = root.join("fresh.txt");
        copy_then_remove(&source, &fresh).unwrap();
        assert!(!source.exists());
        assert_eq!(fs::read_to_string(fresh).unwrap(), "source data");
        assert_eq!(fs::read_dir(&root).unwrap().count(), 2, "no partial-copy files remain");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_retention_cannot_overflow_to_delete_recent_batches() {
        let root = temp_dir("q-retention-overflow");
        let base = root.join("quarantine");
        let id = make_batch(&base, &Utc::now().to_rfc3339(), &[root.join("original")]);
        assert_eq!(empty_quarantine_in(&base, None, Some(u64::MAX), Utc::now()).map(|o| (o.freed, o.emptied)).unwrap(), (0, 0));
        assert!(base.join(id).exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn quarantine_empty_honours_age_and_only_touches_batches() {
        let base = temp_dir("q-empty");
        let home = temp_dir("q-empty-home");
        let old = make_batch(&base, "2026-07-01T00:00:00Z", &[home.join("old.bin")]);
        let recent = make_batch(&base, "2026-09-20T00:00:00Z", &[home.join("new.bin")]);
        // A stray non-batch folder in the quarantine root is never deleted.
        fs::create_dir_all(base.join("not-a-batch")).unwrap();
        let now = chrono::DateTime::parse_from_rfc3339("2026-09-27T00:00:00Z").unwrap().with_timezone(&Utc);

        let (freed, emptied) = empty_quarantine_in(&base, None, Some(30), now).map(|o| (o.freed, o.emptied)).unwrap();
        assert_eq!(emptied, 1, "only the batch older than 30 days");
        assert!(freed >= 64_000);
        assert!(!base.join(&old).exists());
        assert!(base.join(&recent).exists());
        assert!(base.join("not-a-batch").exists());

        let (_, emptied) = empty_quarantine_in(&base, Some(std::slice::from_ref(&recent)), None, now).map(|o| (o.freed, o.emptied)).unwrap();
        assert_eq!(emptied, 1, "explicit empty removes the named batch");
        assert!(empty_quarantine_in(&base, Some(&["../../".to_string()]), None, now).is_err());
        let _ = fs::remove_dir_all(&base);
        let _ = fs::remove_dir_all(&home);
    }

    #[test]
    fn danger_full_access_is_refused_at_run_time() {
        // Validates as a known mode…
        assert!(validate_sandbox_mode("danger-full-access").is_ok());
        // …but is never permitted to actually run.
        assert!(!sandbox_run_permitted("danger-full-access"));
        assert!(sandbox_run_permitted("workspace-write"));
        assert!(sandbox_run_permitted("read-only"));
    }

    #[test]
    fn trash_containment_refuses_paths_outside_the_approved_root() {
        let root = temp_dir("trash-confine");
        let inside = root.join("Downloads/old.dmg");
        write_file(&inside, "x");
        let outside = root.parent().unwrap().join("uco-secret.key");

        // All inside → allowed.
        assert!(ensure_all_within_root(
            &root,
            &[inside.to_string_lossy().to_string()],
        )
        .is_ok());

        // Any path outside the approved root → the whole request is refused.
        assert!(ensure_all_within_root(
            &root,
            &[
                inside.to_string_lossy().to_string(),
                outside.to_string_lossy().to_string(),
            ],
        )
        .is_err());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn move_preserves_undo_log_on_partial_failure() {
        let root = temp_dir("partial");
        let good = root.join("good.txt");
        write_file(&good, "x");
        let good_dest = root.join("out/good.txt");
        // Second pair's source doesn't exist → its rename fails mid-batch.
        let missing = root.join("missing.txt");
        let missing_dest = root.join("out/missing.txt");

        // Must NOT hard-fail: partial success returns Ok so the undo log survives.
        let result = copy_or_move_files(
            move_input(
                vec![pair(&good, &good_dest), pair(&missing, &missing_dest)],
                Some(root.to_string_lossy().to_string()),
            ),
            true,
        )
        .unwrap();

        assert!(result.ok);
        assert!(!good.exists() && good_dest.exists(), "the good file moved");
        let pairs = result.metadata["pairs"].as_array().expect("pairs present");
        assert_eq!(pairs.len(), 1, "undo log covers exactly the file that moved");
        let failed = result.metadata["failed"].as_array().expect("failed present");
        assert_eq!(failed.len(), 1, "the failed file is reported, not lost");
        let _ = fs::remove_dir_all(&root);
    }

    // --- classification + no-clobber naming + home expansion ------------

    #[test]
    fn category_for_extension_groups_known_types() {
        assert_eq!(category_for_extension(Some("png")), "Images");
        assert_eq!(category_for_extension(Some("MP3")), "Audio");
        assert_eq!(category_for_extension(Some("rs")), "Code");
        assert_eq!(category_for_extension(Some("xyz")), "Other");
        assert_eq!(category_for_extension(None), "Other");
    }

    #[test]
    fn unique_path_avoids_clobbering() {
        let dir = temp_dir("unique");
        let taken = dir.join("file.txt");
        write_file(&taken, "x");
        assert_eq!(unique_path(&taken), dir.join("file-1.txt"));
        let free = dir.join("free.txt");
        assert_eq!(unique_path(&free), free);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn expand_home_resolves_tilde() {
        if let Ok(home) = std::env::var("HOME") {
            assert_eq!(expand_home("~"), PathBuf::from(&home));
            assert_eq!(expand_home("~/Pictures"), PathBuf::from(&home).join("Pictures"));
        }
        assert_eq!(expand_home("/tmp/x"), PathBuf::from("/tmp/x"));
        assert_eq!(expand_home("rel/x"), PathBuf::from("rel/x"));
    }

    // --- folder organization strategies (by-type + by-date) ------------

    #[test]
    fn date_folder_formats_year_month_utc() {
        use std::time::{Duration, UNIX_EPOCH};
        assert_eq!(date_folder(UNIX_EPOCH), "1970-01");
        // 1_609_459_200 == 2021-01-01T00:00:00Z
        assert_eq!(date_folder(UNIX_EPOCH + Duration::from_secs(1_609_459_200)), "2021-01");
    }

    #[test]
    fn organize_by_extension_routes_to_category_folders() {
        let root = temp_dir("org-ext");
        let img = root.join("a.png");
        write_file(&img, "x");
        let pairs =
            organization_pairs(&[img.to_string_lossy().to_string()], &root, "by_extension").unwrap();
        assert_eq!(pairs.len(), 1);
        let expected = root.join("Images").join("a.png").to_string_lossy().to_string();
        assert_eq!(pairs[0].destination, expected);
    }

    #[test]
    fn organize_by_date_routes_to_year_month_folders() {
        let root = temp_dir("org-date");
        let file = root.join("note.txt");
        write_file(&file, "x");
        let pairs =
            organization_pairs(&[file.to_string_lossy().to_string()], &root, "by_date").unwrap();
        assert_eq!(pairs.len(), 1);
        let expected = root.join(date_folder_for(&file)).join("note.txt").to_string_lossy().to_string();
        assert_eq!(pairs[0].destination, expected);
        // Subfolder is a real YYYY-MM bucket, not the by-extension category.
        let subfolder = date_folder_for(&file);
        assert_eq!(subfolder.len(), 7);
        assert_eq!(subfolder.as_bytes()[4], b'-');
    }

    // --- process-group lifecycle (H1 + stop escalation) -----------------

    fn spawn_group(script: &str) -> std::process::Child {
        Command::new("sh")
            .args(["-c", script])
            .process_group(0)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap()
    }

    fn is_alive(pid: i32) -> bool {
        unsafe { libc::kill(pid, 0) == 0 }
    }

    fn wait_until(mut cond: impl FnMut() -> bool, timeout: Duration) -> bool {
        let start = Instant::now();
        while start.elapsed() < timeout {
            if cond() {
                return true;
            }
            thread::sleep(Duration::from_millis(50));
        }
        cond()
    }

    #[test]
    fn kill_process_group_reaps_the_whole_tree() {
        let dir = temp_dir("killtree");
        let marker = dir.join("child.pid");
        // sh is the group leader; the backgrounded sleep inherits its group.
        let mut parent = spawn_group(&format!("sleep 30 & echo $! > {:?}; wait", marker));

        let read_pid = || fs::read_to_string(&marker).ok().and_then(|s| s.trim().parse::<i32>().ok());
        assert!(wait_until(|| read_pid().is_some(), Duration::from_secs(5)), "grandchild never started");
        let child_pid = read_pid().unwrap();
        assert!(is_alive(child_pid), "grandchild should be running before the kill");

        // Negative-PID group kill must reach the child, not just sh.
        kill_process_group(parent.id(), libc::SIGKILL);
        let _ = parent.wait();

        assert!(
            wait_until(|| !is_alive(child_pid), Duration::from_secs(5)),
            "grandchild survived the group kill (H1 violated)"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn stop_escalates_to_sigkill_when_sigterm_is_ignored() {
        use std::os::unix::process::ExitStatusExt;
        let dir = temp_dir("stopkill");
        let ready = dir.join("ready");
        // Install a TERM-ignoring trap, signal readiness, then stay alive (the
        // bounded loop is a leak safety net). Only the armed SIGKILL can stop it.
        let script = format!("trap '' TERM; echo 1 > {:?}; for i in $(seq 1 120); do sleep 1; done", ready);
        let mut child = spawn_group(&script);
        let pid = child.id();
        let process_id = format!("test-stop-{}", pid);

        // Wait until the trap is installed; otherwise SIGTERM races trap setup
        // and the child dies on the default action instead of escalating.
        assert!(wait_until(|| ready.exists(), Duration::from_secs(5)), "child never armed its trap");

        // Register the pid as the running process, as the command runner would,
        // so batch_stop_process can find it and arm the escalation.
        RUNNING_PROCESSES.lock().unwrap().insert(process_id.clone(), pid);

        let result = batch_stop_process(process_id.clone()).unwrap();
        assert!(result.ok);

        // SIGTERM is ignored; wait() blocks until the 3s-armed SIGKILL lands,
        // proving the escalation fired.
        let status = child.wait().unwrap();
        assert_eq!(status.signal(), Some(libc::SIGKILL), "stop should escalate to SIGKILL");

        RUNNING_PROCESSES.lock().unwrap().remove(&process_id);
        let _ = fs::remove_dir_all(&dir);
    }
}
