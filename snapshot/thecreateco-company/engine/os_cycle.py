#!/usr/bin/env python3
"""Deterministic company OS dashboard, tick and daily summary. No models or posts."""
from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import tempfile
import urllib.request
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SUPERVISOR_ROOT = Path("/Users/agentsattari/operations-supervisor")
CONTACT_RE = re.compile(r"(?i)(?:[\w.+-]+@[\w.-]+\.[A-Z]{2,}|\b(?:lead|contact|outreach|email)\b)")
FLAGSHIPS = {"scenepilot": "ScenePilot", "luma": "Luma", "form": "Form", "stemdeck": "StemDeck"}


def utcnow():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def _json(path, default=None):
    try:
        return json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError):
        return default


def _context(root):
    """Prefer authoritative persisted context; seed JSON is initialization-only."""
    db_path = Path(root) / "engine/company.sqlite3"
    if db_path.is_file():
        try:
            uri = db_path.resolve().as_uri() + "?mode=ro"
            with sqlite3.connect(uri, uri=True, timeout=2) as db:
                db.execute("PRAGMA query_only=ON")
                if "metadata" in {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'") }:
                    row = db.execute("SELECT value FROM metadata WHERE key='context'").fetchone()
                    if row:
                        value = json.loads(row[0])
                        return value if isinstance(value, dict) else {}
        except (OSError, sqlite3.Error, json.JSONDecodeError):
            pass
    return _json(Path(root) / "data/context.json", {}) or {}


def _atomic(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix=".os-cycle-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def paused(root=ROOT):
    root = Path(root)
    return (root / "PAUSE").exists() or (root / "core-product-lab/PAUSE").exists()


@contextlib.contextmanager
def single_run(root=ROOT):
    lock_path = Path(root) / "engine/.os_cycle.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            yield False
            return
        try:
            yield True
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def _supervisor_status():
    """Read only aggregate heartbeat/report freshness; never surface task text."""
    path = SUPERVISOR_ROOT / "data/supervisor.sqlite3"
    result = {"status": "unavailable", "source": str(path), "observed_at": None, "heartbeat_counts": {}}
    if not path.is_file():
        return result
    try:
        uri = path.resolve().as_uri() + "?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=2) as db:
            db.execute("PRAGMA query_only=ON")
            tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if "heartbeats" in tables:
                result["heartbeat_counts"] = dict(db.execute("SELECT status,COUNT(*) FROM heartbeats GROUP BY status"))
            if "reports" in tables:
                row = db.execute("SELECT at_ms FROM reports ORDER BY at_ms DESC LIMIT 1").fetchone()
                if row and row[0]:
                    result["observed_at"] = dt.datetime.fromtimestamp(row[0] / 1000, dt.timezone.utc).isoformat()
            result["status"] = "available" if result["observed_at"] or result["heartbeat_counts"] else "unknown"
    except (OSError, sqlite3.Error):
        result["status"] = "unavailable"
    return result


def _website_probes():
    """Probe only configured critical URLs with bounded, body-free GET requests."""
    config = _json(SUPERVISOR_ROOT / "config.json", {}) or {}
    urls = config.get("critical_urls", []) if isinstance(config, dict) else []
    checked = utcnow()
    probes = []
    for url in urls[:5]:
        if not isinstance(url, str) or urlsplit(url).scheme != "https":
            continue
        row = {"url": url, "checked_at": checked, "http_status": None, "status": "unknown"}
        try:
            req = urllib.request.Request(url, method="GET", headers={"User-Agent": "thecreateco-os-cycle/1.0"})
            with urllib.request.urlopen(req, timeout=8) as response:
                row.update(http_status=response.status, status="ok" if response.status < 500 else "error")
        except Exception as exc:  # availability data, not a failed OS cycle
            row.update(status="unavailable", error=type(exc).__name__)
        probes.append(row)
    return {"observed_at": checked, "probes": probes, "source": "configured supervisor critical_urls"}


def _product_rows(products, health_text=""):
    found = {}
    for p in products:
        if not isinstance(p, dict):
            continue
        slug = p.get("product_id")
        if slug in FLAGSHIPS and slug not in found:
            found[slug] = {
                "name": FLAGSHIPS[slug], "product_id": slug,
                "maturity": p.get("maturity"), "release_readiness": p.get("release_readiness"),
                "quality_score": p.get("quality_score"), "quality_scores": p.get("quality_scores"),
                "golden_workflow_status": p.get("golden_workflow_status"), "health_status": p.get("health_status"),
                "observed_at": p.get("observed_at"), "next_milestone": p.get("next_milestone"),
                "verification_level": p.get("verification_level"),
            }
    # HEALTH.md is the fallback if a generated product record is missing a flagship.
    sections = {}
    for section in re.split(r"(?m)^##\s+", health_text):
        head = section.splitlines()[0].strip().lower() if section.strip() else ""
        if head in FLAGSHIPS:
            sections[head] = section
    for slug, display in FLAGSHIPS.items():
        section = sections.get(slug, "")
        readiness = re.search(r"(?m)^- Readiness:\s*(.+)$", section)
        score = re.search(r"(?m)^- Quality score:\s*(.+)$", section)
        golden = re.search(r"(?m)^- Golden workflow:\s*(.+)$", section)
        fallback = {"maturity": None,
                    "release_readiness": readiness.group(1).strip() if readiness else None,
                    "quality_score": None, "quality_scores": None, "observed_at": None,
                    "golden_workflow_status": golden.group(1).strip() if golden else None,
                    "health_status": None}
        if slug not in found:
            found[slug] = {"name": display, **fallback}
        else:
            for field, value in fallback.items():
                if found[slug].get(field) is None and value is not None:
                    found[slug][field] = value
    return [found.get(k, {"name": v, "maturity": None, "release_readiness": None,
                          "quality_score": None, "quality_scores": None, "observed_at": None,
                          "golden_workflow_status": None, "health_status": None,
                          "next_milestone": None, "verification_level": None}) for k, v in FLAGSHIPS.items()]


def _company_engine(root=ROOT):
    # Reuse the queue's canonical severity/dependency/product exclusivity rules.
    import importlib.util
    spec = importlib.util.spec_from_file_location("company_os_cycle_engine", Path(__file__).with_name("company.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _eligible(tasks, products=None, root=ROOT):
    return _company_engine(root).eligible_tasks(tasks, products)


def _task_summary(task):
    if not task:
        return None
    private_workstream = str(task.get("workstream") or "").upper() in ("GROWTH", "MARKETING")
    title = str(task.get("title") or "")
    if private_workstream or CONTACT_RE.search(title):
        title = "[department task omitted]"
    next_action = task.get("next_action")
    if next_action and CONTACT_RE.search(str(next_action)):
        next_action = None
    return {"task_id": task.get("task_id"), "title": title, "product": task.get("product"),
            "severity": task.get("severity"), "next_action": next_action, "priority": task.get("priority")}


def _safe_marketing(context, root):
    path = context.get("marketing_db") if isinstance(context, dict) else None
    try:
        summary = _company_engine(root).marketing_summary(path, root)
        outcomes = {key: {"recorded_values": value.get("recorded_values"),
                          "sum_of_recorded_values": value.get("sum_of_recorded_values")}
                    for key, value in (summary.get("outcomes") or {}).items() if isinstance(value, dict)}
        return {"status": summary.get("status"), "queue_statuses": summary.get("queue_statuses", {}),
                "campaign_statuses": summary.get("campaign_statuses", {}), "outcomes": outcomes,
                "outcome_period": summary.get("outcome_period")}
    except Exception as exc:
        return {"status": "unavailable", "error": type(exc).__name__}


def _astra_cycles(root):
    source = _json(Path(root) / "data/astra-cycles.json", None)
    if not isinstance(source, dict) or not isinstance(source.get("cycles"), list):
        return {"status": "unknown", "cycles": []}
    allowed = ("cycle_id", "model", "mode", "reason", "selected_idea", "selected_by", "downstream_task_ids",
               "implementation_status", "input_tokens", "output_tokens", "cost", "usage_coverage",
               "value_created", "result", "wow_review_used")
    cycles = [{k: cycle.get(k) for k in allowed} for cycle in source["cycles"] if isinstance(cycle, dict)]
    return {"status": "available", "cycles": cycles, "source": "data/astra-cycles.json"}


def build_dashboard(root=ROOT, *, now=None, website=None, supervisor=None, cost_snapshot=None):
    root, now = Path(root), now or utcnow()
    queue = _json(root / "TASK_QUEUE.json", {}) or {}
    portfolio = _json(root / "PRODUCT_REGISTRY.json", {}) or {}
    products = portfolio.get("products", []) if isinstance(portfolio, dict) else []
    tasks = queue.get("tasks", []) if isinstance(queue, dict) else []
    context = _context(root)
    health = (root / "core-product-lab/HEALTH.md").read_text() if (root / "core-product-lab/HEALTH.md").is_file() else ""
    counts = {}
    for task in tasks:
        if isinstance(task, dict):
            status = task.get("status") or "UNKNOWN"
            counts[status] = counts.get(status, 0) + 1
    available = _eligible(tasks, products, root)
    next_task = next(iter(available), None)
    metrics = context.get("metrics", {}) if isinstance(context, dict) else {}
    revenue = metrics.get("revenue", {"value": None, "source": None, "period": None, "observed_at": None})
    cost = cost_snapshot if cost_snapshot is not None else _json(root / "data/cost-snapshot.json", {"status": "unavailable"})
    payload = {
        "generated_at": now,
        "company_health": context.get("health", {"score": None, "reason": "No evidence-complete rubric"}),
        "products": _product_rows(products, health),
        "queue": {"counts_by_status": counts, "active_count": counts.get("RUNNING", 0),
                  "blocked_count": counts.get("BLOCKED", 0), "next_task": _task_summary(next_task)},
        "bottleneck": {"value": context.get("biggest_bottleneck"), "observed_at": context.get("observed_at"),
                       "source": context.get("evidence_sources")},
        "revenue": revenue,
        "website": website if website is not None else {"status": "not_checked", "observed_at": None, "probes": []},
        "supervisor": supervisor if supervisor is not None else _supervisor_status(),
        "cost_snapshot": cost,
        "astra": {"telemetry": cost.get("astra") if isinstance(cost, dict) else None,
                  "deliberate_cycles": _astra_cycles(root)},
        "marketing": _safe_marketing(context, root),
        "experiments": {"status": "unknown", "source": None,
                        "reason": "No measured experiment result record is present in company state."},
        "sources": {"task_queue_generated_at": queue.get("generated_at"),
                    "product_registry_generated_at": portfolio.get("generated_at"),
                    "product_health_updated": re.search(r"(?m)^Updated:\s*(.+)$", health).group(1)
                        if re.search(r"(?m)^Updated:\s*(.+)$", health) else None},
    }
    return payload


def dashboard_markdown(payload):
    def safe(value):
        text = "unknown" if value is None else str(value)
        return CONTACT_RE.sub("[redacted]", text).replace("\n", " ")
    lines = ["# Company OS dashboard", "", f"Generated: {safe(payload.get('generated_at'))}", "",
             f"Health: {safe((payload.get('company_health') or {}).get('score'))} (not inferred)",
             f"Bottleneck: {safe((payload.get('bottleneck') or {}).get('value'))}",
             f"Queue: {safe((payload.get('queue') or {}).get('active_count'))} active; "
             f"{safe((payload.get('queue') or {}).get('blocked_count'))} blocked",
             f"Next milestone: {safe(((payload.get('queue') or {}).get('next_task') or {}).get('title'))}",
             f"Revenue evidence: {safe((payload.get('revenue') or {}).get('value'))}; "
             f"source={safe((payload.get('revenue') or {}).get('source'))}; "
             f"period={safe((payload.get('revenue') or {}).get('period'))}", "", "## Flagships", ""]
    for product in payload.get("products", []):
        lines.append(f"- **{safe(product.get('name'))}:** {safe(product.get('release_readiness'))}; "
                     f"maturity={safe(product.get('maturity'))}; score={safe(product.get('quality_score'))}; "
                     f"golden={safe(product.get('golden_workflow_status'))}; "
                     f"next={safe(product.get('next_milestone'))}")
    website = payload.get("website") or {}
    cost = payload.get("cost_snapshot") if isinstance(payload.get("cost_snapshot"), dict) else {}
    daily = cost.get("daily") if isinstance(cost.get("daily"), dict) else {}
    coverage = f"{safe(daily.get('list_estimated_usd_known_rows'))}/{safe(daily.get('ledger_rows'))} rows" \
        if daily.get("ledger_rows") is not None else "unknown"
    lines += ["", "## Operations and evidence", "",
              f"Cost snapshot: observed={safe(cost.get('observed_at'))}; daily list estimate="
              f"{safe(daily.get('list_estimated_usd'))}; billed={safe(daily.get('billed_usd'))}; "
              f"list-estimate coverage={coverage}; basis={safe(cost.get('totals_basis'))}"]
    supervisor = payload.get("supervisor") or {}
    lines.append(f"Supervisor: {safe(supervisor.get('status'))}; latest report={safe(supervisor.get('observed_at'))}; "
                 f"aggregate heartbeat counts={safe(supervisor.get('heartbeat_counts'))}")
    marketing = payload.get("marketing") or {}
    lines.append(f"Marketing: {safe(marketing.get('status'))}; recorded outcome aggregates="
                 f"{safe(marketing.get('outcomes'))}; outcome period={safe(marketing.get('outcome_period'))}")
    astra = payload.get("astra") or {}
    telemetry_astra = astra.get("telemetry") if isinstance(astra, dict) else None
    lines.append(f"Astra historical telemetry: {safe(telemetry_astra)}")
    deliberate = (astra.get("deliberate_cycles") or {}).get("cycles", []) if isinstance(astra, dict) else []
    lines.append("Deliberate Astra cycles: " + ("; ".join(
        f"{safe(c.get('cycle_id'))} selected {safe(c.get('selected_idea'))} ({safe(c.get('implementation_status'))}); "
        f"usage/cost/value={safe(c.get('input_tokens'))}/{safe(c.get('output_tokens'))}/{safe(c.get('cost'))}/{safe(c.get('value_created'))}"
        for c in deliberate) or "unknown / no cycle record"))
    experiments = payload.get("experiments") or {}
    lines.append(f"Experiments: {safe(experiments.get('status'))}; {safe(experiments.get('reason'))}")
    lines += ["", f"Website probes: {safe(website.get('observed_at'))} — " +
              (", ".join(f"{safe(x.get('url'))}: {safe(x.get('status'))}/{safe(x.get('http_status'))}"
                         for x in website.get("probes", [])) or "none recorded"), ""]
    return "\n".join(lines)


def write_dashboard(root=ROOT, payload=None):
    root = Path(root)
    payload = payload or build_dashboard(root)
    _atomic(root / "OS_DASHBOARD.json", json.dumps(payload, indent=2, ensure_ascii=False, allow_nan=False) + "\n")
    _atomic(root / "OS_DASHBOARD.md", dashboard_markdown(payload))
    return payload


def _run(command, *, root, timeout=120):
    try:
        return subprocess.run(command, cwd=root, capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.SubprocessError) as exc:
        return subprocess.CompletedProcess(command, 127, "", type(exc).__name__)


def tick(root=ROOT, *, runner=None, website_probe=None, telemetry=True):
    root = Path(root)
    if paused(root):
        return {"status": "paused", "reason": "company or Core Product Lab PAUSE exists"}
    with single_run(root) as acquired:
        if not acquired:
            return {"status": "overlap_skipped", "reason": "another OS tick holds the cycle lock"}
        if paused(root):
            return {"status": "paused", "reason": "company or Core Product Lab PAUSE exists"}
        run = runner or _run
        py = sys.executable
        engine = root / "engine/company.py"
        steps = []
        for name in ("recover", "refresh"):
            result = run([py, str(engine), "--root", str(root), name], root=root)
            steps.append({"step": "company_" + name, "ok": result.returncode == 0})
            if result.returncode:
                return {"status": "failed", "steps": steps, "error": "company engine " + name + " failed"}
        telemetry_ok = False
        if telemetry:
            collector = root / "engine/telemetry.py"
            result = run([py, str(collector), "--root", str(root), "collect"], root=root, timeout=120)
            telemetry_ok = result.returncode == 0
            steps.append({"step": "telemetry_collect", "ok": result.returncode == 0,
                          **({"unavailable": "collector returned nonzero"} if result.returncode else {})})
            if telemetry_ok:
                anomalies = root / "engine/anomalies.py"
                result = run([py, str(anomalies)], root=root, timeout=30)
                steps.append({"step": "anomaly_sync", "ok": result.returncode == 0,
                              **({"error": "anomaly sync returned nonzero"} if result.returncode else {})})
        lab = root / "core-product-lab/lab.py"
        result = run([py, str(lab), "refresh"], root=root)
        steps.append({"step": "lab_refresh", "ok": result.returncode == 0})
        if result.returncode:
            return {"status": "partial", "steps": steps, "error": "Core Product Lab refresh failed"}
        website = (website_probe or _website_probes)()
        payload = write_dashboard(root, build_dashboard(root, website=website))
        failed_steps = [step["step"] for step in steps if not step["ok"]]
        return {"status": "partial" if failed_steps else "complete", "steps": steps,
                "failed_steps": failed_steps, "dashboard_at": payload["generated_at"]}


def _recent_tasks(tasks, now=None, hours=24):
    now = now or dt.datetime.now(dt.timezone.utc)
    cutoff = now - dt.timedelta(hours=hours)
    rows = []
    for task in tasks:
        if not isinstance(task, dict) or task.get("status") != "COMPLETE":
            continue
        stamp = task.get("completed_at")
        try:
            parsed = dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            if parsed.tzinfo is None or parsed < cutoff:
                continue
        except (ValueError, AttributeError):
            continue
        rows.append(task)
    return rows


def daily_summary(root=ROOT, *, now=None):
    root = Path(root)
    now = now or dt.datetime.now(dt.timezone.utc)
    queue = _json(root / "TASK_QUEUE.json", {}) or {}
    context = _context(root)
    dashboard = _json(root / "OS_DASHBOARD.json", {}) or build_dashboard(root)
    tasks = queue.get("tasks", []) if isinstance(queue, dict) else []
    completed = _recent_tasks(tasks, now)
    # Exclude growth/contact work from per-task titles; report only its aggregate counts.
    safe_completed = [t for t in completed if str(t.get("workstream", "")).upper() not in ("GROWTH", "MARKETING")
                      and not CONTACT_RE.search(str(t.get("title", "")))]
    lines = ["thecreateco daily CEO summary", f"As of {now.replace(microsecond=0).isoformat()}",
             f"Completed company tasks (24h): {len(completed)}; safe to name: {len(safe_completed)}."]
    if safe_completed:
        lines.append("Evidence-linked completions: " + "; ".join(
            f"{t.get('task_id')}: {CONTACT_RE.sub('[redacted]', str(t.get('title') or 'completed work'))}"
            + (" — " + CONTACT_RE.sub("[redacted]", str(t.get("result")))[:180]
               if t.get("result") and not CONTACT_RE.search(str(t.get("result"))) else "")
            for t in safe_completed[:4]))
    else:
        lines.append("No named evidence-linked company completion in the last 24h.")
    counts = (dashboard.get("queue") or {}).get("counts_by_status", {})
    lines.append(f"Queue: {counts.get('RUNNING', 0)} active, {counts.get('BLOCKED', 0)} blocked, "
                 f"{counts.get('QUEUED', 0)} queued, {counts.get('NEEDS_REVIEW', 0)} needs review.")
    lines.append("Next milestone: " + str((((dashboard.get("queue") or {}).get("next_task") or {}).get("title")) or "unknown"))
    metrics = context.get("metrics", {}) if isinstance(context, dict) else {}
    for key in ("revenue", "visitors", "signups", "active_users", "retention", "operating_cost"):
        metric = metrics.get(key, {}) if isinstance(metrics, dict) else {}
        if isinstance(metric, dict):
            value = metric.get("value")
            rendered = "unknown" if value is None else str(value)
            evidence = "; ".join(str(metric.get(k)) for k in ("source", "period", "observed_at") if metric.get(k))
            lines.append(f"{key}: {rendered}" + (f" (source/period/observed: {evidence})" if evidence else " (no evidence recorded)"))
    cost = dashboard.get("cost_snapshot")
    if isinstance(cost, dict):
        daily_cost = cost.get("daily", {}) if isinstance(cost.get("daily"), dict) else {}
        list_cost = daily_cost.get("list_estimated_usd")
        billed = daily_cost.get("billed_usd")
        lines.append("AI cost snapshot: " + (f"list estimate {list_cost}" if list_cost is not None else "list estimate unknown") +
                     (f"; billed {billed}" if billed is not None else "; billed unknown") +
                     f"; observed {cost.get('observed_at') or 'unknown'}")
        astra = dashboard.get("astra")
        if isinstance(astra, dict):
            hist = astra.get("telemetry") or {}
            lines.append(f"Historical Astra telemetry rows: {hist.get('ledger_rows', 'unknown')}; "
                         f"value outcomes recorded: {hist.get('outcomes_recorded', 'unknown')}; "
                         f"unknown: {hist.get('outcomes_unknown', 'unknown')}.")
            cycles = (astra.get("deliberate_cycles") or {}).get("cycles", [])
            for cycle in cycles[:2]:
                lines.append(f"Deliberate Astra cycle {cycle.get('cycle_id', 'unknown')}: "
                             f"selected={cycle.get('selected_idea', 'unknown')}; "
                             f"status={cycle.get('implementation_status', 'unknown')}; "
                             f"usage/cost/value={cycle.get('input_tokens', 'unknown')}/"
                             f"{cycle.get('output_tokens', 'unknown')}/{cycle.get('cost', 'unknown')}/"
                             f"{cycle.get('value_created', 'unknown')}.")
    else:
        lines.append("AI cost snapshot unavailable; no spend inferred.")
    supervisor = dashboard.get("supervisor", {})
    lines.append(f"Supervisor aggregate status: {supervisor.get('status', 'unknown')}; "
                 f"latest report {supervisor.get('observed_at') or 'unknown'}.")
    website = dashboard.get("website", {})
    lines.append(f"Website audit freshness: {website.get('observed_at') or 'unknown'}; "
                 f"probe source={website.get('source') or 'unknown'}.")
    lines.append("Health scores remain unknown unless backed by the dated rubric in the dashboard.")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("tick")
    sub.add_parser("dashboard")
    sub.add_parser("daily")
    args = parser.parse_args(argv)
    if args.command == "tick":
        result = tick(args.root)
        print(json.dumps(result, indent=2))
        if result.get("status") in ("partial", "failed"):
            return 1
    elif args.command == "dashboard":
        print(json.dumps(write_dashboard(args.root), indent=2, ensure_ascii=False))
    else:
        print(daily_summary(args.root))


if __name__ == "__main__":
    raise SystemExit(main())
