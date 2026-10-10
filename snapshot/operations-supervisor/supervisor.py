#!/usr/bin/env python3
"""Read-only evidence collector and durable hourly agent report."""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
CFG = json.loads((ROOT / "config.json").read_text())
DB = ROOT / "data/supervisor.sqlite3"
CHANNEL_RE = re.compile(r"discord:channel:(\d+)")
PRIVATE = re.compile(r"(?i)(\.env|token|secret|password|credential|private|keychain|contacts?|leads?|crm|inbox|outreach)")
VALID_STATUS = {"ACTIVE", "IDLE", "BLOCKED", "FAILED", "WAITING"}


def command(args: list[str], timeout: int = 25) -> dict:
    try:
        done = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=True)
        return json.loads(done.stdout)
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
        return {"_unavailable": type(exc).__name__}


@contextlib.contextmanager
def db_open():
    DB.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB, timeout=10)
    db.row_factory = sqlite3.Row
    db.executescript("""
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY, at_ms INTEGER NOT NULL, window_start_ms INTEGER NOT NULL,
            text TEXT NOT NULL, evidence_json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS channels (
            id TEXT PRIMARY KEY, agent_id TEXT, purpose TEXT, product TEXT,
            last_activity_ms INTEGER, reporting_enabled INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS heartbeats (
            id TEXT PRIMARY KEY, channel_id TEXT, status TEXT, current_task TEXT,
            current_product TEXT, did TEXT, completed TEXT, changed TEXT, tests TEXT,
            result TEXT, blocker TEXT, next_action TEXT, model TEXT, updated_ms INTEGER);
        CREATE TABLE IF NOT EXISTS alerts (
            key TEXT PRIMARY KEY, first_seen_ms INTEGER, last_seen_ms INTEGER, delivered_ms INTEGER);
        CREATE TABLE IF NOT EXISTS failures (
            id INTEGER PRIMARY KEY, at_ms INTEGER NOT NULL, kind TEXT NOT NULL);
    """)
    try:
        with db:
            yield db
    finally:
        db.close()


@contextlib.contextmanager
def single_run():
    path = ROOT / "data/report.lock"
    with path.open("a+") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            yield False
            return
        try:
            yield True
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def channel_id(key: str) -> str | None:
    match = CHANNEL_RE.search(key or "")
    return match.group(1) if match else None


def label(cid: str) -> str:
    return "#" + CFG["channel_labels"].get(cid, cid)


def safe_file(name: str) -> bool:
    return not PRIVATE.search(name) and not name.startswith(".git/")


def git_evidence(name: str, path: str, start_ms: int, check_dirty: bool = True) -> dict:
    folder = Path(path)
    if not (folder / ".git").exists():
        return {"name": name, "unavailable": "repo missing"}
    since = dt.datetime.fromtimestamp(start_ms / 1000, dt.timezone.utc).isoformat()
    def git(*args):
        try:
            return subprocess.run(["git", "-C", path, *args], capture_output=True,
                                  text=True, timeout=8, check=True).stdout
        except (OSError, subprocess.SubprocessError):
            return None
    branch = git("branch", "--show-current")
    log = git("log", "HEAD", f"--since={since}", "--format=COMMIT:%h:%D:%s", "--numstat")
    status = git("status", "--porcelain=v1", "-uno") if check_dirty else ""
    if branch is None or log is None or status is None:
        return {"name": name, "unavailable": "git probe failed"}
    commits, files, added, removed = [], set(), 0, 0
    for row in log.splitlines():
        if row.startswith("COMMIT:"):
            sha, _, remainder = row[7:].partition(":")
            refs, _, subject = remainder.partition(":")
            commits.append({"sha": sha, "refs": refs[:100]})
        elif "\t" in row:
            a, b, file = (row.split("\t", 2) + [""])[:3]
            if safe_file(file):
                files.add(file)
                added += int(a) if a.isdigit() else 0
                removed += int(b) if b.isdigit() else 0
    dirty = [row[3:] for row in status.splitlines() if len(row) > 3 and safe_file(row[3:])]
    return {"name": name, "branch": branch.strip(), "commits": commits,
            "files": sorted(files)[:12], "files_count": len(files),
            "added": added, "removed": removed, "dirty": dirty[:8], "dirty_count": len(dirty)}


def discover_repos() -> list[tuple[str, str, bool]]:
    configured = {str(Path(p).resolve()): n for n, p in CFG["repos"].items()}
    found = [(n, p, True) for n, p in CFG["repos"].items()]
    skip = {".git", "node_modules", "third_party", "vendor", ".venv", "build", "dist", ".next"}
    for root in CFG.get("repo_roots", []):
        base = Path(root)
        if not base.is_dir():
            continue
        for here, dirs, files in os.walk(base):
            folder = Path(here)
            if len(folder.relative_to(base).parts) > 5:
                dirs[:] = []
                continue
            if ".git" in dirs or ".git" in files:
                absolute = str(folder.resolve())
                if absolute not in configured:
                    found.append(("code/" + str(folder.relative_to(base)), absolute, True))
                dirs[:] = []
            else:
                dirs[:] = [d for d in dirs if d not in skip]
    # Git worktrees may live outside the scanned roots; inspect their checked-out
    # HEADs separately instead of attributing every local branch to one product.
    seen = {str(Path(path).resolve()) for _, path, _ in found}
    base_entries = list(found)
    for name, path, _ in base_entries:
        try:
            output = subprocess.run(["git", "-C", path, "worktree", "list", "--porcelain"],
                                    capture_output=True, text=True, timeout=5, check=True).stdout
        except (OSError, subprocess.SubprocessError):
            continue
        for row in output.splitlines():
            if not row.startswith("worktree "):
                continue
            extra = Path(row[9:])
            absolute = str(extra.resolve())
            if not extra.is_dir() or absolute in seen:
                continue
            seen.add(absolute)
            found.append((name + "@" + extra.name, absolute, True))
    return found


def queue_evidence(name: str, path: str) -> dict:
    if not Path(path).is_file():
        return {"unavailable": "database missing"}
    try:
        with sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True, timeout=3) as src:
            counts = dict(src.execute("SELECT status, count(*) FROM tasks GROUP BY status").fetchall())
            if name == "company":
                next_row = src.execute("SELECT id,body FROM tasks WHERE status='QUEUED' "
                                       "ORDER BY priority DESC LIMIT 1").fetchone()
                top = None
                if next_row:
                    title = json.loads(next_row[1]).get("title", "")
                    top = next_row[0] + (": " + title[:65] if title and not PRIVATE.search(title) else "")
            else:
                next_row = src.execute("SELECT task_id,task_type FROM tasks WHERE status='QUEUED' "
                                       "ORDER BY priority DESC LIMIT 1").fetchone()
                top = f"{next_row[0]}: {next_row[1]}" if next_row else None
        return {"counts": counts, "top": top}
    except (OSError, sqlite3.Error):
        return {"unavailable": "read-only query failed"}


def error_kind(message: str) -> str:
    lower = (message or "").lower()
    for label, needles in (
        ("authentication", ("unauthorized", "invalid token", "authentication failed", "credential")),
        ("provider limit", ("rate limit", "usage limit", "quota exceeded", "insufficient credits")),
        ("context overflow", ("context length", "context overflow", "maximum context")),
        ("tool timeout", ("tool timeout", "timed out", "timeout")),
    ):
        if any(needle in lower for needle in needles):
            return label
    return "error (details withheld)"


def cost_snapshot() -> dict:
    """Read existing sanitized company telemetry; never run a second collector."""
    company_db = CFG.get("queue_databases", {}).get("company")
    if not company_db:
        return {"status": "unavailable", "observed_at": None}
    path = Path(company_db).parent.parent / "data/cost-snapshot.json"
    try:
        data = json.loads(path.read_text())
        return {key: data.get(key) for key in ("observed_at", "daily", "daily_by_source", "totals_basis", "governor", "astra", "coverage_gaps")}
    except (OSError, json.JSONDecodeError, AttributeError):
        return {"status": "unavailable", "observed_at": None}


def collect(db: sqlite3.Connection, now_ms: int, start_ms: int) -> dict:
    agents = command(["openclaw", "agents", "list", "--json"])
    sessions = command(["openclaw", "sessions", "--all-agents", "--json", "--limit", "all"], 35)
    crons = command(["openclaw", "cron", "list", "--json"])
    runs = command(["openclaw", "cron", "runs", "--all", "--limit", "200", "--json"])
    source_errors = [key for key, val in (("agents", agents), ("sessions", sessions),
                     ("automations", crons), ("run receipts", runs)) if "_unavailable" in val]
    current_sessions = []
    seen_channels: dict[str, dict] = {}
    for s in sessions.get("sessions", []):
        cid = channel_id(s.get("key", ""))
        if not cid or s.get("kind") != "group":
            continue
        seen_channels[cid] = {"agent": s.get("agentId", "main"),
                              "activity": s.get("lastInteractionAt") or s.get("updatedAt") or 0}
        current_sessions.append({key: s.get(key) for key in
                                 ("key", "agentId", "kind", "status", "updatedAt", "lastInteractionAt",
                                  "model", "modelProvider", "abortedLastRun")})
    for job in crons.get("jobs", []):
        target = (job.get("delivery") or {}).get("to", "")
        cid = channel_id("discord:" + target if target.startswith("channel:") else target)
        if cid and cid not in seen_channels:
            seen_channels[cid] = {"agent": job.get("agentId", "main"), "activity": 0}
    for cid, meta in seen_channels.items():
        db.execute("INSERT INTO channels(id,agent_id,purpose,product,last_activity_ms) VALUES (?,?,?,?,?) "
                   "ON CONFLICT(id) DO UPDATE SET agent_id=excluded.agent_id, "
                   "last_activity_ms=max(coalesce(channels.last_activity_ms,0),excluded.last_activity_ms)",
                   (cid, meta["agent"], CFG["channel_labels"].get(cid, "discovered"),
                    CFG["channel_labels"].get(cid, ""), meta["activity"]))
    db.commit()
    included = {r["id"] for r in db.execute("SELECT id FROM channels WHERE reporting_enabled=1")}
    selected_sessions = [s for s in current_sessions if channel_id(s.get("key", "")) in included]
    recent_runs = []
    for run in runs.get("entries", []):
        if not start_ms <= (run.get("runAtMs") or 0) <= now_ms:
            continue
        summary = run.get("summary") or ""
        count = re.search(r"\b[\d,]+\s+tests?\b", summary, re.I)
        recent_runs.append({key: run.get(key) for key in
                            ("jobId", "jobName", "status", "runAtMs", "model", "provider", "usage")}
                           | {"error_kind": error_kind(run.get("error", "")),
                              "test_claim": count.group(0) if count else None,
                              "build_claim": bool(re.search(r"\bbuilds?\b", summary, re.I) and
                                                  re.search(r"\bpass(?:ed)?\b", summary, re.I))})
    all_jobs = crons.get("jobs", [])
    recent_jobs = [{"id": j.get("id"), "name": j.get("name"), "agentId": j.get("agentId"),
                    "payload": {"model": (j.get("payload") or {}).get("model")},
                    "state": {"lastRunStatus": (j.get("state") or {}).get("lastRunStatus")}}
                   for j in all_jobs if j.get("enabled") and
                   start_ms <= ((j.get("state") or {}).get("lastRunAtMs") or 0) <= now_ms]
    with ThreadPoolExecutor(max_workers=8) as pool:
        repo = list(pool.map(lambda item: git_evidence(item[0], item[1], start_ms, item[2]),
                             discover_repos()))
    queues = {name: queue_evidence(name, path) for name, path in CFG["queue_databases"].items()}
    heartbeats = [dict(row) for row in db.execute("SELECT * FROM heartbeats")]
    supervisor_failures = [dict(row) for row in db.execute(
        "SELECT at_ms,kind FROM failures WHERE at_ms>=? ORDER BY at_ms DESC LIMIT 3", (start_ms,))]
    safe_agents = [{"id": a.get("id"), "model": a.get("model")} for a in agents] if isinstance(agents, list) else []
    return {"at_ms": now_ms, "start_ms": start_ms, "agents": safe_agents,
            "sessions": selected_sessions, "all_channels": len(included), "seen_channels": sorted(seen_channels),
            "runs": recent_runs, "jobs": recent_jobs, "repos": repo, "queues": queues,
            "heartbeats": heartbeats, "source_errors": source_errors,
            "supervisor_failures": supervisor_failures, "cost_snapshot": cost_snapshot()}


def status_of(session: dict, now_ms: int, start_ms: int) -> str:
    state = session.get("status")
    if state in ("running", "active"):
        return "ACTIVE"
    if ((state in ("failed", "error") or session.get("abortedLastRun"))
            and (session.get("updatedAt") or 0) >= start_ms):
        return "FAILED"
    if state in ("blocked", "waiting"):
        return state.upper()
    return "IDLE"


def report_text(data: dict, old: dict | None = None) -> str:
    zone = ZoneInfo(CFG["timezone"])
    fmt = lambda ms: dt.datetime.fromtimestamp(ms / 1000, zone).strftime("%b %d %I:%M %p %Z")
    now_ms, start_ms = data["at_ms"], data["start_ms"]
    by_channel = defaultdict(list)
    for s in data["sessions"]:
        cid = channel_id(s.get("key", ""))
        if cid:
            by_channel[cid].append(s)
    active, idle, failed, blocked = [], [], [], []
    for cid, items in by_channel.items():
        newest = max(items, key=lambda s: s.get("updatedAt") or 0)
        state = status_of(newest, now_ms, start_ms)
        (active if state == "ACTIVE" else failed if state == "FAILED" else
         blocked if state in ("BLOCKED", "WAITING") else idle).append((cid, newest))
    hb_current = [h for h in data["heartbeats"] if h["updated_ms"] >= start_ms]
    hb_stalls = [h for h in data["heartbeats"] if h["status"] == "ACTIVE" and
                 now_ms - h["updated_ms"] >= 3_600_000]
    session_stalls = [(cid, s) for cid, s in active if now_ms - (s.get("updatedAt") or 0) >= 3_600_000]
    job_ok = [j for j in data["jobs"] if (j.get("state") or {}).get("lastRunStatus") == "ok"]
    job_bad = [j for j in data["jobs"] if (j.get("state") or {}).get("lastRunStatus") == "error"]
    working_agents = sorted({s.get("agentId", "main") for s in data["sessions"] if
                             (s.get("lastInteractionAt") or s.get("updatedAt") or 0) >= start_ms} |
                            {j.get("agentId", "main") for j in job_ok if
                             j.get("agentId") != "operations-supervisor"})
    working_agents = [agent for agent in working_agents if agent != "operations-supervisor"]
    old_repos = {r["name"]: r for r in (old or {}).get("repos", [])}
    changed_repo = [r for r in data["repos"] if r.get("commits") or
                    (r.get("dirty") and r.get("dirty") != old_repos.get(r["name"], {}).get("dirty"))]
    changed_repo.sort(key=lambda r: (not bool(r.get("commits")), r["name"]))
    lines = ["**HOURLY AGENT REPORT**", f"{fmt(start_ms)}–{fmt(now_ms)}",
             f"Agents: {len(data['agents'])} configured; active now: " +
             (", ".join(sorted({s.get('agentId','main') for _, s in active})) or "none") +
             "; worked this window: " + (", ".join(working_agents) or "none") + ".",
             f"Channel sessions: {len(active)} active · {len(idle)} idle · {len(blocked)} blocked · "
             f"{len(failed)} failed ({data['all_channels']} monitored)."]
    if data["source_errors"]:
        lines.append("⚠️ Source unavailable: " + ", ".join(data["source_errors"]) + "; remaining sources reported.")
    if data.get("supervisor_failures"):
        lines.append(f"⚠️ Supervisor failed {len(data['supervisor_failures'])} time(s) since prior report; recovered this run.")
    lines.append("**COMPLETED THIS HOUR**")
    if job_ok:
        names = [j.get("name", "unnamed") for j in job_ok if "supervisor" not in j.get("name", "").lower()]
        lines.append("Successful jobs: " + ", ".join(names[:4]) + (f" (+{len(names)-4})" if len(names) > 4 else "") if names else "No verified jobs.")
    else:
        lines.append("No completed automation receipt in this window.")
    test_claims = []
    for run in data["runs"]:
        if run.get("status") != "ok":
            continue
        if run.get("test_claim"):
            test_claims.append(f"{run.get('jobName','agent')}: {run['test_claim']}")
        if run.get("build_claim"):
            test_claims.append(f"{run.get('jobName','agent')}: builds reported passed")
    if test_claims:
        lines.append("Tests (agent run receipts, logs not rechecked): " + "; ".join(test_claims[:3]) + ".")
    committed = [r for r in changed_repo if r.get("commits")]
    dirty_only = [r for r in changed_repo if not r.get("commits")]
    for r in committed[:4]:
        commits = r.get("commits", [])
        files = ", ".join(r["files"][:2])
        lines.append(f"{r['name']}: {len(commits)} commit(s), {r['files_count']} files "
                     f"(+{r['added']}/-{r['removed']}), {r['branch']}; {files or 'file list unavailable'}.")
    if not committed:
        lines.append("No commits in monitored repository heads.")
    lines.append("**IN PROGRESS / BLOCKED / NEXT**")
    for r in dirty_only[:2]:
        lines.append(f"{r['name']}: {r['dirty_count']} tracked uncommitted file(s) observed; "
                     "change time unknown, completion not claimed.")
    for cid, s in active[:8]:
        model = "/".join(filter(None, [s.get("modelProvider"), s.get("model")]))
        lines.append(f"{label(cid)} ({s.get('agentId','main')}): ACTIVE · {model or 'model unknown'}; "
                     "current task/next action unavailable unless heartbeat supplied.")
    recent_idle = [(cid, s) for cid, s in idle if (s.get("lastInteractionAt") or
                   s.get("updatedAt") or 0) >= start_ms]
    if recent_idle:
        lines.append("Recent but now idle: " + ", ".join(label(cid) for cid, _ in recent_idle[:8]) +
                     "; completed task details unavailable without a heartbeat or artifact.")
    for h in hb_current[:5]:
        lines.append(f"{h['id']}: {h['status']} · {h['current_task'] or 'task unknown'}; "
                     f"completed: {h['completed'] or 'none claimed'}; next: {h['next_action'] or 'unknown'}.")
    for h in hb_stalls[:3]:
        hours = (now_ms - h["updated_ms"]) / 3_600_000
        lines.append(f"⚠️ POSSIBLE STALL {h['id']}: ACTIVE heartbeat unchanged {hours:.1f}h; task: {h['current_task'] or 'unknown'}.")
    for cid, s in session_stalls[:3]:
        lines.append(f"⚠️ POSSIBLE STALL {label(cid)}: running session unchanged ≥1h; reason unknown.")
    for j in job_bad[:3]:
        receipt = next((r for r in data["runs"] if r.get("jobId") == j.get("id") and
                        r.get("status") == "error"), {})
        lines.append(f"⚠️ {j.get('name','Automation')} failed: {receipt.get('error_kind','details unavailable')}.")
    if not active and not hb_current and not job_bad:
        lines.append("No agent confirmed actively running at collection time; next actions not observable.")
    for name, result in data["queues"].items():
        if "counts" in result:
            counts = result["counts"]
            lines.append(name.capitalize() + " queue: " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())) + ".")
            if result.get("top"):
                lines.append(name.capitalize() + " next: " + result["top"] + ".")
        else:
            lines.append(name.capitalize() + " queue unavailable.")
    attention = [h["id"] for h in hb_current if h["status"] in ("BLOCKED", "FAILED")]
    attention += [j.get("name", "automation") for j in job_bad]
    lines.append("Needs attention: " + (", ".join(attention[:3]) if attention else "none newly verified") + ".")
    usage = defaultdict(lambda: [0, [], []])
    opus = []
    for run in data["runs"]:
        model = run.get("model")
        if not model:
            continue
        values = usage[model]
        values[0] += 1
        for index, field in ((1, "input_tokens"), (2, "output_tokens")):
            tokens = (run.get("usage") or {}).get(field)
            if isinstance(tokens, int) and not isinstance(tokens, bool) and tokens >= 0:
                values[index].append(tokens)
        if "opus" in model.lower():
            opus.append(run)
    lines.append("**AI USAGE — scheduled runs only**")
    if usage:
        def known_tokens(tokens, receipts):
            return f"{sum(tokens):,} ({len(tokens)}/{receipts} known)" if tokens else "unknown"
        lines.append(" · ".join(f"{m}: {v[0]} run receipt(s), {known_tokens(v[1], v[0])} in/{known_tokens(v[2], v[0])} out" for m, v in sorted(usage.items())))
    else:
        lines.append("No scheduled model receipts in window.")
    lines.append("Interactive per-call usage/billing unavailable; scheduled receipts are not call counts.")
    cost = data.get("cost_snapshot") or {}
    if cost.get("observed_at"):
        by_source = cost.get("daily_by_source") or {}
        marketing = by_source.get("marketing_calls") or by_source.get("marketing_aggregate") or {}
        estimate = marketing.get("list_estimated_usd")
        governor = cost.get("governor") or {}
        lines.append("Cost telemetry: " + (f"marketing source estimate ${estimate:.4f}" if isinstance(estimate, (int, float)) else "marketing estimate unknown") +
                     f"; billed total unknown; {governor.get('mode', 'unknown')} advisory mode; observed {cost['observed_at']}.")
        lines.append("Receipt/source overlap unreconciled; not total company spend.")
    for run in opus[:3]:
        lines.append(f"⚠️ OPUS USED: {run.get('jobName','unknown job')} · {run.get('model')} · "
                     "reason not recorded in receipt.")
    for s in data["sessions"]:
        if ("opus" in (s.get("model") or "").lower() and
                (s.get("lastInteractionAt") or s.get("updatedAt") or 0) >= start_ms):
            lines.append(f"⚠️ OPUS SESSION ACTIVITY: {s.get('agentId','main')} {label(channel_id(s.get('key','')) or '?')} "
                         "· call count/reason unavailable.")
    preferred = {j.get("id"): (j.get("payload") or {}).get("model") for j in data["jobs"]}
    for run in data["runs"]:
        expected = preferred.get(run.get("jobId"))
        observed = run.get("model") or ""
        if expected and observed and expected.split("/")[-1] != observed and run.get("status") == "ok":
            lines.append(f"Fallback observed: {run.get('jobName','job')} {expected} → {observed}.")
    if old:
        prior = old.get("queues", {})
        changed = []
        for name, result in data["queues"].items():
            if result != prior.get(name):
                changed.append(name)
        if not changed and not changed_repo and not job_bad and not hb_current:
            lines.append("No new queue or repository movement since the previous report.")
    return "\n".join(lines)


def save_report(db: sqlite3.Connection, data: dict, text: str):
    db.execute("INSERT INTO reports(at_ms,window_start_ms,text,evidence_json) VALUES (?,?,?,?)",
               (data["at_ms"], data["start_ms"], text, json.dumps(data, default=str)))
    db.commit()
    stamp = dt.datetime.fromtimestamp(data["at_ms"] / 1000, dt.timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    (ROOT / "reports").mkdir(exist_ok=True)
    (ROOT / "reports" / f"{stamp}.md").write_text(text + "\n")


def run_report(preview: bool):
    with single_run() as acquired:
        if not acquired:
            print("NO_REPORT: prior supervisor run still active")
            return
        with db_open() as db:
            row = db.execute("SELECT at_ms,evidence_json FROM reports ORDER BY id DESC LIMIT 1").fetchone()
            now_ms = int(time.time() * 1000)
            start_ms = row["at_ms"] if row else now_ms - 3_600_000
            old = json.loads(row["evidence_json"]) if row else None
            data = collect(db, now_ms, start_ms)
            result = report_text(data, old)
            if not preview:
                save_report(db, data, result)
            print(result)


def heartbeat(args):
    with db_open() as db:
        db.execute("""INSERT INTO heartbeats(id,channel_id,status,current_task,current_product,did,
            completed,changed,tests,result,blocker,next_action,model,updated_ms)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
            channel_id=excluded.channel_id,status=excluded.status,current_task=excluded.current_task,
            current_product=excluded.current_product,did=excluded.did,completed=excluded.completed,
            changed=excluded.changed,tests=excluded.tests,result=excluded.result,blocker=excluded.blocker,
            next_action=excluded.next_action,model=excluded.model,updated_ms=excluded.updated_ms""",
            (args.id, args.channel, args.status, args.task, args.product, args.did,
             args.completed, args.changed, args.tests, args.result, args.blocker,
             args.next, args.model, int(time.time() * 1000)))
        db.commit()
    print(f"Heartbeat recorded: {args.id}")


def daily():
    now = int(time.time() * 1000)
    start = now - 86_400_000
    with db_open() as db:
        rows = db.execute("SELECT at_ms,evidence_json FROM reports WHERE at_ms>=? ORDER BY at_ms", (start,)).fetchall()
    print(f"Daily supervisor rollup: {len(rows)} hourly report(s).")
    commits, jobs, models = Counter(), Counter(), Counter()
    for row in rows:
        evidence = json.loads(row["evidence_json"])
        for repo in evidence["repos"]:
            for commit in repo.get("commits", []):
                commits[(repo["name"], commit["sha"])] = True
        for run in evidence["runs"]:
            if run.get("status") == "ok":
                jobs[(run.get("jobId"), run.get("runAtMs"))] = run.get("jobName")
            if "opus" in (run.get("model") or "").lower():
                models[(run.get("jobId"), run.get("runAtMs"))] = run.get("model")
    print(f"Verified repository commits: {len(commits)}; successful scheduled runs: {len(jobs)}; "
          f"Opus scheduled runs: {len(models)}. Full interactive cost unavailable.")


def critical():
    """Fast no-model watch; only evidence-backed urgent events are emitted."""
    now_ms = int(time.time() * 1000)
    findings = []
    for url in CFG.get("critical_urls", []):
        try:
            request = urllib.request.Request(url, method="GET", headers={"User-Agent": "OperationsSupervisor/1.0"})
            with urllib.request.urlopen(request, timeout=8) as response:
                if response.status >= 500:
                    findings.append(("site:" + url, f"🚨 Production site HTTP {response.status}: <{url}>"))
        except Exception:
            findings.append(("site:" + url, f"🚨 Production site unreachable: <{url}>"))
    marketing = CFG["queue_databases"].get("marketing")
    if marketing and Path(marketing).is_file():
        try:
            since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=1)).isoformat()
            with sqlite3.connect(Path(marketing).resolve().as_uri() + "?mode=ro", uri=True, timeout=2) as src:
                spend = src.execute("SELECT coalesce(sum(est_cost),0) FROM model_calls WHERE ts>=?", (since,)).fetchone()[0]
            threshold = CFG.get("marketing_hourly_cost_alert_usd", 5)
            if spend >= threshold:
                findings.append(("marketing-cost", f"🚨 Marketing estimated model spend ${spend:.2f} in the last hour exceeds ${threshold}; inspect usage."))
        except (OSError, sqlite3.Error):
            pass
    recent = command(["openclaw", "cron", "runs", "--all", "--limit", "80", "--json"])
    provider_errors = defaultdict(set)
    for run in recent.get("entries", []):
        if (run.get("runAtMs") or 0) < now_ms - 900_000 or run.get("status") != "error":
            continue
        kind = error_kind(run.get("error", ""))
        if kind == "authentication":
            findings.append(("auth:" + str(run.get("jobId")),
                             f"🚨 Authentication blocked {run.get('jobName','automation')}; human intervention may be required."))
        if kind == "provider limit":
            provider_errors[run.get("provider") or "unknown"].add(run.get("jobId"))
    if len(provider_errors) >= 2:
        findings.append(("all-providers", "🚨 Multiple model providers hit limits; inspect worker availability now."))
    with db_open() as db:
        output = []
        for key, message in findings:
            row = db.execute("SELECT first_seen_ms,last_seen_ms,delivered_ms FROM alerts WHERE key=?", (key,)).fetchone()
            if not row:
                db.execute("INSERT INTO alerts(key,first_seen_ms,last_seen_ms) VALUES (?,?,?)", (key, now_ms, now_ms))
                continue  # second observation confirms persistent critical state
            if row["last_seen_ms"] < now_ms - 1_200_000:
                db.execute("UPDATE alerts SET first_seen_ms=?,last_seen_ms=?,delivered_ms=NULL WHERE key=?", (now_ms, now_ms, key))
                continue
            if now_ms - row["first_seen_ms"] >= 240_000 and (row["delivered_ms"] is None or
                    now_ms - row["delivered_ms"] >= 1_800_000):
                output.append(message)
                db.execute("UPDATE alerts SET delivered_ms=? WHERE key=?", (now_ms, key))
            else:
                db.execute("UPDATE alerts SET last_seen_ms=? WHERE key=?", (now_ms, key))
        for row in db.execute("SELECT key FROM alerts"):
            if row["key"] not in {key for key, _ in findings}:
                db.execute("DELETE FROM alerts WHERE key=?", (row["key"],))
        db.commit()
    print("\n".join(output))


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("report")
    sub.add_parser("preview")
    sub.add_parser("daily")
    sub.add_parser("critical")
    sub.add_parser("channels")
    hb = sub.add_parser("heartbeat")
    hb.add_argument("id")
    hb.add_argument("--channel", default="")
    hb.add_argument("--status", choices=sorted(VALID_STATUS), required=True)
    for name in ("task", "product", "did", "completed", "changed", "tests", "result", "blocker", "next", "model"):
        hb.add_argument("--" + name, default="")
    ch = sub.add_parser("channel")
    ch.add_argument("id")
    mode = ch.add_mutually_exclusive_group(required=True)
    mode.add_argument("--enable", action="store_true")
    mode.add_argument("--disable", action="store_true")
    args = parser.parse_args()
    if args.cmd in ("report", "preview"):
        try:
            run_report(args.cmd == "preview")
        except Exception as exc:
            try:
                with db_open() as db:
                    db.execute("INSERT INTO failures(at_ms,kind) VALUES (?,?)",
                               (int(time.time() * 1000), type(exc).__name__))
            except (OSError, sqlite3.Error):
                pass
            print(f"Supervisor collection failed: {type(exc).__name__}", file=sys.stderr)
            raise SystemExit(1) from None
    elif args.cmd == "heartbeat":
        heartbeat(args)
    elif args.cmd == "daily":
        daily()
    elif args.cmd == "critical":
        critical()
    elif args.cmd == "channels":
        with db_open() as db:
            for row in db.execute("SELECT * FROM channels ORDER BY id"):
                print(f"{label(row['id'])} ({row['id']}) agent={row['agent_id']} "
                      f"enabled={bool(row['reporting_enabled'])} last={row['last_activity_ms']}")
    elif args.cmd == "channel":
        with db_open() as db:
            db.execute("INSERT INTO channels(id,reporting_enabled) VALUES (?,?) "
                       "ON CONFLICT(id) DO UPDATE SET reporting_enabled=excluded.reporting_enabled",
                       (args.id, int(args.enable)))
            db.commit()
        print(f"{label(args.id)} reporting {'enabled' if args.enable else 'disabled'}")


if __name__ == "__main__":
    main()
