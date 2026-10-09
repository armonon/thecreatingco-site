#!/usr/bin/env python3
"""Bounded no-model receipt collector, idempotent ledger and advisory governor.

Only allowlisted usage fields survive ingestion. Scheduled receipts are not
per-call traces. Marketing reads safe model_calls columns, never contacts/messages.
"""
from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import tempfile
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ("source", "scope", "at", "agent", "product", "task", "model", "provider",
          "reasoning", "input_tokens", "cached_tokens", "cache_read_tokens", "cache_write_tokens", "output_tokens", "total_tokens", "token_accounting",
          "tokens_estimated", "list_estimated_usd", "estimate_basis", "billed_usd", "latency_ms", "success",
          "records", "failures", "escalation_reason", "value_classification", "value_evidence")
IDENTIFIER = re.compile(r"^[A-Za-z0-9_.:/-]{1,160}$")


def identifier(value):
    return value if isinstance(value, str) and IDENTIFIER.fullmatch(value) else None


def number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0 else None


def first(*values):
    return next((v for v in values if v is not None), None)


def utcnow():
    return dt.datetime.now(dt.timezone.utc)


def timestamp(value):
    try:
        if isinstance(value, (int, float)):
            return dt.datetime.fromtimestamp(value / 1000, dt.timezone.utc).isoformat()
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return None
        return parsed.astimezone(dt.timezone.utc).isoformat()
    except (ValueError, TypeError, OverflowError, OSError, AttributeError):
        return None


def stable_id(source, key):
    return source + ":" + hashlib.sha256(json.dumps(key, sort_keys=True).encode()).hexdigest()[:32]


@contextlib.contextmanager
def ledger(root=ROOT):
    path = Path(root) / "engine/telemetry.sqlite3"
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=30)
    db.row_factory = sqlite3.Row
    db.executescript("""
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, at TEXT NOT NULL,
        source TEXT NOT NULL, body TEXT NOT NULL, observed_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS receipts_at ON receipts(at);
      CREATE TABLE IF NOT EXISTS observations(source TEXT PRIMARY KEY, at TEXT NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS value_records(id INTEGER PRIMARY KEY, receipt_id TEXT NOT NULL,
        at TEXT NOT NULL, classification TEXT NOT NULL, evidence TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS value_receipt ON value_records(receipt_id,id);
    """)
    try:
        with db:
            yield db
    finally:
        db.close()


def policy(root=ROOT):
    data = json.loads((Path(root) / "data/cost-policy.json").read_text())
    ZoneInfo(data["timezone"])
    if data.get("mode") not in ("normal", "economy"):
        raise ValueError("invalid governor mode")
    for rule in data.get("budgets", []):
        if rule.get("window") not in ("day", "week") or rule.get("scope") not in ("all", "agent", "product", "task", "astra"):
            raise ValueError("invalid budget window/scope")
        if rule.get("metric") not in ("list_estimated_usd", "billed_usd", "total_tokens", "records"):
            raise ValueError("invalid budget metric")
        if rule.get("limit") is not None and number(rule["limit"]) is None:
            raise ValueError("budget limit must be nonnegative or null")
    return data


def put(db, receipt):
    if not receipt.get("id") or not receipt.get("at"):
        return False
    body = {key: receipt.get(key) for key in FIELDS}
    # Keep separately recorded outcomes when a source is refreshed.
    db.execute("INSERT INTO receipts VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET "
               "at=excluded.at,body=excluded.body,observed_at=excluded.observed_at",
               (receipt["id"], receipt["at"], receipt["source"], json.dumps(body), utcnow().isoformat()))
    return True


def normalize_run(run, jobs=None):
    usage = run.get("usage") if isinstance(run.get("usage"), dict) else {}
    at = timestamp(run.get("runAtMs"))
    job = (jobs or {}).get(run.get("jobId"), {})
    cache = usage.get("input_tokens_details") if isinstance(usage.get("input_tokens_details"), dict) else {}
    inp = number(first(usage.get("input_tokens"), usage.get("inputTokens")))
    out = number(first(usage.get("output_tokens"), usage.get("outputTokens")))
    total = number(first(usage.get("total_tokens"), usage.get("totalTokens")))
    accounting = "source_reported_total" if total is not None else None
    cache_read = number(usage.get("cache_read_tokens"))
    cache_write = number(usage.get("cache_write_tokens"))
    if total is None and inp is not None and out is not None and cache_read is None and cache_write is None:
        total = inp + out
        accounting = "derived_input_plus_output"
    result = dict.fromkeys(FIELDS)
    result.update(source="openclaw_cron", scope="scheduled_run", at=at,
                  agent=identifier(first(run.get("agentId"), job.get("agentId"))),
                  task=identifier(run.get("taskId")), product=identifier(run.get("productId")),
                  model=identifier(run.get("model")), provider=identifier(run.get("provider")),
                  reasoning=identifier(first(run.get("reasoning"), run.get("reasoningEffort"))), input_tokens=inp, output_tokens=out,
                  cached_tokens=number(first(usage.get("cached_tokens"), cache.get("cached_tokens"), cache_read)),
                  cache_read_tokens=cache_read, cache_write_tokens=cache_write,
                  total_tokens=total, token_accounting=accounting, list_estimated_usd=number(usage.get("list_estimated_usd")),
                  billed_usd=number(usage.get("billed_usd")), latency_ms=number(run.get("durationMs")),
                  success=True if run.get("status") == "ok" else False if run.get("status") == "error" else None,
                  records=1, failures=1 if run.get("status") == "error" else 0,
                  escalation_reason=identifier(run.get("escalationReasonCode")))
    result["id"] = stable_id("cron", [run.get("jobId"), run.get("runId") or at])
    return result


def cli_json(args):
    try:
        done = subprocess.run(["openclaw", *args], text=True, capture_output=True, timeout=35, check=True)
        result = json.loads(done.stdout)
        return result if isinstance(result, dict) else {"unavailable": "invalid_shape"}
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
        return {"unavailable": type(exc).__name__}


def collect_cron(db, cfg):
    settings = cfg.get("collection", {})
    size = min(200, max(1, int(settings.get("cron_page_size", 200))))
    pages = min(20, max(1, int(settings.get("cron_max_pages", 10))))
    job_data = cli_json(["cron", "list", "--json"])
    jobs = {j.get("id"): {"agentId": j.get("agentId")} for j in job_data.get("jobs", [])}
    observed, stored, truncated, error = 0, 0, False, None
    for page in range(pages):
        result = cli_json(["cron", "runs", "--all", "--sort", "desc", "--limit", str(size), "--offset", str(page * size), "--json"])
        if result.get("unavailable"):
            error = result["unavailable"]
            break
        entries = result.get("entries", [])
        observed += len(entries)
        for run in entries:
            # Exec-only receipts have no model usage, so are not AI calls.
            if run.get("model") or isinstance(run.get("usage"), dict):
                stored += int(put(db, normalize_run(run, jobs)))
        truncated = bool(result.get("hasMore"))
        if not truncated or not entries:
            break
    return {"status": "unavailable" if error else "partial" if truncated else "available",
            "observed_receipts": observed, "upserted_model_receipts": stored,
            "truncated": truncated, "error": error, "agent_mapping_available": not job_data.get("unavailable"),
            "granularity": "scheduled_run_not_per_call"}


def collect_marketing(db, path, cfg, now):
    if not Path(path).is_file():
        return {"status": "unavailable", "error": "database_missing"}
    days = min(366, max(1, int(cfg.get("collection", {}).get("marketing_days", 35))))
    local = now.astimezone(ZoneInfo(cfg["timezone"]))
    start = (local - dt.timedelta(days=days)).date().isoformat()
    end = local.date().isoformat()
    try:
        with contextlib.closing(sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True, timeout=3)) as src:
            src.row_factory = sqlite3.Row
            src.execute("PRAGMA query_only=ON")
            rows = src.execute("""SELECT id, ts, day, model, provider, task_id, reasoning,
                ok, input_tokens, output_tokens, cached_tokens, est_cost, latency_ms, tokens_estimated
                FROM model_calls WHERE day BETWEEN ? AND ? ORDER BY id DESC LIMIT 10001""", (start, end)).fetchall()
        count = 0
        for row in rows[:10000]:
            receipt = dict.fromkeys(FIELDS)
            receipt.update(source="marketing_calls", scope="per_call", at=timestamp(row["ts"]),
                           agent="marketing", task=identifier(row["task_id"]), model=identifier(row["model"]),
                           provider=identifier(row["provider"]), reasoning=identifier(row["reasoning"]))
            for field in ("input_tokens", "output_tokens", "cached_tokens", "latency_ms"):
                receipt[field] = number(row[field])
            receipt["records"] = 1
            receipt["success"] = True if row["ok"] == 1 else False if row["ok"] == 0 else None
            receipt["failures"] = 1 if row["ok"] == 0 else 0 if row["ok"] == 1 else None
            receipt["tokens_estimated"] = bool(row["tokens_estimated"]) if row["tokens_estimated"] is not None else None
            cost = number(row["est_cost"])
            # Legacy price() returned zero for unknown model prices and failed
            # requests. Never count that sentinel as measured zero spend.
            zero_proven = (receipt["success"] is True and receipt["tokens_estimated"] is False and
                           all(receipt[k] == 0 for k in ("input_tokens", "output_tokens", "cached_tokens")))
            receipt["list_estimated_usd"] = None if cost == 0 and not zero_proven else cost
            receipt["estimate_basis"] = ("observed_zero_tokens" if cost == 0 and zero_proven else
                                         "ambiguous_source_zero" if cost == 0 else
                                         "source_reported_estimate" if cost is not None else "unavailable")
            if receipt["input_tokens"] is not None and receipt["output_tokens"] is not None:
                receipt["total_tokens"] = receipt["input_tokens"] + receipt["output_tokens"]
                receipt["token_accounting"] = "derived_input_plus_output"
            receipt["id"] = stable_id("marketing", [str(Path(path).resolve()), row["id"]])
            count += int(put(db, receipt))
        return {"status": "partial" if len(rows) > 10000 else "available", "upserted_calls": count,
                "start": start, "end": end, "granularity": "per_call_allowlisted_columns",
                "invalid_timestamp_rows": len(rows[:10000]) - count,
                "cost_basis": "source_estimate_not_billed; ambiguous zero normalized to null unless successful non-estimated zero-token call"}
    except (OSError, sqlite3.Error, ValueError) as exc:
        return {"status": "unavailable", "error": type(exc).__name__}


def totals(rows):
    result = {"ledger_rows": len(rows)}
    for field in ("records", "failures", "input_tokens", "cached_tokens", "cache_read_tokens", "cache_write_tokens", "output_tokens", "total_tokens", "list_estimated_usd", "billed_usd"):
        known = [r[field] for r in rows if number(r.get(field)) is not None]
        result[field] = sum(known) if known else None
        result[field + "_known_rows"] = len(known)
    return result


def window_start(now, window, timezone):
    local = now.astimezone(ZoneInfo(timezone)).replace(hour=0, minute=0, second=0, microsecond=0)
    if window == "week":
        local -= dt.timedelta(days=local.weekday())
    return local.astimezone(dt.timezone.utc)


def is_astra(row):
    return "astra" in (row.get("model") or "").lower()


def budget_status(rows, cfg, now, task=None):
    checks = []
    for rule in cfg.get("budgets", []):
        scope, metric = rule["scope"], rule["metric"]
        recent = [r for r in rows if window_start(now, rule["window"], cfg["timezone"]) <= dt.datetime.fromisoformat(r["at"]) <= now]
        if scope == "astra":
            recent = [r for r in recent if is_astra(r)]
            groups = {"astra": recent}
        elif scope == "all":
            groups = {"all": recent}
        else:
            key = identifier((task or {}).get(scope)) or identifier(rule.get("key"))
            if task is not None:
                groups = {key: [r for r in recent if r.get(scope) == key]} if key else {"unknown": []}
            elif rule.get("key"):
                groups = {key: [r for r in recent if r.get(scope) == key]}
            else:
                groups = {key: [r for r in recent if r.get(scope) == key] for key in sorted({r[scope] for r in recent if r.get(scope)})}
        for key, scoped in groups.items():
            summary = totals(scoped)
            value, cap = summary[metric], rule.get("limit")
            exceeded = cap is not None and value is not None and value >= cap
            checks.append({"name": rule.get("name"), "scope": scope, "key": key, "window": rule["window"],
                           "metric": metric, "observed": value, "limit": cap, "exceeded": exceeded,
                           "coverage": "partial" if summary[metric + "_known_rows"] < len(scoped) or not scoped else "observed_rows_only"})
    return checks


def read_rows(db, since=None):
    cursor = db.execute("SELECT id,body FROM receipts WHERE at>=?", (since.isoformat(),)) if since else db.execute("SELECT id,body FROM receipts")
    rows = [{"id": r["id"], **json.loads(r["body"])} for r in cursor]
    values = db.execute("SELECT v.* FROM value_records v JOIN receipts r ON r.id=v.receipt_id WHERE r.at>=? ORDER BY v.id",
                        (since.isoformat() if since else "",))
    latest = {v["receipt_id"]: dict(v) for v in values}
    for row in rows:
        if row["id"] in latest:
            row["value_classification"] = latest[row["id"]]["classification"]
            row["value_evidence"] = latest[row["id"]]["evidence"]
    return rows


def build_snapshot(db, cfg, now):
    rows = read_rows(db, window_start(now, "week", cfg["timezone"]))
    day = [r for r in rows if window_start(now, "day", cfg["timezone"]) <= dt.datetime.fromisoformat(r["at"]) <= now]
    week = [r for r in rows if window_start(now, "week", cfg["timezone"]) <= dt.datetime.fromisoformat(r["at"]) <= now]
    sources = {r["source"]: {"observed_at": r["at"], **json.loads(r["body"])} for r in db.execute("SELECT * FROM observations")}
    astra = [r for r in week if is_astra(r)]
    anomalies = []
    if sum(r.get("failures") or 0 for r in day) >= cfg.get("anomalies", {}).get("failure_count", 3):
        anomalies.append({"kind": "repeated_failures", "count": sum(r.get("failures") or 0 for r in day)})
    missing_reason = [r for r in astra if not r.get("escalation_reason")]
    if missing_reason:
        anomalies.append({"kind": "astra_reason_not_exposed", "ledger_rows": len(missing_reason)})
    checks = budget_status(rows, cfg, now)
    anomalies.extend({"kind": "budget_exceeded", "name": c["name"], "scope": c["scope"],
                      "key": c["key"], "metric": c["metric"], "observed": c["observed"], "limit": c["limit"]}
                     for c in checks if c["exceeded"])
    economy = cfg.get("mode") == "economy" or any(c["exceeded"] for c in checks)
    return {"version": 1, "observed_at": now.isoformat(), "timezone": cfg["timezone"],
            "daily": totals(day), "weekly": totals(week), "sources": sources,
            "daily_by_source": {source: totals([r for r in day if r["source"] == source]) for source in sources},
            "weekly_by_source": {source: totals([r for r in week if r["source"] == source]) for source in sources},
            "totals_basis": "observed receipt sums; cross-source overlap is unreconciled, not company spend or billed totals",
            "governor": {"mode": "economy" if economy else "normal", "advisory_only": True, "budgets": checks},
            "anomalies": anomalies, "astra": {"ledger_rows": len(astra), "outcomes_recorded": sum(r.get("value_classification") is not None for r in astra),
                "outcomes_unknown": sum(r.get("value_classification") in (None, "unknown") for r in astra)},
            "coverage_gaps": ["interactive/native-child per-call usage not exposed by cron receipts",
                "scheduled receipt token counts may aggregate multiple model calls",
                "cache/input accounting differs by source; preserve explicit totals, do not subtract caches blindly",
                "scheduled latency is end-to-end run duration, not pure inference latency",
                "task/product/reasoning/escalation and billed cost often not exposed",
                "marketing tokens and cost can be source estimates, not reconciled billing",
                "visible receipts may overlap marketing calls; combined sums are not reconciled billing"]}


def atomic_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix=".cost-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as handle:
            json.dump(data, handle, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def compact_snapshot(root=ROOT):
    """Read-only cached snapshot for company/dashboard/supervisor consumers."""
    try:
        return json.loads((Path(root) / "data/cost-snapshot.json").read_text())
    except (OSError, json.JSONDecodeError):
        return {"observed_at": None, "status": "unavailable", "billed_usd": None}


def collect(root=ROOT, marketing=None, now=None):
    root, now = Path(root), now or utcnow()
    cfg = policy(root)
    with ledger(root) as db:
        sources = {"openclaw_cron": collect_cron(db, cfg), "marketing_calls": collect_marketing(db,
                   marketing or root.parent / "thecreateco-marketing/engine/data/mktg.db", cfg, now)}
        for source, info in sources.items():
            db.execute("INSERT INTO observations VALUES (?,?,?) ON CONFLICT(source) DO UPDATE SET at=excluded.at,body=excluded.body",
                       (source, now.isoformat(), json.dumps(info)))
        snapshot = build_snapshot(db, cfg, now)
    atomic_json(root / "data/cost-snapshot.json", snapshot)
    return snapshot


def preflight(root=ROOT, task=None, now=None):
    cfg, task, now = policy(root), dict(task or {}), now or utcnow()
    task["task"] = first(task.get("task"), task.get("task_id"))
    task["agent"] = first(task.get("agent"), task.get("owner"))
    # No collection, model call or queue mutation occurs in preflight.
    with ledger(root) as db:
        checks = budget_status(read_rows(db, window_start(now, "week", cfg["timezone"])), cfg, now, task)
    economy = cfg.get("mode") == "economy" or any(c["exceeded"] for c in checks)
    critical = task.get("critical") is True or task.get("severity") in ("P0", "P1")
    defer = economy and task.get("low_value") is True and not critical
    return {"decision": "defer_low_value" if defer else "continue", "advisory_only": True,
            "mode": "economy" if economy else "normal", "critical_override": critical,
            "budgets": checks, "astra_requested": is_astra(task),
            "astra_reason_recorded": bool(identifier(task.get("escalation_reason"))) if is_astra(task) else None,
            "next": "defer redundant scans/nice-to-have drafts; retain critical work" if economy else "prefer deterministic tools and smallest adequate authorized model"}


def record_value(root, receipt_id, classification, evidence):
    if classification not in ("positive", "neutral", "negative", "unknown"):
        raise ValueError("invalid value classification")
    path = Path(evidence)
    if path.is_absolute() or ".." in path.parts or not (Path(root) / path).is_file():
        raise ValueError("evidence must be an existing company-relative file")
    with ledger(root) as db:
        if not db.execute("SELECT 1 FROM receipts WHERE id=?", (receipt_id,)).fetchone():
            raise ValueError("unknown receipt id")
        db.execute("INSERT INTO value_records(receipt_id,at,classification,evidence) VALUES (?,?,?,?)",
                   (receipt_id, utcnow().isoformat(), classification, str(path)))
        snapshot = build_snapshot(db, policy(root), utcnow())
    atomic_json(Path(root) / "data/cost-snapshot.json", snapshot)
    return {"receipt_id": receipt_id, "classification": classification, "evidence": str(path)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    sub = parser.add_subparsers(dest="command", required=True)
    collector = sub.add_parser("collect")
    collector.add_argument("--marketing", type=Path)
    sub.add_parser("snapshot")
    flight = sub.add_parser("preflight")
    flight.add_argument("--task-file", type=Path)
    outcome = sub.add_parser("record-value")
    outcome.add_argument("receipt_id")
    outcome.add_argument("--classification", choices=("positive", "neutral", "negative", "unknown"), required=True)
    outcome.add_argument("--evidence", required=True)
    args = parser.parse_args()
    if args.command == "collect":
        result = collect(args.root, args.marketing)
    elif args.command == "snapshot":
        result = compact_snapshot(args.root)
    elif args.command == "preflight":
        result = preflight(args.root, json.loads(args.task_file.read_text()) if args.task_file else {})
    else:
        result = record_value(args.root, args.receipt_id, args.classification, args.evidence)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
